import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sparkRouter from "./spark";
import pushRouter from "./push";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sparkRouter);
router.use(pushRouter);

export default router;
