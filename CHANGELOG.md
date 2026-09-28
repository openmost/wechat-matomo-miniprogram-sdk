# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Full Matomo JS consent API: `rememberConsentGiven(hoursToExpire?)`, `hasRememberedConsent()`,
  `getRememberedConsent()`, and cookie consent with `requireCookieConsent()`, `setCookieConsentGiven()`,
  `rememberCookieConsentGiven(hoursToExpire?)`, `forgetCookieConsentGiven()`, `areCookiesEnabled()`.
  Before cookie consent nothing is written to storage (visitor ID and queue stay in memory).
- `trackPayments` option (off by default): wraps `wx.requestPayment` and sends GA4-style `Ecommerce`
  payment events (`begin_checkout`, `purchase`, `payment_cancelled`, `payment_failed`).

### Changed

- **Breaking:** `setConsentGiven()` lasts for the current session only, like Matomo JS; use
  `rememberConsentGiven()` to keep consent across launches. Consent stored by 0.1.0 is still honoured.
- **Breaking:** `forgetConsentGiven()` also forgets cookie consent: nothing is stored until consent is
  given again.
- **Breaking:** the automatic share event is now `Share` / `Share to chat` or `Share to Moments` /
  `share` (GA4 style) instead of `share_app_message` / `share_timeline` with the route as name.

## [0.1.0] - 2026-09-28

### Added

- `Matomo.init()` with validated configuration and tracker URL normalisation.
- Automatic pageviews by wrapping `App`, `Page` and `Component` (component pages included).
- WeChat scene and `mtm_*`/`utm_*` campaign attribution on the first hit of a visit; share tracking with campaign parameters.
- Events, site search, goals, outlinks and downloads.
- Ecommerce: product views, cart updates and orders.
- User ID, custom dimensions, heartbeat pings.
- Consent (`tracking` / `cookie`) with hits held until consent is given, and opt-out.
- Persisted offline queue with Matomo bulk tracking, exponential backoff and 23 h expiry.
- WeChat crawler launches (scene 1129) are not tracked.
- TypeScript types, English and Chinese documentation, DevTools example project.
