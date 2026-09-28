# HTTPS, ICP filing and `request合法域名`

## English

WeChat mini programs may only call `wx.request` (which this SDK uses to send tracking hits) against
domains that are:

1. **HTTPS** — WeChat rejects plain HTTP for `wx.request` outright; `parseConfig` in this SDK also
   rejects a non-`https://` `trackerUrl` before anything is sent.
2. **Added to the mini program's server domain allowlist**, 微信公众平台 → 开发 → 开发管理 → 开发设置 →
   服务器域名 → **request合法域名**. WeChat checks every `wx.request` call against this list at runtime;
   a domain that is not listed is silently blocked (the request's `fail` callback fires, which this SDK
   treats as a failed send and retries later).
3. **Filed with an ICP number (ICP 备案)** if the domain resolves to a server that is, or is treated as,
   hosted for the mainland Chinese public — WeChat's domain-verification step for `request合法域名`
   requires the domain to carry a valid ICP filing (备案号) tied to the same entity as the mini program,
   or domain verification will fail and the domain cannot be added to the allowlist at all.

### Matomo Cloud

A `*.matomo.cloud` subdomain (Matomo's own hosted offering) is Matomo-owned infrastructure and **cannot
be ICP-filed by you** — you do not control the domain registration. As a result it generally cannot be
added to `request合法域名`. If you use Matomo Cloud, put an ICP-filed reverse proxy you control in front
of it and point `trackerUrl` at your own domain instead. Only `/matomo.php` (the Tracking HTTP API
endpoint this SDK calls) needs to be proxied — you do not need to proxy the Matomo UI itself.

Example Nginx configuration:

```nginx
server {
    listen 443 ssl;
    server_name stats.example.cn; # your own ICP-filed, HTTPS domain

    location = /matomo.php {
        proxy_pass https://your-instance.matomo.cloud/matomo.php;
        proxy_set_header Host your-instance.matomo.cloud;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

On the Matomo side (self-hosted Matomo behind your own reverse proxy has the same requirement), tell
Matomo to trust the `X-Forwarded-For` header from your proxy so visitor IPs (used for geolocation) are
read from the real client, not the proxy, by adding to `config/config.ini.php`:

```ini
[General]
proxy_client_headers[] = HTTP_X_FORWARDED_FOR
```

Behind your own proxy, Matomo — Cloud or On-Premise — sees **the proxy's IP** for every visitor (breaking
geolocation and IP-based visitor matching) unless it is configured to trust the proxy's forwarded-for
header: on **Matomo On-Premise**, add the `proxy_client_headers[]` setting above; on **Matomo Cloud**, you
cannot edit `config.ini.php`, so ask Matomo Cloud support to trust your proxy's header.

### Latency and reachability

If your Matomo server (or the reverse proxy in front of Matomo Cloud) is hosted outside mainland China,
be aware that:

- Cross-border network paths from mobile carriers in mainland China can be slow or, at times of network
  congestion, intermittently unreachable — this delays or drops hits (this SDK's offline queue with
  retry and exponential backoff mitigates this, but very poor connectivity can still exceed the 23-hour
  window Matomo accepts for `cdt` without `token_auth` and drop the hit rather than back-date it).
  - Do not confuse this with ICP filing: a server can be perfectly reachable yet still fail domain
    verification for `request合法域名` because it lacks a filing.
- For a materially better user experience and reliability, consider hosting Matomo (or the reverse
  proxy) on a mainland China cloud region and completing ICP filing for that domain, or using a CDN/edge
  proxy with points of presence in mainland China in front of an overseas Matomo instance.

## 中文

微信小程序只能对满足以下条件的域名调用 `wx.request`（本 SDK 用它发送统计数据）：

1. **必须为 HTTPS** —— 微信直接拒绝 `wx.request` 使用明文 HTTP；本 SDK 的 `parseConfig` 也会在发送任何数据前
   拒绝非 `https://` 开头的 `trackerUrl`。
2. **已添加到小程序的服务器域名白名单**，路径为 微信公众平台 → 开发 → 开发管理 → 开发设置 → 服务器域名 →
   **request合法域名**。微信在运行时会校验每一次 `wx.request` 调用是否命中该名单；未在名单中的域名会被静默拦截
   （请求的 `fail` 回调会被触发，本 SDK 将其视为发送失败并稍后重试）。
3. **已完成 ICP 备案**，如果该域名解析到面向中国大陆公众提供服务的服务器 —— 微信为 request合法域名 做域名校验时，
   要求该域名持有与小程序主体一致的有效 ICP 备案号，否则域名校验会失败，也就无法将其加入白名单。

### Matomo Cloud

`*.matomo.cloud` 子域名（Matomo 官方托管服务）属于 Matomo 公司自有基础设施，**你无法为其完成 ICP 备案**
（因为你并不拥有该域名的注册权）。因此它通常无法被添加到 request合法域名 中。如果你使用 Matomo Cloud，
请在其前面部署一个由你自己完成 ICP 备案的反向代理，并将 `trackerUrl` 指向你自己的域名。只需代理
`/matomo.php`（本 SDK 调用的 Tracking HTTP API 端点）即可，无需代理 Matomo 后台界面本身。

Nginx 配置示例：

```nginx
server {
    listen 443 ssl;
    server_name stats.example.cn; # 你自己已完成 ICP 备案的 HTTPS 域名

    location = /matomo.php {
        proxy_pass https://your-instance.matomo.cloud/matomo.php;
        proxy_set_header Host your-instance.matomo.cloud;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

在 Matomo 一侧（自建 Matomo 部署在你自己的反向代理之后时，情况相同），需要让 Matomo 信任来自你代理的
`X-Forwarded-For` 请求头，以便访客 IP（用于地理定位）取自真实客户端而非代理服务器，在
`config/config.ini.php` 中添加：

```ini
[General]
proxy_client_headers[] = HTTP_X_FORWARDED_FOR
```

位于你自己的代理之后时，无论是 Matomo Cloud 还是自建（On-Premise）Matomo，都会把**代理服务器的 IP** 当作每位
访客的 IP（导致地理定位和基于 IP 的访客识别失效），除非将其配置为信任代理转发的请求头：**自建 Matomo** 请添加上述
`proxy_client_headers[]` 配置；**Matomo Cloud** 无法编辑 `config.ini.php`，请联系 Matomo Cloud 客服为你的代理
开启该请求头的信任。

### 延迟与可达性

如果你的 Matomo 服务器（或 Matomo Cloud 前的反向代理）部署在中国大陆境外，请注意：

- 中国大陆移动运营商的跨境网络链路可能较慢，在网络拥塞时甚至可能间歇性不可达 —— 这会延迟或丢失统计数据
  （本 SDK 内置的离线队列及指数退避重试可以缓解该问题，但在网络状况非常差的情况下，仍可能超出 Matomo 在无
  `token_auth` 时对 `cdt` 允许的 23 小时窗口，从而丢弃该条数据而非补记时间）。
  - 请勿将其与 ICP 备案问题混淆：即使服务器完全可达，也可能因未完成备案而无法通过 request合法域名 的域名校验。
- 若追求更好的用户体验与可靠性，建议将 Matomo（或反向代理）部署在中国大陆云服务区域并为该域名完成 ICP 备案，
  或在境外 Matomo 实例前使用在中国大陆设有节点的 CDN/边缘代理。
