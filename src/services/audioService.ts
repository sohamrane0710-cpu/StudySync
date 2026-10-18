/**
 * Web Audio API synthesized chimes and offline ambient soundscape generator.
 * Completely autonomous: requires 0 external network requests or media assets.
 */

export class AudioService {
  private static audioCtx: AudioContext | null = null;
  private static ambientSource: AudioNode | null = null;
  private static ambientGain: GainNode | null = null;
  private static customAudioElement: HTMLAudioElement | null = null;

  private static getContext(): AudioContext {
    if (!AudioService.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        // @ts-expect-error webkit prefix fallback
        window.webkitAudioContext;
      AudioService.audioCtx = new AudioContextClass();
    }
    if (AudioService.audioCtx.state === 'suspended') {
      AudioService.audioCtx.resume().catch(() => {});
    }
    return AudioService.audioCtx;
  }

  /**
   * Focus Completion Chime: Warm ascending harmonic chime (C5 -> G5 -> C6).
   */
  public static playFocusCompleteChime(volume: number = 0.7): void {
    try {
      const ctx = AudioService.getContext();
      const now = ctx.currentTime;
      const notes = [523.25, 783.99, 1046.5]; // C5, G5, C6

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.001, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume * 0.35), now + idx * 0.12 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.85);
      });
    } catch (e) {
      console.warn('AudioService error:', e);
    }
  }

  /**
   * Rest Completion Chime: Calming gentle bell descent (E5 -> B4 -> E4).
   */
  public static playRestCompleteChime(volume: number = 0.7): void {
    try {
      const ctx = AudioService.getContext();
      const now = ctx.currentTime;
      const notes = [659.25, 493.88, 329.63]; // E5, B4, E4

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);

        gain.gain.setValueAtTime(0.001, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume * 0.3), now + idx * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 1.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 1.15);
      });
    } catch (e) {
      console.warn('AudioService error:', e);
    }
  }

  /**
   * Gentle Near-End Warning: Subtle soft chime ping.
   */
  public static playWarningChime(volume: number = 0.7): void {
    try {
      const ctx = AudioService.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume * 0.2), now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {
      console.warn('AudioService error:', e);
    }
  }

  /**
   * Synthesizes offline ambient soundscapes.
   */
  public static startAmbient(type: 'rain' | 'whitenoise' | 'drone', volume: number = 0.5): void {
    AudioService.stopAmbient();

    try {
      const ctx = AudioService.getContext();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(Math.max(0.001, volume * 0.4), ctx.currentTime);
      gain.connect(ctx.destination);
      AudioService.ambientGain = gain;

      if (type === 'whitenoise' || type === 'rain') {
        // Generate 5-second looping noise buffer
        const bufferSize = ctx.sampleRate * 5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          if (type === 'rain') {
            // Brown/Pink filtered noise simulation for soft rain
            lastOut = (lastOut + 0.02 * white) / 1.02;
            data[i] = lastOut * 3.5;
          } else {
            // Smoothed white noise
            data[i] = white * 0.15;
          }
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        if (type === 'rain') {
          // Low-pass filter for soothing rain resonance
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, ctx.currentTime);
          source.connect(filter);
          filter.connect(gain);
        } else {
          source.connect(gain);
        }

        source.start();
        AudioService.ambientSource = source;
      } else if (type === 'drone') {
        // Binaural focus drone: 108Hz and 112Hz twin sine oscillators (4Hz theta difference)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(108, ctx.currentTime);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(112, ctx.currentTime);

        const droneGain = ctx.createGain();
        droneGain.gain.setValueAtTime(0.5, ctx.currentTime);

        osc1.connect(droneGain);
        osc2.connect(droneGain);
        droneGain.connect(gain);

        osc1.start();
        osc2.start();

        AudioService.ambientSource = osc1; // tracks primary node for stop
      }
    } catch (e) {
      console.warn('Could not start ambient audio:', e);
    }
  }

  /**
   * Sets volume of actively running ambient sound.
   */
  public static setAmbientVolume(volume: number): void {
    if (AudioService.ambientGain && AudioService.audioCtx) {
      try {
        AudioService.ambientGain.gain.setValueAtTime(
          Math.max(0.001, volume * 0.4),
          AudioService.audioCtx.currentTime,
        );
      } catch (e) {
        console.warn('Error setting ambient volume:', e);
      }
    }
    if (AudioService.customAudioElement) {
      AudioService.customAudioElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Stops all synthesized and custom ambient playback.
   */
  public static stopAmbient(): void {
    try {
      if (AudioService.ambientSource) {
        // @ts-expect-error check stop method
        if (typeof AudioService.ambientSource.stop === 'function') {
          // @ts-expect-error call stop method
          AudioService.ambientSource.stop();
        }
        AudioService.ambientSource.disconnect();
        AudioService.ambientSource = null;
      }
      if (AudioService.ambientGain) {
        AudioService.ambientGain.disconnect();
        AudioService.ambientGain = null;
      }
      if (AudioService.customAudioElement) {
        AudioService.customAudioElement.pause();
        AudioService.customAudioElement = null;
      }
    } catch (e) {
      console.warn('Error stopping ambient audio:', e);
    }
  }

  /**
   * Plays a user-selected local audio file using native browser audio element without uploading.
   */
  public static playCustomAudioFile(file: File, volume: number = 0.5): HTMLAudioElement {
    AudioService.stopAmbient();
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.play().catch((err) => {
      console.warn('Custom audio playback blocked:', err);
    });
    AudioService.customAudioElement = audio;
    return audio;
  }
}
