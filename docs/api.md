# API reference

All methods are available on the `Matomo` singleton exported by the package:

```js
const { Matomo } = require('@openmost/wechat-matomo-miniprogram-sdk');
```

Every method is synchronous (except `flush`, which returns a `Promise<void>`), never throws into the
host app, and can be called before `init` — calls made before `init` are buffered (max 100) and replayed,
in order, right after a successful `init`. A second call to `init` is ignored.

- [init(options)](#initoptions)
- [Automatic events](#automatic-events)
- [trackPageView(title?, path?)](#trackpageviewtitle-path)
- [trackEvent(category, action, name?, value?)](#trackeventcategory-action-name-value)
- [trackSiteSearch(keyword, category?, resultsCount?)](#tracksitesearchkeyword-category-resultscount)
- [trackGoal(idGoal, revenue?)](#trackgoalidgoal-revenue)
- [trackLink(url, type?)](#tracklinkurl-type)
- [setEcommerceView(sku?, name?, category?, price?)](#setecommerceviewsku-name-category-price)
- [addEcommerceItem(sku, name?, category?, price?, quantity?)](#addecommerceitemsku-name-category-price-quantity)
- [removeEcommerceItem(sku)](#removeecommerceitemsku)
- [clearEcommerceCart()](#clearecommercecart)
- [trackEcommerceCartUpdate(grandTotal)](#trackecommercecartupdategrandtotal)
- [trackEcommerceOrder(orderId, grandTotal, subTotal?, tax?, shipping?, discount?)](#trackecommerceorderorderid-grandtotal-subtotal-tax-shipping-discount)
- [setUserId(userId)](#setuseriduserid)
- [resetUserId()](#resetuserid)
- [setCustomDimension(index, value)](#setcustomdimensionindex-value)
- [deleteCustomDimension(index)](#deletecustomdimensionindex)
- [Consent overview](#consent-overview)
- [requireConsent()](#requireconsent)
- [setConsentGiven()](#setconsentgiven)
- [rememberConsentGiven(hoursToExpire?)](#rememberconsentgivenhourstoexpire)
- [forgetConsentGiven()](#forgetconsentgiven)
- [hasRememberedConsent()](#hasrememberedconsent)
- [getRememberedConsent()](#getrememberedconsent)
- [requireCookieConsent()](#requirecookieconsent)
- [setCookieConsentGiven()](#setcookieconsentgiven)
- [rememberCookieConsentGiven(hoursToExpire?)](#remembercookieconsentgivenhourstoexpire)
- [forgetCookieConsentGiven()](#forgetcookieconsentgiven)
- [areCookiesEnabled()](#arecookiesenabled)
- [optOut()](#optout)
- [optIn()](#optin)
- [isOptedOut()](#isoptedout)
- [flush()](#flush)
- [getVisitorId()](#getvisitorid)

### init(options)

Configures and starts the tracker. Must be called once, in `app.js`, before `App({ ... })` — this is
what lets the SDK wrap `App`/`Page`/`Component` before the host defines them. See the
[Configuration](../README.md#configuration) table for every option. Returns `true` on success, `false`
if `options` failed validation (details are logged with `console.warn` when `debug: true`). Calling
`init` a second time is a no-op and returns `true`.

```js
Matomo.init({
  trackerUrl: 'https://stats.example.cn',
  siteId: 3,
});
```

### Automatic events

Besides pageviews, the SDK sends these events by itself, named in GA4 style (readable category and
action, snake_case GA4 event name as the Matomo event name):

| When                                                         | Category    | Action              | Name                |
| ------------------------------------------------------------ | ----------- | ------------------- | ------------------- |
| `onShareAppMessage` (option `trackShares`, on by default)    | `Share`     | `Share to chat`     | `share`             |
| `onShareTimeline` (option `trackShares`)                     | `Share`     | `Share to Moments`  | `share`             |
| `wx.requestPayment` called (option `trackPayments`, off)     | `Ecommerce` | `Payment started`   | `begin_checkout`    |
| payment succeeded                                            | `Ecommerce` | `Payment completed` | `purchase`          |
| payment cancelled by the user (`requestPayment:fail cancel`) | `Ecommerce` | `Payment cancelled` | `payment_cancelled` |
| payment failed for any other reason                          | `Ecommerce` | `Payment failed`    | `payment_failed`    |

The shared page is the page URL of the share event.

With `trackPayments: true`, `init` replaces
[`wx.requestPayment`](https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestPayment.html)
with a wrapper. The wrapper passes the same arguments and `this` on, and returns what WeChat returns:
your `success`/`fail`/`complete` callbacks run with the same results, and a Promise-style call (no
callback) still gets WeChat's Promise. Exceptions thrown by your callbacks propagate as before. If
`wx.requestPayment` is missing or cannot be replaced, payment tracking is silently disabled (logged with
`debug: true`). Code that kept its own reference to `wx.requestPayment` before `init` is not tracked.

`wx.requestPayment` only receives signing parameters (`timeStamp`, `nonceStr`, `package`, `signType`,
`paySign`): the amount and the items are unknown to the SDK. Track the order with
[trackEcommerceOrder()](#trackecommerceorderorderid-grandtotal-subtotal-tax-shipping-discount) in your
`success` callback:

```js
wx.requestPayment({
  ...paymentParams, // from your server
  success() {
    Matomo.trackEcommerceOrder(order.id, order.total);
  },
});
```

### trackPageView(title?, path?)

Sends a pageview hit. Called automatically on every `Page`/`Component` `onShow` when
`autoTrackPages: true` (the default) — most hosts never call this directly. `path` accepts
`route?query=string` and becomes the current page for subsequent hits; `title` overrides
`pageTitles[route]` / the route itself for `action_name`.

Sends: `action_name`, `pv_id` (plus the pending `setEcommerceView` params, if any, on this hit).

```js
Matomo.trackPageView('Product detail', 'pages/product/index?id=42');
```

### trackEvent(category, action, name?, value?)

Every hit other than a pageview (events, site searches, goals, links, ecommerce, heartbeat pings) also
carries the `pv_id` of the last pageview, like Matomo JS, so Matomo links it to that page.

Sends a custom event. `category` and `action` are required (non-empty strings); the call is a no-op and
logged in debug mode otherwise.

Sends: `e_c`, `e_a`, `e_n`, `e_v`.

Following the GA4 convention, `category` and `action` are human-readable (`'Product'`, `'Add to cart'`)
while `name` is a snake_case event name (`'add_to_cart'`), so **Events > Name** in Matomo reads like a
GA4 event name.

```js
Matomo.trackEvent('Product', 'Add to cart', 'add_to_cart', 59.9);
```

### trackSiteSearch(keyword, category?, resultsCount?)

Sends a site search hit. `keyword` is required.

Sends: `search`, `search_cat`, `search_count`.

```js
Matomo.trackSiteSearch('running shoes', 'Shoes', 12);
```

### trackGoal(idGoal, revenue?)

Sends a goal conversion. `idGoal` must be a positive integer.

Sends: `idgoal`, `revenue`.

```js
Matomo.trackGoal(5, 19.9);
```

### trackLink(url, type?)

Sends an outlink or download hit. `type` is `'link'` (default) or `'download'`.

Sends: `link` or `download`.

```js
Matomo.trackLink('https://example.com/brochure.pdf', 'download');
```

### setEcommerceView(sku?, name?, category?, price?)

Records a product (or product-category) page view. The params are attached to the _next_ pageview hit
(the one that follows, typically from `onLoad`/`onShow`), not sent immediately — call it before the
page's own `trackPageView` fires, e.g. from `onLoad`.

Sends (on the next pageview): `_pks`, `_pkn`, `_pkc`, `_pkp`.

```js
Page({
  onLoad(query) {
    Matomo.setEcommerceView(query.sku, 'Running shoes', 'Shoes', 59.9);
  },
});
```

### addEcommerceItem(sku, name?, category?, price?, quantity?)

Adds or replaces (by `sku`) an item in the in-memory cart. Has no network effect by itself — call
`trackEcommerceCartUpdate` or `trackEcommerceOrder` afterwards to send it.

```js
Matomo.addEcommerceItem('SKU123', 'Running shoes', 'Shoes', 59.9, 2);
```

### removeEcommerceItem(sku)

Removes an item from the in-memory cart by `sku`.

```js
Matomo.removeEcommerceItem('SKU123');
```

### clearEcommerceCart()

Empties the in-memory cart without sending a hit.

```js
Matomo.clearEcommerceCart();
```

### trackEcommerceCartUpdate(grandTotal)

Sends the current cart state as a cart-update hit. `grandTotal` is the cart's total amount.

Sends: `idgoal` (`0`), `ec_items` (JSON `[sku, name, category, price, quantity]` per item), `revenue`.

```js
Matomo.addEcommerceItem('SKU123', 'Running shoes', 'Shoes', 59.9, 2);
Matomo.trackEcommerceCartUpdate(119.8);
```

### trackEcommerceOrder(orderId, grandTotal, subTotal?, tax?, shipping?, discount?)

Sends an ecommerce order and clears the cart. `orderId` is required.

Sends: `idgoal` (`0`), `ec_id`, `ec_items`, `revenue`, `ec_st`, `ec_tx`, `ec_sh`, `ec_dt`.

```js
Matomo.trackEcommerceOrder('ORDER-42', 119.8, 99.8, 10, 10, 0);
```

### setUserId(userId)

Sets the Matomo User ID sent as `uid` on every subsequent hit. Use a hashed, salted value derived from
your own user record — **never the raw WeChat `openid`/`unionid`**, and the SDK never calls `wx.login`
itself. `userId` must be a non-empty string; it is trimmed.

```js
Matomo.setUserId(hashedUserId);
```

### resetUserId()

Clears the User ID set by `setUserId` or the `userId` config option (e.g. on logout). Subsequent hits
omit `uid`.

```js
Matomo.resetUserId();
```

### setCustomDimension(index, value)

Sets a [custom dimension](https://matomo.org/faq/general/faq_17931/) sent as `dimension<index>` on every
subsequent hit. `index` must be an integer between 1 and 999.

```js
Matomo.setCustomDimension(1, 'vip');
```

### deleteCustomDimension(index)

Removes a custom dimension previously set with `setCustomDimension` or the `customDimensions` config
option.

```js
Matomo.deleteCustomDimension(1);
```

### Consent overview

The consent API mirrors the [Matomo JavaScript tracker](https://developer.matomo.org/guides/tracking-consent).
A mini program has no cookies: here "cookies" means the SDK's persistent storage (`wx.setStorageSync`),
that is the visitor ID with its visit counters and the offline queue of unsent hits.

| State                                | Hits sent?                               | Stored on the device?                    |
| ------------------------------------ | ---------------------------------------- | ---------------------------------------- |
| No consent required (default)        | yes                                      | yes                                      |
| Tracking consent required, not given | no — kept in memory (max 100), see below | no                                       |
| Cookie consent required, not given   | yes                                      | no — visitor ID and queue live in memory |
| Consent given                        | yes                                      | yes                                      |
| Opted out (`optOut()`), in any state | no                                       | only the opt-out flag                    |

- Tracking consent implies cookie consent: `setConsentGiven()` also gives cookie consent.
- `set*ConsentGiven()` lasts for the current session only (Matomo JS: "one-time only"): call it again on
  every launch after checking your own consent record, or use `remember*ConsentGiven()`.
- `remember*ConsentGiven(hoursToExpire?)` also stores the consent on the device, so later launches start
  with consent. Without `hoursToExpire` (or with a value that is not a positive number) it never expires.
- `forget*ConsentGiven()` withdraws both the session and the remembered consent.
- `optOut()` always wins, whatever the consent state.
- The starting mode is the `requireConsent` option of `init`: `'tracking'` behaves like calling
  `requireConsent()`, `'cookie'` like calling `requireCookieConsent()`.
- Like every method, the consent setters can be called before `init` (they are buffered). The getters
  (`hasRememberedConsent`, `getRememberedConsent`, `areCookiesEnabled`, `isOptedOut`) return `false` /
  `null` before `init`.

Hits tracked while tracking consent is pending are not lost: they are kept in memory only (never written
to storage, at most 100, oldest dropped first) and sent, in order and with their original time, as soon
as tracking consent is given. They are discarded by `optOut()` and `forgetConsentGiven()`, and lost if the
mini program is closed before consent.

### requireConsent()

Requires tracking consent from now on: no hit is sent until `setConsentGiven()` or
`rememberConsentGiven()` is called (or tracking consent was remembered on an earlier launch).

```js
Matomo.requireConsent();
```

### setConsentGiven()

Records that the user consented to tracking, for the current session only (privacy popup "Agree").
Sends the hits kept in memory while consent was pending and, since tracking consent implies cookie
consent, starts storing the visitor ID and queue.

```js
Matomo.setConsentGiven();
```

### rememberConsentGiven(hoursToExpire?)

Same as `setConsentGiven()`, and also stores the consent (with its timestamp) so the next launches start
with tracking consent. `hoursToExpire` (optional, positive number) makes the remembered consent expire
after that many hours; afterwards the user must consent again.

```js
Matomo.rememberConsentGiven(24 * 365); // remember for a year
```

### forgetConsentGiven()

Withdraws tracking consent, whether it was given for the session or remembered. Like Matomo JS (whose
`forgetConsentGiven()` calls `requireConsent()` and `forgetCookieConsentGiven()`), the tracker then
requires tracking consent whatever its mode was, so it stops sending until consent is given again; hits
tracked meanwhile are kept in memory as described in the [overview](#consent-overview). It also forgets
cookie consent, removes the stored consent, visitor ID and queue, discards the hits kept in memory, and
resets the visitor ID. The switch lasts for the current session: the next launch uses the
`requireConsent` option passed to `init` again.

```js
Matomo.forgetConsentGiven();
```

### hasRememberedConsent()

Returns `true` if tracking consent was remembered with `rememberConsentGiven()` and has not expired or
been forgotten. `false` before `init`.

```js
if (!Matomo.hasRememberedConsent()) {
  // show your privacy popup
}
```

### getRememberedConsent()

Returns the time (milliseconds since the epoch) at which the remembered tracking consent was given, or
`null` if there is none (or before `init`).

```js
const since = Matomo.getRememberedConsent();
```

### requireCookieConsent()

Requires cookie consent from now on: hits are still sent, but nothing is written to storage (the visitor
ID and the queue live in memory only) and any stored visitor ID and queue are removed. No-op if cookie
consent was given or remembered.

```js
Matomo.requireCookieConsent();
```

### setCookieConsentGiven()

Records cookie consent for the current session: the visitor ID (kept unchanged) and the queue are stored
from now on.

```js
Matomo.setCookieConsentGiven();
```

### rememberCookieConsentGiven(hoursToExpire?)

Same as `setCookieConsentGiven()`, and also stores the cookie consent so the next launches start with it.
`hoursToExpire` works like in [rememberConsentGiven()](#rememberconsentgivenhourstoexpire).

```js
Matomo.rememberCookieConsentGiven();
```

### forgetCookieConsentGiven()

Withdraws cookie consent (session and remembered) and requires it from now on, even if tracking consent
was given: the stored visitor ID and queue are removed from the device. Hits keep being sent, with the
same visitor ID kept in memory for the rest of the session.

```js
Matomo.forgetCookieConsentGiven();
```

### areCookiesEnabled()

Returns `true` if the SDK may currently write to storage (no consent required, or the required consents
were given). `false` before `init`.

```js
Matomo.areCookiesEnabled();
```

### optOut()

Globally opts the current device out of tracking (persisted): no further hits are sent and the pending
queue is cleared. Independent of `requireConsent`/consent state, and it always wins.

```js
Matomo.optOut();
```

### optIn()

Reverses `optOut()`.

```js
Matomo.optIn();
```

### isOptedOut()

Returns the current opt-out state (`boolean`). Safe to call before `init` (returns `false`).

```js
if (Matomo.isOptedOut()) {
  // hide analytics-dependent UI
}
```

### flush()

Sends any queued hits immediately instead of waiting for `batchSize`/`flushInterval`. Returns a
`Promise<void>` that always resolves (network errors are swallowed and left for the next retry). It
resolves once the requests _it_ started have completed: it does not wait for requests already in
flight from an earlier flush (at most 2 requests are in flight at a time), and hits waiting on those
requests or on a retry backoff are not sent by this call.

Unsent hits stay in the persisted queue (capped at `maxQueue`, oldest dropped first) until they are
sent or are 23 hours old (Matomo refuses older back-dated hits). Network failures without an HTTP response (offline, DNS, domain not in
`request合法域名`) are retried with exponential backoff (up to 1 minute) without limit within those 23
hours; server errors (5xx, 408, 429) are retried at most 10 times; other 4xx responses are dropped.

```js
await Matomo.flush();
```

### getVisitorId()

Returns the current 16-character hex Matomo visitor ID (`_id`), or `''` before `init`.

```js
const visitorId = Matomo.getVisitorId();
```
