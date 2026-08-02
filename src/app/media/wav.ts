/**
 * Minimal RIFF/WAVE encoding.
 *
 * Lyria streams raw PCM with no container, and the default-sound generator
 * script synthesises raw samples, so both need to wrap PCM in a WAV header
 * before anything can play it.
 */

export function encodeWav(
  samples: Int16Array,
  sampleRate: number,
  channels: number,
): Uint8Array {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * bytesPerSample, samples[i], true);
  }

  return new Uint8Array(buffer);
}

/** Decodes base64 into little-endian signed 16-bit samples. */
export function pcm16FromBase64(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  // The byte length can be odd if a chunk is truncated; drop the stray byte
  // rather than letting the Int16Array constructor throw.
  const usable = bytes.byteLength - (bytes.byteLength % 2);
  return new Int16Array(bytes.buffer.slice(0, usable));
}

export function concatInt16(chunks: Int16Array[]): Int16Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Int16Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = '';
  const CHUNK = 0x8000; // avoid blowing the argument limit on large buffers
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Applies a short fade at both ends so a captured loop does not click when it
 * wraps around.
 */
export function crossfadeEdges(
  samples: Int16Array,
  channels: number,
  fadeSamples: number,
): Int16Array {
  const out = new Int16Array(samples);
  const frames = Math.floor(samples.length / channels);
  const fade = Math.min(fadeSamples, Math.floor(frames / 2));
  if (fade <= 0) return out;

  for (let f = 0; f < fade; f++) {
    const gain = f / fade;
    for (let c = 0; c < channels; c++) {
      const head = f * channels + c;
      const tail = (frames - 1 - f) * channels + c;
      out[head] = Math.round(out[head] * gain);
      out[tail] = Math.round(out[tail] * gain);
    }
  }
  return out;
}
