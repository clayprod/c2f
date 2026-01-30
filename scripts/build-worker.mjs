import { build } from 'esbuild';
import path from 'path';

const entry = path.resolve('src/workers/jobWorker.ts');
const outFile = path.resolve('dist/worker/workers/jobWorker.js');

await build({
  entryPoints: [entry],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  target: ['node20'],
  sourcemap: false,
  format: 'cjs',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  alias: {
    '@': path.resolve('src'),
  },
});

console.log(`Worker build complete: ${outFile}`);
