import identity from "./identity.js";

function heapBy<T, Value>(value: (record: T) => Value) {
  function heap<Record extends T>(array: Record[], lo: number, hi: number) {
    const n = hi - lo;
    let i = (n >>> 1) + 1;
    while (--i > 0) sift(array, i, n, lo);
    return array;
  }

  function sort<Record extends T>(array: Record[], lo: number, hi: number) {
    let n = hi - lo;
    while (--n > 0) {
      const record = array[lo];
      array[lo] = array[lo + n];
      array[lo + n] = record;
      sift(array, 1, n, lo);
    }
    return array;
  }

  function sift<Record extends T>(array: Record[], i: number, n: number, lo: number) {
    const record = array[--lo + i];
    const x = value(record);
    let child: number;
    while ((child = i << 1) <= n) {
      if (child < n && value(array[lo + child]) > value(array[lo + child + 1])) child++;
      if (x <= value(array[lo + child])) break;
      array[lo + i] = array[lo + child];
      i = child;
    }
    array[lo + i] = record;
  }

  heap.sort = sort;
  return heap;
}

const heap = Object.assign(heapBy(identity), { by: heapBy });

export default heap;
