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
    Matomo.trackEvent('Example', 'button_click', 'index');
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
