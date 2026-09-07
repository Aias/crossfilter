import fc from "fast-check";
import { describe, expect, it } from "vitest";
import crossfilter from "../index.ts";

interface Row {
  id: number;
  a: number;
  b: number;
  tags: number[];
}

type Draft = Omit<Row, "id">;
type ScalarDimension = "a" | "b";
type DimensionName = ScalarDimension | "tags";
type Filter =
  | { kind: "none" }
  | { kind: "exact"; value: number }
  | { kind: "range"; lo: number; hi: number }
  | { kind: "modulo"; modulus: number; remainder: number };
type Operation =
  | { type: "add"; rows: Draft[] }
  | { type: "removeMatching"; modulus: number; remainder: number }
  | { type: "removeSelected" }
  | { type: "filter"; dimension: DimensionName; filter: Filter };

const value = fc.integer({ min: -5, max: 5 });
const draft: fc.Arbitrary<Draft> = fc.record({
  a: value,
  b: fc.integer({ min: 0, max: 20 }),
  tags: fc.uniqueArray(fc.integer({ min: 0, max: 6 }), { maxLength: 3 }),
});
const modulo = fc
  .integer({ min: 1, max: 4 })
  .chain((modulus) =>
    fc.record({ modulus: fc.constant(modulus), remainder: fc.integer({ min: 0, max: modulus - 1 }) }),
  );
const filter: fc.Arbitrary<Filter> = fc.oneof(
  fc.constant<Filter>({ kind: "none" }),
  fc.record({ kind: fc.constant("exact" as const), value }),
  fc
    .tuple(value, value)
    .map(([x, y]): Filter => ({ kind: "range", lo: Math.min(x, y), hi: Math.max(x, y) })),
  modulo.map((m): Filter => ({ kind: "modulo", ...m })),
);
const operation: fc.Arbitrary<Operation> = fc.oneof(
  fc.record({ type: fc.constant("add" as const), rows: fc.array(draft, { maxLength: 6 }) }),
  modulo.map((m): Operation => ({ type: "removeMatching", ...m })),
  fc.constant<Operation>({ type: "removeSelected" }),
  fc.record({
    type: fc.constant("filter" as const),
    dimension: fc.constantFrom<DimensionName>("a", "b", "tags"),
    filter,
  }),
);

function passes(candidate: number, active: Filter) {
  switch (active.kind) {
    case "none":
      return true;
    case "exact":
      return candidate === active.value;
    case "range":
      return active.lo <= candidate && candidate < active.hi;
    case "modulo":
      return candidate % active.modulus === active.remainder;
  }
}

function rowPasses(row: Row, dimension: DimensionName, active: Filter) {
  if (dimension === "tags") {
    return active.kind === "none" || row.tags.some((tag) => passes(tag, active));
  }
  return passes(row[dimension], active);
}

function ids(rows: readonly Row[]) {
  return rows.map((row) => row.id).sort((x, y) => x - y);
}

function isSortedBy(rows: readonly Row[], dimension: ScalarDimension, direction: 1 | -1) {
  return rows.every(
    (row, index) => index === 0 || direction * (row[dimension] - rows[index - 1][dimension]) >= 0,
  );
}

function countsByKey(keys: number[], counted: (key: number) => number) {
  return [...new Set(keys)].sort((x, y) => x - y).map((key) => ({ key, value: counted(key) }));
}

