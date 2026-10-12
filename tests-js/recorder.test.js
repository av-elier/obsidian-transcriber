import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CaptureSession } from '../chrome-extension/recorder.js';

class Track extends EventTarget {
  readyState = 'live';
  constructor(kind) { super(); this.kind = kind; }
  stop() { this.readyState = 'ended'; }
}
class Stream {
  constructor(tracks) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
}
class Recorder {
  static isTypeSupported() { return true; }
  state = 'inactive';
  constructor(stream, options) { this.stream = stream; this.mimeType = options.mimeType; }
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(['captured']) }); this.onstop?.(); });
  }
}
test('video saves separate audio and releases every capture track', async () => {
  const display = new Stream([new Track('video'), new Track('audio')]);
  const mic = new Stream([new Track('audio')]);
  const destination = new Stream([new Track('audio')]);
  const original = { MediaStream: globalThis.MediaStream, MediaRecorder: globalThis.MediaRecorder, AudioContext: globalThis.AudioContext, navigator: Object.getOwnPropertyDescriptor(globalThis,'navigator') };
  let closed = false, connections = 0;
  globalThis.MediaStream = Stream; globalThis.MediaRecorder = Recorder;
  globalThis.AudioContext = class {
    async resume() {}
    createMediaStreamDestination() { return { stream: destination }; }
    createMediaStreamSource() { return { connect() { connections++; } }; }
    async close() { closed = true; }
  };
  Object.defineProperty(globalThis,'navigator',{ configurable: true, value: { mediaDevices: { getDisplayMedia: async () => display, getUserMedia: async () => mic } } });
  try {
    const session = new CaptureSession();
    await session.start({ mode: 'video', source: 'screen', microphone: true, onEnded() {} });
    assert.equal(connections, 2); assert.equal(session.recorders.length, 2);
    session.pause(); assert.ok(session.recorders.every(entry => entry.recorder.state === 'paused'));
    session.resume();
    const result = await session.stop();
    assert.match(result.media.type, /^video\/webm/); assert.match(result.audio.type, /^audio\/webm/);
    assert.ok(result.media.size > 0 && result.audio.size > 0);
    assert.ok([...display.getTracks(), ...mic.getTracks(), ...destination.getTracks()].every(track => track.readyState === 'ended'));
    assert.ok(closed);
  } finally {
    globalThis.MediaStream = original.MediaStream; globalThis.MediaRecorder = original.MediaRecorder; globalThis.AudioContext = original.AudioContext;
    Object.defineProperty(globalThis,'navigator',original.navigator);
  }
});
test('missing shared audio fails and releases screen capture', async () => {
  const display = new Stream([new Track('video')]);
  const original = Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{ configurable:true,value:{ mediaDevices:{ getDisplayMedia:async()=>display } } });
  try {
    await assert.rejects(new CaptureSession().start({ mode:'audio',source:'screen',microphone:false,onEnded(){} }), /No audio/);
    assert.equal(display.getVideoTracks()[0].readyState,'ended');
  } finally { Object.defineProperty(globalThis,'navigator',original); }
});
