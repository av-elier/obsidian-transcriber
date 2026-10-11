/** Platform-independent service. Inject fetch and credentials from the host. */
export class MistralTranscriptionService {
  constructor({ fetchImpl = globalThis.fetch, timeoutMs = 300000 } = {}) {
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }
  async transcribe({ audio, filename = 'recording.webm', apiKey, model = 'voxtral-mini-latest', signal }) {
    if (!apiKey?.trim()) throw new Error('Enter your Mistral API key in Settings.');
    if (!(audio instanceof Blob) || !audio.size) throw new Error('Recording contains no audio.');
    const body = new FormData();
    body.append('file', audio, filename);
    body.append('model', model);
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const response = await this.fetch('https://api.mistral.ai/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey.trim()}` }, body,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout
    });
    if (!response.ok) {
      const descriptions = { 401: 'Invalid Mistral API key.', 403: 'Your key cannot access this model.', 413: 'Recording exceeds the provider upload limit.', 429: 'Mistral rate limit reached. Try again later.' };
      throw new Error(descriptions[response.status] || `Mistral request failed (${response.status}). Try again later.`);
    }
    const result = await response.json();
    if (typeof result.text !== 'string') throw new Error('Mistral returned an invalid transcript.');
    return { text: result.text, language: result.language ?? null, model, provider: 'mistral' };
  }
}

export function exportTranscript(recording, format) {
  const text = recording.transcript ?? '';
  if (format === 'json') return { content: JSON.stringify({ title: recording.title, createdAt: recording.createdAt, transcript: text, transcription: recording.transcription ?? null }, null, 2), type: 'application/json', extension: 'json' };
  if (format === 'md') return { content: `# ${recording.title.replace(/[\r\n]/g, ' ')}\n\n${text}\n`, type: 'text/markdown', extension: 'md' };
  return { content: text, type: 'text/plain', extension: 'txt' };
}
