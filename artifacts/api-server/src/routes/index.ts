import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sparkRouter from "./spark";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sparkRouter);

export default router;
