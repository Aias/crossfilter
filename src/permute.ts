export default <T>(array: ArrayLike<T>, index: ArrayLike<number>, deep?: boolean): T[] => {
  const n = index.length;
  const copy: T[] = deep ? JSON.parse(JSON.stringify(Array.from(array))) : new Array(n);
  for (let i = 0; i < n; ++i) {
    copy[i] = array[index[i]];
  }
  return copy;
};
