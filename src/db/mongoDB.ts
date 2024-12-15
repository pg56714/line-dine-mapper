import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "";

export const connectDB = async () => {
	try {
		await mongoose.connect(mongoUri);
		console.log("MongoDB 連線成功");
	} catch (error) {
		console.error("MongoDB 連線失敗:", error);
		process.exit(1); // 強制終止程式
	}
};
