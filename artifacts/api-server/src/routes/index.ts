import { Router, type IRouter } from "express";
import healthRouter from "./health";
import foldersRouter from "./folders";
import linksRouter from "./links";
import backupsRouter from "./backups";
import statsRouter from "./stats";
import schedulerRouter from "./scheduler";
import importRouter from "./import";

const router: IRouter = Router();

router.use(healthRouter);
router.use(foldersRouter);
router.use(linksRouter);
router.use(backupsRouter);
router.use(statsRouter);
router.use(schedulerRouter);
router.use(importRouter);

export default router;
