import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, foldersTable, videoLinksTable } from "@workspace/db";
import {
  CreateFolderBody,
  GetFolderParams,
  UpdateFolderParams,
  UpdateFolderBody,
  DeleteFolderParams,
  ListFoldersResponseItem,
  GetFolderResponse,
  UpdateFolderResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/folders", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: foldersTable.id,
      name: foldersTable.name,
      description: foldersTable.description,
      createdAt: foldersTable.createdAt,
      updatedAt: foldersTable.updatedAt,
      linkCount: sql<number>`count(${videoLinksTable.id})::int`,
    })
    .from(foldersTable)
    .leftJoin(videoLinksTable, eq(videoLinksTable.folderId, foldersTable.id))
    .groupBy(foldersTable.id)
    .orderBy(foldersTable.name);

  res.json(rows.map((r) => ListFoldersResponseItem.parse(r)));
});

router.post("/folders", async (req, res): Promise<void> => {
  const parsed = CreateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [folder] = await db
    .insert(foldersTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .returning();

  res.status(201).json(GetFolderResponse.parse({ ...folder, linkCount: 0 }));
});

router.get("/folders/:id", async (req, res): Promise<void> => {
  const params = GetFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select({
      id: foldersTable.id,
      name: foldersTable.name,
      description: foldersTable.description,
      createdAt: foldersTable.createdAt,
      updatedAt: foldersTable.updatedAt,
      linkCount: sql<number>`count(${videoLinksTable.id})::int`,
    })
    .from(foldersTable)
    .leftJoin(videoLinksTable, eq(videoLinksTable.folderId, foldersTable.id))
    .where(eq(foldersTable.id, params.data.id))
    .groupBy(foldersTable.id);

  if (!rows[0]) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  res.json(GetFolderResponse.parse(rows[0]));
});

router.patch("/folders/:id", async (req, res): Promise<void> => {
  const params = UpdateFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;

  const [folder] = await db
    .update(foldersTable)
    .set(updates)
    .where(eq(foldersTable.id, params.data.id))
    .returning();

  if (!folder) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  const rows = await db
    .select({
      id: foldersTable.id,
      name: foldersTable.name,
      description: foldersTable.description,
      createdAt: foldersTable.createdAt,
      updatedAt: foldersTable.updatedAt,
      linkCount: sql<number>`count(${videoLinksTable.id})::int`,
    })
    .from(foldersTable)
    .leftJoin(videoLinksTable, eq(videoLinksTable.folderId, foldersTable.id))
    .where(eq(foldersTable.id, params.data.id))
    .groupBy(foldersTable.id);

  res.json(UpdateFolderResponse.parse(rows[0]));
});

router.delete("/folders/:id", async (req, res): Promise<void> => {
  const params = DeleteFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [folder] = await db
    .delete(foldersTable)
    .where(eq(foldersTable.id, params.data.id))
    .returning();

  if (!folder) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
