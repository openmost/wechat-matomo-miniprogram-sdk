import { cpSync, mkdirSync, rmSync } from 'node:fs';

const target = new URL(
  '../example/miniprogram/miniprogram_npm/wechat-matomo-miniprogram-sdk/',
  import.meta.url,
);
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(new URL('../miniprogram_dist/', import.meta.url), target, { recursive: true });
console.log('Copied miniprogram_dist into example/miniprogram/miniprogram_npm');
