import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const root = 'chrome-extension';
const manifest = JSON.parse(fs.readFileSync(`${root}/manifest.json`));
if (manifest.manifest_version !== 3) throw new Error('Manifest V3 required');
for (const file of ['background.js','studio.js','recorder.js','storage.js','core/transcription.js']) {
  execFileSync(process.execPath, ['--check', `${root}/${file}`], { stdio: 'inherit' });
}
for (const file of ['studio.html','studio.css', manifest.background.service_worker]) {
  if (!fs.existsSync(`${root}/${file}`)) throw new Error(`Missing ${file}`);
}
console.log('Extension manifest, entrypoints, and JavaScript syntax verified.');
