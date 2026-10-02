// Matomo must be initialised before App() so the SDK can wrap App, Page and Component.
import { Matomo } from '@openmost/wechat-matomo-miniprogram-sdk';

Matomo.init({
  trackerUrl: 'https://demo.openmost.com', // Openmost test instance; replace with your ICP-filed tracker domain
  siteId: 1,
  debug: true,
  // Nothing is sent until the visitor accepts the consent banner on the home page.
  requireConsent: 'tracking',
  // trackPayments: true, // wrap wx.requestPayment: GA4-style Ecommerce payment events (off by default)
  pageTitles: {
    'pages/index/index': 'Home',
    'pages/product/product': 'Product',
    'pages/consent/consent': 'Privacy',
    'pages/debug/debug': 'Debug',
  },
});

// bannerDismissed hides the banner for the rest of the session once the visitor has chosen.
App<{ globalData: { bannerDismissed: boolean } }>({ globalData: { bannerDismissed: false } });
