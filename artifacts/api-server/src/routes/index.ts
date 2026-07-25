import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sparkRouter from "./spark";
import pushRouter from "./push";
import iceConfigRouter from "./iceConfig";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sparkRouter);
router.use(pushRouter);
router.use(iceConfigRouter);

export default router;
