import {
	type ClientConfig,
	type MessageAPIResponseBase,
	messagingApi,
	type webhook,
} from "@line/bot-sdk";
import dotenv from "dotenv";
import type {
	Restaurant,
	RestaurantDetails,
	UserPreferences,
} from "../types/restaurantTypes";

import {
	geocodeAddress,
	getRestaurantDetails,
	searchNearbyRestaurants,
} from "../utils/googleMapsUtil";

dotenv.config();

const clientConfig: ClientConfig = {
	channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "",
};

const client = new messagingApi.MessagingApiClient(clientConfig);

let userPreferences: UserPreferences = {
	currentLocation: null,
	topCount: 0,
	radius: 0,
	restaurants: [],
	showNext: 0,
	isSessionEnded: false,
};

/**
 * 重置用戶偏好設定
 * 將用戶偏好的所有屬性初始化為預設值
 */
const resetPreferences = () => {
	userPreferences = {
		currentLocation: null,
		topCount: 0,
		radius: 0,
		restaurants: [],
		showNext: 0,
		isSessionEnded: false,
	};
};

/**
 * 結束互動處理函式
 * 將會話標記為已結束並回覆結束訊息
 * @param replyToken - 用於回覆訊息的 token
 */
const handleEndInteraction = async (replyToken: string) => {
	userPreferences.isSessionEnded = true;
	await client.replyMessage({
		replyToken,
		messages: [
			{
				type: "text",
				text: "感謝您的使用！希望下次能為您服務。如需重新開始，請輸入『找餐廳』。",
			},
		],
	});
};

/**
 * 開始新互動處理函式
 * 重置用戶偏好設定並提示輸入位置
 * @param replyToken - 用於回覆訊息的 token
 */
const handleStartInteraction = async (replyToken: string) => {
	resetPreferences();
	await client.replyMessage({
		replyToken,
		messages: [
			{
				type: "text",
				text: "請輸入您目前的位置（例如：台北市中山區南京東路三段1號）：",
			},
		],
	});
};

/**
 * 地址輸入處理函式
 * 使用 Google Maps Geocoding API 將地址解析為經緯度
 * @param replyToken - 用於回覆訊息的 token
 * @param address - 使用者輸入的地址
 * @returns 是否成功解析地址
 */
const handleAddressInput = async (replyToken: string, address: string) => {
	const location = await geocodeAddress(address);
	if (!location) {
		await client.replyMessage({
			replyToken,
			messages: [
				{
					type: "text",
					text: "無法解析該地址，請重新輸入有效的地址（例如：台北市中山區南京東路三段1號）：",
				},
			],
		});
		return false;
	}

	userPreferences.currentLocation = location;
	await client.replyMessage({
		replyToken,
		messages: [
			{
				type: "text",
				text: "請輸入您想查看的排名前 N 筆餐廳數量（例如：10 表示查看前 10 筆餐廳）：",
			},
		],
	});
	return true;
};

/**
 * 搜尋範圍輸入處理函式
 * 檢查並設定搜尋半徑，同時查詢附近餐廳
 * @param replyToken - 用於回覆訊息的 token
 * @param radiusInput - 使用者輸入的半徑
 * @returns 是否成功處理搜尋範圍
 */
