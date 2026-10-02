import { Matomo } from '@openmost/wechat-matomo-miniprogram-sdk';

const app = getApp<{ globalData: { bannerDismissed: boolean } }>();

Page({
  data: { visitorId: '', showBanner: false },
  onShow() {
    this.setData({
      visitorId: Matomo.getVisitorId(),
      showBanner:
        !app.globalData.bannerDismissed && !Matomo.hasRememberedConsent() && !Matomo.isOptedOut(),
    });
  },
  // Consent banner: remembered for a year on accept, and nothing is ever sent on decline.
  onAccept() {
    Matomo.rememberConsentGiven(24 * 365);
    app.globalData.bannerDismissed = true;
    this.setData({ showBanner: false });
    wx.showToast({ title: 'Thanks!', icon: 'none' });
  },
  onRefuse() {
    Matomo.forgetConsentGiven();
    app.globalData.bannerDismissed = true;
    this.setData({ showBanner: false });
  },
  onSearch(e: { detail: { value: string } }) {
    Matomo.trackSiteSearch(e.detail.value, 'products', 3);
  },
  onEvent() {
    // GA4-style: 'Engagement'/'Button click' are human-readable, 'button_click' is the
    // snake_case event name, as in GA4.
    Matomo.trackEvent('Engagement', 'Button click', 'button_click');
    wx.showToast({ title: 'Event tracked', icon: 'none' });
  },
  onProduct() {
    wx.navigateTo({ url: '/pages/product/product?sku=TEA-001' });
  },
  onConsent() {
    wx.navigateTo({ url: '/pages/consent/consent' });
  },
  onDebug() {
    wx.navigateTo({ url: '/pages/debug/debug' });
  },
  onFlush() {
    Matomo.flush().then(() => wx.showToast({ title: 'Flushed', icon: 'none' }));
  },
  onShareAppMessage() {
    return { title: 'Matomo SDK example' };
  },
});
