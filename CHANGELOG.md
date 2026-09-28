# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-09-28

First public release, published to npm as `@openmost/wechat-matomo-miniprogram-sdk`.

### Added

- `Matomo.init()` with validated configuration and tracker URL normalisation.
- Automatic pageviews by wrapping `App`, `Page` and `Component` (component pages included).
- WeChat scene and `mtm_*`/`utm_*` campaign attribution on the first hit of a visit; share tracking with
  campaign parameters on the shared path.
- Events, site search, goals, outlinks and downloads.
- Ecommerce: product views, cart updates and orders.
- `trackPayments` option (off by default): wraps `wx.requestPayment` once and sends `Ecommerce` payment
  events; the host's callbacks, return value and exceptions are unchanged.
- Automatic events named by one convention — category, sentence-case action, GA4-style snake_case name:
  `Ecommerce` / `Begin checkout` / `begin_checkout`, `Purchase` / `purchase`, `Payment cancelled` /
  `payment_cancelled`, `Payment failed` / `payment_failed`; `Share` / `Share to chat` / `share_to_chat`,
  `Share to Moments` / `share_to_moments`. The READMEs document the convention, with `Auth` / `Login` /
  `login` and `Auth` / `Sign up` / `sign_up` as manual examples.
- User ID, custom dimensions, heartbeat pings.
- Full Matomo JS consent API, mapped to mini program storage: tracking consent (`requireConsent`,
  `setConsentGiven`, `rememberConsentGiven(hoursToExpire?)`, `forgetConsentGiven`, `hasRememberedConsent`,
  `getRememberedConsent`, `isConsentRequired`) and cookie consent (`requireCookieConsent`,
  `setCookieConsentGiven`, `rememberCookieConsentGiven(hoursToExpire?)`, `forgetCookieConsentGiven`,
  `getRememberedCookieConsent`, `areCookiesEnabled`), plus `optOut`/`optIn`/`isOptedOut`.
  - Nothing is sent while tracking consent is pending: hits are kept in memory (max 100) and sent with
    their original time once consent is given, and hits queued earlier are held too.
    `forgetConsentGiven()` drops them, like `optOut()`.
  - While tracking consent is pending a stored visitor ID is reused but not written, like Matomo JS
    `_pk_id`; without cookie consent the stored visitor ID and queue are removed and nothing is written.
  - A withdrawn consent (`forgetConsentGiven()`) is remembered, like `mtm_consent_removed`, until
    consent is given again.
  - `optOut()` removes the stored visitor ID and queue; only the opt-out flag stays.
  - Hits carry `consent=1` once consent is required and given.
- Persisted offline queue with Matomo bulk tracking, exponential backoff and 23 h expiry.
- WeChat crawler launches (scene 1129) are not tracked.
- TypeScript types; documentation in Simplified Chinese, Traditional Chinese and English; DevTools example
  project.

0.1.0 was tagged in git but never published to npm.
