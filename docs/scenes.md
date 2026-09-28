# WeChat scenes and campaign attribution

When a user opens the mini program, WeChat reports a numeric [scene value](https://developers.weixin.qq.com/miniprogram/dev/reference/scene-list.html)
describing how it was opened (`wx.getLaunchOptionsSync().scene` on cold start,
`wx.getEnterOptionsSync().scene` on every foreground). With `trackScenes: true` (the default), the SDK
maps that scene to a Matomo campaign so entry-point performance shows up in **Acquisition → Campaigns**
without any extra work from the host.

## Precedence

1. **Explicit campaign parameters always win.** If the launch/enter query string already contains any
   `mtm_*`, `utm_*` or `pk_campaign`/`pk_kwd` parameter (for example because the QR code or mini program
   code that opened the mini program encodes `?mtm_campaign=...`), the SDK forwards those verbatim and
   does **not** look at the scene at all.
2. Otherwise, if `trackScenes` is enabled, the SDK looks up the scene in the table below and, unless it
   maps to "direct", attaches `mtm_campaign=wechat_<medium>`, `mtm_source=wechat`, `mtm_medium=<medium>`
   and `mtm_kwd=<scene id>` (or the referrer mini program's `appId` for scene `1037`/`1038`).
3. These parameters are attached only to the **first hit of a new visit** (the SDK's 30-minute
   inactivity timeout, matching Matomo JS) — a hit sent mid-visit (for example after briefly switching to
   another mini program and back) does not re-attribute the visit.

## WeChat crawler (scene 1129)

When the launch or enter scene is `1129` (微信爬虫访问 — WeChat's crawler opening pages to index them for
search), the SDK tracks nothing: every hit is dropped and nothing is written to storage, so crawler
visits never inflate your Matomo reports.

## Adding `mtm_campaign` to QR codes / mini program codes

Scenes such as `1011`–`1013` (QR code) and `1047`–`1049` (mini program code) do not, by themselves, tell
Matomo _which_ QR code or mini program code was scanned — only that a code was scanned. To track
individual codes or physical placements, encode the campaign explicitly in the code's target page/query
instead of relying on the scene, e.g. generate the code from your server with the mini program code APIs
[`wxacode.get`](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/qrcode-link/qr-code/getQRCode.html)
or
[`wxacode.createQRCode`](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/qrcode-link/qr-code/createQRCode.html)
(both take a `path` with a query string), or from the mini program admin console, with a path such as:

```
pages/index/index?mtm_campaign=poster_shop42&mtm_medium=qrcode&mtm_source=offline
```

The SDK reads these query parameters at launch (step 1 above) and they take priority over the scene.

`wxacode.getUnlimited` does not accept a query string: it only passes a `scene` string of at most 32
characters (delivered to the page as `query.scene`), so it cannot carry arbitrary `mtm_*` parameters.
Use `wxacode.get` or `wxacode.createQRCode` for campaign-tagged codes.

## Scene table

`— (direct)` means the SDK does not attach any campaign parameters for that scene (the visit is reported
as direct/none, same as Matomo's default for a URL with no campaign parameters).

<!-- prettier-ignore -->
| Scene | 官方说明 | Matomo campaign | Medium |
| --- | --- | --- | --- |
| 1001 | 发现页小程序「最近使用」列表 | — (direct) | — (direct) |
| 1005 | 微信首页顶部搜索框的搜索结果页 | wechat_search | search |
| 1006 | 发现栏小程序主入口搜索框的搜索结果页 | wechat_search | search |
| 1007 | 单人聊天会话中的小程序消息卡片 | wechat_share | share |
| 1008 | 群聊会话中的小程序消息卡片 | wechat_share | share |
| 1010 | 收藏夹 | — (direct) | — (direct) |
| 1011 | 扫描二维码 | wechat_qrcode | qrcode |
| 1012 | 长按图片识别二维码 | wechat_qrcode | qrcode |
| 1013 | 扫描手机相册中选取的二维码 | wechat_qrcode | qrcode |
| 1014 | 小程序订阅消息 | wechat_message | message |
| 1017 | 前往小程序体验版的入口页 | — (direct) | — (direct) |
| 1020 | 公众号 profile 页相关小程序列表 | wechat_official_account | official_account |
| 1022 | 聊天顶部置顶小程序入口 | — (direct) | — (direct) |
| 1023 | 安卓系统桌面图标 | — (direct) | — (direct) |
| 1025 | 扫描一维码 | wechat_qrcode | qrcode |
| 1027 | 微信首页顶部搜索框搜索结果页「使用过的小程序」列表 | wechat_search | search |
| 1035 | 公众号自定义菜单 | wechat_official_account | official_account |
| 1036 | App 分享消息卡片 | wechat_app | app |
| 1037 | 小程序打开小程序 | wechat_miniprogram | miniprogram |
| 1038 | 从另一个小程序返回 | wechat_miniprogram | miniprogram |
| 1042 | 添加好友搜索框的搜索结果页 | wechat_search | search |
| 1043 | 公众号模板消息 | wechat_official_account | official_account |
| 1044 | 带 shareTicket 的小程序消息卡片 | wechat_share | share |
| 1045 | 朋友圈广告 | wechat_ads | ads |
| 1046 | 朋友圈广告详情页 | wechat_ads | ads |
| 1047 | 扫描小程序码 | wechat_miniprogram_code | miniprogram_code |
| 1048 | 长按图片识别小程序码 | wechat_miniprogram_code | miniprogram_code |
| 1049 | 扫描手机相册中选取的小程序码 | wechat_miniprogram_code | miniprogram_code |
| 1053 | 搜一搜的结果页 | wechat_search | search |
| 1058 | 公众号文章 | wechat_official_account | official_account |
| 1067 | 公众号文章广告 | wechat_ads | ads |
| 1068 | 附近小程序列表广告 | wechat_ads | ads |
| 1069 | 移动应用通过 openSDK 进入 | wechat_app | app |
| 1074 | 公众号会话下发的小程序消息卡片 | wechat_official_account | official_account |
| 1082 | 公众号会话下发的文字链 | wechat_official_account | official_account |
| 1084 | 朋友圈广告原生页 | wechat_ads | ads |
| 1089 | 微信聊天主界面下拉 | — (direct) | — (direct) |
| 1090 | 长按小程序右上角菜单唤出最近使用历史 | — (direct) | — (direct) |
| 1091 | 公众号文章商品卡片 | wechat_official_account | official_account |
| 1095 | 小程序广告组件 | wechat_ads | ads |
| 1103 | 发现-小程序主入口我的小程序 | — (direct) | — (direct) |
| 1104 | 微信聊天主界面下拉，「我的小程序」栏 | — (direct) | — (direct) |
| 1106 | 聊天主界面下拉，从顶部搜索结果页打开小程序 | wechat_search | search |
| 1129 | 微信爬虫访问 | — (not tracked) | — (not tracked) |
| 1154 | 朋友圈内打开「单页模式」 | wechat_share_timeline | share_timeline |
| 1155 | 「单页模式」打开小程序 | wechat_share_timeline | share_timeline |
| 1167 | H5 通过开放标签打开小程序 | wechat_web | web |
| 1168 | 移动/网站应用直接运行小程序 | wechat_app | app |
| 1175 | 视频号主页商店入口 | wechat_channels | channels |
| 1176 | 视频号直播间主播打开小程序 | wechat_channels | channels |
| 1177 | 视频号直播商品 | wechat_channels | channels |
| 1184 | 视频号链接打开小程序 | wechat_channels | channels |
| 1195 | 视频号主页商品 tab | wechat_channels | channels |

Source: the full official scene list, [developers.weixin.qq.com/miniprogram/dev/reference/scene-list.html](https://developers.weixin.qq.com/miniprogram/dev/reference/scene-list.html), cross-checked against `SCENE_MAP` in `src/attribution.ts` (see `docs/wechat-platform-notes.md`). A scene id that is _not_ in this table (i.e. not a key of `SCENE_MAP`) is not treated as direct: it falls back to `mtm_campaign=wechat_other` / `mtm_medium=other`, so new scene ids WeChat introduces still get attributed, just under a generic bucket, until `SCENE_MAP` is updated.
