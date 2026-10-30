class SoundEngine {
  private audioCtx: AudioContext | null = null;
  private ambientSource: AudioNode | null = null;
  private ambientGain: GainNode | null = null;
  private currentPreset: string = 'none';

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Plays a resonant melodic chime for timer completion or phase transition.
   */
  public playChime(volume = 0.7, soundEnabled = true) {
    if (!soundEnabled || volume <= 0) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(volume * 0.4, now);
      masterGain.connect(ctx.destination);

      // Play a calming 3-tone chord (E5, G#5, B5) with harmonic decay
      const frequencies = [659.25, 830.61, 987.77];

      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        noteGain.gain.setValueAtTime(0, now + idx * 0.12);
        noteGain.gain.linearRampToValueAtTime(0.8, now + idx * 0.12 + 0.05);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 1.8);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 2.0);
      });
    } catch {
      // Audio autoplay policy blocked or not supported
    }
  }

  /**
   * Plays a subtle click/tap sound for timer control feedback.
   */
  public playTick(volume = 0.5, soundEnabled = true) {
    if (!soundEnabled || volume <= 0) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);

      gain.gain.setValueAtTime(volume * 0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Silently ignore
    }
  }

  /**
   * Starts or stops synthetic ambient sound (rain, waves, cafe, white-noise)
   */
  public setAmbient(preset: string = 'none', volume = 0.5, soundEnabled = true) {
    this.stopAmbient();
    this.currentPreset = preset;

    if (!soundEnabled || volume <= 0 || preset === 'none') {
      return;
    }

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      // 2 seconds of pink/brown noise loop
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (preset === 'rain' || preset === 'waves') {
          // Pink-ish / filtered noise
          b0 = 0.99 * b0 + white * 0.05;
          b1 = 0.95 * b1 + white * 0.1;
          data[i] = (b0 + b1) * 0.8;
        } else if (preset === 'cafe') {
          // Brown-ish low rumble
          b2 = (b2 + (0.02 * white)) / 1.02;
          data[i] = b2 * 2.5;
        } else {
          // Gentle white noise
          data[i] = white * 0.15;
        }
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      // Filter to shape the sound
      const filter = ctx.createBiquadFilter();
      if (preset === 'rain') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
      } else if (preset === 'waves') {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime);
      } else {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume * 0.2, ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      this.ambientSource = noise;
      this.ambientGain = gain;
    } catch {
      // Audio context blocked
    }
  }

  public getCurrentPreset(): string {
    return this.currentPreset;
  }

  public setAmbientVolume(volume: number) {
    if (this.ambientGain && this.audioCtx) {
      this.ambientGain.gain.setValueAtTime(volume * 0.2, this.audioCtx.currentTime);
    }
  }

  public stopAmbient() {
    if (this.ambientSource) {
      try {
        (this.ambientSource as AudioScheduledSourceNode).stop();
      } catch {
        // Ignored
      }
      this.ambientSource = null;
    }
    this.ambientGain = null;
    this.currentPreset = 'none';
  }
}

export const soundEngine = new SoundEngine();
