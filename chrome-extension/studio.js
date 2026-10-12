import { recordings } from './storage.js';
import { CaptureSession } from './recorder.js';
import { MistralTranscriptionService, exportTranscript } from './core/transcription.js';
import { LocalTranscriptionService } from './core/local-transcription.js';
import { decodeAudio } from './audio.js';

const $ = id => document.getElementById(id);
const service = new MistralTranscriptionService();
const localService = new LocalTranscriptionService({ decodeAudio, createWorker: () => new Worker(new URL('./local-worker.js', import.meta.url), { type: 'module' }) });
let items = [], selected, capture, starting = false, stopping = false, mediaUrl, controller, timer;
let apiKey = '', model = 'voxtral-mini-latest', pendingSave = Promise.resolve();
let provider = 'local';
const unsaved = new Set();
const status = message => { $('status').textContent = message; };
const clock = ms => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
function report(error) { status(error.name === 'AbortError' ? 'Transcription cancelled.' : error.name === 'TimeoutError' ? 'Transcription timed out. Your recording is saved; try again.' : error.message); }
function action(label, handler) {
  const button = document.createElement('button'); button.textContent = label;
  button.addEventListener('click', () => Promise.resolve().then(handler).catch(report));
  return button;
}
function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function filename(title) { return title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120) || 'recording'; }
function persist(item) {
  // Serialize snapshots so slower writes cannot overwrite newer edits.
  const snapshot = { ...item };
  unsaved.add(item.id);
  pendingSave = pendingSave.catch(() => {}).then(async () => { await recordings.save(snapshot); if (item.title === snapshot.title && item.transcript === snapshot.transcript) unsaved.delete(item.id); });
  pendingSave.catch(report);
  return pendingSave;
}
function renderLibrary() {
  $('library').replaceChildren();
  const query = $('search').value.toLowerCase();
  const visible = items.filter(item => item.title.toLowerCase().includes(query)).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  if (!visible.length) { const empty = document.createElement('p'); empty.textContent = items.length ? 'No matching recordings.' : 'Your recordings will appear here.'; $('library').append(empty); }
  for (const item of visible) {
    const button = action(item.title, () => openRecording(item));
    button.className = `recording${selected?.id === item.id ? ' active' : ''}`;
    const detail = document.createElement('small');
    detail.textContent = `${new Date(item.createdAt).toLocaleString()} · ${item.mode} · ${clock(item.durationMs)}${item.transcript ? ' · transcribed' : ''}`;
    button.append(detail); $('library').append(button);
  }
}
function openRecording(item) {
  if (controller) { status('Finish or cancel transcription before switching recordings.'); return; }
  selected = item; renderLibrary();
  if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  const editor = $('editor'); editor.replaceChildren();
  const title = document.createElement('input'); title.id = 'title'; title.value = item.title; title.setAttribute('aria-label', 'Recording title');
  title.addEventListener('input', () => { item.title = title.value; persist(item); renderLibrary(); });
  const player = document.createElement(item.mode === 'video' ? 'video' : 'audio');
  mediaUrl = URL.createObjectURL(item.media); player.src = mediaUrl; player.controls = true;
  const controls = document.createElement('div'); controls.className = 'controls';
  const transcribe = action('Transcribe', async () => {
    if (controller) return;
    if (item.transcript && !confirm('Replace your edited transcript with a new transcription?')) return;
    controller = new AbortController(); transcribe.disabled = true; transcript.disabled = true; cancel.hidden = false;
    status(provider === 'local' ? 'Starting local transcription…' : 'Uploading audio to Mistral and transcribing…');
    try {
      const result = await (provider === 'local' ? localService : service).transcribe({ audio: item.audio, apiKey, model, signal: controller.signal, onProgress: status });
      item.transcript = result.text; item.transcription = { ...result, text: undefined, transcribedAt: new Date().toISOString() };
      transcript.value = item.transcript; await persist(item); renderLibrary(); status('Transcript ready. Edits save automatically.');
    } finally { controller = null; transcribe.disabled = false; transcript.disabled = false; cancel.hidden = true; }
  });
  const cancel = action('Cancel transcription', () => controller?.abort()); cancel.hidden = true;
  controls.append(transcribe, cancel, action('Download recording', () => download(item.media, `${filename(item.title)}.webm`)), action('Delete', async () => {
    if (controller) throw new Error('Cancel transcription before deleting.');
    if (!confirm(`Delete “${item.title}” and its transcript from this browser?`)) return;
    await pendingSave.catch(() => {}); await recordings.remove(item.id); unsaved.delete(item.id); items = items.filter(other => other.id !== item.id); selected = null;
    URL.revokeObjectURL(mediaUrl); mediaUrl = null; editor.replaceChildren(); renderLibrary(); status('Recording deleted.');
  }));
  const transcript = document.createElement('textarea'); transcript.value = item.transcript || ''; transcript.placeholder = 'Transcribe this recording, or type your own notes here.'; transcript.setAttribute('aria-label', 'Editable transcript');
  transcript.addEventListener('input', () => { item.transcript = transcript.value; persist(item); });
  const exports = document.createElement('div'); exports.className = 'controls';
  for (const format of ['txt', 'md', 'json']) exports.append(action(`Export ${format.toUpperCase()}`, async () => {
    await pendingSave;
    const result = exportTranscript(item, format);
    download(new Blob([result.content], { type: result.type }), `${filename(item.title)}.${result.extension}`);
  }));
  editor.append(title, player, controls, transcript, exports);
}
function recordingState(active) {
  for (const id of ['start','mode','source','microphone']) $(id).disabled = active;
  $('pause').disabled = !active; $('stop').disabled = !active;
}
$('start').addEventListener('click', async () => {
  if (capture || starting) return;
  starting = true; recordingState(true); $('stop').disabled = true; $('pause').disabled = true;
  const session = new CaptureSession();
  const mode = $('mode').value;
  try {
    await session.start({ mode, source: $('source').value, microphone: $('microphone').checked, onEnded: () => { if (capture) stopRecording(); } });
    capture = session; capture.mode = mode; recordingState(true);
    timer = setInterval(() => { $('timer').textContent = clock((capture.pausedAt || Date.now()) - capture.startedAt); }, 250);
    status('Recording. Keep this studio tab open until you stop and save.');
  } catch (error) { report(error); recordingState(false); }
  finally { starting = false; }
});
$('pause').addEventListener('click', () => {
  if (!capture || stopping) return;
  if (capture.pausedAt) { capture.resume(); $('pause').textContent = 'Pause'; status('Recording resumed.'); }
  else { capture.pause(); $('pause').textContent = 'Resume'; status('Recording paused.'); }
});
async function stopRecording() {
  if (!capture || stopping) return;
  stopping = true; $('stop').disabled = true; $('pause').disabled = true; clearInterval(timer);
  try {
    const result = await capture.stop();
    const item = { id: crypto.randomUUID(), title: `Recording ${new Date().toLocaleString()}`, createdAt: new Date().toISOString(), mode: capture.mode, ...result, transcript: '' };
    // Keep unsaved media in memory for recovery if disk quota/storage fails.
    items.push(item);
    try { await persist(item); status('Recording saved locally.'); }
    catch (error) { status(`Could not save: ${error.message}. Download this recording now before closing the tab.`); }
    renderLibrary(); openRecording(item);
  } catch (error) { report(error); }
  finally { capture = null; stopping = false; recordingState(false); $('pause').textContent = 'Pause'; }
}
$('stop').addEventListener('click', stopRecording);
$('mode').addEventListener('change', () => { if ($('mode').value === 'video') $('source').value = 'screen'; });
$('source').addEventListener('change', () => { if ($('source').value === 'microphone') $('mode').value = 'audio'; });
$('search').addEventListener('input', renderLibrary);
$('settings-toggle').addEventListener('click', () => { $('settings').hidden = !$('settings').hidden; });
$('provider').addEventListener('change', () => { $('mistral-settings').hidden = $('provider').value !== 'mistral'; });
$('save-settings').addEventListener('click', async () => {
  try {
    apiKey = $('api-key').value.trim(); model = $('model').value.trim() || 'voxtral-mini-latest';
    provider = $('provider').value;
    await chrome.storage.local.set({ model, provider });
    if ($('remember').checked) await chrome.storage.local.set({ apiKey });
    else await chrome.storage.local.remove('apiKey');
    status('Settings saved.'); $('settings').hidden = true;
  } catch (error) { report(error); }
});
window.addEventListener('beforeunload', event => {
  if (capture || starting || controller || unsaved.size) { event.preventDefault(); event.returnValue = ''; }
});
try {
  const settings = await chrome.storage.local.get(['apiKey','model','provider']);
  apiKey = settings.apiKey || ''; model = settings.model || model;
  provider = settings.provider === 'mistral' ? 'mistral' : 'local';
  $('provider').value = provider; $('mistral-settings').hidden = provider !== 'mistral';
  $('api-key').value = apiKey; $('model').value = model; $('remember').checked = !!apiKey;
  items = await recordings.list(); renderLibrary();
} catch (error) { report(error); }
