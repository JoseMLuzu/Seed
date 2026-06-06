import { Howl, Howler } from 'howler';

export type SeedSoundKind = 'pop' | 'holdPop' | 'plant' | 'water' | 'sprout' | 'step' | 'harvest';

type ToneLayer = {
  frequency: number;
  start: number;
  duration: number;
  gain: number;
  glideTo?: number;
};

type SoundPreset = {
  layers: ToneLayer[];
  duration: number;
  volume: number;
  noise?: {
    start: number;
    duration: number;
    gain: number;
  };
};

const SAMPLE_RATE = 44100;
const MASTER_VOLUME = 0.55;
const SOUND_FILES: Partial<Record<SeedSoundKind, string[]>> = {
  pop: ['/sounds/mixkit-long-pop-2358-short.wav'],
  holdPop: ['/sounds/mixkit-long-pop-2358.wav'],
};

const SOUND_PRESETS: Record<SeedSoundKind, SoundPreset> = {
  pop: {
    duration: 0.18,
    volume: 0.56,
    layers: [
      { frequency: 260, start: 0, duration: 0.08, gain: 0.22, glideTo: 510 },
      { frequency: 920, start: 0.032, duration: 0.09, gain: 0.1, glideTo: 1180 },
    ],
  },
  holdPop: {
    duration: 0.48,
    volume: 0.64,
    layers: [
      { frequency: 260, start: 0, duration: 0.12, gain: 0.18, glideTo: 460 },
    ],
  },
  plant: {
    duration: 0.28,
    volume: 0.82,
    layers: [
      { frequency: 392, start: 0, duration: 0.18, gain: 0.34, glideTo: 466 },
      { frequency: 784, start: 0.04, duration: 0.18, gain: 0.16, glideTo: 880 },
    ],
  },
  water: {
    duration: 0.34,
    volume: 0.7,
    noise: { start: 0.02, duration: 0.18, gain: 0.08 },
    layers: [
      { frequency: 620, start: 0, duration: 0.17, gain: 0.16, glideTo: 430 },
      { frequency: 720, start: 0.1, duration: 0.17, gain: 0.1, glideTo: 520 },
    ],
  },
  sprout: {
    duration: 0.36,
    volume: 0.78,
    layers: [
      { frequency: 440, start: 0, duration: 0.2, gain: 0.24, glideTo: 554 },
      { frequency: 659, start: 0.08, duration: 0.2, gain: 0.16, glideTo: 740 },
    ],
  },
  step: {
    duration: 0.22,
    volume: 0.62,
    layers: [
      { frequency: 523, start: 0, duration: 0.15, gain: 0.18, glideTo: 587 },
    ],
  },
  harvest: {
    duration: 0.46,
    volume: 0.86,
    layers: [
      { frequency: 392, start: 0, duration: 0.22, gain: 0.2, glideTo: 494 },
      { frequency: 587, start: 0.07, duration: 0.24, gain: 0.16, glideTo: 740 },
      { frequency: 880, start: 0.15, duration: 0.24, gain: 0.12, glideTo: 988 },
    ],
  },
};

const soundCache = new Map<SeedSoundKind, Howl>();

Howler.volume(MASTER_VOLUME);

export function unlockSeedAudio() {
  if (typeof window === 'undefined') return;
  Howler.mute(false);
  const context = Howler.ctx;
  if (context && context.state !== 'running') {
    void context.resume().catch(() => {
      // iOS can reject resume outside a direct user gesture.
    });
  }
}

function envelope(time: number, duration: number) {
  const attack = Math.min(0.026, duration * 0.22);
  const releaseStart = duration * 0.58;
  if (time < 0 || time > duration) return 0;
  if (time < attack) return time / attack;
  if (time > releaseStart) {
    const releaseProgress = (time - releaseStart) / Math.max(0.001, duration - releaseStart);
    return Math.pow(1 - releaseProgress, 2.5);
  }
  return 1;
}

function waveSample(layer: ToneLayer, absoluteTime: number) {
  const localTime = absoluteTime - layer.start;
  if (localTime < 0 || localTime > layer.duration) return 0;
  const progress = localTime / layer.duration;
  const frequency = layer.glideTo
    ? layer.frequency + (layer.glideTo - layer.frequency) * progress
    : layer.frequency;
  const phase = Math.PI * 2 * frequency * localTime;
  const main = Math.sin(phase);
  const shine = Math.sin(phase * 2.01) * 0.16;
  return (main + shine) * layer.gain * envelope(localTime, layer.duration);
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function wavToDataUrl(samples: Int16Array) {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);
  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(44 + index * bytesPerSample, samples[index], true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function createSoundDataUrl(preset: SoundPreset) {
  const sampleCount = Math.ceil(preset.duration * SAMPLE_RATE);
  const samples = new Int16Array(sampleCount);
  let seed = 42;

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    let value = preset.layers.reduce((total, layer) => total + waveSample(layer, time), 0);

    if (preset.noise) {
      const localTime = time - preset.noise.start;
      if (localTime >= 0 && localTime <= preset.noise.duration) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const noise = ((seed / 0xffffffff) * 2 - 1) * preset.noise.gain;
        value += noise * envelope(localTime, preset.noise.duration);
      }
    }

    const softened = Math.tanh(value * 1.35) * 0.72;
    samples[index] = Math.max(-1, Math.min(1, softened)) * 32767;
  }

  return wavToDataUrl(samples);
}

function getHowl(kind: SeedSoundKind) {
  const cached = soundCache.get(kind);
  if (cached) return cached;

  const preset = SOUND_PRESETS[kind];
  const howl = new Howl({
    src: SOUND_FILES[kind] || [createSoundDataUrl(preset)],
    volume: preset.volume,
    preload: true,
    html5: false,
  });
  soundCache.set(kind, howl);
  return howl;
}

export function playSeedSound(kind: SeedSoundKind, enabled: boolean, force = false) {
  if ((!enabled && !force) || typeof window === 'undefined') return;
  unlockSeedAudio();
  const howl = getHowl(kind);
  if (howl.state() === 'loaded') {
    howl.play();
    return;
  }
  howl.once('load', () => howl.play());
}

export function preloadSeedSounds() {
  if (typeof window === 'undefined') return;
  (Object.keys(SOUND_PRESETS) as SeedSoundKind[]).forEach(kind => {
    getHowl(kind);
  });
}
