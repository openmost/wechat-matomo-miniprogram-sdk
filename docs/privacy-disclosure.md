# Privacy disclosure

This SDK sends usage-analytics data to a Matomo server that **you (the host mini program) configure and
control**. Under WeChat's platform rules and China's Personal Information Protection Law (PIPL), you are
the data controller (个人信息处理者) for that data — Openmost, the SDK's author, never receives or stores
it. The text below is meant to be copied, adapted, and pasted into your mini program's
用户隐私保护指引 (User Privacy Protection Guidelines, configured in 微信公众平台 → 设置 → 服务内容声明 → 用户隐私保护指引)
and/or your own privacy policy. Replace the bracketed placeholders with your own details before
publishing.

## English

**SDK name:** wechat-matomo-miniprogram-sdk

**Provider:** [Openmost](https://openmost.com) — open source (MIT license), source code available at
<https://github.com/openmost/wechat-matomo-miniprogram-sdk>. Openmost does not operate the analytics
server this SDK sends data to and does not receive or process any data collected by it.

**Purpose:** usage analytics — understanding how visitors use [your mini program name], to improve its
content, navigation and features.

**Data collected:**

- Device type or model and operating system version (e.g. "iPhone", iOS 17; Android devices report
  their model name)
- WeChat client version
- Screen resolution (in device pixels)
- System language
- Pages viewed (route and query string) and the local time of each interaction
- Events you configure the SDK to track (e.g. button taps, searches, purchases)
- A randomly generated visitor identifier (not derived from any WeChat account identifier), with the
  number and time of previous visits
- The WeChat "scene" value describing how the mini program was opened (e.g. scan, share, search), used
  only to attribute traffic sources

**Data NOT collected:** this SDK never accesses or transmits the user's WeChat `openid`, `unionid`,
phone number, precise or approximate location, avatar, nickname, or any other WeChat-authorized personal
information. It never calls `wx.login`, `wx.getUserProfile`, or any location/contacts API. If [your mini
program name] separately calls `Matomo.setUserId()` with your own user identifier, disclose that
separately as part of your own account/login data handling — see the note below.

**Storage:** a small amount of state (the visitor identifier, pending unsent events, consent status) is
stored locally on the user's device using the mini program storage APIs (`wx.setStorageSync`), under
keys prefixed `_mtm_sdk_` (for example `_mtm_sdk_visitor`, `_mtm_sdk_queue`). This data is not
synchronized to WeChat's servers by the platform; it is only ever sent by this SDK, over HTTPS, to the
analytics server address you configure below.

**Recipient / cross-border transfer:** analytics data is sent directly from the user's device to
**[your Matomo server URL]**, which is operated by **[your company/organization name]**. If that server
is located outside mainland China, this constitutes a cross-border transfer of personal information and
you must comply with PIPL's cross-border transfer requirements (e.g. a security assessment, standard
contract filing, or certification, as applicable to your organization) and disclose the recipient country
and safeguards in your privacy policy.

**User control:** users can decline analytics tracking. If [your mini program name] provides a privacy
consent popup, declining calls `Matomo.optOut()` (or leaves `Matomo.requireConsent()` unresolved),
which stops all further data collection and clears any data queued but not yet sent. Withdrawing consent
does not delete data already received by your Matomo server; contact **[your support email]** for a
deletion request.

---

## 中文

**SDK 名称：** wechat-matomo-miniprogram-sdk

**提供方：** [Openmost](https://openmost.com) — 开源项目（MIT 许可证），源代码见
<https://github.com/openmost/wechat-matomo-miniprogram-sdk>。Openmost 不运营本 SDK 所发送数据的目标分析服务器，
也不会接收或处理本 SDK 收集的任何数据。

**使用目的：** 用户行为统计分析 —— 了解用户如何使用【你的小程序名称】，以改进其内容、导航与功能。

**收集的信息：**

- 设备类型或型号及操作系统版本（例如 "iPhone"、iOS 17；安卓设备会上报其型号名称）
- 微信客户端版本
- 屏幕分辨率（按设备物理像素计）
- 系统语言
- 访问的页面（路由与查询参数）及每次交互的本地时间
- 你配置本 SDK 追踪的自定义事件（如按钮点击、搜索、下单等）
- 随机生成的访客标识符（非基于任何微信账号标识生成），以及此前访问的次数与时间
- 描述小程序打开方式的微信 "场景值"（如扫码、分享、搜索），仅用于流量来源归因

**不会收集的信息：** 本 SDK 不会获取或上传用户的微信 `openid`、`unionid`、手机号、精确或大致地理位置、头像、
昵称，或任何其他微信授权个人信息。本 SDK 从不调用 `wx.login`、`wx.getUserProfile` 或任何位置/通讯录相关接口。
如果【你的小程序名称】另行调用 `Matomo.setUserId()` 传入你自有的用户标识符，请在你自己的账号/登录数据处理说明中
单独披露 —— 详见下方说明。

**存储方式：** 少量状态信息（访客标识符、待发送事件、同意状态）通过小程序存储接口
（`wx.setStorageSync`）保存在用户设备本地，键名统一以 `_mtm_sdk_` 为前缀（例如 `_mtm_sdk_visitor`、
`_mtm_sdk_queue`）。该数据不会被微信平台同步至其服务器；仅由本 SDK 通过 HTTPS 发送至你在下方配置的分析服务器
地址。

**接收方 / 跨境传输：** 统计数据由用户设备直接发送至 **【你的 Matomo 服务器地址】**，该服务器由
**【你的公司/组织名称】** 运营。若该服务器位于中国大陆境外，则构成个人信息的跨境传输，你需依据《个人信息保护法》
履行相应的跨境传输合规义务（如安全评估、标准合同备案或认证，视你的组织情况而定），并在隐私政策中披露接收方所在
国家/地区及所采取的保护措施。

**用户控制：** 用户可以拒绝统计追踪。若【你的小程序名称】提供隐私同意弹窗，用户拒绝时应调用 `Matomo.optOut()`
（或不调用 `Matomo.setConsentGiven()` 使 `Matomo.requireConsent()` 保持未同意状态），这将停止所有后续数据收集，
并清除尚未发送的排队数据。撤回同意不会删除已发送至你的 Matomo 服务器的历史数据；如需删除，请联系
**【你的客服邮箱】**。
