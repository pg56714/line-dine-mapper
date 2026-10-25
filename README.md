# line-美食地圖夥伴

繁體中文 | [English](./README_en.md)

這個專案將 LINE Bot 與 Google Maps API 結合，為用戶提供方便的餐廳收藏工具。

## LINE Bot 資訊

- **Bot 基本 ID**: `@798sblaw`

<img src="assets/qr_code.png" alt="QR Code" width="200">

## 主要功能
1. **找餐廳**
   - 排序方式：餐廳按照評論數優先排序，其次為評分高低。
2. **收藏名單**
   - 用戶可以將「找餐廳」中的餐廳新增至收藏名單。
3. **隨機推薦**
   - 從用戶的收藏名單中隨機推薦一家餐廳。

更多詳細資訊，請參考[文件](https://hackmd.io/@-nXGMy8zTgK2nBlGiHohww/S1QC2z6Eye)。

<div style="display: flex; flex-wrap: wrap; gap: 10px;">
    <img src="assets/1.jpg" style="width: 200px; height: auto; object-fit: cover;">
    <img src="assets/2.jpg" style="width: 200px; height: auto; object-fit: cover;">
    <img src="assets/3.jpg" style="width: 200px; height: auto; object-fit: cover;">
    <img src="assets/4.jpg" style="width: 200px; height: auto; object-fit: cover;">
    <img src="assets/5.jpg" style="width: 200px; height: auto; object-fit: cover;">
    <img src="assets/6.jpg" style="width: 200px; height: auto; object-fit: cover;">
    <img src="assets/7.jpg" style="width: 200px; height: auto; object-fit: cover;">
    <img src="assets/8.jpg" style="width: 200px; height: auto; object-fit: cover;">
</div>

## 本地開發

1. 複製 `.env.example` 為 `.env` 並填入各項設定。
2. `yarn install` 後執行 `yarn dev`。
3. 設定 `IS_LOCAL=true` 時，會透過 ngrok 建立公開網址作為 Webhook URL，需在 `NGROK_AUTHTOKEN` 填入 [ngrok authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)。ngrok（`@ngrok/ngrok`）只是本地開發用的 devDependency，正式環境不會載入。

## 安全性

依賴升級紀錄與目前已知尚未解決的問題，請見 [docs/security-log.zh-TW.md](docs/security-log.zh-TW.md)（[English](docs/security-log.md)）。

## 貢獻指南

請參考[貢獻指南](.github/CONTRIBUTING.md)。

### 貢獻者

<a href="https://github.com/pg56714/line-dine-mapper/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=pg56714/line-dine-mapper" />
</a>

## 授權條款

本專案採用 [MIT 授權條款](LICENSE)。
