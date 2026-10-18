import 'fake-indexeddb/auto';

// Mock Web Audio API for tests
class AudioContextMock {
  state = 'running';
  destination = {};
  currentTime = 0;
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {},
      disconnect: () => {},
    };
  }
  createGain() {
    return {
      gain: { value: 1, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
      disconnect: () => {},
    };
  }
  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      connect: () => {},
      start: () => {},
      stop: () => {},
      disconnect: () => {},
    };
  }
  createBuffer(_numberOfChannels: number, length: number, _sampleRate: number) {
    return {
      getChannelData: () => new Float32Array(length),
    };
  }
  close() {
    return Promise.resolve();
  }
  resume() {
    return Promise.resolve();
  }
}

// Polyfill window.AudioContext and webkitAudioContext
(window as unknown as { AudioContext: unknown }).AudioContext =
  window.AudioContext || AudioContextMock;
(window as unknown as { webkitAudioContext: unknown }).webkitAudioContext =
  (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext || AudioContextMock;
