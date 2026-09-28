import { rmSync } from 'node:fs';

rmSync(new URL('../miniprogram_dist', import.meta.url), { recursive: true, force: true });
