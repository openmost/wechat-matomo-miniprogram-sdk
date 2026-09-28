import { Matomo } from '@openmost/wechat-matomo-miniprogram-sdk';

Page({
  data: { visitorId: '' },
  onShow() {
    this.setData({ visitorId: Matomo.getVisitorId() });
  },
  onSearch(e: { detail: { value: string } }) {
    Matomo.trackSiteSearch(e.detail.value, 'products', 3);
  },
  onEvent() {
    // GA4-style: 'Engagement'/'Button click' are human-readable, 'button_click' is the
    // snake_case event name, as in GA4.
    Matomo.trackEvent('Engagement', 'Button click', 'button_click');
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
