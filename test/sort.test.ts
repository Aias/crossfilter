import fc from "fast-check";
import { describe, expect, it } from "vitest";
import sortIndexByValue from "../src/sort.ts";

function reference<V>(values: readonly V[]) {
  return Array.from({ length: values.length }, (_, i) => i).sort((A, B) => {
    const a = values[A];
    const b = values[B];
    return a < b ? -1 : a > b ? 1 : A - B;
  });
}

const specialNumbers = fc.constantFrom(0, -0, Infinity, -Infinity, 1e-320, -1e-320, 2 ** 53);
const numbers = fc.array(fc.oneof(fc.double({ noNaN: true }), fc.integer({ min: -3, max: 3 }), specialNumbers), {
  minLength: 0,
  maxLength: 1500,
});

describe("sortIndexByValue", () => {
  it("matches a comparator sort for numbers of any size", () => {
    fc.assert(
      fc.property(numbers, (values) => {
        expect(sortIndexByValue(values, values.length)).toEqual(reference(values));
      }),
      { numRuns: 200 },
    );
  });

  it("matches a comparator sort for dates", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1e12, max: 1e12 }).map((ms) => new Date(ms)), { maxLength: 1200 }),
        (values) => {
          expect(sortIndexByValue(values, values.length)).toEqual(reference(values));
        },
      ),
      { numRuns: 60 },
    );
  });

  it("matches a comparator sort for strings", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 4 }), { maxLength: 800 }), (values) => {
        expect(sortIndexByValue(values, values.length)).toEqual(reference(values));
      }),
      { numRuns: 60 },
    );
  });

  it("keeps ties in index order across large inputs", () => {
    const values = Array.from({ length: 4096 }, (_, i) => i % 7);
    const sorted = sortIndexByValue(values, values.length);
    expect(sorted).toEqual(reference(values));
  });
});
