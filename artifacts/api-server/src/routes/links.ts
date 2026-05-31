import { Router, type IRouter } from "express";
import { eq, and, sql, asc } from "drizzle-orm";
import { db, videoLinksTable, foldersTable, backupLinksTable } from "@workspace/db";
import {
  ListLinksQueryParams,
  CreateLinkBody,
  GetLinkParams,
  UpdateLinkParams,
  UpdateLinkBody,
  DeleteLinkParams,
  CheckLinkParams,
  MoveLinkParams,
  MoveLinkBody,
  ListLinksResponseItem,
  GetLinkResponse,
  UpdateLinkResponse,
  CheckLinkResponse,
  MoveLinkResponse,
  CheckAllLinksResponse,
} from "@workspace/api-zod";
import { checkVideoUrl } from "../lib/linkChecker";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getLinkWithFolder(id: number) {
  const rows = await db
    .select({
      id: videoLinksTable.id,
      folderId: videoLinksTable.folderId,
      folderName: foldersTable.name,
      title: videoLinksTable.title,
      url: videoLinksTable.url,
      pageUrl: videoLinksTable.pageUrl,
      refreshedUrl: videoLinksTable.refreshedUrl,
      activeBackupId: videoLinksTable.activeBackupId,
      status: videoLinksTable.status,
      notes: videoLinksTable.notes,
      lastChecked: videoLinksTable.lastChecked,
      createdAt: videoLinksTable.createdAt,
      updatedAt: videoLinksTable.updatedAt,
      backupCount: sql<number>`(
        select count(*)::int from backup_links where video_link_id = ${videoLinksTable.id}
      )`,
    })
    .from(videoLinksTable)
    .leftJoin(foldersTable, eq(foldersTable.id, videoLinksTable.folderId))
    .where(eq(videoLinksTable.id, id));
  return rows[0] ?? null;
}

/**
 * Checks primary URL, then falls back through backups in priority order.
 * Returns the first working URL and which backupId was used (null = primary).
 */
