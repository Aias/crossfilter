import { indexRange } from "./indexes.js";

const littleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const radixThreshold = 512;
const digitBits = 16;
const digitCount = 1 << digitBits;
const digitMask = digitCount - 1;

export function numericKeys(values: readonly unknown[], n: number) {
  const keys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const value = values[i];
    const key = typeof value === "number" ? value : typeof value === "object" && value !== null ? value.valueOf() : NaN;
    if (typeof key !== "number" || key !== key) return undefined;
    keys[i] = key + 0;
  }
  return keys;
}

function sortableBits(keys: Float64Array) {
  const words = new Uint32Array(keys.buffer);
  for (let i = 0; i < keys.length; i++) {
    const hi = 2 * i + 1;
    const lo = 2 * i;
    if (words[hi] & 0x80000000) {
      words[hi] = ~words[hi] >>> 0;
      words[lo] = ~words[lo] >>> 0;
    } else {
      words[hi] = (words[hi] ^ 0x80000000) >>> 0;
    }
  }
  return words;
}

function radixSortIndex(keys: Float64Array, n: number) {
  const words = sortableBits(keys);
  let source = indexRange(n);
  let target = indexRange(n);
  const counts = new Uint32Array(digitCount + 1);
  for (let pass = 0; pass < 4; pass++) {
    const word = pass < 2 ? 0 : 1;
    const shift = (pass & 1) * digitBits;
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      counts[((words[2 * source[i] + word] >>> shift) & digitMask) + 1]++;
    }
    let uniform = false;
    for (let digit = 0; digit < digitCount; digit++) {
      if (counts[digit + 1] === n) uniform = true;
      counts[digit + 1] += counts[digit];
    }
    if (uniform) continue;
    for (let i = 0; i < n; i++) {
      const index = source[i];
      target[counts[(words[2 * index + word] >>> shift) & digitMask]++] = index;
    }
    const swapped = source;
    source = target;
    target = swapped;
  }
  return source;
}

export default function sortIndexByValue<V>(values: readonly V[], n: number) {
  if (littleEndian && n >= radixThreshold) {
    const keys = numericKeys(values, n);
    if (keys) return radixSortIndex(keys, n);
  }
  return indexRange(n).sort((A, B) => {
    const a = values[A];
    const b = values[B];
    return a < b ? -1 : a > b ? 1 : A - B;
  });
}
