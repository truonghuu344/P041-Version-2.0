/**
 * AudioWorklet: mic -> PCM16 mono 16kHz, phát ra từng khung 100ms.
 *
 * Gemini Live chỉ nhận PCM thô (pcm_16000), không nhận container webm/opus,
 * nên không dùng MediaRecorder được nữa.
 *
 * Hai ràng buộc đã đo được trên API thật:
 *  1. Phải đẩy audio theo NHỊP THẬT. Gom buffer rồi xả một lần làm server bỏ
 *     đoạn sau chỗ ngập ngừng — transcript mất chữ mà không báo lỗi.
 *     Worklet chạy theo đồng hồ audio nên tự thoả mãn điều này.
 *  2. Khung ~100ms là cỡ backend đang cắt để gửi đi.
 *
 * Đường đi chính: app.js mở AudioContext thẳng ở 16kHz, trình duyệt tự
 * resample bằng bộ lọc tử tế, và worklet chỉ còn đổi Float32 sang Int16
 * (ratio = 1, không lọc gì thêm).
 *
 * Đường dự phòng, khi trình duyệt từ chối 16kHz: worklet tự hạ tần số bằng
 * trung bình cửa sổ (box filter). Cách này hơn hẳn việc bốc mẫu cách quãng —
 * bốc cách quãng gập nguyên biên độ phần trên Nyquist xuống dải tiếng nói —
 * nhưng vẫn chỉ suy giảm ~50% ở 10kHz (đặc tính sinc của box dài 3). Chấp
 * nhận được cho đường dự phòng, không nên coi là chất lượng cuối.
 */

const TARGET_RATE = 16000;
const FRAME_MS = 100;

class PCM16Downsampler extends AudioWorkletProcessor {
  constructor() {
    super();
    // `sampleRate` là biến toàn cục của AudioWorkletGlobalScope.
    this.ratio = sampleRate / TARGET_RATE;
    this.frameSamples = Math.round((TARGET_RATE * FRAME_MS) / 1000);
    this.pending = [];   // mẫu đầu vào chưa tiêu thụ hết
    this.position = 0;   // vị trí đọc (có phần thập phân)
    this.out = [];       // mẫu Int16 chờ đủ một khung
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0];
    for (let i = 0; i < channel.length; i += 1) {
      this.pending.push(channel[i]);
    }

    while (this.position + this.ratio <= this.pending.length) {
      const start = this.position;
      const end = start + this.ratio;
      const from = Math.floor(start);
      const to = Math.min(Math.ceil(end), this.pending.length);

      let sum = 0;
      let count = 0;
      for (let i = from; i < to; i += 1) {
        sum += this.pending[i];
        count += 1;
      }

      let sample = count > 0 ? sum / count : 0;
      if (sample > 1) sample = 1;
      if (sample < -1) sample = -1;
      this.out.push(sample < 0 ? sample * 0x8000 : sample * 0x7fff);
      this.position = end;
    }

    const consumed = Math.floor(this.position);
    if (consumed > 0) {
      this.pending.splice(0, consumed);
      this.position -= consumed;
    }

    while (this.out.length >= this.frameSamples) {
      const frame = new Int16Array(this.out.splice(0, this.frameSamples));
      // Chuyển quyền sở hữu buffer để không phải sao chép.
      this.port.postMessage(frame.buffer, [frame.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm16-downsampler', PCM16Downsampler);
