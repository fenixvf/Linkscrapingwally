import { Router, type IRouter } from "express";
import { db, videoLinksTable, foldersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  ImportFromArchiveOrgBody,
  ImportFromArchiveOrgResponse,
  GetLinkResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const VIDEO_FORMATS = [
  "h.264",
  "h.264 ia",
  "mpeg4",
  "mp4",
  "ogg video",
  "webm",
  "mpeg2",
  "divx",
  "xvid",
  "matroska",
  "quicktime",
  "windows media",
  "flash video",
  "rmvb",
  "flv",
];

function isVideoFile(format: string): boolean {
  const f = format.toLowerCase();
  return VIDEO_FORMATS.some((v) => f.includes(v));
}

function extractIdentifier(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("archive.org")) return null;
    const match = u.pathname.match(/^\/details\/([^/]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

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

interface ArchiveFile {
  name: string;
  format: string;
  title?: string;
  size?: string;
  length?: string;
}

interface ArchiveMetadata {
  metadata?: {
    title?: string | string[];
    identifier?: string;
  };
  files?: ArchiveFile[];
}

function pickBestFiles(
  files: ArchiveFile[],
  preferFormat?: string
): ArchiveFile[] {
  const videoFiles = files.filter((f) => isVideoFile(f.format ?? ""));
  if (videoFiles.length === 0) return [];

  const grouped = new Map<string, ArchiveFile[]>();
  for (const f of videoFiles) {
    const baseName = f.name.replace(/\.[^.]+$/, "");
    const group = grouped.get(baseName) ?? [];
    group.push(f);
    grouped.set(baseName, group);
  }

  const PREFERRED_ORDER = [
    "h.264",
    "h.264 ia",
    "mpeg4",
    "mp4",
    "webm",
    "ogg video",
    "mpeg2",
  ];

  const result: ArchiveFile[] = [];
  for (const [, group] of grouped) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    let best = group[0];

    if (preferFormat) {
      const pref = group.find(
        (f) => f.format.toLowerCase() === preferFormat.toLowerCase()
      );
      if (pref) {
        result.push(pref);
        continue;
      }
    }

    for (const fmt of PREFERRED_ORDER) {
      const match = group.find((f) => f.format.toLowerCase().includes(fmt));
      if (match) {
        best = match;
        break;
      }
    }
    result.push(best);
  }

  return result;
}

router.post("/import/archive-org", async (req, res): Promise<void> => {
  const parsed = ImportFromArchiveOrgBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { url, folderId, preferFormat } = parsed.data;

  const identifier = extractIdentifier(url);
  if (!identifier) {
    res
      .status(400)
      .json({
        error:
          "URL inválida. Use uma URL do Archive.org como https://archive.org/details/ZeroS01",
      });
    return;
  }

  let metadata: ArchiveMetadata;
  try {
    const response = await fetch(
      `https://archive.org/metadata/${identifier}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!response.ok) {
      res
        .status(400)
        .json({ error: `Archive.org retornou status ${response.status}` });
      return;
    }
    metadata = (await response.json()) as ArchiveMetadata;
  } catch (err) {
    res
      .status(400)
      .json({ error: `Não foi possível acessar o Archive.org: ${String(err)}` });
    return;
  }

  if (!metadata.files || metadata.files.length === 0) {
    res
      .status(400)
      .json({ error: "Nenhum arquivo encontrado neste item do Archive.org." });
    return;
  }

  const collectionTitle =
    typeof metadata.metadata?.title === "string"
      ? metadata.metadata.title
      : Array.isArray(metadata.metadata?.title)
        ? metadata.metadata.title[0]
        : identifier;

  const bestFiles = pickBestFiles(metadata.files, preferFormat ?? undefined);

  if (bestFiles.length === 0) {
    res
      .status(400)
      .json({
        error:
          "Nenhum arquivo de vídeo encontrado neste item do Archive.org.",
      });
    return;
  }

  const pageUrl = `https://archive.org/details/${identifier}`;

  const insertedLinks = [];
  let skipped = 0;

  for (const file of bestFiles) {
    const downloadUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(file.name)}`;

    const fileTitle =
      file.title ||
      file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim() ||
      `${collectionTitle} — ${file.name}`;

    try {
      const [link] = await db
        .insert(videoLinksTable)
        .values({
          title: fileTitle,
          url: downloadUrl,
          pageUrl,
          folderId: folderId ?? null,
          status: "unknown",
          notes: `Importado de Archive.org: ${collectionTitle}`,
        })
        .returning();

      const full = await getLinkWithFolder(link.id);
      if (full) insertedLinks.push(GetLinkResponse.parse(full));
    } catch {
      skipped++;
    }
  }

  res.json(
    ImportFromArchiveOrgResponse.parse({
      imported: insertedLinks.length,
      skipped,
      links: insertedLinks,
    })
  );
});

export default router;
