// 僅在本地開發（IS_LOCAL=true）時使用；@ngrok/ngrok 為 devDependency，因此以動態 import 載入，正式環境不需安裝。
export const startNgrok = async (port: number): Promise<void> => {
	try {
		const ngrok = await import("@ngrok/ngrok");
		// 從環境變數 NGROK_AUTHTOKEN 讀取 authtoken
		const listener = await ngrok.forward({
			addr: port,
			authtoken_from_env: true,
		});
		console.log(`公開的 Webhook URL 是：${listener.url()}/callback`);
		console.log("請將此 URL 設定為 LINE 開發者後台的 Webhook URL");
	} catch (error) {
		console.error("無法啟動 ngrok:", error);
	}
};
