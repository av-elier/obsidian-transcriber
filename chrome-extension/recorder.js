export class CaptureSession {
  streams = [];
  recorders = [];
  async start({ mode, source, microphone, onEnded }) {
    try {
      let display;
      if (source === 'screen') {
        display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        this.streams.push(display);
        display.getVideoTracks()[0].addEventListener('ended', onEnded, { once: true });
      }
      let mic;
      if (microphone || source === 'microphone') {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.streams.push(mic);
        mic.getAudioTracks()[0].addEventListener('ended', onEnded, { once: true });
      }
      if (this.streams.some(stream => stream.getTracks().some(track => track.readyState === 'ended'))) throw new Error('Capture ended before recording started. Please try again.');
      const audioStreams = this.streams.filter(stream => stream.getAudioTracks().length);
      if (!audioStreams.length) throw new Error('No audio selected. Enable Share audio in the Chrome picker or include your microphone.');
      this.context = new AudioContext();
      await this.context.resume();
      const destination = this.context.createMediaStreamDestination();
      for (const stream of audioStreams) this.context.createMediaStreamSource(stream).connect(destination);
      this.streams.push(destination.stream);
      this.audio = this.createRecorder(destination.stream, false);
      if (mode === 'video') {
        if (!display) throw new Error('Video recording requires a screen or tab source.');
        this.media = this.createRecorder(new MediaStream([...display.getVideoTracks(), ...destination.stream.getAudioTracks()]), true);
      } else this.media = this.audio;
      for (const entry of this.recorders) entry.recorder.onerror = event => {
        this.error = event.error || new Error('Media recording failed.');
        onEnded();
      };
      for (const recorder of this.recorders) recorder.recorder.start(1000);
      this.startedAt = Date.now();
    } catch (error) { await this.release(); throw error; }
  }
  createRecorder(stream, video) {
    const types = video ? ['video/webm;codecs=vp8,opus', 'video/webm'] : ['audio/webm;codecs=opus', 'audio/webm'];
    const mimeType = types.find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('This Chrome version does not support WebM recording.');
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    const entry = { recorder, chunks, mimeType };
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    this.recorders.push(entry);
    return entry;
  }
  pause() { this.recorders.forEach(({ recorder }) => recorder.pause()); this.pausedAt = Date.now(); }
  resume() { this.recorders.forEach(({ recorder }) => recorder.resume()); this.startedAt += Date.now() - this.pausedAt; this.pausedAt = null; }
  async stop() {
    const durationMs = (this.pausedAt || Date.now()) - this.startedAt;
    try {
      await Promise.all(this.recorders.map(({ recorder }) => new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = event => { this.error = event.error || new Error('Recording failed.'); reject(this.error); };
        if (recorder.state === 'inactive') resolve(); else recorder.stop();
      })));
      if (this.error) throw this.error;
      return { media: new Blob(this.media.chunks, { type: this.media.mimeType }), audio: new Blob(this.audio.chunks, { type: this.audio.mimeType }), durationMs };
    } finally { await this.release(); }
  }
  async release() {
    this.recorders.forEach(({ recorder }) => { if (recorder.state !== 'inactive') recorder.stop(); });
    this.streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
    if (this.context) await this.context.close();
  }
}
