import ngrok from "ngrok";

export const startNgrok = async (port: number): Promise<void> => {
    try {
        const url = await ngrok.connect(port);
        console.log(`公開的 Webhook URL 是：${url}/callback`);
        console.log("請將此 URL 設定為 LINE 開發者後台的 Webhook URL");
    } catch (error) {
        console.error("無法啟動 ngrok:", error);
    }
};
