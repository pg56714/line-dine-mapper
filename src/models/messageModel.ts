import {
	type ClientConfig,
	HTTPFetchError,
	type MessageAPIResponseBase,
	messagingApi,
	type webhook,
} from "@line/bot-sdk";
import dotenv from "dotenv";

// 載入環境變數設定
dotenv.config();

// 設定 LINE 客戶端與 Express 應用程式的配置
const clientConfig: ClientConfig = {
	channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "", // 從環境變數取得 Channel Access Token
};

const client = new messagingApi.MessagingApiClient(clientConfig);

export const textEventHandler = async (
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
