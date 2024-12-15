import mongoose, { Schema, type Document } from "mongoose";

export interface IFavorite extends Document {
	lineUserId: string;
	restaurantId: string;
	name: string;
	address: string;
	latitude: number;
	longitude: number;
	addedAt: Date;
}

const favoriteSchema = new Schema<IFavorite>({
	lineUserId: { type: String, required: true },
	restaurantId: { type: String, required: true },
	name: { type: String, required: true },
	address: { type: String, required: true },
	latitude: { type: Number, required: true },
	longitude: { type: Number, required: true },
	addedAt: { type: Date, default: Date.now },
});

export const Favorite = mongoose.model<IFavorite>("Favorite", favoriteSchema);
