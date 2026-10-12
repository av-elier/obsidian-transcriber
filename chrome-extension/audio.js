/** Chrome adapter: decode WebM/Opus and resample to Whisper's 16 kHz PCM. */
export async function decodeAudio(audio) {
  const context = new OfflineAudioContext(1, 1, 16000);
  let decoded;
  try { decoded = await context.decodeAudioData(await audio.arrayBuffer()); }
  catch { throw new Error('Chrome could not decode this recording. Try making a new recording.'); }
  const mono = new Float32Array(decoded.length);
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const samples = decoded.getChannelData(channel);
    for (let index = 0; index < mono.length; index++) mono[index] += samples[index] / decoded.numberOfChannels;
  }
  return mono;
}
