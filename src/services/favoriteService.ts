import { Favorite, type IFavorite } from "../models/favoritesModel";

export const getFavoritesByUserId = async (
	userId: string,
): Promise<IFavorite[]> => {
	return await Favorite.find({ lineUserId: userId });
};

export const addFavorite = async (
	lineUserId: string,
	restaurantId: string,
	name: string,
	address: string,
	latitude: number,
	longitude: number,
): Promise<IFavorite> => {
	const favorite = new Favorite({
		lineUserId,
		restaurantId,
		name,
		address,
		latitude,
		longitude,
	});
	return await favorite.save();
};

export const deleteFavoriteById = async (
	userId: string,
	restaurantId: string,
): Promise<number> => {
	const result = await Favorite.deleteOne({ lineUserId: userId, restaurantId });
	return result.deletedCount || 0;
};

export const isFavoriteExists = async (
	userId: string,
	restaurantId: string,
): Promise<boolean> => {
	const favorite = await Favorite.findOne({ lineUserId: userId, restaurantId });
	return !!favorite;
};
