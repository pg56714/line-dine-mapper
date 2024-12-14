import { Client } from "@googlemaps/google-maps-services-js";
import axios from "axios";
import dotenv from "dotenv";
import type { Restaurant, RestaurantDetails } from "../types/restaurantTypes";

dotenv.config();

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || "";

// 初始化 Google Maps Client
const googleMapsClient = new Client({});

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
				language: "zh-TW", // 設置為繁體中文
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
					language: "zh-TW", // 設置為繁體中文
				},
			},
		);

		const restaurants = response.data.results as Restaurant[];

		// 修正排序邏輯：先按評論數排序，若評論數相同再按評分排序
		const sortedRestaurants = restaurants.sort((a, b) => {
			const reviewsA = a.user_ratings_total ?? 0; // 評論數，默認為 0
			const reviewsB = b.user_ratings_total ?? 0;
			const ratingA = a.rating ?? 0; // 評分，默認為 0
			const ratingB = b.rating ?? 0;

			// 先比較評論數，若相等則比較評分
			if (reviewsB === reviewsA) {
				return ratingB - ratingA; // 評分由高到低
			}
			return reviewsB - reviewsA; // 評論數由多到少
		});

		return sortedRestaurants;
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
					language: "zh-TW", // 設置為繁體中文
				},
			},
		);
		return response.data.result as RestaurantDetails;
	} catch (error) {
		console.error("Error fetching restaurant details:", error);
		throw error;
	}
};
