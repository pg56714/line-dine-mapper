import {
	type ClientConfig,
	type MessageAPIResponseBase,
	messagingApi,
	type webhook,
} from "@line/bot-sdk";
import dotenv from "dotenv";
import type { Restaurant, UserPreferences } from "../types/restaurantTypes";

import {
	geocodeAddress,
	getRestaurantDetails,
	searchNearbyRestaurants,
} from "../utils/googleMapsUtil";

import {
	addFavorite,
	deleteFavoriteById,
	getFavoritesByUserId,
	isFavoriteExists,
} from "../services/favoriteService";

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
	lastSelectedRestaurant: null,
	context: null,
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
		lastSelectedRestaurant: null,
		context: null,
	};
};

/**
 * 結束互動處理函式
 * 將會話標記為已結束並回覆結束訊息
 * @param replyToken - 用於回覆訊息的 token
 */
const handleEndInteraction = async (userId: string) => {
	userPreferences.isSessionEnded = true;

	await client.showLoadingAnimation({
		chatId: userId,
		loadingSeconds: 5,
	});

	await client.pushMessage({
		to: userId,
		messages: [
			{
				type: "text",
				text: "感謝您的使用！希望下次能為您服務。如需重新開始，請選擇以下快速操作：",
				quickReply: {
					items: [
						{
							type: "action",
							action: {
								type: "message",
								label: "重新開始",
								text: "找餐廳",
							},
						},
						{
							type: "action",
							action: {
								type: "message",
								label: "查看收藏名單",
								text: "收藏名單",
							},
						},
						{
							type: "action",
							action: {
								type: "message",
								label: "隨機推薦(從收藏名單)",
								text: "隨機推薦",
							},
						},
					],
				},
			},
		],
	});
};

/**
 * 開始新互動處理函式
 * 重置用戶偏好設定並提示輸入位置
 * @param replyToken - 用於回覆訊息的 token
 */
const handleStartInteraction = async (replyToken: string, userId: string) => {
	await client.showLoadingAnimation({
		chatId: userId,
		loadingSeconds: 5,
	});

	await client.replyMessage({
		replyToken,
		messages: [
			{
				type: "text",
				text: "請輸入您目前的位置（例如：臺北市信義區信義路5段7號）或是用位置資訊傳送：",
			},
		],
	});
};

/**
 * 處理位置輸入（文字地址或地理位置訊息）
 * 使用者可以傳送位置訊息或輸入地址
 * @param replyToken - 用於回覆訊息的 token
 * @param userId - LINE 使用者 ID
 * @param addressOrLocation - 文字地址或地理位置信息
 * @returns 是否成功解析地址
 */
