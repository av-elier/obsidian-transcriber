import { pipeline, env } from './vendor/transformers.min.js';
import { LOCAL_MODEL } from './core/local-transcription.js';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = new URL('./vendor/', import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
let transcriber;
const progress = message => self.postMessage({ type: 'progress', message });
self.onmessage = async ({ data }) => {
  if (data.type !== 'transcribe') return;
  try {
    if (!transcriber) {
      progress('Loading local Whisper model. First use downloads model files; keep this tab open…');
      transcriber = await pipeline('automatic-speech-recognition', LOCAL_MODEL, {
        device: 'wasm', dtype: 'q8',
        progress_callback: event => {
          if (event.status === 'progress') progress(`Downloading ${event.file}: ${Math.round(event.progress || 0)}%`);
          else if (event.status === 'initiate') progress(`Loading ${event.file}…`);
        }
      });
    }
    progress('Transcribing locally on your computer… Longer recordings can take several minutes.');
    const result = await transcriber(data.samples, { chunk_length_s: 30, stride_length_s: 5, task: 'transcribe' });
    self.postMessage({ type: 'result', text: result.text });
  } catch (error) {
    self.postMessage({ type: 'error', message: `Local transcription failed: ${error.message}. If this is the first use, check your internet connection for the model download.` });
  }
};
