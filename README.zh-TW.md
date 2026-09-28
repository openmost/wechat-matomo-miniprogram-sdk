# @openmost/wechat-matomo-miniprogram-sdk

[簡體中文](README.md) | 繁體中文 | [English](README.en.md)

[![CI](https://github.com/openmost/wechat-matomo-miniprogram-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/openmost/wechat-matomo-miniprogram-sdk/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@openmost/wechat-matomo-miniprogram-sdk.svg)](https://www.npmjs.com/package/@openmost/wechat-matomo-miniprogram-sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

一個零依賴、專為微信小程式打造的 [Matomo](https://matomo.org) 數據分析 SDK。

> [!TIP]
> 需要 Matomo 方面的協助嗎？無論是稽核、部署設定、追蹤規劃、資料品質、效能優化、儀表板，
> 還是在你自己位於中國的伺服器上安裝 Matomo，Matomo 專家 Openmost 都能為你提供協助：https://openmost.com · ronan@openmost.com

## 特點

- 自動頁面瀏覽統計 —— 包裝 `App`/`Page`/`Component`，不需要在每個頁面手動埋點即可追蹤導覽
- 微信場景值 → 行銷活動（campaign）歸因（掃碼、分享、搜尋、廣告、公眾號、視頻號等）
- 分享追蹤（`onShareAppMessage`/`onShareTimeline`），並在分享連結上附加行銷活動參數
- 自訂事件、站內搜尋、目標轉換、外部連結與下載
- 電商：商品瀏覽、購物車更新、訂單，以及可選的微信支付事件（`trackPayments`）
- 自訂維度
- 使用者 ID
- 追蹤同意與 Cookie 同意（本次工作階段、帶有效期限的記住、撤回）及退出追蹤 —— 與 Matomo JS 同意 API 一致
- 離線佇列，支援批次傳送、指數退避重試與容量上限 —— 尚未送出的資料在重新啟動與長時間離線後依然保留，最長 23 小時
- 零執行期依賴
- **壓縮後 < 40 KB**（實測 33,393 位元組）
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

| 選項               | 型別                              | 預設值           | 說明                                                                                                   |
| ------------------ | --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| `trackerUrl`       | string                            | 必填             | 僅支援 https；會被自動標準化（移除 `matomo.php`、`index.php`、查詢字串、hash；補齊結尾 `/`）           |
| `siteId`           | number \| string                  | 必填             | `^[1-9]\d*$`                                                                                           |
| `trackerPath`      | string                            | `matomo.php`     | 用於反向代理情境                                                                                       |
| `autoTrackPages`   | boolean                           | `true`           | 包裝 `App` / `Page` / `Component`                                                                      |
| `pageTitles`       | `Record<string,string>`           | `{}`             | 路由 → 標題；未設定時使用路由本身（與 `navigationBarTitleText` 無關）                                  |
| `excludedRoutes`   | string[]                          | `[]`             | 路由前綴比對（忽略開頭的 `/`），如 `pages/debug/`                                                      |
| `trackShares`      | boolean                           | `true`           | 分享時傳送 `Share` / `Share to chat` / `share_to_chat` 或 `Share to Moments` / `share_to_moments` 事件 |
| `trackPayments`    | boolean                           | `false`          | 包裝 `wx.requestPayment`，傳送 GA4 風格的付款事件                                                      |
| `shareCampaign`    | string \| false                   | `'wechat_share'` | 以 `mtm_campaign` 形式附加到分享路徑                                                                   |
| `trackScenes`      | boolean                           | `true`           | 將入口場景值對應為行銷活動/來源                                                                        |
| `requireConsent`   | `false \| 'tracking' \| 'cookie'` | `false`          | 與 Matomo JS 的同意模式語義一致                                                                        |
| `userId`           | string                            | —                | 也可稍後透過 `setUserId` 設定                                                                          |
| `customDimensions` | `Record<number,string>`           | `{}`             | 索引範圍 1–999                                                                                         |
| `heartbeat`        | number                            | `15`             | 單位秒；0 表示停用；透過 `onHide` 時的 `ping=1` 傳送                                                   |
| `batchSize`        | number                            | `20`             | 每次批次請求包含的筆數                                                                                 |
| `flushInterval`    | number                            | `5000`           | 單位毫秒                                                                                               |
| `maxQueue`         | number                            | `500`            | 超出上限時優先捨棄最舊的紀錄                                                                           |
| `debug`            | boolean                           | `false`          | 主控台記錄輸出；正式環境除非明確開啟，否則不應啟用                                                     |
| `disabled`         | boolean                           | `false`          | 總開關                                                                                                 |

`init` 收到不合法設定時的行為詳見 [`docs/api.md`](./docs/api.md)。

## 使用範例

**事件：**

Matomo 沒有官方的事件命名慣例，因此本 SDK 採用業界廣泛使用的 GA4
[建議事件](https://support.google.com/analytics/answer/9267735?hl=en)命名慣例：`category`（類別）是易讀的分組名稱，`action`（動作）是首字母大寫的事件名稱片語，
事件的 `name`（第三個參數，對應 Matomo 的 `e_n`）則是 GA4 風格的 snake_case 名稱 —— 如此一來，Matomo 的
**Events > Name**（事件 > 名稱）呈現方式就會與 GA4 的事件名稱風格一致。

```js
Matomo.trackEvent('Product', 'Add to cart', 'add_to_cart', 59.9);
```

SDK 的自動事件以及建議的手動事件都遵循同一慣例：

| 類別        | 動作                | 名稱                | 傳送方式                                                       |
| ----------- | ------------------- | ------------------- | -------------------------------------------------------------- |
| `Ecommerce` | `Begin checkout`    | `begin_checkout`    | 自動：呼叫 `wx.requestPayment` 時（`trackPayments`，預設關閉） |
| `Ecommerce` | `Purchase`          | `purchase`          | 自動：付款成功時                                               |
| `Ecommerce` | `Payment cancelled` | `payment_cancelled` | 自動：使用者取消付款時（`requestPayment:fail cancel`）         |
| `Ecommerce` | `Payment failed`    | `payment_failed`    | 自動：其他原因導致付款失敗時                                   |
| `Share`     | `Share to chat`     | `share_to_chat`     | 自動：`onShareAppMessage`（`trackShares`，預設開啟）           |
| `Share`     | `Share to Moments`  | `share_to_moments`  | 自動：`onShareTimeline`（`trackShares`）                       |
| `Auth`      | `Login`             | `login`             | 手動：你自己的登入流程成功後傳送，並同時呼叫 `setUserId()`     |
| `Auth`      | `Sign up`           | `sign_up`           | 手動：新帳號註冊成功後傳送                                     |

```js
Matomo.setUserId(hashedUserId);
Matomo.trackEvent('Auth', 'Login', 'login');
```

`Login` 與 `Sign up` 不會被自動追蹤：多數小程式會在每次啟動時靜默呼叫 `wx.login` 更新登入憑證（code），
這並非使用者登入，自動統計會導致數據虛增。

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

**電商 —— 微信支付（`trackPayments: true`，預設關閉）：** SDK 會包裝 `wx.requestPayment` 並傳送上表中的 `Ecommerce` 事件：
呼叫後傳送 `Begin checkout` / `begin_checkout`；付款成功時傳送 `Purchase` / `purchase`；
使用者取消（`requestPayment:fail cancel`）時傳送 `Payment cancelled` / `payment_cancelled`；其他失敗傳送
`Payment failed` / `payment_failed`。你的 `success`/`fail`/`complete` 回呼以及回傳的 Promise 與未接入 SDK
時的行為完全一致。若 `wx.requestPayment` 無法被替換，此選項會靜默停用（`debug: true` 時會輸出日誌）。

`wx.requestPayment` 只接收簽名參數（`timeStamp`、`nonceStr`、`package`、`signType`、`paySign`），沒有金額與
商品資訊 —— 因此營收資料仍需在 `success` 回呼中呼叫 `trackEcommerceOrder(...)`：

```js
Matomo.init({ trackerUrl: 'https://stats.example.cn', siteId: 3, trackPayments: true });

// wx.requestPayment 只接收簽名參數：請在付款成功時自行記錄訂單
wx.requestPayment({
  timeStamp,
  nonceStr,
  package: prepayPackage,
  signType: 'RSA',
  paySign,
  success() {
    Matomo.trackEcommerceOrder(orderId, 119.8);
  },
});
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
  Matomo.rememberConsentGiven(); // 會儲存：之後啟動時直接視為已同意
  // Matomo.setConsentGiven(); // 或者：僅在本次工作階段內有效
}
function onDecline() {
  Matomo.optOut(); // 會儲存；永遠優先
}
```

與 Matomo JS 一致，使用者同意之前產生的頁面瀏覽與事件不會遺失：它們僅保存在記憶體中（不會寫入本地儲存，最多
100 筆），並在使用者同意後立即依原始時間傳送。呼叫 `optOut()` 或 `forgetConsentGiven()` 會捨棄這些資料；若使用者
在同意之前關閉小程式，這些資料也會遺失。

同意 API 與 Matomo JS 一致：追蹤同意（`requireConsent`、`setConsentGiven`、`rememberConsentGiven(hoursToExpire?)`、
`forgetConsentGiven`、`hasRememberedConsent`、`getRememberedConsent`、`isConsentRequired`）與 Cookie 同意
（`requireCookieConsent`、`setCookieConsentGiven`、`rememberCookieConsentGiven(hoursToExpire?)`、
`forgetCookieConsentGiven`、`getRememberedCookieConsent`、`areCookiesEnabled`）。在小程式中，"Cookie" 指 SDK
的本地儲存（訪客 ID 與離線佇列）：使用 `requireConsent: 'cookie'` 時資料會立即傳送，但在使用者給出 Cookie 同意
之前不會寫入任何儲存；只要缺少 Cookie 同意（呼叫了 `forgetCookieConsentGiven()`，或記住的同意已過期），已儲存
的資料就會被刪除。追蹤同意包含 Cookie 同意；`set*` 僅在本次工作階段內有效，`remember*` 會儲存到裝置上（可設定
以小時為單位的有效期限）。在等待追蹤同意期間不會傳送任何資料（包括先前已排入佇列的資料），已儲存的訪客 ID 會
繼續沿用但不會被更新。`forgetConsentGiven()` 的撤回狀態會儲存在裝置上：之後每次啟動都需要重新取得同意，直到
使用者再次同意為止。`optOut()` 永遠優先，並會刪除已儲存的訪客 ID 與佇列。詳見
[同意概覽](./docs/api.md#consent-overview)。

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

Matomo 專家 [Openmost](https://openmost.com)（ronan@openmost.com）可為 Matomo 及本 SDK 提供協助：稽核、部署設定、
追蹤規劃、資料品質、效能優化、儀表板，以及在你自己位於中國的伺服器上安裝 Matomo。

## 授權條款

MIT —— 詳見 [LICENSE](./LICENSE)。
</content>
