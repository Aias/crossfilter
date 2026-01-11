export interface Bisector<T, V> {
  (a: T[], x: V, lo: number, hi: number): number;
  left: (a: T[], x: V, lo: number, hi: number) => number;
  right: (a: T[], x: V, lo: number, hi: number) => number;
}

const filterExact = <T, V>(bisect: Bisector<T, V>, value: V): (values: T[]) => [number, number] => {
  return (values: T[]): [number, number] => {
    const n = values.length;
    return [bisect.left(values, value, 0, n), bisect.right(values, value, 0, n)];
  };
};

const filterRange = <T, V>(bisect: Bisector<T, V>, range: [V, V]): (values: T[]) => [number, number] => {
  const min = range[0];
  const max = range[1];
  return (values: T[]): [number, number] => {
    const n = values.length;
    return [bisect.left(values, min, 0, n), bisect.left(values, max, 0, n)];
  };
};

const filterAll = <T>(values: T[]): [number, number] => {
  return [0, values.length];
};

export default {
  filterExact,
  filterRange,
  filterAll
};
