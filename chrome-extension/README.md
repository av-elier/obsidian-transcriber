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
- Open Settings and enter a Mistral API key. By default the key lasts only for this studio session; optionally remember it in unencrypted extension-local storage. Uncheck Remember and Save to remove it. Keys never appear in exports.
- Select a saved recording and click **Transcribe with Mistral**. Only the separate audio track is uploaded, including for video recordings. Mistral usage may incur charges. Failed/cancelled requests leave recordings and existing transcripts intact.
- Edit the title and transcript; edits save automatically. Export the current text as TXT, Markdown, or JSON. Download the original recording as WebM.

## Architecture / desktop reuse

`core/transcription.js` is the platform-independent service boundary. Its `transcribe({audio: Blob, filename, apiKey, model, signal})` returns `{text, language, model, provider}`. It accepts an injected fetch implementation, has a five-minute request timeout, and supports cancellation. No Chrome APIs, UI, capture, or persistence are used by this module. A future Electron/Tauri host can reuse it, provide credentials through an OS keychain or trusted backend, and replace the IndexedDB/capture adapters. `exportTranscript` is also reusable. Do not embed a shared developer API key in distributed clients.

`recorder.js` owns media permissions and mixes audio using Web Audio. Video recording runs a separate audio MediaRecorder for provider uploads. `storage.js` owns IndexedDB, and `studio.js` coordinates the host-specific UI. The full extension tab owns capture so popup dismissal and service worker suspension do not interrupt it. Video plus separate audio is stored locally, consuming additional space. Active chunks are held in memory until Stop; very long recordings should be split manually. There is no background recovery after a browser crash.

The original Python Obsidian workflow remains available independently. The new service follows Mistral's documented [audio transcription API](https://docs.mistral.ai/studio/audio/speech_to_text/offline_transcription). Chrome capture follows [Chrome's extension recording guidance](https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture).

## Validation

From the repository root run `npm test` and `npm run check` (Node 22+). These verify the service contract, request/authentication, provider errors, cancellation, exports, syntax, and manifest entrypoints without making paid API calls.

Manual Chrome acceptance checks:

1. Deny/cancel microphone or sharing permission; verify controls reset and no tracks remain active.
2. Record microphone audio, pause/resume, stop, play and download. Reopen the studio and verify persistence.
3. Record a Chrome tab with Share audio enabled and microphone disabled; verify playback contains tab audio. Repeat with microphone mixed in.
4. Record video with audio; verify video playback and that transcription uploads audio only. Stop using Chrome's sharing indicator and verify save.
5. Try missing/invalid keys, cancel a transcription, then use a valid key. Confirm edits survive reopening and exports contain the edited text.
6. Search, rename, delete, and reopen recordings. Ensure deleting a recording does not recreate it through a pending edit.

Actual browser media capture and paid Mistral requests require manual validation with devices and credentials.
