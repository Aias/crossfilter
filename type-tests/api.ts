import crossfilter from "../lib/index.js";

type Equal<Actual, Expected> =
  (<Value>() => Value extends Actual ? 1 : 2) extends <Value>() => Value extends Expected ? 1 : 2
    ? true
    : false;
type IsAny<Value> = 0 extends 1 & Value ? true : false;
declare function expect<Type extends true>(): Type;

interface Sale {
  amount: number;
  category: string;
  date: Date;
  optionalAmount: number | null;
  tags: string[];
}

export function verifyDimensions(records: Sale[]) {
  const source = crossfilter(records);
  const appended = source.add([]);
  expect<Equal<IsAny<typeof appended>, false>>();
  expect<Equal<ReturnType<typeof appended.all>, Sale[]>>();
  const amount = source.dimension((record) => {
    expect<Equal<typeof record, Sale>>();
    return record.amount;
  });
  amount
    .filterExact(10)
    .filterRange([0, 20])
    .filterFunction((value) => {
      expect<Equal<typeof value, number>>();
      return value > 5;
    });
  amount.filterExact(null).filterExact(undefined).filterAll();
  expect<Equal<ReturnType<typeof amount.accessor>, number>>();
  expect<Equal<ReturnType<typeof amount.top>, Sale[]>>();
  expect<Equal<ReturnType<typeof amount.bottom>, Sale[]>>();
  expect<Equal<IsAny<ReturnType<typeof amount.accessor>>, false>>();
  expect<Equal<string extends Parameters<typeof amount.filterExact>[0] ? true : false, false>>();

  const chainedAmount = amount.filterAll().accessor(records[0]);
  expect<Equal<typeof chainedAmount, number>>();
  const typedAmount: crossfilter.Dimension<Sale, number> = amount;
  typedAmount.accessor(records[0]);

  const category = source.dimension((record) => record.category);
  category.filterExact("hardware").filterFunction((value) => {
    expect<Equal<typeof value, string>>();
    return value.startsWith("h");
  });
  const date = source.dimension((record) => record.date);
  date.filterRange([new Date(0), new Date(1)]);
  expect<Equal<ReturnType<typeof date.accessor>, Date>>();

  const optionalAmount = source.dimension((record) => record.optionalAmount);
  optionalAmount.filterExact(null).filterFunction((value) => {
    expect<Equal<typeof value, number | null>>();
    return value === null || value > 0;
  });
  const tags = source.dimension((record) => record.tags, true);
  tags.filterExact("hardware").filterFunction((value) => {
    expect<Equal<typeof value, string>>();
    return value.length > 0;
  });
  expect<Equal<ReturnType<typeof tags.accessor>, string[]>>();

  const chainedTags = tags.filterExact("hardware").accessor(records[0]);
  expect<Equal<typeof chainedTags, string[]>>();
  const typedArray = source.dimension((record) => Int32Array.of(record.amount), true);
  const typedArrayValue = typedArray.filterAll().accessor(records[0]);
  expect<Equal<typeof typedArrayValue, Int32Array<ArrayBuffer>>>();
  const dynamicIterable: boolean = records.length > 0;
  const dynamic = source.dimension((record) => record.tags, dynamicIterable);
  dynamic.filterFunction((value) => {
    expect<Equal<typeof value, string | string[]>>();
    return value.length > 0;
  });

  const filtered = source.allFiltered([amount, category, { id: () => 1 }]);
  expect<Equal<typeof filtered, Sale[]>>();
  source.isElementFiltered(0, [amount, { id: () => 2 }]);
  const unsubscribe = source.onChange((event) => {
    expect<Equal<typeof event, "dataAdded" | "dataRemoved" | "filtered">>();
    expect<Equal<IsAny<typeof event>, false>>();
  });
  expect<Equal<typeof unsubscribe, () => void>>();
}

