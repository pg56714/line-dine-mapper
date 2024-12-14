import { HTTPFetchError, type webhook } from "@line/bot-sdk";
import dotenv from "dotenv";
import type { Request, Response } from "express";
import { textEventHandler } from "../models/messageModel";

// 載入環境變數設定
dotenv.config();

export const handleCallback = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const callbackRequest = req.body as webhook.CallbackRequest;
	const events = callbackRequest?.events;

	if (!events || events.length === 0) {
		res
			.status(400)
			.json({ status: "error", message: "No events found in the request." });
		return;
	}

	try {
		await Promise.all(
			events.map(async (event: webhook.Event) => {
				try {
					await textEventHandler(event); // 呼叫文字事件處理函式
				} catch (err: unknown) {
					if (err instanceof HTTPFetchError) {
						console.error(err.status);
						console.error(err.headers.get("x-line-request-id"));
						console.error(err.body);
					} else if (err instanceof Error) {
						console.error(err);
					}
				}
			}),
		);
		res.status(200).json({ status: "success" });
	} catch (error) {
		console.error(error);
		res.status(500).json({ status: "error" });
	}
};

// 建立根路由，測試連線用
export const testConnection = (_: Request, res: Response): void => {
	res
		.status(200)
		.json({ status: "success", message: "Connected successfully!" });
};
