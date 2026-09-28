# @openmost/wechat-matomo-miniprogram-sdk

[簡體中文](README.md) | 繁體中文 | [English](README.en.md)

[![CI](https://github.com/openmost/wechat-matomo-miniprogram-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/openmost/wechat-matomo-miniprogram-sdk/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@openmost/wechat-matomo-miniprogram-sdk.svg)](https://www.npmjs.com/package/@openmost/wechat-matomo-miniprogram-sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

一個零依賴、專為微信小程式打造的 [Matomo](https://matomo.org) 數據分析 SDK。

## 特點

- 自動頁面瀏覽統計 —— 包裝 `App`/`Page`/`Component`，不需要在每個頁面手動埋點即可追蹤導覽
- 微信場景值 → 行銷活動（campaign）歸因（掃碼、分享、搜尋、廣告、公眾號、視頻號等）
- 分享追蹤（`onShareAppMessage`/`onShareTimeline`），並在分享連結上附加行銷活動參數
- 自訂事件、站內搜尋、目標轉換、外部連結與下載
- 電商：商品瀏覽、購物車更新、訂單
- 自訂維度
- 使用者 ID
- 同意模式（`tracking` / `cookie`）與退出追蹤，語義與 Matomo JS 保持一致
- 離線佇列，支援批次傳送、指數退避重試與容量上限 —— 尚未送出的資料在重新啟動與長時間離線後依然保留，最長 23 小時
- 零執行期依賴
- **壓縮後 < 32 KB**（實測 30,253 位元組）
- 完整 TypeScript 型別定義
- 相容 WebView 與 Skyline 渲染引擎

## 環境需求

- 微信小程式基礎函式庫 **≥ 2.2.1**（微信開發者工具的 npm 支援）
- Matomo **≥ 4**
- 一個已啟用 HTTPS 且已完成 ICP 備案的統計伺服器網域，並已加入小程式的 `request合法域名` 白名單 —— 如果你使用
  Matomo Cloud 或部署於中國大陸境外，請參閱 [`docs/china-icp.md`](./docs/china-icp.md)

## 安裝

```bash
npm i @openmost/wechat-matomo-miniprogram-sdk
```

接著在微信開發者工具中執行：**工具 → 構建 npm**。

```js
// app.js —— 必須在 App() 之前執行
const { Matomo } = require('@openmost/wechat-matomo-miniprogram-sdk');

Matomo.init({
  trackerUrl: 'https://stats.example.cn', // 基礎網址；會自動加上 matomo.php
  siteId: 3,
});

App({/* 不變 */});
```

請在 開發管理 → 伺服器網域 → **request合法域名** 中加入統計伺服器網域。

## 設定選項

| 選項               | 型別                              | 預設值           | 說明                                                                                         |
| ------------------ | --------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| `trackerUrl`       | string                            | 必填             | 僅支援 https；會被自動標準化（移除 `matomo.php`、`index.php`、查詢字串、hash；補齊結尾 `/`） |
| `siteId`           | number \| string                  | 必填             | `^[1-9]\d*$`                                                                                 |
| `trackerPath`      | string                            | `matomo.php`     | 用於反向代理情境                                                                             |
| `autoTrackPages`   | boolean                           | `true`           | 包裝 `App` / `Page` / `Component`                                                            |
| `pageTitles`       | `Record<string,string>`           | `{}`             | 路由 → 標題；未設定時使用路由本身（與 `navigationBarTitleText` 無關）                        |
| `excludedRoutes`   | string[]                          | `[]`             | 路由前綴比對（忽略開頭的 `/`），如 `pages/debug/`                                            |
| `trackShares`      | boolean                           | `true`           | 在 `onShareAppMessage` / `onShareTimeline` 上傳送事件                                        |
| `shareCampaign`    | string \| false                   | `'wechat_share'` | 以 `mtm_campaign` 形式附加到分享路徑                                                         |
| `trackScenes`      | boolean                           | `true`           | 將入口場景值對應為行銷活動/來源                                                              |
| `requireConsent`   | `false \| 'tracking' \| 'cookie'` | `false`          | 與 Matomo JS 的同意模式語義一致                                                              |
| `userId`           | string                            | —                | 也可稍後透過 `setUserId` 設定                                                                |
| `customDimensions` | `Record<number,string>`           | `{}`             | 索引範圍 1–999                                                                               |
| `heartbeat`        | number                            | `15`             | 單位秒；0 表示停用；透過 `onHide` 時的 `ping=1` 傳送                                         |
| `batchSize`        | number                            | `20`             | 每次批次請求包含的筆數                                                                       |
| `flushInterval`    | number                            | `5000`           | 單位毫秒                                                                                     |
| `maxQueue`         | number                            | `500`            | 超出上限時優先捨棄最舊的紀錄                                                                 |
| `debug`            | boolean                           | `false`          | 主控台記錄輸出；正式環境除非明確開啟，否則不應啟用                                           |
| `disabled`         | boolean                           | `false`          | 總開關                                                                                       |

`init` 收到不合法設定時的行為詳見 [`docs/api.md`](./docs/api.md)。

## 使用範例

**事件：**

遵循 GA4 的命名慣例：`category`（類別）與 `action`（動作）使用人類可讀的文字（如 `'Product'`、
`'Add to cart'`），而事件的 `name`（第三個參數，對應 Matomo 的 `e_n`）則使用 snake_case 形式的事件名稱，如
`'add_to_cart'` —— 如此一來，Matomo 的 **Events > Name**（事件 > 名稱）呈現方式就會與 GA4 的事件名稱一致。

```js
Matomo.trackEvent('Product', 'Add to cart', 'add_to_cart', 59.9);
```

**站內搜尋：**

```js
Matomo.trackSiteSearch('running shoes', 'Shoes', 12);
```

**電商 —— 商品頁（於 `onLoad` 中呼叫 `setEcommerceView`，須早於自動頁面瀏覽的傳送）：**

```js
Page({
  onLoad(query) {
    Matomo.setEcommerceView(query.sku, 'Running shoes', 'Shoes', 59.9);
  },
});
```

**電商 —— 購物車更新：**

```js
Matomo.addEcommerceItem('SKU123', 'Running shoes', 'Shoes', 59.9, 2);
Matomo.trackEcommerceCartUpdate(119.8);
```

**電商 —— 訂單：**

```js
Matomo.trackEcommerceOrder('ORDER-42', 119.8, 99.8, 10, 10, 0);
```

**使用者 ID** —— 請使用基於你自有帳號體系產生、經過雜湊/加鹽處理的識別碼，**切勿使用原始的微信
`openid`/`unionid`**；本 SDK 本身從不呼叫 `wx.login`：

```js
Matomo.setUserId(hashedUserId);
// 登出時：
Matomo.resetUserId();
```

**自訂維度：**

```js
Matomo.setCustomDimension(1, 'vip');
```

**同意（consent）流程**，需搭配你自己在首次啟動時顯示的隱私彈窗：

```js
// 使用 requireConsent 初始化，在使用者同意之前不會傳送任何資料
Matomo.init({
  trackerUrl: 'https://stats.example.cn',
  siteId: 3,
  requireConsent: 'tracking',
});

// 在你的隱私彈窗中：
function onAgree() {
  Matomo.setConsentGiven();
}
function onDecline() {
  Matomo.optOut();
}
```

與 Matomo JS 一致，使用者同意之前產生的頁面瀏覽與事件不會遺失：它們僅保存在記憶體中（不會寫入本地儲存，最多
100 筆），並在呼叫 `setConsentGiven()` 後立即依原始時間傳送。呼叫 `optOut()` 或 `forgetConsentGiven()` 會
捨棄這些資料；若使用者在同意之前關閉小程式，這些資料也會遺失。

完整 API 請參閱 [`docs/api.md`](./docs/api.md)；此流程具體收集哪些資料，可直接貼到隱私權政策中的文案見
[`docs/privacy-disclosure.md`](./docs/privacy-disclosure.md)。

## 頁面在 Matomo 中的呈現方式

頁面以 `app://<appId>/<route>?<query>` 的網址格式傳送，因此 Matomo 的 **行為 → 頁面** 報表會依小程式與路由
分類，而不是依一個籠統的網域。頁面標題（`action_name`）優先採用 `pageTitles[route]`，否則使用路由本身。

由於採用 `app://` 協定，Matomo 網站設定中的「僅追蹤以上述網址開頭的造訪與行為」（排除未知網址）必須保持關閉，
或是將 `app://<appId>` 加入該網站的網址清單 —— 否則 Matomo 會捨棄所有資料。

## 歸因（Attribution）

如果啟動（或前景進入）的查詢字串中已包含明確的行銷活動參數（`mtm_*`、`utm_*` 或 `pk_campaign`/`pk_kwd`），
則會直接採用這些參數。否則，在 `trackScenes: true`（預設值）的情況下，開啟小程式所使用的微信
[場景值](https://developers.weixin.qq.com/miniprogram/dev/reference/scene-list.html) 會被對應為
`wechat_<medium>` 行銷活動（例如 `wechat_share`、`wechat_qrcode`、`wechat_official_account`）。這些參數
僅會附加在 **新造訪的第一筆紀錄**上（30 分鐘無活動即視為新造訪，與 Matomo JS 一致）—— 完整場景值對照表與
優先順序規則見 [`docs/scenes.md`](./docs/scenes.md)。

Matomo 核心只會儲存行銷活動名稱與關鍵字（`mtm_campaign`、`mtm_kwd`）；`mtm_source`、`mtm_medium` 及其他
`mtm_*` 維度僅在安裝了 [MarketingCampaignsReporting](https://plugins.matomo.org/MarketingCampaignsReporting)
外掛時才會被儲存。

來自微信爬蟲（場景值 `1129`「微信爬蟲訪問」，用於為搜尋收錄小程式內容）的造訪完全不會被統計：既不會傳送任何
資料，也不會寫入本地儲存。

**已知限制：** 如果頁面的 `onShareAppMessage`/`onShareTimeline` 回傳 `{ promise }`（非同步形式），微信會採用
該 Promise 最終 resolve 的值，而不是處理函式同步回傳的物件 —— 因此本 SDK 附加在同步回傳值上的 `mtm_*` 分享
行銷活動參數在這種情況下不會生效。採用 Promise 形式的宿主小程式，應改為同步回傳分享物件，或是自行在
Promise resolve 的值中加入這些行銷活動參數。

## 隱私

可直接貼到你隱私權政策與用戶隱私保護指引中的文案見
[`docs/privacy-disclosure.md`](./docs/privacy-disclosure.md)。

**會收集：** 裝置型號、作業系統、微信版本、螢幕尺寸、語言、瀏覽的頁面、你設定追蹤的事件，以及隨機產生的
訪客 ID。

**絕不收集：** 微信 `openid`、`unionid`、電話號碼或地理位置。

## API 參考

完整方法列表見 [`docs/api.md`](./docs/api.md)。

## 範例

一個可在微信開發者工具中直接執行、涵蓋本 SDK 全部功能的範例小程式位於
[`example/README.md`](./example/README.md)。

## 支援

[Openmost](https://openmost.com)（support@openmost.com）為 Matomo 及本 SDK 提供建置、託管與教育訓練服務。

## 授權條款

MIT —— 詳見 [LICENSE](./LICENSE)。
</content>
