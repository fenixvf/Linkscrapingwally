import { Router, type IRouter } from "express";
import { getSchedulerState, triggerNow } from "../lib/scheduler";

const router: IRouter = Router();

router.get("/scheduler", (_req, res): void => {
  const s = getSchedulerState();
  res.json({
    enabled: s.enabled,
    intervalHours: s.intervalHours,
    running: s.running,
    lastRunAt: s.lastRunAt?.toISOString() ?? null,
    lastRunChecked: s.lastRunChecked,
    lastRunFixed: s.lastRunFixed,
    nextRunAt: s.nextRunAt?.toISOString() ?? null,
  });
});

router.post("/scheduler/run", async (_req, res): Promise<void> => {
  const state = getSchedulerState();
  if (state.running) {
    res.status(409).json({ error: "Verificação já está em andamento" });
    return;
  }
  // fire-and-forget; client can poll /scheduler to track progress
  triggerNow().catch(() => undefined);
  res.json({ started: true });
});

export default router;
