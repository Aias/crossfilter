import identity from "./identity.js";

function bisectBy<T, Value>(value: (record: T) => Value) {
  function bisectLeft(array: readonly T[], target: Value, lo: number, hi: number) {
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (value(array[mid]) < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function bisectRight(array: readonly T[], target: Value, lo: number, hi: number) {
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (target < value(array[mid])) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  return Object.assign(bisectRight, { right: bisectRight, left: bisectLeft });
}

const bisect = Object.assign(bisectBy(identity), { by: bisectBy });

export default bisect;
