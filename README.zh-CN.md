# wechat-matomo-miniprogram-sdk

[![CI](https://github.com/openmost/wechat-matomo-miniprogram-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/openmost/wechat-matomo-miniprogram-sdk/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/wechat-matomo-miniprogram-sdk.svg)](https://www.npmjs.com/package/wechat-matomo-miniprogram-sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

面向微信小程序的零依赖 [Matomo](https://matomo.org) 统计分析 SDK。

[English →](./README.md)

## 特性

- 自动页面访问统计 —— 包装 `App`/`Page`/`Component`，无需在每个页面手动埋点即可追踪导航
- 微信场景值 → 营销活动（campaign）归因（扫码、分享、搜索、广告、公众号、视频号等）
- 分享追踪（`onShareAppMessage`/`onShareTimeline`），并在分享链接上附加营销活动参数
- 自定义事件、站内搜索、目标转化、外链与下载
- 电商：商品浏览、购物车更新、订单
- 自定义维度
- 用户 ID
- 同意模式（`tracking` / `cookie`）与退出追踪，语义与 Matomo JS 保持一致
- 离线队列，支持批量发送、指数退避重试与容量上限 —— 未发送的数据在重启和长时间离线后依然保留，最长 23 小时
- 零运行时依赖
- **压缩后 < 32 KB**（实测 29,844 字节）
- 完整 TypeScript 类型定义
- 兼容 WebView 与 Skyline 渲染引擎

## 环境要求

- 微信小程序基础库 **≥ 2.2.1**（微信开发者工具的 npm 支持）
- Matomo **≥ 4**
- 一个已启用 HTTPS 且已完成 ICP 备案的统计服务器域名，并已加入小程序的 `request合法域名` 白名单 —— 如果你使用
  Matomo Cloud 或部署在中国大陆境外，请参阅 [`docs/china-icp.md`](./docs/china-icp.md)

## 安装

```bash
npm i wechat-matomo-miniprogram-sdk
```

然后在微信开发者工具中执行：**工具 → 构建 npm**。

```js
// app.js —— 必须在 App() 之前执行
const { Matomo } = require('wechat-matomo-miniprogram-sdk');

Matomo.init({
  trackerUrl: 'https://stats.example.cn', // 基础地址；会自动追加 matomo.php
  siteId: 3,
});

App({/* 不变 */});
```

请在 开发管理 → 服务器域名 → **request合法域名** 中添加统计服务器域名。

## 配置项

| 选项               | 类型                              | 默认值           | 说明                                                                                         |
| ------------------ | --------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| `trackerUrl`       | string                            | 必填             | 仅支持 https；会被自动标准化（去除 `matomo.php`、`index.php`、查询参数、hash；补齐末尾 `/`） |
| `siteId`           | number \| string                  | 必填             | `^[1-9]\d*$`                                                                                 |
| `trackerPath`      | string                            | `matomo.php`     | 用于反向代理场景                                                                             |
| `autoTrackPages`   | boolean                           | `true`           | 包装 `App` / `Page` / `Component`                                                            |
| `pageTitles`       | `Record<string,string>`           | `{}`             | 路由 → 标题；未配置时使用路由本身（与 `navigationBarTitleText` 无关）                        |
| `excludedRoutes`   | string[]                          | `[]`             | 路由前缀匹配（忽略开头的 `/`），如 `pages/debug/`                                            |
| `trackShares`      | boolean                           | `true`           | 在 `onShareAppMessage` / `onShareTimeline` 上发送事件                                        |
| `shareCampaign`    | string \| false                   | `'wechat_share'` | 以 `mtm_campaign` 形式附加到分享路径                                                         |
| `trackScenes`      | boolean                           | `true`           | 将入口场景值映射为营销活动/来源                                                              |
| `requireConsent`   | `false \| 'tracking' \| 'cookie'` | `false`          | 与 Matomo JS 的同意模式语义一致                                                              |
| `userId`           | string                            | —                | 也可稍后通过 `setUserId` 设置                                                                |
| `customDimensions` | `Record<number,string>`           | `{}`             | 索引范围 1–999                                                                               |
| `heartbeat`        | number                            | `15`             | 单位秒；0 表示禁用；通过 `onHide` 时的 `ping=1` 发送                                         |
| `batchSize`        | number                            | `20`             | 每次批量请求包含的记录数                                                                     |
| `flushInterval`    | number                            | `5000`           | 单位毫秒                                                                                     |
| `maxQueue`         | number                            | `500`            | 超出后优先丢弃最旧的记录                                                                     |
| `debug`            | boolean                           | `false`          | 控制台日志输出；除非显式开启，生产环境不应启用                                               |
| `disabled`         | boolean                           | `false`          | 总开关                                                                                       |

`init` 接收到非法配置时的行为详见 [`docs/api.md`](./docs/api.md)。

## 使用示例

**事件：**

```js
Matomo.trackEvent('Video', 'play', 'intro.mp4');
```

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
  Matomo.setConsentGiven();
}
function onDecline() {
  Matomo.optOut();
}
```

与 Matomo JS 一致，用户同意之前产生的页面访问和事件不会丢失：它们只保存在内存中（不会写入本地存储，最多 100
条），并在调用 `setConsentGiven()` 后立即按原始时间发送。调用 `optOut()` 或 `forgetConsentGiven()` 会丢弃这些数据；
如果用户在同意之前关闭了小程序，这些数据也会丢失。

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

[Openmost](https://openmost.com)（support@openmost.com）为 Matomo 及本 SDK 提供部署、托管与培训服务。

## 许可证

MIT —— 详见 [LICENSE](./LICENSE)。
