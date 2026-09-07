import xfilterArray from "./array.js";

export const REMOVED_INDEX = -1;

export function indexArray(n: number, m: number) {
  return (
    m < 0x101 ? xfilterArray.array8 : m < 0x10001 ? xfilterArray.array16 : xfilterArray.array32
  )(n);
}

export function indexRange(n: number) {
  const range = indexArray(n, n);
  for (let i = -1; ++i < n;) range[i] = i;
  return range;
}

export function capacity(width: number) {
  return width === 8 ? 0x100 : width === 16 ? 0x10000 : 0x100000000;
}
