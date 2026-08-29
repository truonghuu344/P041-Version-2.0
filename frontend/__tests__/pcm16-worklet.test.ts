/**
 * Tests cho AudioWorklet hạ tần số mic -> PCM16 16kHz.
 *
 * Đây là chỗ dễ hỏng âm thầm nhất của luồng voice: resample sai vẫn ra tiếng
 * nghe được, nhưng WER xấu đi mà không có lỗi nào. Nạp thẳng file worklet
 * thật vào sandbox để test đúng code sẽ chạy trong trình duyệt.
 */

import fs from 'fs';
import path from 'path';

const WORKLET_PATH = path.resolve(__dirname, '../public/pcm16-worklet.js');
const TARGET_RATE = 16000;
const FRAME_SAMPLES = 1600; // 100ms
const BLOCK = 128; // AudioWorklet luôn gọi process() với 128 mẫu

class FakeAudioWorkletProcessor {
  port: { postMessage: (data: ArrayBuffer, transfer?: unknown[]) => void };

  constructor() {
    this.port = { postMessage: () => undefined };
  }
}

function loadProcessor(inputRate: number) {
  const code = fs.readFileSync(WORKLET_PATH, 'utf8');
  let Registered: (new () => { process: (inputs: Float32Array[][]) => boolean }) | null =
    null;

  const factory = new Function(
    'AudioWorkletProcessor',
    'registerProcessor',
    'sampleRate',
    code,
  );
  factory(
    FakeAudioWorkletProcessor,
    (_name: string, cls: never) => {
      Registered = cls;
    },
    inputRate,
  );

  if (!Registered) throw new Error('worklet không gọi registerProcessor');
  return new Registered();
}

/** Đẩy một tín hiệu qua worklet, trả về toàn bộ mẫu Int16 thu được. */
function run(inputRate: number, signal: Float32Array) {
  const processor = loadProcessor(inputRate) as unknown as {
    port: { postMessage: (b: ArrayBuffer) => void };
    process: (inputs: Float32Array[][]) => boolean;
  };

  const frames: Int16Array[] = [];
  processor.port.postMessage = (buffer: ArrayBuffer) => {
    frames.push(new Int16Array(buffer));
  };

  for (let offset = 0; offset < signal.length; offset += BLOCK) {
    const block = signal.subarray(offset, offset + BLOCK);
    processor.process([[block as Float32Array]]);
  }

  const total = frames.reduce((n, f) => n + f.length, 0);
  const merged = new Int16Array(total);
  let at = 0;
  for (const frame of frames) {
    merged.set(frame, at);
    at += frame.length;
  }
  return { frames, samples: merged };
}

function sine(freq: number, rate: number, seconds: number): Float32Array {
  const out = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Math.sin((2 * Math.PI * freq * i) / rate) * 0.8;
  }
  return out;
}

function rms(samples: Int16Array): number {
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / Math.max(samples.length, 1));
}

/** Ước lượng tần số trội bằng số lần đổi dấu. */
function dominantHz(samples: Int16Array, rate: number): number {
  let crossings = 0;
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i - 1] < 0 !== samples[i] < 0) crossings += 1;
  }
  return (crossings * rate) / (2 * samples.length);
}

describe('pcm16 worklet', () => {
  it('phát ra khung 100ms đúng cỡ', () => {
    const { frames } = run(48000, sine(1000, 48000, 1));
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      expect(frame.length).toBe(FRAME_SAMPLES);
    }
  });

  it('hạ 48kHz xuống đúng 16kHz', () => {
    const { samples } = run(48000, sine(1000, 48000, 1));
    // 1 giây vào -> ~16000 mẫu ra, cho phép lệch một khung do phần dư.
    expect(samples.length).toBeGreaterThanOrEqual(TARGET_RATE - FRAME_SAMPLES);
    expect(samples.length).toBeLessThanOrEqual(TARGET_RATE);
  });

  it('xử lý được tỉ lệ không nguyên 44.1kHz', () => {
    const { samples } = run(44100, sine(1000, 44100, 1));
    expect(samples.length).toBeGreaterThanOrEqual(TARGET_RATE - FRAME_SAMPLES);
    expect(samples.length).toBeLessThanOrEqual(TARGET_RATE);
  });

  it('giữ nguyên tần số của tín hiệu trong dải', () => {
    const { samples } = run(48000, sine(1000, 48000, 1));
    expect(dominantHz(samples, TARGET_RATE)).toBeGreaterThan(950);
    expect(dominantHz(samples, TARGET_RATE)).toBeLessThan(1050);
  });

  it('giữ được biên độ', () => {
    const { samples } = run(48000, sine(1000, 48000, 1));
    // Sin biên độ 0.8 -> RMS ~ 0.8/sqrt(2) * 32767 ≈ 18500.
    expect(rms(samples)).toBeGreaterThan(15000);
    expect(rms(samples)).toBeLessThan(21000);
  });

  it('đường đi chính: context 16kHz thì worklet là pass-through', () => {
    // app.js mở AudioContext ở 16kHz nên trình duyệt lo phần resample.
    const { samples } = run(16000, sine(1000, 16000, 1));
    expect(samples.length).toBe(TARGET_RATE);
    expect(dominantHz(samples, TARGET_RATE)).toBeGreaterThan(980);
    expect(dominantHz(samples, TARGET_RATE)).toBeLessThan(1020);
    expect(rms(samples)).toBeGreaterThan(17000);
  });

  it('đường dự phòng: tần số trên Nyquist bị suy giảm', () => {
    // Bốc mẫu cách quãng sẽ gập 10kHz xuống 6kHz gần như nguyên biên độ — đó
    // là lỗi cần chặn. Box filter dài 3 hạ xuống ~0.51 (đáp ứng sinc), nên
    // ngưỡng 0.6 MÔ TẢ đúng bộ lọc này chứ không phải mục tiêu chất lượng.
    const inBand = rms(run(48000, sine(1000, 48000, 1)).samples);
    const outOfBand = rms(run(48000, sine(10000, 48000, 1)).samples);
    expect(outOfBand).toBeLessThan(inBand * 0.6);
  });

  it('không mất mẫu giữa các lần gọi process()', () => {
    // Tín hiệu dài gấp đôi thì số mẫu ra cũng phải gấp đôi.
    const one = run(48000, sine(1000, 48000, 1)).samples.length;
    const two = run(48000, sine(1000, 48000, 2)).samples.length;
    expect(two).toBeGreaterThan(one * 2 - FRAME_SAMPLES * 2);
  });

  it('không vỡ khi input rỗng', () => {
    const processor = loadProcessor(48000);
    expect(processor.process([[]])).toBe(true);
    expect(processor.process([])).toBe(true);
  });
});
