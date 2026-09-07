interface Bisector<Value> {
  left(values: readonly Value[], value: Value, lo: number, hi: number): number;
  right(values: readonly Value[], value: Value, lo: number, hi: number): number;
}

function filterExact<Value>(bisect: Bisector<Value>, value: Value) {
  return function (values: readonly Value[]): [number, number] {
    const n = values.length;
    return [bisect.left(values, value, 0, n), bisect.right(values, value, 0, n)];
  };
}

function filterRange<Value>(bisect: Bisector<Value>, range: readonly [Value, Value]) {
  const min = range[0];
  const max = range[1];
  return function (values: readonly Value[]): [number, number] {
    const n = values.length;
    return [bisect.left(values, min, 0, n), bisect.left(values, max, 0, n)];
  };
}

function filterAll(values: readonly unknown[]): [number, number] {
  return [0, values.length];
}

export default {
  filterExact,
  filterRange,
  filterAll,
};
