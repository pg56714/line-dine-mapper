import { Client } from "@googlemaps/google-maps-services-js";
import axios from "axios";
import dotenv from "dotenv";
import OpenCC from "opencc-js";
import type { Restaurant, RestaurantDetails } from "../types/restaurantTypes";

// 初始化轉換器(因有些地址是簡體中文)
const converter = OpenCC.Converter({ from: "cn", to: "twp" }); // 簡體轉繁體

dotenv.config();

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || "";

// 初始化 Google Maps Client
const googleMapsClient = new Client({});

/**
 * 去除地址中的郵遞區號和 "台灣"
 * @param address - 完整地址字串
 * @returns 處理後的地址
 */
const cleanAddress = (address: string): string => {
	return address
		.replace(/\b\d{3,5}\b/g, "")
		.replace(/臺灣/g, "")
		.trim();
};

/**
 * 使用 Google Maps Geocoding API 將地址解析為經緯度
 * @param address - 使用者輸入的地址
 * @returns 經緯度 { lat, lng } 或 null
 */
export const geocodeAddress = async (
	address: string,
): Promise<{ lat: number; lng: number } | null> => {
	try {
		const response = await googleMapsClient.geocode({
			params: {
				address,
				key: googleMapsApiKey,
				language: "zh-TW",
			},
		});

		if (response.data.results.length > 0) {
			const location = response.data.results[0].geometry.location;
			return { lat: location.lat, lng: location.lng };
		}

		console.error("No results found for address:", address);
		return null;
	} catch (error) {
		console.error("Error during geocoding:", error);
		return null;
	}
};

/**
 * 使用 Google Maps Places API 搜尋附近餐廳
 * @param latitude - 搜尋位置的緯度
 * @param longitude - 搜尋位置的經度
 * @param radius - 搜尋範圍（單位：公尺）
 * @param type - 搜尋類型（預設為 "restaurant"）
 * @returns 附近餐廳列表
 */
export const searchNearbyRestaurants = async (
	latitude: number,
	longitude: number,
	radius: number,
	type = "restaurant",
): Promise<Restaurant[]> => {
	try {
		const response = await axios.get(
			"https://maps.googleapis.com/maps/api/place/nearbysearch/json",
			{
				params: {
					location: `${latitude},${longitude}`,
					radius,
					type,
					key: googleMapsApiKey,
					language: "zh-TW",
				},
			},
		);

		const restaurants = response.data.results;

		// 轉換成 Restaurant 格式
		const formattedRestaurants: Restaurant[] = await Promise.all(
			restaurants.map(async (restaurant) => {
				const details = await getRestaurantDetails(restaurant.place_id);

				const convertedAddress = details?.formatted_address
					? cleanAddress(converter(details.formatted_address))
					: cleanAddress(converter(restaurant.vicinity));

				// 獲取跳轉後圖片 URL
				const imageUrl = restaurant.photos?.[0]?.photo_reference
					? await getFinalPhotoUrl(restaurant.photos[0].photo_reference)
					: "";

				return {
					name: restaurant.name,
					vicinity: convertedAddress || restaurant.vicinity,
					place_id: restaurant.place_id,
					rating: restaurant.rating,
					user_ratings_total: restaurant.user_ratings_total,
					imageUrl: imageUrl,
					url: `https://www.google.com/maps/place/?q=place_id:${restaurant.place_id}`,
					mapUrl: `https://www.google.com/maps/dir/?api=1&destination=${restaurant.geometry.location.lat},${restaurant.geometry.location.lng}`,
				};
			}),
		);

		// 按評論數和評分排序
		return formattedRestaurants.sort((a, b) => {
			const reviewsA = a.user_ratings_total ?? 0;
			const reviewsB = b.user_ratings_total ?? 0;
			const ratingA = a.rating ?? 0;
			const ratingB = b.rating ?? 0;

			if (reviewsB === reviewsA) {
				return ratingB - ratingA;
			}
			return reviewsB - reviewsA;
		});
	} catch (error) {
		console.error("Error fetching nearby restaurants:", error);
		throw error;
	}
};

/**
 * 使用 Google Maps Places API 獲取餐廳詳細資訊
 * @param placeId - 餐廳的 Place ID
 * @returns 餐廳詳細資訊
 */
export const getRestaurantDetails = async (
	placeId: string,
): Promise<RestaurantDetails> => {
	try {
		const response = await axios.get(
			"https://maps.googleapis.com/maps/api/place/details/json",
			{
				params: {
					place_id: placeId,
					key: googleMapsApiKey,
					language: "zh-TW",
				},
			},
		);

		const details = response.data.result as RestaurantDetails;
		if (details.formatted_address) {
			details.formatted_address = cleanAddress(
				converter(details.formatted_address),
			);
		}

		return details;
	} catch (error) {
		console.error("Error fetching restaurant details:", error);
		throw error;
	}
};

/**
 * 獲取跳轉後的圖片 URL
 * @param photoReference - Google Maps API 的 photo_reference
 * @param maxWidth - 最大寬度
 * @returns 最終圖片 URL
 */
const getFinalPhotoUrl = async (
	photoReference: string,
	maxWidth = 400,
): Promise<string> => {
	const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${googleMapsApiKey}`;
	try {
		// 設定 axios 請求不跟隨重定向 (maxRedirects: 0)
		const response = await axios.get(photoApiUrl, {
			maxRedirects: 0, // 不跟隨重定向
			validateStatus: (status) => status === 302, // 接受 302
		});
		const finalUrl = response.headers.location;
		if (finalUrl) {
			return finalUrl;
		}
		throw new Error("未找到 Location header");
	} catch (error) {
		console.error("Error fetching final photo URL:", error);
		return "";
	}
};