async function checkWithFallback(linkId: number, primaryUrl: string, pageUrl: string | null | undefined): Promise<{
  status: "active" | "expired" | "unknown";
  resolvedUrl: string | null;
  activeBackupId: number | null;
}> {
  // Try primary first
  const primary = await checkVideoUrl(primaryUrl, pageUrl);
  if (primary.status === "active") {
    return { ...primary, activeBackupId: null };
  }

  // Primary failed — try backups in priority order
  const backups = await db
    .select()
    .from(backupLinksTable)
    .where(eq(backupLinksTable.videoLinkId, linkId))
    .orderBy(asc(backupLinksTable.priority), asc(backupLinksTable.createdAt));

  for (const backup of backups) {
    logger.info({ backupId: backup.id, url: backup.url }, "Trying backup link");
    const result = await checkVideoUrl(backup.url, null);

    // Update the backup's own status
    await db
      .update(backupLinksTable)
      .set({ status: result.status, lastChecked: new Date() })
      .where(eq(backupLinksTable.id, backup.id));

    if (result.status === "active") {
      logger.info({ backupId: backup.id }, "Backup link is active — promoting");
      return {
        status: "active",
        resolvedUrl: result.resolvedUrl ?? backup.url,
        activeBackupId: backup.id,
      };
    }
  }

  // All failed
  return { status: primary.status, resolvedUrl: primary.resolvedUrl, activeBackupId: null };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get("/links", async (req, res): Promise<void> => {
  const queryParams = ListLinksQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { folderId, status } = queryParams.data;
  const conditions = [];
  if (folderId !== undefined) conditions.push(eq(videoLinksTable.folderId, folderId));
  if (status !== undefined) conditions.push(eq(videoLinksTable.status, status));

  const rows = await db
    .select({
      id: videoLinksTable.id,
      folderId: videoLinksTable.folderId,
      folderName: foldersTable.name,
      title: videoLinksTable.title,
      url: videoLinksTable.url,
      pageUrl: videoLinksTable.pageUrl,
      refreshedUrl: videoLinksTable.refreshedUrl,
      activeBackupId: videoLinksTable.activeBackupId,
      status: videoLinksTable.status,
      notes: videoLinksTable.notes,
      lastChecked: videoLinksTable.lastChecked,
      createdAt: videoLinksTable.createdAt,
      updatedAt: videoLinksTable.updatedAt,
      backupCount: sql<number>`(
        select count(*)::int from backup_links where video_link_id = ${videoLinksTable.id}
      )`,
    })
    .from(videoLinksTable)
    .leftJoin(foldersTable, eq(foldersTable.id, videoLinksTable.folderId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(videoLinksTable.createdAt);

  res.json(rows.map((r) => ListLinksResponseItem.parse(r)));
});

router.post("/links", async (req, res): Promise<void> => {
  const parsed = CreateLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [link] = await db
    .insert(videoLinksTable)
    .values({
      title: parsed.data.title,
      url: parsed.data.url,
      pageUrl: parsed.data.pageUrl ?? null,
      folderId: parsed.data.folderId ?? null,
      notes: parsed.data.notes ?? null,
      status: "unknown",
    })
    .returning();

  const full = await getLinkWithFolder(link.id);
  res.status(201).json(GetLinkResponse.parse(full));
});

router.post("/links/check-all", async (req, res): Promise<void> => {
  const links = await db.select().from(videoLinksTable);

  let active = 0;
  let expired = 0;
  let failed = 0;

  for (const link of links) {
    try {
      const result = await checkWithFallback(link.id, link.url, link.pageUrl);
      await db
        .update(videoLinksTable)
        .set({
          status: result.status,
          refreshedUrl: result.resolvedUrl ?? link.refreshedUrl,
          activeBackupId: result.activeBackupId,
          lastChecked: new Date(),
        })
        .where(eq(videoLinksTable.id, link.id));

      if (result.status === "active") active++;
      else if (result.status === "expired") expired++;
      else failed++;
    } catch {
      failed++;
    }
  }

  res.json(CheckAllLinksResponse.parse({ total: links.length, checked: links.length, active, expired, failed }));
});

router.get("/links/:id", async (req, res): Promise<void> => {
  const params = GetLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const link = await getLinkWithFolder(params.data.id);
  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  res.json(GetLinkResponse.parse(link));
});

router.patch("/links/:id", async (req, res): Promise<void> => {
  const params = UpdateLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.url !== undefined) updates.url = parsed.data.url;
  if (parsed.data.pageUrl !== undefined) updates.pageUrl = parsed.data.pageUrl;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const [updated] = await db
    .update(videoLinksTable)
    .set(updates)
    .where(eq(videoLinksTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const full = await getLinkWithFolder(updated.id);
  res.json(UpdateLinkResponse.parse(full));
});

router.delete("/links/:id", async (req, res): Promise<void> => {
  const params = DeleteLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [link] = await db
    .delete(videoLinksTable)
    .where(eq(videoLinksTable.id, params.data.id))
    .returning();

  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/links/:id/check", async (req, res): Promise<void> => {
  const params = CheckLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const existing = await getLinkWithFolder(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const result = await checkWithFallback(params.data.id, existing.url, existing.pageUrl);

  await db
    .update(videoLinksTable)
    .set({
      status: result.status,
      refreshedUrl: result.resolvedUrl ?? existing.refreshedUrl,
      activeBackupId: result.activeBackupId,
      lastChecked: new Date(),
    })
    .where(eq(videoLinksTable.id, params.data.id));

  const full = await getLinkWithFolder(params.data.id);
  res.json(CheckLinkResponse.parse(full));
});

/**
 * GET /links/:id/serve
 * Resolves the active URL for a video link and redirects (302) to it.
 * Works as the `src` of <video>, inside any player, or as a direct download.
 * Query param: ?autocheck=1  — re-checks the link before redirecting.
 */
router.get("/links/:id/serve", async (req, res): Promise<void> => {
  const params = GetLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const link = await getLinkWithFolder(params.data.id);
  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  // Optional: re-check before redirecting
  if (req.query.autocheck === "1") {
    const result = await checkWithFallback(params.data.id, link.url, link.pageUrl);
    await db
      .update(videoLinksTable)
      .set({
        status: result.status,
        refreshedUrl: result.resolvedUrl ?? link.refreshedUrl,
        activeBackupId: result.activeBackupId,
        lastChecked: new Date(),
      })
      .where(eq(videoLinksTable.id, params.data.id));

    const refreshed = result.resolvedUrl ?? link.refreshedUrl ?? link.url;
    res.redirect(302, refreshed);
    return;
  }

  const target = link.refreshedUrl ?? link.url;
  res.redirect(302, target);
});

/**
 * GET /links/:id/embed
 * Returns a minimal HTML page with a self-contained video player.
 * Designed for <iframe> embedding on external sites.
 */
router.get("/links/:id/embed", async (req, res): Promise<void> => {
  const params = GetLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).send("Bad request");
    return;
  }

  const link = await getLinkWithFolder(params.data.id);
  if (!link) {
    res.status(404).send("Link not found");
    return;
  }

  const videoUrl = link.refreshedUrl ?? link.url;
  const autoplay = req.query.autoplay === "1" ? "autoplay" : "";
  const muted = req.query.muted === "1" ? "muted" : "";
  const title = link.title.replace(/"/g, "&quot;").replace(/</g, "&lt;");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
  video {
    width: 100%; height: 100%;
    object-fit: contain;
    display: block;
  }
  .unavailable {
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    color: #888; font-family: system-ui, sans-serif; font-size: 14px; gap: 8px;
  }
  .unavailable svg { opacity: .4; }
</style>
</head>
<body>
${
  link.status === "expired" && !link.refreshedUrl
    ? `<div class="unavailable">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>Vídeo indisponível</span>
      </div>`
    : `<video src="${videoUrl}" controls ${autoplay} ${muted} playsinline>
        <p>Seu navegador não suporta o player de vídeo.</p>
      </video>`
}
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.send(html);
});

router.patch("/links/:id/move", async (req, res): Promise<void> => {
  const params = MoveLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = MoveLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(videoLinksTable)
    .set({ folderId: parsed.data.folderId ?? null })
    .where(eq(videoLinksTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const full = await getLinkWithFolder(updated.id);
  res.json(MoveLinkResponse.parse(full));
});

export default router;
