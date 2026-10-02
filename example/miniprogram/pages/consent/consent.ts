import { Matomo } from '@openmost/wechat-matomo-miniprogram-sdk';

Page({
  data: {
    optedOut: false,
    cookiesEnabled: false,
    rememberedConsent: 'None',
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const at = Matomo.getRememberedConsent();
    this.setData({
      optedOut: Matomo.isOptedOut(),
      cookiesEnabled: Matomo.areCookiesEnabled(),
      rememberedConsent: at === null ? 'None' : new Date(at).toLocaleString(),
    });
  },
  // Tracking consent: nothing is sent until it is given (implies cookie consent).
  onGive() {
    Matomo.setConsentGiven();
    this.refresh();
  },
  onRemember() {
    Matomo.rememberConsentGiven(24 * 365);
    this.refresh();
  },
  onForget() {
    Matomo.forgetConsentGiven();
    this.refresh();
  },
  // Cookie consent: hits are sent, but nothing is stored on the device until it is given.
  onGiveCookies() {
    Matomo.setCookieConsentGiven();
    this.refresh();
  },
  onRememberCookies() {
    Matomo.rememberCookieConsentGiven(24 * 365);
    this.refresh();
  },
  onForgetCookies() {
    Matomo.forgetCookieConsentGiven();
    this.refresh();
  },
  onOptOut() {
    Matomo.optOut();
    this.refresh();
  },
  onOptIn() {
    Matomo.optIn();
    this.refresh();
  },
  onResetBanner() {
    Matomo.forgetConsentGiven();
    getApp<{ globalData: { bannerDismissed: boolean } }>().globalData.bannerDismissed = false;
    wx.reLaunch({ url: '/pages/index/index' });
  },
});
