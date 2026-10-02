# Example mini program

1. `npm run example:sync` (builds the SDK and copies it into `example/miniprogram/miniprogram_npm`).
2. Open the `example/` folder in WeChat DevTools (tourist AppID is fine).
3. Replace `trackerUrl` / `siteId` in `miniprogram/app.ts` with your Matomo.
4. Your tracker domain must be in 开发管理 → 开发设置 → 服务器域名 → request合法域名. For a quick local test
   only, tick 详情 → 本地设置 → "不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书".
5. `debug: true` logs invalid calls, invalid config and SDK errors in the DevTools console (not every hit);
   check Matomo → Visitors → Visits Log, or the DevTools Network panel, to see the hits.
6. The example runs with `requireConsent: 'tracking'`: the home page shows a consent banner, and nothing is
   sent until you tap Accept. Privacy settings → "Show the consent banner again" brings it back.
