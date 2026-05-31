import { Router, type IRouter } from "express";
import healthRouter from "./health";
import foldersRouter from "./folders";
import linksRouter from "./links";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(foldersRouter);
router.use(linksRouter);
router.use(statsRouter);

export default router;
