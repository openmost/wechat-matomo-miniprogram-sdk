import { build } from 'esbuild';

const LIMIT = 32 * 1024;

const result = await build({
  entryPoints: ['miniprogram_dist/index.js'],
  bundle: true,
  minify: true,
  write: false,
  format: 'cjs',
  platform: 'neutral',
  target: 'es2017',
});

const bytes = result.outputFiles[0].contents.length;
console.log(`SDK minified bundle: ${bytes} bytes (limit ${LIMIT})`);
if (bytes > LIMIT) {
  console.error('Size budget exceeded');
  process.exit(1);
}
