import { Matomo } from 'wechat-matomo-miniprogram-sdk';

Page({
  data: { optedOut: false },
  onShow() {
    this.setData({ optedOut: Matomo.isOptedOut() });
  },
  onGive() {
    Matomo.setConsentGiven();
  },
  onForget() {
    Matomo.forgetConsentGiven();
  },
  onOptOut() {
    Matomo.optOut();
    this.setData({ optedOut: true });
  },
  onOptIn() {
    Matomo.optIn();
    this.setData({ optedOut: false });
  },
});
