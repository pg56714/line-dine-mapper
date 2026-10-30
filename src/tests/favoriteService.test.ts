import { type Mock, describe, expect, it, vi } from "vitest";
import { Favorite } from "../models/favoritesModel";
import {
	addFavorite,
	deleteFavoriteById,
	getFavoritesByUserId,
	isFavoriteExists,
} from "../services/favoriteService";

vi.mock("../models/favoritesModel"); // Mock Favorite 模型

describe("Favorite Service", () => {
	it("should return correct favorites list for a user", async () => {
		const mockFavorites = [
			{
				lineUserId: "user1",
				restaurantId: "rest1",
				name: "Restaurant 1",
				address: "Address 1",
			},
			{
				lineUserId: "user1",
				restaurantId: "rest2",
				name: "Restaurant 2",
				address: "Address 2",
			},
		];
		(Favorite.find as Mock).mockResolvedValue(mockFavorites);

		const result = await getFavoritesByUserId("user1");
		expect(Favorite.find).toHaveBeenCalledWith({ lineUserId: "user1" });
		expect(result).toEqual(mockFavorites);
	});

	it("should successfully add a favorite", async () => {
		const mockFavorite = {
			lineUserId: "user1",
			restaurantId: "rest1",
			name: "Restaurant 1",
			address: "Address 1",
			latitude: 25.033,
			longitude: 121.565,
		};
		(Favorite.prototype.save as Mock).mockResolvedValue(mockFavorite);

		const result = await addFavorite(
			mockFavorite.lineUserId,
			mockFavorite.restaurantId,
			mockFavorite.name,
			mockFavorite.address,
			mockFavorite.latitude,
			mockFavorite.longitude,
		);

		expect(Favorite.prototype.save).toHaveBeenCalled();
		expect(result).toEqual(mockFavorite);
	});

	it("should delete a favorite successfully", async () => {
		(Favorite.deleteOne as Mock).mockResolvedValue({ deletedCount: 1 });

		const result = await deleteFavoriteById("user1", "rest1");
		expect(Favorite.deleteOne).toHaveBeenCalledWith({
			lineUserId: "user1",
			restaurantId: "rest1",
		});
		expect(result).toBe(1);
	});

	it("should handle delete failure gracefully", async () => {
		(Favorite.deleteOne as Mock).mockResolvedValue({ deletedCount: 0 });

		const result = await deleteFavoriteById("user1", "rest1");
		expect(Favorite.deleteOne).toHaveBeenCalledWith({
			lineUserId: "user1",
			restaurantId: "rest1",
		});
		expect(result).toBe(0);
	});

	it("should return true if a favorite exists", async () => {
		const mockFavorite = { lineUserId: "user1", restaurantId: "rest1" };
		(Favorite.findOne as Mock).mockResolvedValue(mockFavorite);

		const result = await isFavoriteExists("user1", "rest1");
		expect(Favorite.findOne).toHaveBeenCalledWith({
			lineUserId: "user1",
			restaurantId: "rest1",
		});
		expect(result).toBe(true);
	});

	it("should return false if a favorite does not exist", async () => {
		(Favorite.findOne as Mock).mockResolvedValue(null);

		const result = await isFavoriteExists("user1", "rest1");
		expect(Favorite.findOne).toHaveBeenCalledWith({
			lineUserId: "user1",
			restaurantId: "rest1",
		});
		expect(result).toBe(false);
	});
});
