import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalTranscriptionService, LOCAL_MODEL } from '../chrome-extension/core/local-transcription.js';

function setup(response = { type: 'result', text: '  Local speech  ' }) {
  const worker = { terminated: false, calls: 0,
    postMessage(message, transfers) {
      this.calls++; this.message = message; this.transfers = transfers;
      if (response) queueMicrotask(() => this.onmessage?.({ data: response }));
    },
    terminate() { this.terminated = true; }
  };
  let created = 0;
  const samples = new Float32Array([0.1,0.2]);
  const service = new LocalTranscriptionService({ decodeAudio: async () => samples, createWorker: () => { created++; return worker; } });
  return { service, worker, samples, created: () => created };
}
test('local service transfers decoded PCM without credentials or audio upload', async () => {
  const { service, worker, samples, created } = setup();
  const result = await service.transcribe({ audio: new Blob(['audio']) });
  assert.deepEqual(result, { text: 'Local speech', language: null, provider: 'local-whisper', model: LOCAL_MODEL });
  assert.deepEqual(worker.transfers, [samples.buffer]);
  assert.deepEqual(Object.keys(worker.message).sort(), ['samples','type']);
  await service.transcribe({ audio: new Blob(['audio']) }); assert.equal(created(),1);
});
test('local cancellation terminates inference worker and permits retry', async () => {
  const { service, worker } = setup(null), controller = new AbortController();
  const result = service.transcribe({ audio: new Blob(['audio']), signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(worker.terminated,true); assert.equal(service.worker,null); assert.equal(service.busy,false);
});
test('pre-cancelled requests never create a worker', async () => {
  const { service, created } = setup(), controller = new AbortController(); controller.abort();
  await assert.rejects(service.transcribe({ audio: new Blob(['a']),signal:controller.signal }), { name:'AbortError' });
  assert.equal(created(),0);
});
test('local model errors and malformed results reset worker', async () => {
  for (const response of [{ type:'error',message:'Download failed' },{ type:'result',text:null }]) {
    const { service, worker } = setup(response);
    await assert.rejects(service.transcribe({ audio:new Blob(['a']) }));
    assert.equal(worker.terminated,true); assert.equal(service.busy,false);
  }
});
test('rejects invalid audio and decoding failures', async () => {
  const { service } = setup();
  await assert.rejects(service.transcribe({ audio:new Blob([]) }), /no audio/);
  service.decodeAudio = async () => new Float32Array();
  await assert.rejects(service.transcribe({ audio:new Blob(['a']) }), /decode/);
  assert.equal(service.busy,false);
});
