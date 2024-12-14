// 定義餐廳基本資訊
export interface Restaurant {
	mapUrl: string;
	url: string;
	imageUrl: string;
	name: string; // 餐廳名稱
	vicinity: string; // 餐廳地址
	place_id: string; // 餐廳的 Google Place ID
	rating?: number; // 評分
	user_ratings_total?: number; // 評論數
}

// 定義餐廳詳細資訊
export interface RestaurantDetails {
	name: string; // 餐廳名稱
	formatted_address: string; // 格式化地址
	rating?: number; // 評分
	user_ratings_total?: number; // 評論數
	opening_hours?: {
		weekday_text: string[]; // 營業時間的描述
	};
	geometry: {
		location: {
			lat: number; // 緯度
			lng: number; // 經度
		};
	};
}

// 用戶偏好設定
export interface UserPreferences {
	currentLocation: { lat: number; lng: number } | null; // 使用者當前位置
	topCount: number; // 查看餐廳數量
	radius: number; // 搜尋範圍
	restaurants: Restaurant[]; // 餐廳列表
	showNext: number; // 追蹤目前顯示進度
	isSessionEnded: boolean; // 是否結束互動
}
