import { Matomo } from 'wechat-matomo-miniprogram-sdk';

const CATEGORIES = ['Tea', 'Green tea'];

Page({
  data: { sku: '', name: 'Jasmine tea', price: 38 },
  onLoad(query: Record<string, string>) {
    this.setData({ sku: query.sku ?? 'TEA-001' });
    // Called before the automatic pageview in onShow, so it is attached to it.
    Matomo.setEcommerceView(this.data.sku, this.data.name, CATEGORIES, this.data.price);
  },
  onAdd() {
    Matomo.addEcommerceItem(this.data.sku, this.data.name, CATEGORIES, this.data.price, 1);
    Matomo.trackEcommerceCartUpdate(this.data.price);
  },
  onOrder() {
    Matomo.trackEcommerceOrder(`ORDER-${Date.now()}`, this.data.price, this.data.price, 0, 0);
    wx.showToast({ title: 'Order tracked', icon: 'none' });
  },
});
