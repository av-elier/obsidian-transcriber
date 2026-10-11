import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MistralTranscriptionService, exportTranscript } from '../chrome-extension/core/transcription.js';

test('Mistral uploads audio with bearer authentication and normalizes response', async () => {
  let request;
  const service = new MistralTranscriptionService({ fetchImpl: async (url, options) => {
    request = { url, ...options }; return new Response(JSON.stringify({ text: 'Hello world', language: 'en' }));
  } });
  const result = await service.transcribe({ audio: new Blob(['audio'], { type: 'audio/webm' }), apiKey: ' key ' });
  assert.equal(request.url, 'https://api.mistral.ai/v1/audio/transcriptions');
  assert.equal(request.headers.Authorization, 'Bearer key');
  assert.equal(request.body.get('file').name, 'recording.webm');
  assert.equal(request.body.get('model'), 'voxtral-mini-latest');
  assert.equal(result.text, 'Hello world'); assert.equal(result.provider, 'mistral');
});
test('rejects missing credentials, empty audio, and malformed responses', async () => {
  const service = new MistralTranscriptionService({ fetchImpl: async () => new Response('{}') });
  await assert.rejects(service.transcribe({ audio: new Blob(['a']) }), /API key/);
  await assert.rejects(service.transcribe({ audio: new Blob([]), apiKey: 'k' }), /no audio/);
  await assert.rejects(service.transcribe({ audio: new Blob(['a']), apiKey: 'k' }), /invalid transcript/);
});
test('provider failures never expose provider body or credentials', async () => {
  for (const status of [401,403,413,429,500]) {
    const service = new MistralTranscriptionService({ fetchImpl: async () => new Response('secret', { status }) });
    await assert.rejects(service.transcribe({ audio: new Blob(['a']), apiKey: 'secret' }), error => !error.message.includes('secret'));
  }
});
test('cancellation reaches injected transport', async () => {
  const controller = new AbortController(); controller.abort();
  const service = new MistralTranscriptionService({ fetchImpl: async (_, options) => { options.signal.throwIfAborted(); } });
  await assert.rejects(service.transcribe({ audio: new Blob(['a']), apiKey: 'k', signal: controller.signal }), { name: 'AbortError' });
});
test('exports use edited transcript and preserve Unicode', () => {
  const item = { title: 'Meeting', transcript: 'Edited café text', createdAt: '2026-10-11' };
  assert.equal(exportTranscript(item, 'txt').content, item.transcript);
  assert.equal(exportTranscript(item, 'md').content, '# Meeting\n\nEdited café text\n');
  assert.equal(JSON.parse(exportTranscript(item, 'json').content).transcript, item.transcript);
});
