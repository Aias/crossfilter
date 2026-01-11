import identity from './identity';

export type ComparableValue = string | number | boolean;
export type NaturallyOrderedValue = ComparableValue | { valueOf(): ComparableValue } | null | undefined;

// Represents a bisector that works on arrays of T, comparing extracted values of type V
export interface BisectorResult<T, V> {
  (a: T[], x: V, lo: number, hi: number): number;
  right: (a: T[], x: V, lo: number, hi: number) => number;
  left: (a: T[], x: V, lo: number, hi: number) => number;
}

export interface BisectWithBy<T, V> extends BisectorResult<T, V> {
  by: <U, W extends NaturallyOrderedValue>(f: (d: U) => W) => BisectorResult<U, W>;
}

const toComparableValue = (value: NaturallyOrderedValue): ComparableValue | null | undefined => {
  if (value == null) return value;
  if (typeof value === 'object') return value.valueOf();
  return value;
};

const compare = (a: NaturallyOrderedValue, b: NaturallyOrderedValue): number => {
  const av = toComparableValue(a);
  const bv = toComparableValue(b);

  if (typeof av === 'string' && typeof bv === 'string') {
    return av < bv ? -1 : av > bv ? 1 : 0;
  }

  const an = Number(av);
  const bn = Number(bv);
  return an < bn ? -1 : an > bn ? 1 : 0;
};

function bisect_by<T, V extends NaturallyOrderedValue>(f: (d: T) => V): BisectorResult<T, V> {
  // Locate the insertion point for x in a to maintain sorted order.
  function bisectLeft(a: T[], x: V, lo: number, hi: number): number {
    while (lo < hi) {
      const mid = lo + hi >>> 1;
      if (compare(f(a[mid]), x) < 0) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // Similar to bisectLeft, but returns an insertion point which comes after
  // any existing entries of x in a.
  function bisectRight(a: T[], x: V, lo: number, hi: number): number {
    while (lo < hi) {
      const mid = lo + hi >>> 1;
      if (compare(x, f(a[mid])) < 0) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  // bisector IS bisectRight with additional properties attached
  // Using Object.assign preserves the function identity (bisector === bisector.right)
  return Object.assign(bisectRight, {
    right: bisectRight,
    left: bisectLeft
  });
}

// For the default bisector, T = V (comparing values directly)
// baseBisect IS the main function, with .right/.left/.by attached
const baseBisect = bisect_by<NaturallyOrderedValue, NaturallyOrderedValue>(identity);
const bisect = Object.assign(baseBisect, {
  by: bisect_by
});

export default bisect;
