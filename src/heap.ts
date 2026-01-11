export interface HeapResult<T> {
  (a: T[], lo: number, hi: number): T[];
  sort: (a: T[], lo: number, hi: number) => T[];
}

export interface HeapWithBy extends HeapResult<number> {
  by: <T>(f: (d: T) => number) => HeapResult<T>;
}

function heap_by<T>(f: (d: T) => number): HeapResult<T> {
  // Sifts the element a[lo+i-1] down the heap.
  function sift(a: T[], i: number, n: number, lo: number): void {
    const d = a[--lo + i];
    const x = f(d);
    let child: number;
    while ((child = i << 1) <= n) {
      if (child < n && f(a[lo + child]) > f(a[lo + child + 1])) child++;
      if (x <= f(a[lo + child])) break;
      a[lo + i] = a[lo + child];
      i = child;
    }
    a[lo + i] = d;
  }

  // Builds a binary heap within the specified array a[lo:hi].
  function heap(a: T[], lo: number, hi: number): T[] {
    const n = hi - lo;
    let i = (n >>> 1) + 1;
    while (--i > 0) sift(a, i, n, lo);
    return a;
  }

  // Sorts the specified array a[lo:hi] in descending order, assuming it is already a heap.
  function sort(a: T[], lo: number, hi: number): T[] {
    let n = hi - lo;
    let t: T;
    while (--n > 0) {
      t = a[lo];
      a[lo] = a[lo + n];
      a[lo + n] = t;
      sift(a, 1, n, lo);
    }
    return a;
  }

  // Create the result object
  function heapFn(a: T[], lo: number, hi: number): T[] {
    return heap(a, lo, hi);
  }
  heapFn.sort = sort;

  return heapFn;
}

// Create the default heap for numbers
const identityNum = (d: number): number => d;
const baseHeap = heap_by(identityNum);

function heapFn(a: number[], lo: number, hi: number): number[] {
  return baseHeap(a, lo, hi);
}
heapFn.sort = baseHeap.sort;
heapFn.by = heap_by;

const h: HeapWithBy = heapFn;

export default h;