const handleRadiusInput = async (replyToken: string, radiusInput: string) => {
	const radius = Number.parseInt(radiusInput, 10);
	if (Number.isNaN(radius) || radius <= 0) {
		await client.replyMessage({
			replyToken,
			messages: [
				{
					type: "text",
					text: "請輸入有效的半徑（例如：1000）：",
				},
			],
		});
		return false;
	}

	userPreferences.radius = radius;
	const { lat, lng } = userPreferences.currentLocation || {};
	if (!lat || !lng) {
		await client.replyMessage({
			replyToken,
			messages: [
				{
					type: "text",
					text: "無效的位置資料，請重新輸入位置。",
				},
			],
		});
		return false;
	}

	const restaurants = await searchNearbyRestaurants(lat, lng, radius);
	if (!restaurants || restaurants.length === 0) {
		await client.replyMessage({
			replyToken,
			messages: [
				{
					type: "text",
					text: "抱歉，找不到符合條件的餐廳。\n您可以嘗試以下選項：\n1. 輸入新的地址。\n2. 調整搜尋範圍（例如：輸入新的半徑大小）。\n3. 輸入『找餐廳』重新開始互動。",
				},
			],
		});
		return false;
	}

	userPreferences.restaurants = restaurants.slice(0, userPreferences.topCount);
	userPreferences.showNext = 0;

	await sendRestaurantList(replyToken);
	return true;
};

/**
 * 發送餐廳詳細資訊
 * 提供餐廳的名稱、地址、評分和其他資訊，並提供操作選項
 * @param replyToken - 用於回覆訊息的 token
 * @param restaurant - 選中的餐廳資訊
 */
const sendRestaurantDetails = async (
	replyToken: string,
	restaurant: Restaurant,
) => {
	const restaurantDetails = await getRestaurantDetails(restaurant.place_id);

	await client.replyMessage({
		replyToken,
		messages: [
			{
				type: "text",
				text: `🍽 餐廳資訊：\n\n🏷 名稱: ${restaurantDetails.name}\n📍 地址: ${restaurantDetails.formatted_address}\n\n📝 評論數: ${restaurantDetails.user_ratings_total || "無"}\n⭐ 平均評分: ${restaurantDetails.rating || "無"}\n\n🕒 營業時間:\n${
					restaurantDetails.opening_hours?.weekday_text
						.map((day) => `📅 ${day}`)
						.join("\n") || "無資訊"
				}`,
			},
			{
				type: "template",
				altText: "請選擇操作",
				template: {
					type: "buttons",
					text: "您可以選擇以下操作：",
					actions: [
						{
							type: "uri",
							label: "導航到餐廳",
							uri: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
								restaurantDetails.name,
							)}&destination_place_id=${restaurant.place_id}`,
						},
						{
							type: "uri",
							label: "導航到Line Go",
							uri: `https://app.taxigo.com.tw/?destination=${restaurantDetails.geometry.location.lat},${restaurantDetails.geometry.location.lng}`,
						},
						{
							type: "postback",
							label: "收藏該餐廳",
							data: `action=save&restaurantId=${restaurant.place_id}`,
						},
						{
							type: "message",
							label: "結束互動",
							text: "結束",
						},
					],
				},
			},
		],
	});
};

/**
 * 發送餐廳清單
 * 根據用戶偏好顯示餐廳列表，每次最多顯示 4 筆
 * @param replyToken - 用於回覆訊息的 token
 */
