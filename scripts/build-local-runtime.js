import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('@huggingface/transformers'));
const root = resolve(dist, '..');
const target = 'chrome-extension/vendor';
mkdirSync(target, { recursive: true });
for (const file of ['transformers.min.js','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm']) {
  copyFileSync(resolve(dist, file), `${target}/${file}`);
}
copyFileSync(resolve(root, 'LICENSE'), `${target}/TRANSFORMERS-LICENSE.txt`);
// onnxruntime-web's npm package omits its license file; keep the upstream notice.
copyFileSync('scripts/ONNX-LICENSE.txt', `${target}/ONNX-LICENSE.txt`);
writeFileSync(`${target}/README.md`, '# Bundled local speech runtime\n\nTransformers.js 3.8.1 (Apache-2.0), with its matched ONNX Runtime Web build (MIT). These files are copied unmodified from the pinned dependency using `npm run build:local`. Runtime code and WebAssembly are packaged locally; only model data is downloaded.\n');
console.log(`Packaged Transformers.js ${JSON.parse(readFileSync(resolve(root,'package.json'))).version} and matching WASM runtime.`);
