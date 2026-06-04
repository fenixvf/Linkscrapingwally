/**
 * Background scheduler — periodically re-checks all video links.
 * Configurable via AUTO_CHECK_INTERVAL_HOURS (default: 6).
 */
import { db, videoLinksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runLinkCheck } from "./checkLink";
import { logger } from "./logger";

export interface SchedulerState {
  enabled: boolean;
  intervalHours: number;
  lastRunAt: Date | null;
  lastRunChecked: number;
  lastRunFixed: number;
  nextRunAt: Date | null;
  running: boolean;
}

const state: SchedulerState = {
  enabled: false,
  intervalHours: 6,
  lastRunAt: null,
  lastRunChecked: 0,
  lastRunFixed: 0,
  nextRunAt: null,
  running: false,
};

let timer: ReturnType<typeof setTimeout> | null = null;

async function runCheck() {
  if (state.running) {
    logger.info("Scheduler: previous run still in progress, skipping");
    scheduleNext();
    return;
  }

  state.running = true;
  const startedAt = new Date();
  logger.info("Scheduler: starting auto-check of all links");

  let checked = 0;
  let fixed = 0;

  try {
    const links = await db.select({ id: videoLinksTable.id }).from(videoLinksTable);

    for (const { id } of links) {
      try {
        const [before] = await db
          .select({ status: videoLinksTable.status })
          .from(videoLinksTable)
          .where(eq(videoLinksTable.id, id));

        const result = await runLinkCheck(id);
        checked++;

        if (result.status === "active" && before?.status !== "active") {
          fixed++;
          logger.info({ linkId: id }, "Scheduler: link recovered");
        }
      } catch (err) {
        logger.error({ err, linkId: id }, "Scheduler: error checking link");
      }
    }
  } finally {
    state.running = false;
    state.lastRunAt = startedAt;
    state.lastRunChecked = checked;
    state.lastRunFixed = fixed;
    logger.info({ checked, fixed }, "Scheduler: auto-check complete");
    scheduleNext();
  }
}

function scheduleNext() {
  if (timer) clearTimeout(timer);
  const ms = state.intervalHours * 60 * 60 * 1000;
  state.nextRunAt = new Date(Date.now() + ms);
  timer = setTimeout(runCheck, ms);
}

export function startScheduler() {
  const raw = process.env["AUTO_CHECK_INTERVAL_HOURS"];
  const hours = raw ? Number(raw) : 6;
  state.intervalHours = Number.isFinite(hours) && hours > 0 ? hours : 6;
  state.enabled = true;

  logger.info({ intervalHours: state.intervalHours }, "Scheduler: started");
  scheduleNext();
}

export function stopScheduler() {
  if (timer) clearTimeout(timer);
  timer = null;
  state.enabled = false;
  state.nextRunAt = null;
}

/** Trigger an immediate run (used by the manual API endpoint). */
export async function triggerNow() {
  if (timer) clearTimeout(timer);
  await runCheck();
}

export function getSchedulerState(): Readonly<SchedulerState> {
  return { ...state };
}
