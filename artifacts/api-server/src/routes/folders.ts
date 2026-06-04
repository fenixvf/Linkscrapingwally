import { Router, type IRouter } from "express";
import { eq, sql, asc } from "drizzle-orm";
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

function parseEpisodeParams(params: Record<string, string>): { folderId: number; number: number } | null {
  const folderId = parseInt(params["folderId"] ?? "", 10);
  const number = parseInt(params["number"] ?? "", 10);
  if (!isFinite(folderId) || folderId <= 0) return null;
  if (!isFinite(number) || number <= 0) return null;
  return { folderId, number };
}

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

/**
 * GET /folders/:folderId/episode/:number
 * Redirects (302) to the active video URL for episode N in a folder.
 * Episodes are ordered by episodeOrder (nulls last, then by createdAt).
 */
router.get("/folders/:folderId/episode/:number", async (req, res): Promise<void> => {
  const params = parseEpisodeParams(req.params as Record<string, string>);
  if (!params) {
    res.status(400).send("Bad request");
    return;
  }

  const links = await db
    .select({
      id: videoLinksTable.id,
      url: videoLinksTable.url,
      refreshedUrl: videoLinksTable.refreshedUrl,
      status: videoLinksTable.status,
      episodeOrder: videoLinksTable.episodeOrder,
    })
    .from(videoLinksTable)
    .where(
      eq(videoLinksTable.folderId, params.folderId),
    )
    .orderBy(
      asc(sql`CASE WHEN ${videoLinksTable.episodeOrder} IS NULL THEN 1 ELSE 0 END`),
      asc(videoLinksTable.episodeOrder),
      asc(videoLinksTable.createdAt),
    );

  const episode = links[params.number - 1];
  if (!episode) {
    res.status(404).send("Episode not found");
    return;
  }

  const target = episode.refreshedUrl ?? episode.url;
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.redirect(302, target);
});

/**
 * GET /folders/:folderId/episode/:number/embed
 * Returns a minimal embeddable HTML player for episode N in a folder.
 */
router.get("/folders/:folderId/episode/:number/embed", async (req, res): Promise<void> => {
  const params = parseEpisodeParams(req.params as Record<string, string>);
  if (!params) {
    res.status(400).send("Bad request");
    return;
  }

  const links = await db
    .select({
      id: videoLinksTable.id,
      title: videoLinksTable.title,
      url: videoLinksTable.url,
      refreshedUrl: videoLinksTable.refreshedUrl,
      status: videoLinksTable.status,
      episodeOrder: videoLinksTable.episodeOrder,
    })
    .from(videoLinksTable)
    .where(
      eq(videoLinksTable.folderId, params.folderId),
    )
    .orderBy(
      asc(sql`CASE WHEN ${videoLinksTable.episodeOrder} IS NULL THEN 1 ELSE 0 END`),
      asc(videoLinksTable.episodeOrder),
      asc(videoLinksTable.createdAt),
    );

  const episode = links[params.number - 1];
  if (!episode) {
    res.status(404).send("Episode not found");
    return;
  }

  const videoUrl = episode.refreshedUrl ?? episode.url;
  const autoplay = req.query.autoplay === "1" ? "autoplay" : "";
  const muted = req.query.muted === "1" ? "muted" : "";
  const title = episode.title.replace(/"/g, "&quot;").replace(/</g, "&lt;");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
  video { width: 100%; height: 100%; object-fit: contain; display: block; }
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
  episode.status === "expired" && !episode.refreshedUrl
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
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.send(html);
});

export default router;
