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
					language: "zh-TW",
				},
			},
		);

		const restaurants = response.data.results;

		// 將 API 結果轉換為自定義 Restaurant 格式
		const formattedRestaurants: Restaurant[] = restaurants.map(
			(restaurant) => ({
				name: restaurant.name,
				vicinity: restaurant.vicinity,
				place_id: restaurant.place_id,
				rating: restaurant.rating,
				user_ratings_total: restaurant.user_ratings_total,
				imageUrl: restaurant.photos?.[0]?.photo_reference
					? getPhotoUrl(restaurant.photos[0].photo_reference)
					: "",
				url: `https://www.google.com/maps/place/?q=place_id:${restaurant.place_id}`, // Google Maps 頁面連結
				mapUrl: `https://www.google.com/maps/dir/?api=1&destination=${restaurant.geometry.location.lat},${restaurant.geometry.location.lng}`, // 導航連結
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

/**
 * 根據 photo_reference 生成圖片 URL
 * @param photoReference - Google Maps API 返回的 photo_reference
 * @param maxWidth - 圖片最大寬度（選填）
 * @returns 圖片完整 URL
 */
const getPhotoUrl = (photoReference: string, maxWidth = 400): string => {
	return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${googleMapsApiKey}`;
};
