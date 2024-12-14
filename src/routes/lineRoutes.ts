import { type MiddlewareConfig, middleware } from "@line/bot-sdk";
import express from "express";
import { handleCallback, testConnection } from "../controllers/lineController";

const router = express.Router();

const middlewareConfig: MiddlewareConfig = {
	channelSecret: process.env.CHANNEL_SECRET || "", // 從環境變數取得 Channel Secret
};

router.get("/", testConnection);
router.post("/callback", middleware(middlewareConfig), handleCallback);

export default router;