describe("crossfilter against a reference model", () => {
  it("agrees with a naive implementation across random operation sequences", () => {
    fc.assert(
      fc.property(fc.array(draft, { maxLength: 12 }), fc.array(operation, { minLength: 1, maxLength: 12 }), (initial, operations) => {
        let nextId = 0;
        const materialize = (drafts: Draft[]) => drafts.map((row) => ({ id: nextId++, ...row }));
        let rows = materialize(initial);
        const filters: Record<DimensionName, Filter> = {
          a: { kind: "none" },
          b: { kind: "none" },
          tags: { kind: "none" },
        };
        const source = crossfilter(rows);
        const dimensions = {
          a: source.dimension((row) => row.a),
          b: source.dimension((row) => row.b),
          tags: source.dimension((row) => row.tags, true),
        };
        const all = source.groupAll();
        const countA = dimensions.a.group();
        const sumA = dimensions.a.group().reduceSum((row) => row.b);
        const countTags = dimensions.tags.group();
        const otherA = dimensions.a.groupAll();

        const selected = (row: Row) =>
          rowPasses(row, "a", filters.a) && rowPasses(row, "b", filters.b) && rowPasses(row, "tags", filters.tags);
        const selectedExcept = (row: Row, dimension: DimensionName) =>
          (["a", "b", "tags"] as const).every(
            (other) => other === dimension || rowPasses(row, other, filters[other]),
          );

        const check = () => {
          const expected = rows.filter(selected);
          expect(source.size()).toBe(rows.length);
          expect(source.all().map((row) => row.id)).toEqual(rows.map((row) => row.id));
          expect(ids(source.allFiltered())).toEqual(ids(expected));
          expect(all.value()).toBe(expected.length);
          expect(otherA.value()).toBe(rows.filter((row) => selectedExcept(row, "a")).length);
          rows.forEach((row, index) => expect(source.isElementFiltered(index)).toBe(selected(row)));
          for (const dimension of ["a", "b"] as const) {
            const top = dimensions[dimension].top(Infinity);
            expect(ids(top)).toEqual(ids(expected));
            expect(isSortedBy(top, dimension, -1)).toBe(true);
            const bottom = dimensions[dimension].bottom(Infinity);
            expect(ids(bottom)).toEqual(ids(expected));
            expect(isSortedBy(bottom, dimension, 1)).toBe(true);
          }
          const visibleForTagPairs = rows.filter((row) => selectedExcept(row, "tags"));
          const tagPairs = visibleForTagPairs.flatMap((row) =>
            row.tags.filter((tag) => passes(tag, filters.tags)).map((tag) => ({ tag, id: row.id })),
          );
          const emptyRows =
            filters.tags.kind === "none"
              ? visibleForTagPairs.filter((row) => row.tags.length === 0).map((row) => row.id)
              : [];
          const ascending = tagPairs
            .slice()
            .sort((x, y) => x.tag - y.tag || x.id - y.id)
            .map((pair) => pair.id);
          expect(dimensions.tags.top(Infinity).map((row) => row.id)).toEqual(
            ascending.slice().reverse().concat(emptyRows),
          );
          expect(dimensions.tags.bottom(Infinity).map((row) => row.id)).toEqual(
            emptyRows.concat(ascending),
          );
          const visibleForA = rows.filter((row) => selectedExcept(row, "a"));
          expect(countA.all()).toEqual(
            countsByKey(
              rows.map((row) => row.a),
              (key) => visibleForA.filter((row) => row.a === key).length,
            ),
          );
          expect(sumA.all()).toEqual(
            countsByKey(
              rows.map((row) => row.a),
              (key) => visibleForA.filter((row) => row.a === key).reduce((sum, row) => sum + row.b, 0),
            ),
          );
          const visibleForTags = rows.filter((row) => selectedExcept(row, "tags"));
          expect(countTags.all()).toEqual(
            countsByKey(
              rows.flatMap((row) => row.tags),
              (key) => visibleForTags.filter((row) => row.tags.includes(key)).length,
            ),
          );
        };

        check();
        for (const step of operations) {
          switch (step.type) {
            case "add": {
              const added = materialize(step.rows);
              rows = rows.concat(added);
              source.add(added);
              break;
            }
            case "removeMatching": {
              const matches = (row: Row) => row.b % step.modulus === step.remainder;
              rows = rows.filter((row) => !matches(row));
              source.remove(matches);
              break;
            }
            case "removeSelected":
              rows = rows.filter((row) => !selected(row));
              source.remove();
              break;
            case "filter": {
              filters[step.dimension] = step.filter;
              const dimension = dimensions[step.dimension];
              const active = step.filter;
              switch (active.kind) {
                case "none":
                  dimension.filterAll();
                  break;
                case "exact":
                  dimension.filterExact(active.value);
                  break;
                case "range":
                  dimension.filterRange([active.lo, active.hi]);
                  break;
                case "modulo":
                  dimension.filterFunction(
                    (candidate) => candidate % active.modulus === active.remainder,
                  );
                  break;
              }
              break;
            }
          }
          check();
        }
      }),
      { numRuns: 300 },
    );
  });
});
