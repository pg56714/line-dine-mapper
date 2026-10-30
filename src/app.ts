import { JSONParseError, SignatureValidationFailed } from "@line/bot-sdk";
import dotenv from "dotenv";
import express, {
	type Application,
	type NextFunction,
	type Request,
	type Response,
} from "express";
import { connectDB } from "./db/mongoDB";
import lineRoutes from "./routes/lineRoutes";
import { startNgrok } from "./utils/ngrokUtil";

connectDB();

dotenv.config();

// 建立一個新的 Express 應用程式
const app: Application = express();

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const isLocal = process.env.IS_LOCAL === "true";

app.use("/", lineRoutes);

// LINE middleware 驗證失敗時回傳 401 / 400，而不是 500
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
	if (err instanceof SignatureValidationFailed) {
		res.status(401).send("Invalid signature");
		return;
	}
	if (err instanceof JSONParseError) {
		res.status(400).send("Invalid request body");
		return;
	}
	next(err);
});

app.listen(PORT, async () => {
	console.log(`伺服器啟動於埠號 ${PORT}`);
	if (isLocal) {
		await startNgrok(PORT);
	} else {
		console.log(`請將 http://localhost:${PORT}/callback 設定為 Webhook URL`);
	}
});
