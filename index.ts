import {
	type ClientConfig,
	type MessageAPIResponseBase,
	messagingApi,
	middleware,
	type MiddlewareConfig,
	type webhook,
	HTTPFetchError,
} from "@line/bot-sdk";
import express, { type Application, type Request, type Response } from "express";
import dotenv from "dotenv";
import ngrok from "ngrok";

// 載入環境變數設定
dotenv.config();

// 設定 LINE 客戶端與 Express 應用程式的配置
const clientConfig: ClientConfig = {
	channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "", // 從環境變數取得 Channel Access Token
};

const middlewareConfig: MiddlewareConfig = {
	channelSecret: process.env.CHANNEL_SECRET || "", // 從環境變數取得 Channel Secret
};

// 設定伺服器埠號
const PORT = Number.parseInt(process.env.PORT || "3000", 10);

// 建立一個新的 LINE SDK 客戶端
const client = new messagingApi.MessagingApiClient(clientConfig);

// 建立一個新的 Express 應用程式
const app: Application = express();

// 處理文字訊息的函式
const textEventHandler = async (
	event: webhook.Event,
): Promise<MessageAPIResponseBase | undefined> => {
	if (event.type !== "message" || event.message.type !== "text") {
		return;
	}
	if (!event.replyToken) return;

	await client.replyMessage({
		replyToken: event.replyToken,
		messages: [
			{
				type: "text",
				text: event.message.text,
			},
		],
	});
};

// 建立根路由，測試連線用
app.get("/", async (_: Request, res: Response): Promise<void> => {
	res.status(200).json({
		status: "success",
		message: "Connected successfully!",
	});
});

// 接收 LINE Webhook 的路由
app.post(
	"/callback",
	middleware(middlewareConfig), // 使用 LINE 提供的中介軟體
	async (req: Request, res: Response): Promise<void> => {
		const callbackRequest: webhook.CallbackRequest = req.body; // 取得請求的主體內容
		const events: webhook.Event[] = callbackRequest.events!; // 提取事件列表

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
	},
);

// 本地伺服器 URL 測試用
// 使用 ngrok 啟動伺服器並建立公開的 URL
app.listen(PORT, async () => {
	console.log(`LINE Bot 伺服器已啟動，埠號為 ${PORT}`);

	try {
		// 使用 ngrok 連結本地伺服器，建立公開的 URL
		const url = await ngrok.connect(PORT);
		console.log(`公開的 Webhook URL 是：${url}/callback`);
		console.log("請將此 URL 設定為 LINE 開發者後台的 Webhook URL");
	} catch (error) {
		console.error("無法啟動 ngrok:", error); // ngrok 啟動錯誤時的處理
	}
});

// 啟動伺服器
// app.listen(PORT, () => {
//   console.log(LINE Bot 伺服器已啟動，埠號為 ${PORT});
//   console.log(訪問 URL: http://localhost:${PORT});
// });
