# @openmost/wechat-matomo-miniprogram-sdk

简体中文 | [繁體中文](README.zh-TW.md) | [English](README.en.md)

[![CI](https://github.com/openmost/wechat-matomo-miniprogram-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/openmost/wechat-matomo-miniprogram-sdk/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@openmost/wechat-matomo-miniprogram-sdk.svg)](https://www.npmjs.com/package/@openmost/wechat-matomo-miniprogram-sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

面向微信小程序的零依赖 [Matomo](https://matomo.org) 统计分析 SDK。

> [!TIP]
> 需要 Matomo 方面的帮助吗？无论是审计、部署配置、埋点方案、数据质量、性能优化、数据看板，
> 还是在你自己位于中国的服务器上安装 Matomo，Matomo 专家 Openmost 都能为你提供支持：https://openmost.com · ronan@openmost.com

## 特性

- 自动页面访问统计 —— 包装 `App`/`Page`/`Component`，无需在每个页面手动埋点即可追踪导航
- 微信场景值 → 营销活动（campaign）归因（扫码、分享、搜索、广告、公众号、视频号等）
- 分享追踪（`onShareAppMessage`/`onShareTimeline`），并在分享链接上附加营销活动参数
- 自定义事件、站内搜索、目标转化、外链与下载
- 电商：商品浏览、购物车更新、订单，以及可选的微信支付事件（`trackPayments`）
- 自定义维度
- 用户 ID
- 追踪同意与 Cookie 同意（本次会话、带有效期的记住、撤回）及退出追踪 —— 与 Matomo JS 同意 API 一致
- 离线队列，支持批量发送、指数退避重试与容量上限 —— 未发送的数据在重启和长时间离线后依然保留，最长 23 小时
- 零运行时依赖
- **压缩后 < 40 KB**（实测 33,393 字节）
- 完整 TypeScript 类型定义
- 兼容 WebView 与 Skyline 渲染引擎

## 环境要求

- 微信小程序基础库 **≥ 2.2.1**（微信开发者工具的 npm 支持）
- Matomo **≥ 4**
- 一个已启用 HTTPS 且已完成 ICP 备案的统计服务器域名，并已加入小程序的 `request合法域名` 白名单 —— 如果你使用
  Matomo Cloud 或部署在中国大陆境外，请参阅 [`docs/china-icp.md`](./docs/china-icp.md)

## 安装

```bash
npm i @openmost/wechat-matomo-miniprogram-sdk
```

然后在微信开发者工具中执行：**工具 → 构建 npm**。

```js
// app.js —— 必须在 App() 之前执行
const { Matomo } = require('@openmost/wechat-matomo-miniprogram-sdk');

Matomo.init({
  trackerUrl: 'https://stats.example.cn', // 基础地址；会自动追加 matomo.php
  siteId: 3,
});

App({/* 不变 */});
```

请在 开发管理 → 服务器域名 → **request合法域名** 中添加统计服务器域名。

## 配置项

| 选项               | 类型                              | 默认值           | 说明                                                                                                   |
| ------------------ | --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| `trackerUrl`       | string                            | 必填             | 仅支持 https；会被自动标准化（去除 `matomo.php`、`index.php`、查询参数、hash；补齐末尾 `/`）           |
| `siteId`           | number \| string                  | 必填             | `^[1-9]\d*$`                                                                                           |
| `trackerPath`      | string                            | `matomo.php`     | 用于反向代理场景                                                                                       |
| `autoTrackPages`   | boolean                           | `true`           | 包装 `App` / `Page` / `Component`                                                                      |
| `pageTitles`       | `Record<string,string>`           | `{}`             | 路由 → 标题；未配置时使用路由本身（与 `navigationBarTitleText` 无关）                                  |
| `excludedRoutes`   | string[]                          | `[]`             | 路由前缀匹配（忽略开头的 `/`），如 `pages/debug/`                                                      |
| `trackShares`      | boolean                           | `true`           | 分享时发送 `Share` / `Share to chat` / `share_to_chat` 或 `Share to Moments` / `share_to_moments` 事件 |
| `trackPayments`    | boolean                           | `false`          | 包装 `wx.requestPayment`，发送 GA4 风格的支付事件                                                      |
| `shareCampaign`    | string \| false                   | `'wechat_share'` | 以 `mtm_campaign` 形式附加到分享路径                                                                   |
| `trackScenes`      | boolean                           | `true`           | 将入口场景值映射为营销活动/来源                                                                        |
| `requireConsent`   | `false \| 'tracking' \| 'cookie'` | `false`          | 与 Matomo JS 的同意模式语义一致                                                                        |
| `userId`           | string                            | —                | 也可稍后通过 `setUserId` 设置                                                                          |
| `customDimensions` | `Record<number,string>`           | `{}`             | 索引范围 1–999                                                                                         |
| `heartbeat`        | number                            | `15`             | 单位秒；0 表示禁用；通过 `onHide` 时的 `ping=1` 发送                                                   |
| `batchSize`        | number                            | `20`             | 每次批量请求包含的记录数                                                                               |
| `flushInterval`    | number                            | `5000`           | 单位毫秒                                                                                               |
| `maxQueue`         | number                            | `500`            | 超出后优先丢弃最旧的记录                                                                               |
| `debug`            | boolean                           | `false`          | 控制台日志输出；除非显式开启，生产环境不应启用                                                         |
| `disabled`         | boolean                           | `false`          | 总开关                                                                                                 |

`init` 接收到非法配置时的行为详见 [`docs/api.md`](./docs/api.md)。

## 使用示例

**事件：**

Matomo 没有官方的事件命名规范，因此本 SDK 采用业界广泛使用的 GA4
[推荐事件](https://support.google.com/analytics/answer/9267735?hl=en)命名规范：`category`（类别）是可读的分组名，`action`（操作）是首字母大写的事件名短语，
事件的 `name`（第三个参数，对应 Matomo 的 `e_n`）则是 GA4 风格的 snake_case 名称 —— 这样 Matomo 中
**Events > Name**（事件 > 名称）的呈现方式就和 GA4 的事件名风格一致。

```js
Matomo.trackEvent('Product', 'Add to cart', 'add_to_cart', 59.9);
```

SDK 的自动事件以及推荐的手动事件都遵循同一规范：

| 类别        | 操作                | 名称                | 发送方式                                                       |
| ----------- | ------------------- | ------------------- | -------------------------------------------------------------- |
| `Ecommerce` | `Begin checkout`    | `begin_checkout`    | 自动：调用 `wx.requestPayment` 时（`trackPayments`，默认关闭） |
| `Ecommerce` | `Purchase`          | `purchase`          | 自动：支付成功时                                               |
| `Ecommerce` | `Payment cancelled` | `payment_cancelled` | 自动：用户取消支付时（`requestPayment:fail cancel`）           |
| `Ecommerce` | `Payment failed`    | `payment_failed`    | 自动：其他原因导致支付失败时                                   |
| `Share`     | `Share to chat`     | `share_to_chat`     | 自动：`onShareAppMessage`（`trackShares`，默认开启）           |
| `Share`     | `Share to Moments`  | `share_to_moments`  | 自动：`onShareTimeline`（`trackShares`）                       |
| `Auth`      | `Login`             | `login`             | 手动：你自己的登录流程成功后发送，并同时调用 `setUserId()`     |
| `Auth`      | `Sign up`           | `sign_up`           | 手动：新账号注册成功后发送                                     |

```js
Matomo.setUserId(hashedUserId);
Matomo.trackEvent('Auth', 'Login', 'login');
```

`Login` 和 `Sign up` 不会被自动追踪：大多数小程序会在每次启动时静默调用 `wx.login` 刷新登录凭证（code），
这并不是用户登录，自动统计会导致数据虚高。

**站内搜索：**

```js
Matomo.trackSiteSearch('running shoes', 'Shoes', 12);
```

**电商 —— 商品页（在 `onLoad` 中调用 `setEcommerceView`，需早于自动页面访问的发送）：**

```js
Page({
  onLoad(query) {
    Matomo.setEcommerceView(query.sku, 'Running shoes', 'Shoes', 59.9);
  },
});
```

**电商 —— 购物车更新：**

```js
Matomo.addEcommerceItem('SKU123', 'Running shoes', 'Shoes', 59.9, 2);
Matomo.trackEcommerceCartUpdate(119.8);
```

**电商 —— 订单：**

```js
Matomo.trackEcommerceOrder('ORDER-42', 119.8, 99.8, 10, 10, 0);
```

**电商 —— 微信支付（`trackPayments: true`，默认关闭）：** SDK 会包装 `wx.requestPayment` 并发送上表中的 `Ecommerce` 事件：
调用后发送 `Begin checkout` / `begin_checkout`；支付成功时发送 `Purchase` / `purchase`；
用户取消（`requestPayment:fail cancel`）时发送 `Payment cancelled` / `payment_cancelled`；其他失败发送
`Payment failed` / `payment_failed`。你的 `success`/`fail`/`complete` 回调以及返回的 Promise 与未接入 SDK
时的行为完全一致。如果 `wx.requestPayment` 无法被替换，该选项会静默停用（`debug: true` 时会输出日志）。

`wx.requestPayment` 只接收签名参数（`timeStamp`、`nonceStr`、`package`、`signType`、`paySign`），没有金额和
商品信息 —— 因此收入数据仍需在 `success` 回调中调用 `trackEcommerceOrder(...)`：

```js
Matomo.init({ trackerUrl: 'https://stats.example.cn', siteId: 3, trackPayments: true });

// wx.requestPayment 只接收签名参数：请在支付成功时自行记录订单
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

**用户 ID** —— 请使用基于你自有账号体系生成的、经过哈希/加盐处理的标识符，**切勿使用原始的微信 `openid`/
`unionid`**；本 SDK 自身从不调用 `wx.login`：

```js
Matomo.setUserId(hashedUserId);
// 退出登录时：
Matomo.resetUserId();
```

**自定义维度：**

```js
Matomo.setCustomDimension(1, 'vip');
```

**同意（consent）流程**，与你自己在首次启动时展示的隐私弹窗配合使用：

```js
// 使用 requireConsent 初始化，在用户同意之前不会发送任何数据
Matomo.init({
  trackerUrl: 'https://stats.example.cn',
  siteId: 3,
  requireConsent: 'tracking',
});

// 在你的隐私弹窗中：
function onAgree() {
  Matomo.rememberConsentGiven(); // 会保存：之后启动时直接视为已同意
  // Matomo.setConsentGiven(); // 或者：仅在本次会话内有效
}
function onDecline() {
  Matomo.optOut(); // 会保存；始终优先
}
```

与 Matomo JS 一致，用户同意之前产生的页面访问和事件不会丢失：它们只保存在内存中（不会写入本地存储，最多 100
条），并在用户同意后立即按原始时间发送。调用 `optOut()` 或 `forgetConsentGiven()` 会丢弃这些数据；如果用户在同意
之前关闭了小程序，这些数据也会丢失。

同意 API 与 Matomo JS 一致：追踪同意（`requireConsent`、`setConsentGiven`、`rememberConsentGiven(hoursToExpire?)`、
`forgetConsentGiven`、`hasRememberedConsent`、`getRememberedConsent`、`isConsentRequired`）与 Cookie 同意
（`requireCookieConsent`、`setCookieConsentGiven`、`rememberCookieConsentGiven(hoursToExpire?)`、
`forgetCookieConsentGiven`、`getRememberedCookieConsent`、`areCookiesEnabled`）。在小程序中，"Cookie" 指 SDK
的本地存储（访客 ID 与离线队列）：使用 `requireConsent: 'cookie'` 时数据会立即发送，但在用户给出 Cookie 同意
之前不会写入任何存储；只要缺少 Cookie 同意（调用了 `forgetCookieConsentGiven()`，或记住的同意已过期），已保存
的数据就会被删除。追踪同意包含 Cookie 同意；`set*` 仅在本次会话内有效，`remember*` 会保存到设备上（可设置以
小时为单位的有效期）。在等待追踪同意期间不会发送任何数据（包括之前已排队的数据），已保存的访客 ID 会继续沿用
但不会被更新。`forgetConsentGiven()` 的撤回状态会保存在设备上：之后每次启动都需要重新获得同意，直到用户再次
同意为止。`optOut()` 始终优先，并会删除已保存的访客 ID 与队列。详见 [同意概览](./docs/api.md#consent-overview)。

完整 API 请参阅 [`docs/api.md`](./docs/api.md)；该流程具体收集哪些数据，可直接粘贴到隐私政策中的文案见
[`docs/privacy-disclosure.md`](./docs/privacy-disclosure.md)。

## 页面在 Matomo 中的呈现方式

页面以 `app://<appId>/<route>?<query>` 的 URL 格式发送，因此 Matomo 的 **行为 → 页面** 报表会按小程序和路由
组织，而不是按一个笼统的域名。页面标题（`action_name`）优先取 `pageTitles[route]`，否则使用路由本身。

由于使用了 `app://` 协议，Matomo 网站设置中的「仅追踪以上述 URL 开头的访问和行为」（排除未知 URL）必须保持关闭，
或者将 `app://<appId>` 添加到该网站的 URL 列表中 —— 否则 Matomo 会丢弃所有数据。

## 归因（Attribution）

如果启动（或前台进入）查询参数中已包含显式的营销活动参数（`mtm_*`、`utm_*` 或 `pk_campaign`/`pk_kwd`），则
直接使用这些参数。否则，在 `trackScenes: true`（默认值）的情况下，打开小程序所使用的微信
[场景值](https://developers.weixin.qq.com/miniprogram/dev/reference/scene-list.html) 会被映射为
`wechat_<medium>` 营销活动（例如 `wechat_share`、`wechat_qrcode`、`wechat_official_account`）。这些参数
仅会附加到 **新会话的第一条记录**上（30 分钟无活动即视为新会话，与 Matomo JS 一致）—— 完整场景值对照表与
优先级规则见 [`docs/scenes.md`](./docs/scenes.md)。

Matomo 核心只保存营销活动名称和关键词（`mtm_campaign`、`mtm_kwd`）；`mtm_source`、`mtm_medium` 及其他
`mtm_*` 维度仅在安装了 [MarketingCampaignsReporting](https://plugins.matomo.org/MarketingCampaignsReporting)
插件时才会被保存。

微信爬虫（场景值 `1129`「微信爬虫访问」，用于为搜索收录小程序内容）的访问完全不会被统计：既不发送任何数据，
也不会写入本地存储。

**已知限制：** 如果页面的 `onShareAppMessage`/`onShareTimeline` 返回 `{ promise }`（异步形式），微信会使用
该 Promise 最终 resolve 的值，而不是处理函数同步返回的对象 —— 因此本 SDK 附加在同步返回值上的 `mtm_*` 分享
营销活动参数在这种情况下不会生效。使用 Promise 形式的宿主小程序，应改为同步返回分享对象，或者自行在
Promise resolve 的值中添加这些营销活动参数。

## 隐私

可直接粘贴到你隐私政策和用户隐私保护指引中的文案见
[`docs/privacy-disclosure.md`](./docs/privacy-disclosure.md)。

**会收集：** 设备型号、操作系统、微信版本、屏幕尺寸、语言、访问的页面、你配置追踪的事件，以及随机生成的访客 ID。

**绝不收集：** 微信 `openid`、`unionid`、手机号或地理位置。

## API 参考

完整方法列表见 [`docs/api.md`](./docs/api.md)。

## 示例

一个可在微信开发者工具中直接运行、覆盖本 SDK 全部能力的示例小程序位于
[`example/README.md`](./example/README.md)。

## 支持

Matomo 专家 [Openmost](https://openmost.com)（ronan@openmost.com）可为 Matomo 及本 SDK 提供支持：审计、部署配置、
埋点方案、数据质量、性能优化、数据看板，以及在你自己位于中国的服务器上安装 Matomo。

## 许可证

MIT —— 详见 [LICENSE](./LICENSE)。
</content>
