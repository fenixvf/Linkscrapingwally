/**
 * Shared link-checking logic used by both the HTTP routes and the scheduler.
 */
import { eq, asc } from "drizzle-orm";
import { db, videoLinksTable, backupLinksTable } from "@workspace/db";
import { checkVideoUrl } from "./linkChecker";
import { logger } from "./logger";

/**
 * Computes the new refreshedUrl to store after a check.
 *
 * Rules:
 *  - resolvedUrl found (from scraping or redirect) → always use it
 *  - link is active but no redirect found → clear refreshedUrl so /serve uses link.url
 *  - link is broken → preserve the existing refreshedUrl as a last-resort fallback
 */
export function computeRefreshedUrl(
  result: CheckResult,
  existingRefreshedUrl: string | null | undefined,
): string | null {
  if (result.resolvedUrl !== null) return result.resolvedUrl;
  if (result.status === "active") return null;
  return existingRefreshedUrl ?? null;
}

export interface CheckResult {
  status: "active" | "expired" | "unknown";
  resolvedUrl: string | null;
  activeBackupId: number | null;
}

/**
 * Checks the primary URL and falls back through backup links in priority order.
 * Does NOT write to the database.
 */
export async function checkWithFallback(
  linkId: number,
  primaryUrl: string,
  pageUrl: string | null | undefined,
): Promise<CheckResult> {
  // Try primary first
  const primary = await checkVideoUrl(primaryUrl, pageUrl);
  if (primary.status === "active") {
    return { status: "active", resolvedUrl: primary.resolvedUrl, activeBackupId: null };
  }

  // Primary failed — try backups in priority order
  const backups = await db
    .select()
    .from(backupLinksTable)
    .where(eq(backupLinksTable.videoLinkId, linkId))
    .orderBy(asc(backupLinksTable.priority), asc(backupLinksTable.createdAt));

  for (const backup of backups) {
    logger.info({ linkId, backupId: backup.id, url: backup.url }, "Trying backup link");
    const result = await checkVideoUrl(backup.url, null);

    await db
      .update(backupLinksTable)
      .set({ status: result.status, lastChecked: new Date() })
      .where(eq(backupLinksTable.id, backup.id));

    if (result.status === "active") {
      logger.info({ linkId, backupId: backup.id }, "Backup link is active — promoting");
      return {
        status: "active",
        resolvedUrl: result.resolvedUrl ?? backup.url,
        activeBackupId: backup.id,
      };
    }
  }

  return { status: primary.status, resolvedUrl: primary.resolvedUrl, activeBackupId: null };
}

/**
 * Checks a link and persists the result to the database.
 * Returns the updated status.
 */
export async function runLinkCheck(linkId: number): Promise<CheckResult> {
  const [link] = await db
    .select()
    .from(videoLinksTable)
    .where(eq(videoLinksTable.id, linkId));

  if (!link) throw new Error(`Link ${linkId} not found`);

  const result = await checkWithFallback(linkId, link.url, link.pageUrl);

  await db
    .update(videoLinksTable)
    .set({
      status: result.status,
      refreshedUrl: computeRefreshedUrl(result, link.refreshedUrl),
      activeBackupId: result.activeBackupId,
      lastChecked: new Date(),
    })
    .where(eq(videoLinksTable.id, linkId));

  return result;
}
