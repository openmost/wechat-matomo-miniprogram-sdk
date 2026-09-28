import type { EnterOptions } from './types';

export interface SceneInfo {
  medium: string;
  label: string;
}

const s = (medium: string, label: string): SceneInfo => ({ medium, label });

/** Official WeChat scene values → Matomo campaign medium. `null` = direct entry. */
export const SCENE_MAP: Readonly<Record<number, SceneInfo | null>> = {
  1001: null, // 发现页小程序「最近使用」列表
  1005: s('search', '微信首页顶部搜索框的搜索结果页'),
  1006: s('search', '发现栏小程序主入口搜索框的搜索结果页'),
  1007: s('share', '单人聊天会话中的小程序消息卡片'),
  1008: s('share', '群聊会话中的小程序消息卡片'),
  1010: null, // 收藏夹
  1011: s('qrcode', '扫描二维码'),
  1012: s('qrcode', '长按图片识别二维码'),
  1013: s('qrcode', '扫描手机相册中选取的二维码'),
  1014: s('message', '小程序订阅消息'),
  1017: null, // 前往小程序体验版的入口页
  1020: s('official_account', '公众号 profile 页相关小程序列表'),
  1022: null, // 聊天顶部置顶小程序入口
  1023: null, // 安卓系统桌面图标
  1025: s('qrcode', '扫描一维码'),
  1027: s('search', '微信首页顶部搜索框搜索结果页"使用过的小程序"列表'),
  1035: s('official_account', '公众号自定义菜单'),
  1036: s('app', 'App 分享消息卡片'),
  1037: s('miniprogram', '小程序打开小程序'),
  1038: s('miniprogram', '从另一个小程序返回'),
  1042: s('search', '添加好友搜索框的搜索结果页'),
  1043: s('official_account', '公众号模板消息'),
  1044: s('share', '带 shareTicket 的小程序消息卡片'),
  1045: s('ads', '朋友圈广告'),
  1046: s('ads', '朋友圈广告详情页'),
  1047: s('miniprogram_code', '扫描小程序码'),
  1048: s('miniprogram_code', '长按图片识别小程序码'),
  1049: s('miniprogram_code', '扫描手机相册中选取的小程序码'),
  1053: s('search', '搜一搜的结果页'),
  1058: s('official_account', '公众号文章'),
  1067: s('ads', '公众号文章广告'),
  1068: s('ads', '附近小程序列表广告'),
  1069: s('app', '移动应用通过 openSDK 进入'),
  1074: s('official_account', '公众号会话下发的小程序消息卡片'),
  1082: s('official_account', '公众号会话下发的文字链'),
  1084: s('ads', '朋友圈广告原生页'),
  1089: null, // 微信聊天主界面下拉
  1090: null, // 长按小程序右上角菜单唤出最近使用历史
  1091: s('official_account', '公众号文章商品卡片'),
  1095: s('ads', '小程序广告组件'),
  1103: null, // 发现-小程序主入口我的小程序
  1104: null, // 微信聊天主界面下拉，「我的小程序」栏
  1106: s('search', '聊天主界面下拉，从顶部搜索结果页打开小程序'),
  1129: s('crawler', '微信爬虫访问'),
  1154: s('share_timeline', '朋友圈内打开"单页模式"'),
  1155: s('share_timeline', '"单页模式"打开小程序'),
  1167: s('web', 'H5 通过开放标签打开小程序'),
  1168: s('app', '移动/网站应用直接运行小程序'),
  1175: s('channels', '视频号主页商店入口'),
  1176: s('channels', '视频号直播间主播打开小程序'),
  1177: s('channels', '视频号直播商品'),
  1184: s('channels', '视频号链接打开小程序'),
  1195: s('channels', '视频号主页商品 tab'),
};

export const CAMPAIGN_KEYS: readonly string[] = [
  'mtm_campaign',
  'mtm_cid',
  'mtm_kwd',
  'mtm_keyword',
  'mtm_source',
  'mtm_medium',
  'mtm_content',
  'mtm_group',
  'mtm_placement',
  'utm_campaign',
  'utm_id',
  'utm_source',
  'utm_medium',
  'utm_term',
  'utm_content',
  'pk_campaign',
  'pk_kwd',
];

export interface Attribution {
  params: Record<string, string>;
}

/** Explicit campaign parameters in the launch query always win over the scene. */
export function resolveAttribution(
  options: EnterOptions | undefined,
  trackScenes: boolean,
): Attribution {
  if (!options) return { params: {} };
  const query = options.query ?? {};
  const explicit: Record<string, string> = {};
  for (const key of CAMPAIGN_KEYS) {
    const value = query[key];
    if (typeof value === 'string' && value !== '') explicit[key] = value;
  }
  if (Object.keys(explicit).length > 0 || !trackScenes) return { params: explicit };

  const info = SCENE_MAP[options.scene];
  if (info === null) return { params: {} };
  const medium = info?.medium ?? 'other';
  const referrerApp = medium === 'miniprogram' ? options.referrerInfo?.appId : undefined;
  return {
    params: {
      mtm_campaign: `wechat_${medium}`,
      mtm_source: 'wechat',
      mtm_medium: medium,
      mtm_kwd: referrerApp || String(options.scene),
    },
  };
}
