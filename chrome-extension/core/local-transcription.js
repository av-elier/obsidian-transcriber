export const LOCAL_MODEL = 'Xenova/whisper-tiny';

/** Portable local service: the host supplies audio decoding and a Worker factory. */
export class LocalTranscriptionService {
  constructor({ decodeAudio, createWorker }) {
    this.decodeAudio = decodeAudio;
    this.createWorker = createWorker;
    this.worker = null;
    this.busy = false;
  }
  async transcribe({ audio, signal, onProgress = () => {} }) {
    if (this.busy) throw new Error('A local transcription is already running.');
    if (!(audio instanceof Blob) || !audio.size) throw new Error('Recording contains no audio.');
    signal?.throwIfAborted();
    this.busy = true;
    try {
      onProgress('Preparing audio for local transcription…');
      const samples = await this.decodeAudio(audio);
      signal?.throwIfAborted();
      if (!(samples instanceof Float32Array) || !samples.length) throw new Error('Unable to decode audio for transcription.');
      return await new Promise((resolve, reject) => {
        let worker;
        const cleanup = () => {
          signal?.removeEventListener('abort', abort);
          if (worker) { worker.onmessage = null; worker.onerror = null; }
        };
        const fail = error => {
          cleanup(); worker?.terminate(); this.worker = null; reject(error);
        };
        const abort = () => fail(new DOMException('Transcription cancelled.', 'AbortError'));
        try {
          worker = this.worker ??= this.createWorker();
          worker.onmessage = ({ data }) => {
            if (data.type === 'progress') onProgress(data.message);
            else if (data.type === 'result') {
              if (typeof data.text !== 'string') return fail(new Error('Local model returned an invalid transcript.'));
              cleanup(); resolve({ text: data.text.trim(), language: null, provider: 'local-whisper', model: LOCAL_MODEL });
            } else if (data.type === 'error') fail(new Error(data.message));
          };
          worker.onerror = () => fail(new Error('Local transcription could not start. Reload the extension and try again.'));
          signal?.addEventListener('abort', abort, { once: true });
          worker.postMessage({ type: 'transcribe', samples }, [samples.buffer]);
        } catch (error) { fail(error); }
      });
    } finally { this.busy = false; }
  }
}
