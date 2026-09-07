import identity from "./identity.js";
import crossfilterHeap from "./heap.js";

function heapselectBy<T, Value>(value: (record: T) => Value) {
  const heap = crossfilterHeap.by(value);

  return function heapselect<Record extends T>(
    array: readonly Record[],
    lo: number,
    hi: number,
    k: number,
  ) {
    const queue = new Array<Record>((k = Math.min(hi - lo, k)));

    for (let i = 0; i < k; ++i) queue[i] = array[lo++];
    heap(queue, 0, k);

    if (lo < hi) {
      let min = value(queue[0]);
      do {
        const record = array[lo];
        if (value(record) > min) {
          queue[0] = record;
          min = value(heap(queue, 0, k)[0]);
        }
      } while (++lo < hi);
    }

    return queue;
  };
}

const heapselect = Object.assign(heapselectBy(identity), { by: heapselectBy });

export default heapselect;
