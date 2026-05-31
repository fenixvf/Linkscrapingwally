import { Router, type IRouter } from "express";
import { eq, sql, and, gte } from "drizzle-orm";
import { db, videoLinksTable, foldersTable } from "@workspace/db";
import { GetStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (req, res): Promise<void> => {
  const [linkStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${videoLinksTable.status} = 'active')::int`,
      expired: sql<number>`count(*) filter (where ${videoLinksTable.status} = 'expired')::int`,
      unknown: sql<number>`count(*) filter (where ${videoLinksTable.status} = 'unknown' or ${videoLinksTable.status} = 'checking')::int`,
    })
    .from(videoLinksTable);

  const [folderStats] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(foldersTable);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recentStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videoLinksTable)
    .where(gte(videoLinksTable.lastChecked, oneHourAgo));

  res.json(
    GetStatsResponse.parse({
      totalLinks: linkStats?.total ?? 0,
      activeLinks: linkStats?.active ?? 0,
      expiredLinks: linkStats?.expired ?? 0,
      unknownLinks: linkStats?.unknown ?? 0,
      totalFolders: folderStats?.total ?? 0,
      recentlyChecked: recentStats?.count ?? 0,
    }),
  );
});

export default router;
