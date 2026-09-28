import { Matomo } from 'wechat-matomo-miniprogram-sdk';

const toast = (title: string) => wx.showToast({ title, icon: 'none' });

Page({
  data: { visitorId: '' },
  onShow() {
    this.setData({ visitorId: Matomo.getVisitorId() });
  },
  onPageView() {
    Matomo.trackPageView('Debug: manual pageview', '/pages/debug/debug?manual=1');
    toast('trackPageView');
  },
  onGoal() {
    Matomo.trackGoal(1, 9.9);
    toast('trackGoal');
  },
  onLink() {
    Matomo.trackLink('https://openmost.com', 'link');
    toast('trackLink link');
  },
  onDownload() {
    Matomo.trackLink('https://openmost.com/brochure.pdf', 'download');
    toast('trackLink download');
  },
  onRemoveItem() {
    Matomo.removeEcommerceItem('TEA-001');
    toast('removeEcommerceItem');
  },
  onClearCart() {
    Matomo.clearEcommerceCart();
    toast('clearEcommerceCart');
  },
  onSetUser() {
    Matomo.setUserId('example-user-hash');
    toast('setUserId');
  },
  onResetUser() {
    Matomo.resetUserId();
    toast('resetUserId');
  },
  onSetDimension() {
    Matomo.setCustomDimension(1, 'debug');
    toast('setCustomDimension');
  },
  onDeleteDimension() {
    Matomo.deleteCustomDimension(1);
    toast('deleteCustomDimension');
  },
  onRequireConsent() {
    Matomo.requireConsent();
    toast('requireConsent');
  },
});