const handleAddressInput = async (
	replyToken: string,
	userId: string,
	addressOrLocation: { address?: string; lat?: number; lng?: number },
) => {
	await client.showLoadingAnimation({
		chatId: userId,
		loadingSeconds: 5,
	});

	let location = null;

	if (addressOrLocation.address) {
		// 使用地址解析成經緯度
		location = await geocodeAddress(addressOrLocation.address);
		if (!location) {
			await client.replyMessage({
				replyToken,
				messages: [
					{
						type: "text",
						text: "無法解析該地址，請重新輸入有效的地址（例如：台北市中山區南京東路三段1號）或傳送位置資訊。",
					},
				],
			});
			return false;
		}
	} else if (addressOrLocation.lat && addressOrLocation.lng) {
		// 直接使用位置訊息
		location = { lat: addressOrLocation.lat, lng: addressOrLocation.lng };
	}

	if (!location) {
		await client.replyMessage({
			replyToken,
			messages: [
				{ type: "text", text: "無法取得位置，請重新輸入或傳送位置資訊。" },
			],
		});
		return false;
	}

	// 儲存位置資訊
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
 * 使用者搜尋偏好設定處理函式
 * 處理並驗證使用者輸入的 topCount 值，並根據輸入更新偏好設定或要求後續輸入。
 * @param userPreferences - 儲存使用者偏好設定的物件
 * @param client - 與聊天用戶端互動的 API 客戶端
 * @param userId - 用戶的唯一識別 ID
 * @param userMessage - 用戶傳遞的訊息（topCount 值）
 * @param replyToken - 用於回覆訊息的 token
 */
async function handleTopCountInput(
	userPreferences: { topCount?: number },
	client: messagingApi.MessagingApiClient,
	userId: string,
	userMessage: string,
	replyToken: string,
): Promise<void> {
	if (!userPreferences.topCount) {
		await client.showLoadingAnimation({
			chatId: userId,
			loadingSeconds: 5,
		});

		// 移除非數字字符（如單位），僅保留數字部分
		const cleanedMessage = userMessage.replace(/[^\d]/g, ""); // 移除所有非數字字符
		const topCount = Number.parseInt(cleanedMessage, 10);

		// 驗證輸入是否為有效的正數字
		if (Number.isNaN(topCount) || topCount <= 0) {
			await client.replyMessage({
				replyToken,
				messages: [{ type: "text", text: "請輸入有效的數字（例如：10）" }],
			});
			return;
		}

		// 更新使用者偏好設定
		userPreferences.topCount = topCount;

		// 回覆下一步的訊息請求
		await client.replyMessage({
			replyToken,
			messages: [
				{
					type: "text",
					text: "請輸入搜尋半徑範圍（單位：公尺，例如：1000 表示 1 公里）：",
				},
			],
		});
	}
}

/**
 * 搜尋範圍輸入處理函式
 * 檢查並設定搜尋半徑，同時查詢附近餐廳
 * @param replyToken - 用於回覆訊息的 token
 * @param radiusInput - 使用者輸入的半徑
 * @returns 是否成功處理搜尋範圍
 */
const handleRadiusInput = async (
	replyToken: string,
	radiusInput: string,
	userId: string,
) => {
	await client.showLoadingAnimation({
		chatId: userId,
		loadingSeconds: 5,
	});

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

	await sendRestaurantList(replyToken, userId);
	return true;
};

/**
 * 發送餐廳清單
 * 根據用戶偏好顯示餐廳列表，每次最多顯示 4 筆
 * @param replyToken - 用於回覆訊息的 token
 */
const sendRestaurantList = async (replyToken: string, userId: string) => {
	await client.showLoadingAnimation({
		chatId: userId,
		loadingSeconds: 5,
	});

	const startIndex = userPreferences.showNext || 0;
	const endIndex = Math.min(startIndex + 4, userPreferences.restaurants.length);

	// 動態生成 FlexBubble 陣列
	const bubbles: messagingApi.FlexBubble[] = userPreferences.restaurants
		.slice(startIndex, endIndex)
		.map((restaurant, index): messagingApi.FlexBubble => {
			// console.log(restaurant); // debug
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
				? "輸入『繼續』以查看更多餐廳，或直接輸入『餐廳序號』，也可輸入『隨機』來獲得推薦！"
				: "已顯示所有餐廳。請輸入餐廳序號或輸入『隨機』以隨機推薦。",
	};

	userPreferences.showNext = endIndex; // 更新索引

	// 發送訊息
	await client.replyMessage({
		replyToken,
		messages: [flexMessage, textMessage],
	});
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
	userId: string,
) => {
	await client.showLoadingAnimation({
		chatId: userId,
		loadingSeconds: 5,
	});

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
							data: `action=add_to_favorites&restaurantId=${restaurant.place_id}`,
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
 * 新增餐廳至收藏清單
 * @param replyToken - 用於回覆訊息的 token
 * @param userId - LINE 使用者 ID
 */
const handleAddToFavorites = async (
	replyToken: string,
	userId: string,
): Promise<void> => {
	try {
		await client.showLoadingAnimation({
			chatId: userId,
			loadingSeconds: 5,
		});

		// 檢查是否有選擇最後的餐廳，若沒有則提示用戶
		if (!userPreferences.lastSelectedRestaurant) {
			await client.replyMessage({
				replyToken,
				messages: [
					{ type: "text", text: "您尚未選取餐廳，請先選擇餐廳後再試。" },
				],
			});
			return;
		}

		const restaurant = userPreferences.lastSelectedRestaurant;

		// 從 API 獲取選定餐廳的詳細資訊
		const restaurantDetails = await getRestaurantDetails(restaurant.place_id);

		// 檢查該餐廳是否已在收藏清單中
		const existingFavorite = await isFavoriteExists(
			userId,
			restaurant.place_id,
		);

		if (existingFavorite) {
			// 如果餐廳已經收藏過，提示用戶
			await client.replyMessage({
				replyToken,
				messages: [
					{
						type: "text",
						text: `餐廳『${restaurant.name}』已經在您的收藏名單中！`,
					},
				],
			});

			// 呼叫結束互動邏輯
			await handleEndInteraction(userId);
			return;
		}

		// 如果餐廳未收藏，則新增至收藏清單
		await addFavorite(
			userId,
			restaurant.place_id,
			restaurant.name,
			restaurantDetails.formatted_address,
			restaurantDetails.geometry.location.lat || 0,
			restaurantDetails.geometry.location.lng || 0,
		);

		// 回覆成功訊息
		await client.replyMessage({
			replyToken,
			messages: [
				{
					type: "text",
					text: `成功收藏餐廳：${restaurant.name}！`,
				},
			],
		});

		// 呼叫結束互動邏輯
		await handleEndInteraction(userId);
		return;
	} catch (error) {
		console.error("新增收藏時發生錯誤:", error);

		// 如果發生錯誤，提示用戶稍後再試
		await client.replyMessage({
			replyToken,
			messages: [{ type: "text", text: "新增收藏時發生錯誤，請稍後再試。" }],
		});
	}
};

/**
 * 顯示收藏名單，支援分頁功能
 * 如果收藏名單太多，允許用戶輸入『繼續』以查看更多
 * @param replyToken - 用於回覆訊息的 token
 * @param userId - LINE 使用者 ID
 */
const handleFavoritesList = async (
	replyToken: string,
	userId: string,
): Promise<void> => {
	try {
		// 每頁顯示的收藏數量
		const itemsPerPage = 4;

		// 確定要顯示的範圍
		const startIndex = userPreferences.showNext || 0;
		const favorites = await getFavoritesByUserId(userId);

		// 收藏數量檢查
		if (!favorites || favorites.length === 0) {
			await client.replyMessage({
				replyToken,
				messages: [{ type: "text", text: "您的收藏名單目前是空的！" }],
			});
			return;
		}

		const endIndex = Math.min(startIndex + itemsPerPage, favorites.length);

		// 檢查是否有更多內容需要顯示
		const hasMore = endIndex < favorites.length;

		// 動態生成 FlexBubble
		const bubbles: messagingApi.FlexBubble[] = favorites
			.slice(startIndex, endIndex)
			.map((favorite) => ({
				type: "bubble",
				body: {
					type: "box",
					layout: "vertical",
					contents: [
						{
							type: "text",
							text: favorite.name,
							weight: "bold",
							size: "xl",
							wrap: true,
						},
						{
							type: "text",
							text: favorite.address,
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
							style: "primary",
							height: "sm",
							action: {
								type: "uri",
								label: "查看地圖",
								uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
									favorite.name,
								)}&query_place_id=${favorite.restaurantId}`,
							},
						},
						{
							type: "button",
							style: "secondary",
							height: "sm",
							action: {
								type: "postback",
								label: "刪除收藏",
								data: `action=delete&restaurantId=${favorite.restaurantId}`,
							},
						},
					],
				},
			}));

		// Flex 訊息格式
		const flexMessage: messagingApi.FlexMessage = {
			type: "flex",
			altText: "您的收藏名單",
			contents: {
				type: "carousel",
				contents: bubbles,
			},
		};

		// 附加的提示訊息
		const continuationMessage: messagingApi.TextMessage = {
			type: "text",
			text: hasMore ? "輸入『繼續』以查看更多收藏。" : "已顯示所有收藏名單。",
		};

		// 更新顯示索引
		userPreferences.showNext = hasMore ? endIndex : 0; // 下一頁或重置為 0

		// 發送訊息
		await client.replyMessage({
			replyToken,
			messages: [flexMessage, continuationMessage],
		});

		if (!hasMore) {
			// 呼叫結束互動邏輯
			await handleEndInteraction(userId);
		}
	} catch (error) {
		console.error("取得收藏名單時發生錯誤:", error);
		await client.replyMessage({
			replyToken,
			messages: [{ type: "text", text: "取得收藏名單失敗，請稍後再試。" }],
		});
	}
};

/**
 * 隨機推薦收藏名單中的餐廳
 * 從用戶的收藏名單中隨機選擇一個餐廳，並提供詳細資訊及操作選項
 * @param replyToken - 用於回覆訊息的 token
 * @param userId - LINE 使用者 ID
 */
const handleRandomRecommendation = async (
	replyToken: string,
	userId: string,
) => {
	// 從資料庫中查詢該用戶的收藏名單
	const favorites = await getFavoritesByUserId(userId);

	// 檢查收藏名單是否為空
	if (!favorites || favorites.length === 0) {
		// 如果收藏名單為空，提示用戶新增收藏餐廳
		await client.replyMessage({
			replyToken,
			messages: [
				{ type: "text", text: "您的收藏名單目前是空的！請先新增收藏餐廳。" },
			],
		});
		return; // 結束執行
	}

	// 隨機從收藏名單中選擇一個餐廳
	const randomRestaurant =
		favorites[Math.floor(Math.random() * favorites.length)];

	// 生成 Flex 訊息以顯示隨機推薦的餐廳資訊
	const randomRestaurantMessage: messagingApi.FlexMessage = {
		type: "flex",
		altText: "隨機推薦的餐廳", // 當裝置不支援 Flex 訊息時顯示的文字
		contents: {
			type: "bubble",
			body: {
				type: "box",
				layout: "vertical",
				contents: [
					{
						type: "text",
						text: randomRestaurant.name, // 餐廳名稱
						weight: "bold", // 文字加粗
						size: "xl", // 文字大小
						wrap: true, // 允許文字換行
					},
					{
						type: "text",
						text: randomRestaurant.address, // 餐廳地址
						wrap: true, // 允許文字換行
					},
				],
			},
			footer: {
				type: "box",
				layout: "vertical",
				spacing: "sm", // 按鈕間距
				contents: [
					{
						type: "button",
						style: "link", // 按鈕樣式為連結
						action: {
							type: "uri",
							label: "查看地圖", // 按鈕文字
							uri: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
								randomRestaurant.name,
							)}&destination_place_id=${randomRestaurant.restaurantId}`, // Google 地圖導航連結
						},
					},
				],
			},
		},
	};

	// 回覆隨機推薦的餐廳訊息
	await client.replyMessage({
		replyToken,
		messages: [randomRestaurantMessage],
	});

	// 呼叫結束互動邏輯
	await handleEndInteraction(userId);
};

/**
 * 刪除收藏的餐廳
 * 根據用戶選擇的餐廳 ID 從資料庫中移除該收藏
 * @param replyToken - 用於回覆訊息的 token
 * @param userId - LINE 使用者 ID
 * @param restaurantId - 要刪除的餐廳 ID
 */
const handleDeleteFavorite = async (
	replyToken: string,
	userId: string,
	restaurantId: string,
): Promise<void> => {
	try {
		// 刪除資料庫中的該收藏
		const deletedCount = await deleteFavoriteById(userId, restaurantId);

		// 檢查刪除結果
		if (deletedCount === 0) {
			await client.replyMessage({
				replyToken,
				messages: [
					{
						type: "text",
						text: "未找到要刪除的收藏項目，請確認餐廳是否在您的收藏中。",
					},
				],
			});
			return;
		}

		// 刪除成功的回覆訊息
		await client.replyMessage({
			replyToken,
			messages: [{ type: "text", text: "已成功刪除該收藏！" }],
		});

		// 呼叫結束互動邏輯
		await handleEndInteraction(userId);
	} catch (error) {
		console.error("刪除收藏時發生錯誤:", error);
		await client.replyMessage({
			replyToken,
			messages: [{ type: "text", text: "刪除收藏時發生錯誤，請稍後再試。" }],
		});
	}
};

/**
 * 文字訊息事件處理函式
 * @param event - LINE Webhook 事件物件
 * @returns	- 回覆訊息
 */
export const textEventHandler = async (
	event: webhook.Event,
): Promise<MessageAPIResponseBase | undefined> => {
	// 處理 follow 事件（用戶加入好友）
	if (event.type === "follow") {
		const replyToken = event.replyToken;

		await client.replyMessage({
			replyToken,
			messages: [
				{
					type: "text",
					text: "歡迎加入！以下是快速操作選單，請選擇：",
					quickReply: {
						items: [
							{
								type: "action",
								action: {
									type: "message",
									label: "找餐廳",
									text: "找餐廳",
								},
							},
							{
								type: "action",
								action: {
									type: "message",
									label: "查看收藏名單",
									text: "收藏名單",
								},
							},
							{
								type: "action",
								action: {
									type: "message",
									label: "隨機推薦(從收藏名單)",
									text: "隨機推薦",
								},
							},
						],
					},
				},
			],
		});
		return;
	}

	// 處理 message 事件
	if (event.type === "message") {
		const { message, replyToken } = event;

		// 僅處理 text 和 location 類型的訊息
		if (message.type === "text" || message.type === "location") {
			const userMessage = message.type === "text" ? message.text.trim() : null;

			if (userMessage === "結束") {
				await handleEndInteraction(event.source.userId);
				return;
			}

			if (userMessage === "收藏名單") {
				resetPreferences();
				userPreferences.context = "favoritesList";
				await handleFavoritesList(replyToken, event.source.userId);
				return;
			}

			if (userMessage === "隨機推薦") {
				resetPreferences();
				await handleRandomRecommendation(replyToken, event.source.userId);
				return;
			}

			if (userMessage === "找餐廳") {
				resetPreferences();
				userPreferences.context = "restaurantList"; // 設置為『找餐廳』
				await handleStartInteraction(replyToken, event.source.userId);
				return;
			}

			if (userMessage === "繼續") {
				if (userPreferences.context === "restaurantList") {
					await sendRestaurantList(replyToken, event.source.userId);
				} else if (userPreferences.context === "favoritesList") {
					await handleFavoritesList(replyToken, event.source.userId);
				} else {
					await client.replyMessage({
						replyToken,
						messages: [{ type: "text", text: "當前沒有可繼續的操作。" }],
					});
				}
				return;
			}

			// 如果互動已結束，直接回覆
			if (userPreferences.isSessionEnded) {
				await client.replyMessage({
					replyToken,
					messages: [
						{
							type: "text",
							text: "互動已結束。如需重新開始，請選擇以下快速操作：",
							quickReply: {
								items: [
									{
										type: "action",
										action: {
											type: "message",
											label: "重新開始",
											text: "找餐廳",
										},
									},
									{
										type: "action",
										action: {
											type: "message",
											label: "查看收藏名單",
											text: "收藏名單",
										},
									},
									{
										type: "action",
										action: {
											type: "message",
											label: "隨機推薦(從收藏名單)",
											text: "隨機推薦",
										},
									},
								],
							},
						},
					],
				});
				return;
			}

			if (userPreferences.context === "restaurantList") {
				// 確保處理順序正確
				if (!userPreferences.currentLocation) {
					if (message.type === "text") {
						// 處理文字地址
						await handleAddressInput(replyToken, event.source.userId, {
							address: message.text,
						});
					} else if (message.type === "location") {
						// 處理地理位置訊息
						await handleAddressInput(replyToken, event.source.userId, {
							lat: message.latitude,
							lng: message.longitude,
						});
					}
					return;
				}
				if (!userPreferences.topCount) {
					await handleTopCountInput(
						userPreferences,
						client,
						event.source.userId,
						userMessage || "",
						replyToken,
					);
					return;
				}
				if (!userPreferences.radius) {
					await handleRadiusInput(
						replyToken,
						userMessage || "",
						event.source.userId,
					);
					return;
				}
				// 處理餐廳選擇
				const selectedRestaurant = (() => {
					if (userMessage?.toLowerCase() === "隨機") {
						// 確保隨機選擇時列表有內容
						if (userPreferences.restaurants.length === 0) return null;
						return userPreferences.restaurants[
							Math.floor(Math.random() * userPreferences.restaurants.length)
						];
					}
					// 確保 userMessage 是有效的數字並在範圍內
					const index = Number.parseInt(userMessage || "", 10) - 1;
					if (
						!Number.isNaN(index) &&
						index >= 0 &&
						index < userPreferences.restaurants.length
					) {
						return userPreferences.restaurants[index];
					}
					// 預設為無效選擇
					return null;
				})();
				if (selectedRestaurant) {
					// 設定最後選中的餐廳並發送詳細資訊
					userPreferences.lastSelectedRestaurant = selectedRestaurant;
					await sendRestaurantDetails(
						replyToken,
						selectedRestaurant,
						event.source.userId,
					);
				} else {
					// 提示用戶重新輸入有效序號或使用隨機推薦
					await client.replyMessage({
						replyToken,
						messages: [
							{
								type: "text",
								text: "請輸入有效的餐廳序號（例如：1），或輸入『隨機』讓系統推薦。",
							},
						],
					});
				}
			} else if (userPreferences.context === "favoritesList") {
				await client.replyMessage({
					replyToken,
					messages: [
						{
							type: "text",
							text: "輸入『繼續』以查看更多收藏，或是輸入結束。",
						},
					],
				});
			} else {
				await client.replyMessage({
					replyToken,
					messages: [
						{
							type: "text",
							text: "請輸入『找餐廳』、『收藏名單』、『隨機推薦』，以下快速操作：",
							quickReply: {
								items: [
									{
										type: "action",
										action: {
											type: "message",
											label: "找餐廳",
											text: "找餐廳",
										},
									},
									{
										type: "action",
										action: {
											type: "message",
											label: "查看收藏名單",
											text: "收藏名單",
										},
									},
									{
										type: "action",
										action: {
											type: "message",
											label: "隨機推薦(從收藏名單)",
											text: "隨機推薦",
										},
									},
								],
							},
						},
					],
				});
			}
		}
	}

	// 處理 postback 事件
	if (event.type === "postback") {
		const postbackEvent = event as webhook.PostbackEvent;
		const params = new URLSearchParams(postbackEvent.postback.data);

		// 處理刪除收藏的事件
		if (params.get("action") === "delete") {
			const restaurantId = params.get("restaurantId");
			if (!restaurantId) {
				await client.replyMessage({
					replyToken: event.replyToken,
					messages: [{ type: "text", text: "無效的刪除請求。" }],
				});
				return;
			}

			await handleDeleteFavorite(
				event.replyToken,
				event.source.userId,
				restaurantId,
			);
			return;
		}

		// 處理新增至收藏的事件
		if (params.get("action") === "add_to_favorites") {
			await handleAddToFavorites(event.replyToken, event.source.userId);
			return;
		}
	}
};
