import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const root = 'chrome-extension';
const manifest = JSON.parse(fs.readFileSync(`${root}/manifest.json`));
if (manifest.manifest_version !== 3) throw new Error('Manifest V3 required');
for (const file of ['background.js','studio.js','recorder.js','storage.js','audio.js','local-worker.js','core/transcription.js','core/local-transcription.js']) {
  execFileSync(process.execPath, ['--check', `${root}/${file}`], { stdio: 'inherit' });
}
for (const file of ['studio.html','studio.css', manifest.background.service_worker, 'vendor/transformers.min.js','vendor/ort-wasm-simd-threaded.jsep.mjs','vendor/ort-wasm-simd-threaded.jsep.wasm']) {
  if (!fs.existsSync(`${root}/${file}`)) throw new Error(`Missing ${file}`);
}
console.log('Extension manifest, entrypoints, and JavaScript syntax verified.');
