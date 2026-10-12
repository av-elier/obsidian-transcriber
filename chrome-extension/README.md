# Transcription Studio

## Install

1. Open `chrome://extensions` in Chrome and enable Developer mode.
2. Choose **Load unpacked** and select this `chrome-extension` directory.
3. Click the extension toolbar action to open the studio.

No build step or dependencies are required. Use a current desktop Chrome version.

## Record and transcribe

- Choose audio only or video with audio. Audio can come from your microphone or a shared Chrome tab/screen; you can mix your microphone into shared audio.
- In Chrome's sharing picker, enable **Share audio**. Availability of system/window audio depends on Chrome and your OS. Video requires a shared tab or screen. If the chosen source has no audio and microphone is disabled, recording fails with an explanation.
- Keep the studio tab open while recording. Pause/resume, then **Stop & save**. Stopping sharing also saves the recording. Closing the studio or browser during capture can lose the active recording.
- Recordings and transcripts are saved in IndexedDB in this Chrome profile. Reopen the extension to find them. Download recordings to back them up; clearing extension data or uninstalling removes local data.
- Select a saved recording and click **Transcribe**. **Local Whisper** is the default: no API key, subscription, or local server required. The first use downloads the quantized multilingual `Xenova/whisper-tiny` model from Hugging Face. Progress appears under the recording controls. Your audio is decoded and processed on your computer, including the separate audio track from video recordings.
- Model data is cached in this extension's browser storage; subsequent transcription works offline once the necessary files are cached. Clearing browser/extension data or uninstalling can require another download. The Whisper Tiny model prioritizes download size and CPU compatibility; accuracy varies with language, noise, and speech quality. Long recordings may take several minutes and use substantial memory. Keep the studio tab open.
- Mistral is optional: choose it under Settings and enter an API key. Only this mode uploads audio to Mistral and may incur usage charges. By default the key lasts only for this studio session; optionally remember it in unencrypted extension-local storage. Uncheck Remember and Save to remove it. Keys never appear in exports.
- Failed/cancelled requests leave recordings and existing transcripts intact. Cancel terminates the local worker; retry loads the model again from cached files.
- Edit the title and transcript; edits save automatically. Export the current text as TXT, Markdown, or JSON. Download the original recording as WebM.

## Architecture / desktop reuse

`core/local-transcription.js` is the default platform-independent service. Its `transcribe({audio: Blob, signal, onProgress})` returns `{text, language, model, provider}`. The host injects `decodeAudio` and `createWorker`; the service handles validation, cancellation, and results. Chrome's `audio.js` adapter decodes saved WebM/Opus to mono 16 kHz PCM. `local-worker.js` loads Whisper in a dedicated module worker using WebAssembly CPU inference, avoiding a GPU requirement and keeping the UI responsive. A future desktop host can reuse the contract with a desktop audio decoder and its own inference worker.

`core/transcription.js` provides optional Mistral transcription through the same result contract and contains the reusable `exportTranscript` function. It accepts an injected fetch implementation, has a five-minute request timeout, and supports cancellation. A desktop host can provide Mistral credentials through an OS keychain or trusted backend. Do not embed a shared developer API key in distributed clients.

The `vendor` directory packages pinned Transformers.js and its matched ONNX Runtime Web JavaScript/WASM, including license notices. Model downloads contain data only; extension scripts are loaded from the installed extension. The CSP explicitly allows WebAssembly and local module workers. Model-host permissions support Hugging Face's storage redirects.

`recorder.js` owns media permissions and mixes audio using Web Audio. Video recording runs a separate audio MediaRecorder for provider uploads. `storage.js` owns IndexedDB, and `studio.js` coordinates the host-specific UI. The full extension tab owns capture so popup dismissal and service worker suspension do not interrupt it. Video plus separate audio is stored locally, consuming additional space. Active chunks are held in memory until Stop; very long recordings should be split manually. There is no background recovery after a browser crash.

The original Python Obsidian workflow remains available independently. Local speech recognition uses [Transformers.js](https://huggingface.co/docs/transformers.js/v3.8.1/pipelines). The optional remote service follows Mistral's documented [audio transcription API](https://docs.mistral.ai/studio/audio/speech_to_text/offline_transcription). Chrome capture follows [Chrome's extension recording guidance](https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture).

## Validation

From the repository root run `npm test` and `npm run check` (Node 22+). These verify local/remote service contracts, worker cancellation/retry, request/authentication, provider errors, exports, syntax, and manifest entrypoints without making paid API calls. Users loading the unpacked extension do not need Node or a build step.

To regenerate bundled runtime files as a maintainer, install the pinned dependency with `pnpm install --frozen-lockfile --ignore-scripts` and run `npm run build:local`. Native dependency installation scripts are unnecessary for the browser runtime.

Manual Chrome acceptance checks:

1. Deny/cancel microphone or sharing permission; verify controls reset and no tracks remain active.
2. Record microphone audio, pause/resume, stop, play and download. Reopen the studio and verify persistence.
3. Record a Chrome tab with Share audio enabled and microphone disabled; verify playback contains tab audio. Repeat with microphone mixed in.
4. Record video with audio; verify video playback and that transcription uploads audio only. Stop using Chrome's sharing indicator and verify save.
5. With no API key, transcribe a recording locally; check model download progress and the result. Reopen the studio, disconnect the internet, and transcribe another saved recording using the cached model. Cancel and retry. Confirm edits survive reopening and exports contain the edited text.
6. Search, rename, delete, and reopen recordings. Ensure deleting a recording does not recreate it through a pending edit.
7. Optionally select Mistral in Settings; try missing/invalid keys, cancel a transcription, then use a valid key. Return to Local Whisper and verify no key is required.

Real local Whisper inference has been smoke-tested in headless Chrome under the manifest's CSP using a speech sample, WebM/Opus decoding, studio UI transcription, cached-model inference with external requests blocked, and transcript persistence. This test used a local HTTP host with a Chrome storage adapter stub; installed-extension permissions, microphone/screen capture, and paid Mistral requests still require the acceptance checks above.