const sendRestaurantList = async (replyToken: string) => {
	const startIndex = userPreferences.showNext || 0;
	const endIndex = Math.min(startIndex + 4, userPreferences.restaurants.length);

	// 動態生成 FlexBubble 陣列
	const bubbles: messagingApi.FlexBubble[] = userPreferences.restaurants
		.slice(startIndex, endIndex)
		.map((restaurant, index): messagingApi.FlexBubble => {
			// console.log(restaurant.imageUrl); // debug
			return {
				type: "bubble",
				hero: {
					type: "image",
					url: restaurant.imageUrl,
					size: "full",
					aspectRatio: "20:13",
					aspectMode: "cover",
					action: {
						type: "uri",
						uri: restaurant.url,
					},
				},
				body: {
					type: "box",
					layout: "vertical",
					contents: [
						{
							type: "text",
							text: `${startIndex + index + 1}. ${restaurant.name}`,
							weight: "bold",
							size: "xl",
							wrap: true,
						},
						{
							type: "text",
							text: `地址：${restaurant.vicinity}`,
							wrap: true,
						},
						{
							type: "text",
							text: `評論數：${restaurant.user_ratings_total || "無"}`,
							wrap: true,
						},
						{
							type: "text",
							text: `評分：${restaurant.rating || "無"}`,
							wrap: true,
						},
					],
				},
				footer: {
					type: "box",
					layout: "vertical",
					spacing: "sm",
					contents: [
						{
							type: "button",
							style: "link",
							action: {
								type: "uri",
								label: "查看地圖",
								uri: restaurant.mapUrl,
							},
						},
					],
				},
			};
		});

	// Flex Message
	const flexMessage: messagingApi.FlexMessage = {
		type: "flex", // 明確指定為 "flex"
		altText: "餐廳清單",
		contents: {
			type: "carousel",
			contents: bubbles,
		},
	};

	// 普通文字訊息
	const textMessage: messagingApi.TextMessage = {
		type: "text",
		text:
			endIndex < userPreferences.restaurants.length
				? "輸入「繼續」以查看更多餐廳！"
				: "已顯示所有餐廳。請輸入餐廳序號或輸入「隨機」以隨機推薦。",
	};

	userPreferences.showNext = endIndex; // 更新索引

	// 發送訊息
	await client.replyMessage({
		replyToken,
		messages: [flexMessage, textMessage],
	});
};

/**
 * 主事件處理函式
 * 負責處理來自 LINE 的事件並呼叫對應的邏輯
 * @param event - LINE 傳遞的事件
 * @returns API 回應結果
 */
export const textEventHandler = async (
	event: webhook.Event,
): Promise<MessageAPIResponseBase | undefined> => {
	if (
		event.type !== "message" ||
		(event.message.type !== "text" && event.message.type !== "location")
	)
		return;

	const userMessage =
		event.message.type === "text" ? event.message.text.trim() : null;
	const replyToken = event.replyToken;

	if (userMessage === "找餐廳") {
		await handleStartInteraction(replyToken);
		return;
	}

	if (userPreferences.isSessionEnded) {
		await client.replyMessage({
			replyToken,
			messages: [
				{
					type: "text",
					text: "互動已結束。如需重新開始，請輸入『找餐廳』或是『收藏名單』。",
				},
			],
		});
		return;
	}

	if (userMessage === "結束") {
		await handleEndInteraction(replyToken);
		return;
	}

	if (!userPreferences.currentLocation) {
		await handleAddressInput(replyToken, userMessage || "");
		return;
	}

	if (!userPreferences.topCount) {
		const topCount = Number.parseInt(userMessage || "", 10);
		if (Number.isNaN(topCount) || topCount <= 0) {
			await client.replyMessage({
				replyToken,
				messages: [
					{
						type: "text",
						text: "請輸入有效的數字（例如：10）：",
					},
				],
			});
			return;
		}
		userPreferences.topCount = topCount;

		await client.replyMessage({
			replyToken,
			messages: [
				{
					type: "text",
					text: "請輸入搜尋半徑範圍（單位：公尺，例如：1000 表示 1 公里）：",
				},
			],
		});
		return;
	}

	if (!userPreferences.radius) {
		await handleRadiusInput(replyToken, userMessage || "");
		return;
	}

	if (userMessage === "繼續") {
		await sendRestaurantList(replyToken);
		return;
	}

	const selectedRestaurant =
		userMessage?.toLowerCase() === "隨機"
			? userPreferences.restaurants[
					Math.floor(Math.random() * userPreferences.restaurants.length)
				]
			: userPreferences.restaurants[Number.parseInt(userMessage || "", 10) - 1];

	if (selectedRestaurant) {
		await sendRestaurantDetails(replyToken, selectedRestaurant);
	} else {
		await client.replyMessage({
			replyToken,
			messages: [
				{
					type: "text",
					text: "請輸入有效的餐廳序號，或輸入「隨機」讓系統推薦。",
				},
			],
		});
	}
};
