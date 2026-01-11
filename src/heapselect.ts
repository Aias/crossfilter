import xFilterHeap from './heap.js';

export type HeapselectFn<T> = (a: T[], lo: number, hi: number, k: number) => T[];

export interface HeapselectWithBy extends HeapselectFn<number> {
  by: <T>(f: (d: T) => number) => HeapselectFn<T>;
}

function heapselect_by<T>(f: (d: T) => number): HeapselectFn<T> {
  const heap = xFilterHeap.by(f);

  // Returns a new array containing the top k elements in the array a[lo:hi].
  function heapselect(a: T[], lo: number, hi: number, k: number): T[] {
    k = Math.min(hi - lo, k);
    const queue = new Array<T>(k);
    let min: number;
    let i: number;
    let d: T;

    for (i = 0; i < k; ++i) queue[i] = a[lo++];
    heap(queue, 0, k);

    if (lo < hi) {
      min = f(queue[0]);
      do {
        if (f(d = a[lo]) > min) {
          queue[0] = d;
          min = f(heap(queue, 0, k)[0]);
        }
      } while (++lo < hi);
    }

    return queue;
  }

  return heapselect;
}

// Create the default heapselect for numbers
const identityNum = (d: number): number => d;
const baseHeapselect = heapselect_by(identityNum);

function heapselectFn(a: number[], lo: number, hi: number, k: number): number[] {
  return baseHeapselect(a, lo, hi, k);
}
heapselectFn.by = heapselect_by;

const h: HeapselectWithBy = heapselectFn;

export default h;
