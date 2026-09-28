# @openmost/wechat-matomo-miniprogram-sdk

[简体中文](README.md) | [繁體中文](README.zh-TW.md) | English

[![CI](https://github.com/openmost/wechat-matomo-miniprogram-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/openmost/wechat-matomo-miniprogram-sdk/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@openmost/wechat-matomo-miniprogram-sdk.svg)](https://www.npmjs.com/package/@openmost/wechat-matomo-miniprogram-sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A zero-dependency [Matomo](https://matomo.org) analytics SDK for WeChat mini programs (微信小程序).

## Features

- Automatic pageviews — wraps `App`/`Page`/`Component` so navigation is tracked without touching every page
- WeChat scene → campaign attribution (scan, share, search, ads, official account, video channel, …)
- Share tracking (`onShareAppMessage`/`onShareTimeline`) with campaign parameters appended to the shared link
- Custom events, site search, goals, outlinks and downloads
- Ecommerce: product view, cart updates, orders, and optional WeChat Pay events (`trackPayments`)
- Custom dimensions
- User ID
- Tracking and cookie consent (session, remembered with expiry, forget) and opt-out — the Matomo JS consent API
- Offline queue with bulk sending, exponential-backoff retry, and a size cap — unsent hits survive
  restarts and long offline periods for up to 23 hours
- Zero runtime dependencies
- **< 40 KB minified** (measured 32,758 B)
- Full TypeScript types
- Works in the WebView and Skyline rendering engines

## Requirements

- WeChat mini program base library **≥ 2.2.1** (npm support in WeChat DevTools)
- Matomo **≥ 4**
- An HTTPS, ICP-filed tracker domain added to your mini program's `request合法域名` allowlist — see
  [`docs/china-icp.md`](./docs/china-icp.md) if your Matomo instance is on Matomo Cloud or hosted outside
  mainland China

## Install

```bash
npm i @openmost/wechat-matomo-miniprogram-sdk
```

Then, in WeChat DevTools: **工具 → 构建 npm** (Tools → Build npm).

```js
// app.js — must run before App()
const { Matomo } = require('@openmost/wechat-matomo-miniprogram-sdk');

Matomo.init({
  trackerUrl: 'https://stats.example.cn', // base URL; matomo.php appended
  siteId: 3,
});

App({/* unchanged */});
```

The host adds the tracker domain to 开发管理 → 服务器域名 → **request合法域名**.

## Configuration

| Option             | Type                              | Default          | Notes                                                                                        |
| ------------------ | --------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| `trackerUrl`       | string                            | required         | https only; normalised (strip `matomo.php`, `index.php`, query, hash; trailing `/`)          |
| `siteId`           | number \| string                  | required         | `^[1-9]\d*$`                                                                                 |
| `trackerPath`      | string                            | `matomo.php`     | for proxies                                                                                  |
| `autoTrackPages`   | boolean                           | `true`           | wrap `App` / `Page` / `Component`                                                            |
| `pageTitles`       | `Record<string,string>`           | `{}`             | route → title; else `navigationBarTitleText`-agnostic route                                  |
| `excludedRoutes`   | string[]                          | `[]`             | route prefix match (leading `/` ignored), e.g. `pages/debug/`                                |
| `trackShares`      | boolean                           | `true`           | `Share` / `Share to chat` / `share_to_chat` or `Share to Moments` / `share_to_moments` event |
| `trackPayments`    | boolean                           | `false`          | wrap `wx.requestPayment` and send GA4-style payment events                                   |
| `shareCampaign`    | string \| false                   | `'wechat_share'` | appended to share path as `mtm_campaign`                                                     |
| `trackScenes`      | boolean                           | `true`           | map entry scene to campaign/referrer                                                         |
| `requireConsent`   | `false \| 'tracking' \| 'cookie'` | `false`          | mirrors Matomo JS consent modes                                                              |
| `userId`           | string                            | —                | may also be set later with `setUserId`                                                       |
| `customDimensions` | `Record<number,string>`           | `{}`             | index 1–999                                                                                  |
| `heartbeat`        | number                            | `15`             | seconds; 0 disables; sent on `onHide` via `ping=1`                                           |
| `batchSize`        | number                            | `20`             | hits per bulk request                                                                        |
| `flushInterval`    | number                            | `5000`           | ms                                                                                           |
| `maxQueue`         | number                            | `500`            | oldest dropped first                                                                         |
| `debug`            | boolean                           | `false`          | console logging, never in release unless set                                                 |
| `disabled`         | boolean                           | `false`          | kill switch                                                                                  |

See [`docs/api.md`](./docs/api.md) for what happens when `init` receives invalid config.

## Usage

**Events:**

Matomo has no official event naming convention, so this SDK follows the widely used GA4
[recommended events](https://support.google.com/analytics/answer/9267735?hl=en) convention: `category` is a readable group, `action` is the event name in
sentence case, and the event `name` (the 3rd argument, Matomo's `e_n`) is the snake_case GA4 event name
— so **Events > Name** in Matomo reads like a GA4 event name.

```js
Matomo.trackEvent('Product', 'Add to cart', 'add_to_cart', 59.9);
```

The SDK's automatic events, and the manual ones it recommends, follow the same convention:

| Category    | Action              | Name                | Sent                                                                               |
| ----------- | ------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| `Ecommerce` | `Begin checkout`    | `begin_checkout`    | automatically when `wx.requestPayment` is called (`trackPayments`, off by default) |
| `Ecommerce` | `Purchase`          | `purchase`          | automatically when the payment succeeds                                            |
| `Ecommerce` | `Payment cancelled` | `payment_cancelled` | automatically when the user cancels (`requestPayment:fail cancel`)                 |
| `Ecommerce` | `Payment failed`    | `payment_failed`    | automatically on any other payment failure                                         |
| `Share`     | `Share to chat`     | `share_to_chat`     | automatically from `onShareAppMessage` (`trackShares`, on by default)              |
| `Share`     | `Share to Moments`  | `share_to_moments`  | automatically from `onShareTimeline` (`trackShares`)                               |
| `Auth`      | `Login`             | `login`             | by your code, once your own login succeeded — call `setUserId()` too               |
| `Auth`      | `Sign up`           | `sign_up`           | by your code, once a new account was created                                       |

```js
Matomo.setUserId(hashedUserId);
Matomo.trackEvent('Auth', 'Login', 'login');
```

`Login` and `Sign up` are not tracked automatically: most mini programs call `wx.login` silently at
launch to refresh the session code, which is not a user login and would inflate the counts.

**Site search:**

```js
Matomo.trackSiteSearch('running shoes', 'Shoes', 12);
```

**Ecommerce — product page (call `setEcommerceView` from `onLoad`, before the automatic pageview fires):**

```js
Page({
  onLoad(query) {
    Matomo.setEcommerceView(query.sku, 'Running shoes', 'Shoes', 59.9);
  },
});
```

**Ecommerce — cart update:**

```js
Matomo.addEcommerceItem('SKU123', 'Running shoes', 'Shoes', 59.9, 2);
Matomo.trackEcommerceCartUpdate(119.8);
```

**Ecommerce — order:**

```js
Matomo.trackEcommerceOrder('ORDER-42', 119.8, 99.8, 10, 10, 0);
```

**Ecommerce — WeChat Pay (`trackPayments: true`, off by default):** the SDK wraps `wx.requestPayment`
and sends the `Ecommerce` events of the table above: `Begin checkout` / `begin_checkout` once it is
called, then `Purchase` / `purchase` on success, `Payment cancelled` / `payment_cancelled` when the user
cancels (`requestPayment:fail cancel`), or `Payment failed` / `payment_failed` for any other failure.
Your `success`/`fail`/`complete` callbacks and the returned Promise behave exactly as without the SDK. If
`wx.requestPayment` cannot be replaced, the option is silently disabled (logged with `debug: true`).

`wx.requestPayment` only receives signing parameters (`timeStamp`, `nonceStr`, `package`, `signType`,
`paySign`) — no amount or items — so revenue still requires `trackEcommerceOrder(...)` in your `success`
callback:

```js
Matomo.init({ trackerUrl: 'https://stats.example.cn', siteId: 3, trackPayments: true });

// wx.requestPayment only gets signing parameters: record the order yourself on success
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

**User ID** — use a hashed/salted identifier derived from your own account system, **never the raw
WeChat `openid`/`unionid`**; this SDK never calls `wx.login` itself:

```js
Matomo.setUserId(hashedUserId);
// on logout:
Matomo.resetUserId();
```

**Custom dimensions:**

```js
Matomo.setCustomDimension(1, 'vip');
```

**Consent flow**, paired with your own privacy popup shown on first launch:

```js
// init() with requireConsent so nothing is sent until the user agrees
Matomo.init({
  trackerUrl: 'https://stats.example.cn',
  siteId: 3,
  requireConsent: 'tracking',
});

// in your privacy popup:
function onAgree() {
  Matomo.rememberConsentGiven(); // stored: later launches start with consent
  // Matomo.setConsentGiven(); // or: this session only
}
function onDecline() {
  Matomo.optOut(); // persisted; always wins
}
```

Like Matomo JS, pageviews and events tracked before the user agrees are not lost: they are kept in memory
only (never written to storage, at most 100) and sent, with their original time, as soon as consent is
given. `optOut()` or `forgetConsentGiven()` discards them, and they are lost if the user closes the mini
program before agreeing.

The consent API matches Matomo JS: tracking consent (`requireConsent`, `setConsentGiven`,
`rememberConsentGiven(hoursToExpire?)`, `forgetConsentGiven`, `hasRememberedConsent`,
`getRememberedConsent`) and cookie consent (`requireCookieConsent`, `setCookieConsentGiven`,
`rememberCookieConsentGiven(hoursToExpire?)`, `forgetCookieConsentGiven`, `areCookiesEnabled`). In a mini
program, "cookies" means the SDK's storage (visitor ID and offline queue): with `requireConsent: 'cookie'`
hits are sent at once, but nothing is written to storage until cookie consent is given, and
`forgetCookieConsentGiven()` deletes what was stored. Tracking consent implies cookie consent; `set*`
lasts for the session, `remember*` is stored (optionally with an expiry in hours); `optOut()` always wins.
See the [consent overview](./docs/api.md#consent-overview).

See [`docs/api.md`](./docs/api.md) for the full API, and
[`docs/privacy-disclosure.md`](./docs/privacy-disclosure.md) for ready-to-paste privacy-policy text
describing exactly what this flow collects.

## How pages appear in Matomo

Pages are sent with the URL scheme `app://<appId>/<route>?<query>`, so Matomo's **Behaviour → Pages**
report is organized by mini program and route rather than by a generic domain. The page title
(`action_name`) is `pageTitles[route]` if configured, otherwise the route itself.

Because of the `app://` scheme, the Matomo website setting "Only track visits and actions when the action
URL starts with one of the above URLs" (exclude unknown URLs) must stay off, or `app://<appId>` must be
added to the website's URLs — otherwise Matomo discards every hit.

## Attribution

If the launch (or enter) query string already contains explicit campaign parameters (`mtm_*`, `utm_*` or
`pk_campaign`/`pk_kwd`), those are used as-is. Otherwise, with `trackScenes: true` (the default), the
WeChat [scene value](https://developers.weixin.qq.com/miniprogram/dev/reference/scene-list.html) that
opened the mini program is mapped to a `wechat_<medium>` campaign (e.g. `wechat_share`, `wechat_qrcode`,
`wechat_official_account`). These parameters are only attached to the **first hit of a new visit** (a
30-minute inactivity timeout, matching Matomo JS) — see [`docs/scenes.md`](./docs/scenes.md) for the full
scene table and precedence rules.

Matomo core stores the campaign name and keyword (`mtm_campaign`, `mtm_kwd`); `mtm_source`,
`mtm_medium` and the other `mtm_*` dimensions are only stored when the
[MarketingCampaignsReporting](https://plugins.matomo.org/MarketingCampaignsReporting) plugin is installed.

Visits from the WeChat crawler (scene `1129`, 微信爬虫访问, used to index mini program content for search)
are not tracked at all: no hit is sent and nothing is written to storage.

**Known limitation:** if a page's `onShareAppMessage`/`onShareTimeline` returns `{ promise }` (the async
form), WeChat uses the value the promise resolves to, not the object the handler returned synchronously —
so the `mtm_*` share-campaign parameters this SDK appends to the synchronous return value are not applied
in that case. Hosts using the promise form should either return the share object synchronously instead,
or add the campaign parameters themselves inside the promise's resolved value.

## Privacy

See [`docs/privacy-disclosure.md`](./docs/privacy-disclosure.md) for ready-to-paste text for your privacy
policy and 用户隐私保护指引.

**Collected:** device model, OS, WeChat version, screen size, language, pages viewed, events you track,
and a randomly generated visitor ID.

**Never collected:** WeChat `openid`, `unionid`, phone number, or location.

## API reference

See [`docs/api.md`](./docs/api.md) for every method.

## Example

A runnable WeChat DevTools example mini program exercising the SDK lives in
[`example/README.md`](./example/README.md).

## Support

[Openmost](https://openmost.com) (support@openmost.com) offers setup, hosting and training for Matomo and
this SDK.

## License

MIT — see [LICENSE](./LICENSE).
</content>
