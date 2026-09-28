# Example mini program

1. `npm run example:sync` (builds the SDK and copies it into `example/miniprogram/miniprogram_npm`).
2. Open the `example/` folder in WeChat DevTools (tourist AppID is fine).
3. Replace `trackerUrl` / `siteId` in `miniprogram/app.ts` with your Matomo.
4. Your tracker domain must be in 开发管理 → 开发设置 → 服务器域名 → request合法域名. For a quick local test
   only, tick 详情 → 本地设置 → "不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书".
5. `debug: true` logs every step in the DevTools console; check Matomo → Visitors → Visits Log.
