# 安全性紀錄

[English](security-log.md) | 繁體中文

- 日期: 2026-10-25
- 分支: `fix/security-upgrades`
- 範圍: `package.json`、`yarn.lock`、`src/utils/ngrokUtil.ts`

## 摘要

已停止維護的 ngrok beta 套件換成官方 SDK，且只在本地開發時使用；依賴改從官方 npm registry 安裝，並在原主版本內升級。decode-uri-component 仍有一個影響很低的漏洞。

## 修改內容

| 項目 | 修改前 | 修改後 | 原因 |
|---|---|---|---|
| ngrok | 5.0.0-beta.2 (dependency) | removed | 有命令注入漏洞；已停止維護的 beta 版，安裝時會下載 ngrok 執行檔 |
| @ngrok/ngrok | - | ^1.7.0 (devDependency) | 官方 SDK；只有 `IS_LOCAL=true` 時才以動態 import 載入 |
| express | 4.21.2 | 4.22.3 | 在 4.x 內更新 |
| mongoose | 8.9.0 | 8.24.7 | 查詢注入、`$nor` 繞過 sanitizeFilter、原型汙染漏洞 |
| @line/bot-sdk | 9.5.0 | 9.9.0 | 更新 |
| axios | 1.7.9 (indirect) | 1.20.0 (direct) | SSRF、header 注入、DoS 漏洞；`googleMapsUtil.ts` 直接使用 |
| body-parser | 1.20.3 | removed | 沒有使用（且有 DoS 漏洞） |
| @types/mongoose | ^5.11.97 | removed | 已棄用的空殼套件（mongoose 已內建型別），會多裝一份 mongoose |
| yarn.lock registry | registry.npmmirror.com | registry.npmjs.org | 改用官方 registry |
| `tsconfig.json` | - | `skipLibCheck: true` | opencc-js 1.4 附帶的 `.d.ts` 在 NodeNext 解析下會報錯 |

## 使用前須知

- 本地開發請設定 `IS_LOCAL=true` 與 `NGROK_AUTHTOKEN`（見 `.env.example`）；正式環境不需要 ngrok。

## 尚未解決的問題

### 被上游限制的套件版本

| 套件 | 版本 | 漏洞 | 無法修正的原因 | 影響與因應 |
|---|---|---|---|---|
| decode-uri-component | 0.2.2 | 1 筆（0.5.0 修正） | 由 @googlemaps/google-maps-services-js 內的 query-string 7 帶入；修正只出現在純 ESM 的 0.5，query-string 7 無法載入。 | 解碼格式錯誤的百分比編碼時可能造成阻斷服務。Google Maps client 用 query-string 組出請求網址，不會解析使用者輸入。 |

### 需要修改程式才能解決

- 簽章錯誤的 LINE 請求會被拒絕，但因為沒有處理 `SignatureValidationFailed` 的錯誤處理器，Express 回應的是 500 而不是 401；加上錯誤處理器即可回應 401。

## 驗證方式

- `tsc`、`biome check`、`jest`（6 個測試）皆通過。
- 連接本地 MongoDB 測試：簽章正確的 webhook 請求回應 200，並會存取資料庫與呼叫 LINE 回覆 API；簽章錯誤的請求會被拒絕。
- 設定 `IS_LOCAL=true` 時，`@ngrok/ngrok` 能正常載入，連線失敗只會記錄錯誤，不會讓程式當掉。
- 以 osv-scanner 掃描 `yarn.lock`，只剩 decode-uri-component。

## 未驗證項目

- 實際建立 ngrok 通道（測試環境封鎖了 ngrok 連線）。
- 實際的 LINE 回覆與 Google Maps 查詢（需要真實 token）。
