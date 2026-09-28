# API reference

All methods are available on the `Matomo` singleton exported by the package:

```js
const { Matomo } = require('wechat-matomo-miniprogram-sdk');
```

Every method is synchronous (except `flush`, which returns a `Promise<void>`), never throws into the
host app, and can be called before `init` — calls made before `init` are buffered (max 100) and replayed,
in order, right after a successful `init`. A second call to `init` is ignored.

- [init(options)](#initoptions)
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
- [requireConsent()](#requireconsent)
- [setConsentGiven()](#setconsentgiven)
- [forgetConsentGiven()](#forgetconsentgiven)
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

```js
Matomo.trackEvent('Video', 'play', 'intro.mp4');
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

### requireConsent()

Switches consent mode to `'tracking'` at runtime if it was `false` (the default): tracking pauses until
`setConsentGiven()` is called. No-op if a consent mode is already configured (`requireConsent` in
`init`).

Like Matomo JS, hits tracked while `'tracking'` consent is pending are not lost: they are kept in memory
only (never written to storage, at most 100, oldest dropped first) and sent, in order and with their
original time, as soon as `setConsentGiven()` is called. They are discarded by `optOut()` and
`forgetConsentGiven()`, and lost if the mini program is closed before consent.

```js
Matomo.requireConsent();
```

### setConsentGiven()

Records that the user consented (privacy popup "Agree"). Unblocks tracking under `'tracking'` mode —
sending the hits kept in memory while consent was pending (see [requireConsent()](#requireconsent)) —
and enables persisting the visitor ID to storage under `'cookie'` mode.

```js
Matomo.setConsentGiven();
```

### forgetConsentGiven()

Withdraws consent. Like Matomo JS (whose `forgetConsentGiven()` calls `requireConsent()`), the tracker
then requires tracking consent whatever its mode was — `false`, `'cookie'` or `'tracking'` — so it stops
sending until `setConsentGiven()` is called again; hits tracked meanwhile are kept in memory as described
under [requireConsent()](#requireconsent). It also clears the stored consent flag, discards the hits
already kept in memory, and resets the visitor ID (a fresh visitor ID is generated and no longer
persisted). The switch lasts for the current session: the next launch uses the `requireConsent` option
passed to `init` again.

```js
Matomo.forgetConsentGiven();
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
