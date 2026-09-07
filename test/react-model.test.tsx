import { act, renderHook } from "@testing-library/react";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import crossfilter from "../index.ts";
import {
  useCrossfilterVersion,
  useDimensionBottom,
  useDimensionFilter,
  useDimensionTop,
  useGroupAll,
  useGroupTop,
  useGroupValue,
} from "../react.ts";

interface Row {
  id: number;
  a: number;
  b: number;
}

type Operation =
  | { type: "add"; rows: Omit<Row, "id">[] }
  | { type: "remove"; modulus: number; remainder: number }
  | { type: "filterA"; range: [number, number] | null }
  | { type: "filterB"; value: number | null };

const draft = fc.record({ a: fc.integer({ min: -4, max: 4 }), b: fc.integer({ min: 0, max: 5 }) });
const operation: fc.Arbitrary<Operation> = fc.oneof(
  fc.record({ type: fc.constant("add" as const), rows: fc.array(draft, { minLength: 1, maxLength: 5 }) }),
  fc.record({
    type: fc.constant("remove" as const),
    modulus: fc.integer({ min: 2, max: 4 }),
    remainder: fc.integer({ min: 0, max: 1 }),
  }),
  fc.record({
    type: fc.constant("filterA" as const),
    range: fc.option(
      fc
        .tuple(fc.integer({ min: -4, max: 4 }), fc.integer({ min: -4, max: 4 }))
        .map(([x, y]): [number, number] => [Math.min(x, y), Math.max(x, y)]),
      { nil: null },
    ),
  }),
  fc.record({
    type: fc.constant("filterB" as const),
    value: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
  }),
);

describe("react hooks against direct reads", () => {
  it("report the same snapshots as reading the crossfilter after every operation", () => {
    fc.assert(
      fc.property(fc.array(draft, { maxLength: 8 }), fc.array(operation, { minLength: 1, maxLength: 10 }), (initial, operations) => {
        let nextId = 0;
        const materialize = (drafts: Omit<Row, "id">[]) => drafts.map((row) => ({ id: nextId++, ...row }));
        const source = crossfilter(materialize(initial));
        const a = source.dimension((row) => row.a);
        const b = source.dimension((row) => row.b);
        const byA = a.group();
        const sumB = b.group().reduceSum((row) => row.b);
        const total = source.groupAll();
        const hook = renderHook(() => ({
          version: useCrossfilterVersion(source),
          bins: useGroupAll(source, byA),
          topBins: useGroupTop(source, sumB, 2),
          total: useGroupValue(source, total),
          top: useDimensionTop(source, a, 3),
          bottom: useDimensionBottom(source, b, 3, 1),
          filterA: useDimensionFilter(source, a),
        }));
        const check = () => {
          const { current } = hook.result;
          expect(current.bins).toEqual(byA.all());
          expect(current.topBins).toEqual(sumB.top(2));
          expect(current.total).toBe(total.value());
          expect(current.top).toEqual(a.top(3));
          expect(current.bottom).toEqual(b.bottom(3, 1));
          expect(current.filterA[0]).toEqual(a.currentFilter());
        };
        check();
        let version = hook.result.current.version;
        for (const step of operations) {
          const before = hook.result.current;
          act(() => {
            switch (step.type) {
              case "add":
                source.add(materialize(step.rows));
                break;
              case "remove":
                source.remove((row) => row.b % step.modulus === step.remainder);
                break;
              case "filterA":
                before.filterA[1](step.range);
                break;
              case "filterB":
                b.filterExact(step.value);
                break;
            }
          });
          expect(hook.result.current.version).toBe(version + 1);
          version += 1;
          expect(hook.result.current.bins).not.toBe(before.bins);
          check();
        }
        hook.unmount();
      }),
      { numRuns: 150 },
    );
  });
});
