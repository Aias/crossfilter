function jsonArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError("expected an array");
  return value;
}

export default function permute<T>(
  array: readonly T[],
  index: readonly number[],
  deep?: false,
): T[];
export default function permute<T>(
  array: readonly T[],
  index: readonly number[],
  deep: boolean,
): unknown[];
export default function permute<T>(array: readonly T[], index: readonly number[], deep = false) {
  const copy = deep ? jsonArray(JSON.parse(JSON.stringify(array))) : new Array<T>(index.length);
  for (let i = 0, n = index.length; i < n; ++i) copy[i] = array[index[i]];
  return copy;
}
