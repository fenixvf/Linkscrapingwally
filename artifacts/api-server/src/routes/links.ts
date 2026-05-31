import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, videoLinksTable, foldersTable } from "@workspace/db";
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

const router: IRouter = Router();

async function getLinkWithFolder(id: number) {
  const rows = await db
    .select({
      id: videoLinksTable.id,
      folderId: videoLinksTable.folderId,
      folderName: foldersTable.name,
      title: videoLinksTable.title,
      url: videoLinksTable.url,
      refreshedUrl: videoLinksTable.refreshedUrl,
      status: videoLinksTable.status,
      notes: videoLinksTable.notes,
      lastChecked: videoLinksTable.lastChecked,
      createdAt: videoLinksTable.createdAt,
      updatedAt: videoLinksTable.updatedAt,
    })
    .from(videoLinksTable)
    .leftJoin(foldersTable, eq(foldersTable.id, videoLinksTable.folderId))
    .where(eq(videoLinksTable.id, id));
  return rows[0] ?? null;
}

router.get("/links", async (req, res): Promise<void> => {
  const queryParams = ListLinksQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { folderId, status } = queryParams.data;

  const conditions = [];
  if (folderId !== undefined) {
    conditions.push(eq(videoLinksTable.folderId, folderId));
  }
  if (status !== undefined) {
    conditions.push(eq(videoLinksTable.status, status));
  }

  const rows = await db
    .select({
      id: videoLinksTable.id,
      folderId: videoLinksTable.folderId,
      folderName: foldersTable.name,
      title: videoLinksTable.title,
      url: videoLinksTable.url,
      refreshedUrl: videoLinksTable.refreshedUrl,
      status: videoLinksTable.status,
      notes: videoLinksTable.notes,
      lastChecked: videoLinksTable.lastChecked,
      createdAt: videoLinksTable.createdAt,
      updatedAt: videoLinksTable.updatedAt,
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
      const result = await checkVideoUrl(link.url);
      await db
        .update(videoLinksTable)
        .set({
          status: result.status,
          refreshedUrl: result.resolvedUrl ?? link.refreshedUrl,
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

  res.json(
    CheckAllLinksResponse.parse({
      total: links.length,
      checked: links.length,
      active,
      expired,
      failed,
    }),
  );
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

  const result = await checkVideoUrl(existing.url);

  const [updated] = await db
    .update(videoLinksTable)
    .set({
      status: result.status,
      refreshedUrl: result.resolvedUrl ?? existing.refreshedUrl,
      lastChecked: new Date(),
    })
    .where(eq(videoLinksTable.id, params.data.id))
    .returning();

  const full = await getLinkWithFolder(updated.id);
  res.json(CheckLinkResponse.parse(full));
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
