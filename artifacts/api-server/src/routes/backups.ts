import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, backupLinksTable, videoLinksTable } from "@workspace/db";
import {
  ListBackupsParams,
  CreateBackupParams,
  CreateBackupBody,
  UpdateBackupParams,
  UpdateBackupBody,
  UpdateBackupResponse,
  DeleteBackupParams,
  ListBackupsResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/links/:id/backups", async (req, res): Promise<void> => {
  const params = ListBackupsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parent = await db
    .select({ id: videoLinksTable.id })
    .from(videoLinksTable)
    .where(eq(videoLinksTable.id, params.data.id));
  if (!parent[0]) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const rows = await db
    .select()
    .from(backupLinksTable)
    .where(eq(backupLinksTable.videoLinkId, params.data.id))
    .orderBy(asc(backupLinksTable.priority), asc(backupLinksTable.createdAt));

  res.json(rows.map((r) => ListBackupsResponseItem.parse(r)));
});

router.post("/links/:id/backups", async (req, res): Promise<void> => {
  const params = CreateBackupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateBackupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const parent = await db
    .select({ id: videoLinksTable.id })
    .from(videoLinksTable)
    .where(eq(videoLinksTable.id, params.data.id));
  if (!parent[0]) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  // Auto-assign priority = count of existing backups
  const existing = await db
    .select({ id: backupLinksTable.id })
    .from(backupLinksTable)
    .where(eq(backupLinksTable.videoLinkId, params.data.id));

  const [backup] = await db
    .insert(backupLinksTable)
    .values({
      videoLinkId: params.data.id,
      url: parsed.data.url,
      label: parsed.data.label ?? null,
      priority: existing.length,
      status: "unknown",
    })
    .returning();

  res.status(201).json(ListBackupsResponseItem.parse(backup));
});

router.patch("/links/:id/backups/:backupId", async (req, res): Promise<void> => {
  const params = UpdateBackupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBackupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.url !== undefined) updates.url = parsed.data.url;
  if (parsed.data.label !== undefined) updates.label = parsed.data.label;
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;

  const [updated] = await db
    .update(backupLinksTable)
    .set(updates)
    .where(
      and(
        eq(backupLinksTable.id, params.data.backupId),
        eq(backupLinksTable.videoLinkId, params.data.id),
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Backup not found" });
    return;
  }

  res.json(UpdateBackupResponse.parse(updated));
});

router.delete("/links/:id/backups/:backupId", async (req, res): Promise<void> => {
  const params = DeleteBackupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(backupLinksTable)
    .where(
      and(
        eq(backupLinksTable.id, params.data.backupId),
        eq(backupLinksTable.videoLinkId, params.data.id),
      ),
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Backup not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
