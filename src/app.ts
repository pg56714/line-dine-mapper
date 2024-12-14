import dotenv from "dotenv";
import express, {
	type Application,
} from "express";
import lineRoutes from "./routes/lineRoutes";
import { startNgrok } from "./utils/ngrokUtil";

dotenv.config();

// 建立一個新的 Express 應用程式
const app: Application = express();

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const isLocal = process.env.IS_LOCAL === "true";

app.use("/", lineRoutes);

app.listen(PORT, async () => {
    console.log(`伺服器啟動於埠號 ${PORT}`);
    if (isLocal) {
        await startNgrok(PORT);
    } else {
        console.log(`請將 http://localhost:${PORT}/callback 設定為 Webhook URL`);
    }
});
