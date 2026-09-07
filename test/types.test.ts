import { describe, expectTypeOf, it } from "vitest";
import crossfilter from "../index.ts";

interface Sale {
  amount: number;
  category: string;
  date: Date;
  optionalAmount: number | null;
  tags: string[];
}

const sales: Sale[] = [
  {
    amount: 12,
    category: "hardware",
    date: new Date("2024-01-01"),
    optionalAmount: 5,
    tags: ["a", "b"],
  },
  {
    amount: 34,
    category: "software",
    date: new Date("2024-02-01"),
    optionalAmount: null,
    tags: [],
  },
];

describe("public types", () => {
  it("dimensions", () => {
    const source = crossfilter(sales);
    const appended = source.add([]);
    expectTypeOf(appended).not.toBeAny();
    expectTypeOf<ReturnType<typeof appended.all>>().toEqualTypeOf<Sale[]>();
    const amount = source.dimension((record) => {
      expectTypeOf(record).toEqualTypeOf<Sale>();
      return record.amount;
    });
    amount
      .filterExact(10)
      .filterRange([0, 20])
      .filterFunction((value) => {
        expectTypeOf(value).toEqualTypeOf<number>();
        return value > 5;
      });
    amount.filterExact(null).filterExact(undefined).filterAll();
    expectTypeOf<ReturnType<typeof amount.accessor>>().toEqualTypeOf<number>();
    expectTypeOf<ReturnType<typeof amount.top>>().toEqualTypeOf<Sale[]>();
    expectTypeOf<ReturnType<typeof amount.bottom>>().toEqualTypeOf<Sale[]>();
    expectTypeOf<ReturnType<typeof amount.accessor>>().not.toBeAny();
    expectTypeOf<string>().not.toExtend<Parameters<typeof amount.filterExact>[0]>();

    const chainedAmount = amount.filterAll().accessor(sales[0]);
    expectTypeOf(chainedAmount).toEqualTypeOf<number>();
    const typedAmount: crossfilter.Dimension<Sale, number> = amount;
    typedAmount.accessor(sales[0]);

    const category = source.dimension((record) => record.category);
    category.filterExact("hardware").filterFunction((value) => {
      expectTypeOf(value).toEqualTypeOf<string>();
      return value.startsWith("h");
    });
    const date = source.dimension((record) => record.date);
    date.filterRange([new Date(0), new Date(1)]);
    expectTypeOf<ReturnType<typeof date.accessor>>().toEqualTypeOf<Date>();

    const optionalAmount = source.dimension((record) => record.optionalAmount);
    optionalAmount.filterExact(null).filterFunction((value) => {
      expectTypeOf(value).toEqualTypeOf<number | null>();
      return value === null || value > 0;
    });
    const tags = source.dimension((record) => record.tags, true);
    tags.filterExact("hardware").filterFunction((value) => {
      expectTypeOf(value).toEqualTypeOf<string>();
      return value.length > 0;
    });
    expectTypeOf<ReturnType<typeof tags.accessor>>().toEqualTypeOf<string[]>();

    const chainedTags = tags.filterExact("hardware").accessor(sales[0]);
    expectTypeOf(chainedTags).toEqualTypeOf<string[]>();
    const typedArray = source.dimension((record) => Int32Array.of(record.amount), true);
    const typedArrayValue = typedArray.filterAll().accessor(sales[0]);
    expectTypeOf(typedArrayValue).toEqualTypeOf<Int32Array<ArrayBuffer>>();
    const dynamicIterable: boolean = sales.length > 0;
    const dynamic = source.dimension((record) => record.tags, dynamicIterable);
    dynamic.filterFunction((value) => {
      expectTypeOf(value).toEqualTypeOf<string | string[]>();
      return value.length > 0;
    });

    const filtered = source.allFiltered([amount, category, { id: () => 1 }]);
    expectTypeOf(filtered).toEqualTypeOf<Sale[]>();
    source.isElementFiltered(0, [amount, { id: () => 2 }]);
    const unsubscribe = source.onChange((event) => {
      expectTypeOf(event).toEqualTypeOf<"dataAdded" | "dataRemoved" | "filtered">();
      expectTypeOf(event).not.toBeAny();
    });
    expectTypeOf(unsubscribe).toEqualTypeOf<() => void>();
  });

  it("groups", () => {
    const source = crossfilter(sales);
    const dimension = source.dimension((record) => record.amount);
    const counted = dimension.group();
    expectTypeOf<ReturnType<typeof counted.all>[number]>().toEqualTypeOf<{
      key: number;
      value: number;
    }>();
    const labeled = dimension.group((value) => {
      expectTypeOf(value).toEqualTypeOf<number>();
      return String(value);
    });
    expectTypeOf<ReturnType<typeof labeled.all>[number]>().toEqualTypeOf<{
      key: string;
      value: number;
    }>();

    const total = labeled.reduce(
      (value, record, notFilter, index) => {
        expectTypeOf(value).toEqualTypeOf<{ total: number; count: number }>();
        expectTypeOf(record).toEqualTypeOf<Sale>();
        expectTypeOf(notFilter).toEqualTypeOf<boolean | undefined>();
        expectTypeOf(index).toEqualTypeOf<number | undefined>();
        expectTypeOf(value).not.toBeAny();
        return { total: value.total + record.amount, count: value.count + 1 };
      },
      (value, record) => ({ total: value.total - record.amount, count: value.count - 1 }),
      () => ({ total: 0, count: 0 }),
    );
    total.order((value) => {
      expectTypeOf(value).toEqualTypeOf<{ total: number; count: number }>();
      return value.total;
    });
    expectTypeOf<ReturnType<typeof total.all>[number]>().toEqualTypeOf<{
      key: string;
      value: { total: number; count: number };
    }>();
    const resetCount = total.reduceCount();
    expectTypeOf<ReturnType<typeof resetCount.all>[number]["value"]>().toEqualTypeOf<number>();
    const resetSum = total.reduceSum((record) => {
      expectTypeOf(record).toEqualTypeOf<Sale>();
      return record.amount;
    });
    expectTypeOf<ReturnType<typeof resetSum.all>[number]["value"]>().toEqualTypeOf<number>();
    expectTypeOf<ReturnType<typeof dimension.groupAll>["value"]>().toExtend<() => number>();
  });

  it("groupAll", () => {
    const source = crossfilter(sales);
    const counted = source.groupAll();
    expectTypeOf<ReturnType<typeof counted.value>>().toEqualTypeOf<number>();
    const total = counted.reduce(
      (value, record) => {
        expectTypeOf(value).toEqualTypeOf<{ total: number }>();
        expectTypeOf(record).toEqualTypeOf<Sale>();
        return { total: value.total + record.amount };
      },
      (value, record) => ({ total: value.total - record.amount }),
      () => ({ total: 0 }),
    );
    expectTypeOf<ReturnType<typeof total.value>>().toEqualTypeOf<{ total: number }>();
    expectTypeOf<ReturnType<typeof total.value>>().not.toBeAny();
    const resetCount = total.reduceCount();
    expectTypeOf<ReturnType<typeof resetCount.value>>().toEqualTypeOf<number>();
    const resetSum = total.reduceSum((record) => record.amount);
    expectTypeOf<ReturnType<typeof resetSum.value>>().toEqualTypeOf<number>();
  });

  it("utilities", () => {
    const heap = crossfilter.heap(sales, 0, sales.length);
    expectTypeOf(heap).toEqualTypeOf<Sale[]>();
    const heapByAmount = crossfilter.heap.by((record: { amount: number }) => record.amount);
    const selectedHeap = heapByAmount(sales, 0, sales.length);
    expectTypeOf(selectedHeap).toEqualTypeOf<Sale[]>();
    const sortedHeap = heapByAmount.sort(sales, 0, sales.length);
    expectTypeOf(sortedHeap).toEqualTypeOf<Sale[]>();
    const selection = crossfilter.heapselect.by((record: { amount: number }) => record.amount)(
      sales,
      0,
      sales.length,
      2,
    );
    expectTypeOf(selection).toEqualTypeOf<Sale[]>();
    const bisect = crossfilter.bisect.by((record: Sale) => record.amount);
    expectTypeOf<Parameters<typeof bisect>[1]>().toEqualTypeOf<number>();
    expectTypeOf<ReturnType<typeof bisect>>().toEqualTypeOf<number>();
    expectTypeOf<ReturnType<typeof bisect>>().not.toBeAny();
    expectTypeOf(bisect.right).not.toBeAny();
    expectTypeOf<Parameters<typeof bisect.right>[1]>().toEqualTypeOf<number>();
    bisect.left(sales, 0, 0, sales.length);
    bisect.right(sales, 0, 0, sales.length);
    crossfilter.bisect([null, 0, 1], null, 0, 3);
    crossfilter.bisect([new Date(0), new Date(1)], new Date(1), 0, 2);
    const reordered = crossfilter.permute(sales, [1, 0]);
    expectTypeOf(reordered).toEqualTypeOf<Sale[]>();
    const serialized = crossfilter.permute(sales, [1, 0], true);
    expectTypeOf(serialized).toEqualTypeOf<unknown[]>();
  });
});
