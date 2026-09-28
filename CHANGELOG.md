# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

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