export function verifyGroups(records: Sale[]) {
  const source = crossfilter(records);
  const dimension = source.dimension((record) => record.amount);
  const counted = dimension.group();
  expect<Equal<ReturnType<typeof counted.all>[number], { key: number; value: number }>>();
  const labeled = dimension.group((value) => {
    expect<Equal<typeof value, number>>();
    return String(value);
  });
  expect<Equal<ReturnType<typeof labeled.all>[number], { key: string; value: number }>>();

  const total = labeled.reduce(
    (value, record, notFilter, index) => {
      expect<Equal<typeof value, { total: number; count: number }>>();
      expect<Equal<typeof record, Sale>>();
      expect<Equal<typeof notFilter, boolean | undefined>>();
      expect<Equal<typeof index, number | undefined>>();
      expect<Equal<IsAny<typeof value>, false>>();
      return { total: value.total + record.amount, count: value.count + 1 };
    },
    (value, record) => ({ total: value.total - record.amount, count: value.count - 1 }),
    () => ({ total: 0, count: 0 }),
  );
  total.order((value) => {
    expect<Equal<typeof value, { total: number; count: number }>>();
    return value.total;
  });
  expect<
    Equal<
      ReturnType<typeof total.all>[number],
      { key: string; value: { total: number; count: number } }
    >
  >();
  const resetCount = total.reduceCount();
  expect<Equal<ReturnType<typeof resetCount.all>[number]["value"], number>>();
  const resetSum = total.reduceSum((record) => {
    expect<Equal<typeof record, Sale>>();
    return record.amount;
  });
  expect<Equal<ReturnType<typeof resetSum.all>[number]["value"], number>>();
  expect<
    Equal<ReturnType<typeof dimension.groupAll>["value"] extends () => number ? true : false, true>
  >();
}

export function verifyGroupAll(records: Sale[]) {
  const source = crossfilter(records);
  const counted = source.groupAll();
  expect<Equal<ReturnType<typeof counted.value>, number>>();
  const total = counted.reduce(
    (value, record) => {
      expect<Equal<typeof value, { total: number }>>();
      expect<Equal<typeof record, Sale>>();
      return { total: value.total + record.amount };
    },
    (value, record) => ({ total: value.total - record.amount }),
    () => ({ total: 0 }),
  );
  expect<Equal<ReturnType<typeof total.value>, { total: number }>>();
  expect<Equal<IsAny<ReturnType<typeof total.value>>, false>>();
  const resetCount = total.reduceCount();
  expect<Equal<ReturnType<typeof resetCount.value>, number>>();
  const resetSum = total.reduceSum((record) => record.amount);
  expect<Equal<ReturnType<typeof resetSum.value>, number>>();
}

export function verifyUtilities(records: Sale[]) {
  const heap = crossfilter.heap(records, 0, records.length);
  expect<Equal<typeof heap, Sale[]>>();
  const heapByAmount = crossfilter.heap.by((record: { amount: number }) => record.amount);
  const selectedHeap = heapByAmount(records, 0, records.length);
  expect<Equal<typeof selectedHeap, Sale[]>>();
  const sortedHeap = heapByAmount.sort(records, 0, records.length);
  expect<Equal<typeof sortedHeap, Sale[]>>();
  const selection = crossfilter.heapselect.by((record: { amount: number }) => record.amount)(
    records,
    0,
    records.length,
    2,
  );
  expect<Equal<typeof selection, Sale[]>>();
  const bisect = crossfilter.bisect.by((record: Sale) => record.amount);
  expect<Equal<Parameters<typeof bisect>[1], number>>();
  expect<Equal<ReturnType<typeof bisect>, number>>();
  expect<Equal<IsAny<ReturnType<typeof bisect>>, false>>();
  expect<Equal<IsAny<typeof bisect.right>, false>>();
  expect<Equal<Parameters<typeof bisect.right>[1], number>>();
  bisect.left(records, 0, 0, records.length);
  bisect.right(records, 0, 0, records.length);
  crossfilter.bisect([null, 0, 1], null, 0, 3);
  crossfilter.bisect([new Date(0), new Date(1)], new Date(1), 0, 2);
  const reordered = crossfilter.permute(records, [1, 0]);
  expect<Equal<typeof reordered, Sale[]>>();
  const serialized = crossfilter.permute(records, [1, 0], true);
  expect<Equal<typeof serialized, unknown[]>>();
}
