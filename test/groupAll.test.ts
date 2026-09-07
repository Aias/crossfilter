import { describe, expect, it } from "vitest";
import crossfilter from "../index.ts";

type Row = Record<number, number> & { id: string };

const createData = (numRows: number, numColumns: number): Row[] => {
  const rows: Row[] = [];
  for (let i = 0; i < numRows; i++) {
    const row: Row = { id: `${i}` };
    for (let j = 0; j < numColumns; j++) row[j] = Math.random();
    rows.push(row);
  }
  return rows;
};

const getColumnMetric = (col: number) => (row: Row) => row[col];

const initContext = (numRows: number, numColumns: number) => {
  const data = createData(numRows, numColumns);
  const cf = crossfilter<Row>();
  const colDims = new Array(numColumns).fill(0).map((_i, j) => cf.dimension(getColumnMetric(j)));
  const allGroup = cf.groupAll();
  cf.add(data);
  return { cf, data, colDims, allGroup };
};

const testFilter = (ctx: ReturnType<typeof initContext>) => {
  ctx.allGroup.value();
  ctx.colDims[ctx.colDims.length - 1].filterRange([2, 3]);
};

const cases = [];
for (let nc = 1; nc < 300; nc++) {
  cases.push({ nc });
}

describe.each(cases)("$nc Dimensions", ({ nc }) => {
  const ctx = initContext(8, nc);
  testFilter(ctx);

  it("groupAll equals allFiltered", () => {
    expect(ctx.allGroup.value()).toBe(ctx.cf.allFiltered().length);
  });
});
