import { describe, test } from "vitest";
import crossfilter from "../index.ts";
import type { Crossfilter, Dimension, Group, GroupAll } from "../index.ts";

export interface Payment {
  date: Date;
  amount: number;
}

interface PaymentIndex {
  payments: Crossfilter<Payment>;
  all: GroupAll<Payment, number>;
  amount: Dimension<Payment, number>;
  amounts: Group<Payment, number, number>;
  date: Dimension<Payment, Date>;
  dates: Group<Payment, Date, number>;
  day: Dimension<Payment, number>;
  days: Group<Payment, number, number>;
  hour: Dimension<Payment, number>;
  hours: Group<Payment, number, number>;
}

const firstSize = 9e4;
const secondSize = 1e4;
const totalSize = firstSize + secondSize;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
};

const randomIndex = (distribution: number[]) => {
  const total = distribution.reduce((sum, weight) => sum + weight, 0);
  let cumulative = 0;
  const thresholds = distribution.map((weight) => (cumulative += weight / total));
  return () => crossfilter.bisect.left(thresholds, Math.random(), 0, thresholds.length);
};

const randomNormal = () => {
  let uniform = 0;
  while (uniform === 0) uniform = Math.random();
  return Math.sqrt(-2 * Math.log(uniform)) * Math.cos(2 * Math.PI * Math.random());
};

const randomLogNormal = (mean: number, deviation: number) => () =>
  Math.exp(mean + deviation * randomNormal());

const randomRecentDate = (
  randomDayOfWeek: () => number,
  randomHourOfDay: () => number,
  weeks: number,
) => () => {
  const date = addDays(new Date(), -7 * Math.floor(Math.random() * weeks));
  date.setDate(date.getDate() + randomDayOfWeek() - date.getDay());
  date.setHours(randomHourOfDay(), Math.random() * 60, Math.random() * 60, Math.random() * 1000);
  return date;
};

const randomDayOfWeek = randomIndex([0, 0.6, 0.7, 0.75, 0.8, 0.76, 0]);
const randomHourOfDay = randomIndex([
  0, 0, 0, 0, 0, 0, 0, 0.2, 0.5, 0.7, 0.85, 0.9, 0.8, 0.69, 0.72, 0.8, 0.78, 0.7, 0.3, 0, 0, 0, 0, 0,
]);
const randomDate = randomRecentDate(randomDayOfWeek, randomHourOfDay, 13);
const randomAmount = randomLogNormal(2.5, 0.5);

const paymentRecords: Payment[] = Array.from({ length: totalSize }, () => ({
  date: randomDate(),
  amount: randomAmount(),
}));

const firstBatch = paymentRecords.slice(0, firstSize);
const secondBatch = paymentRecords.slice(firstSize);

const createIndex = (batch: Payment[]): PaymentIndex => {
  const payments = crossfilter(batch);
  const all = payments.groupAll();
  const amount = payments.dimension((d) => d.amount);
  const amounts = amount.group(Math.floor);
  const date = payments.dimension((d) => d.date);
  const dates = date.group(startOfDay);
  const day = payments.dimension((d) => d.date.getDay());
  const days = day.group();
  const hour = payments.dimension((d) => d.date.getHours());
  const hours = hour.group();
  return { payments, all, amount, amounts, date, dates, day, days, hour, hours };
};

const readDisplay = (index: PaymentIndex) => {
  index.dates.all();
  index.days.all();
  index.hours.all();
  index.amounts.all();
  index.all.value();
  index.date.top(40);
};

const runOptions = { time: 300, iterations: 10, warmupTime: 50, warmupIterations: 2 };

describe("crossfilter", () => {
  test(`indexes ${firstSize} records`, async ({ bench }) => {
    await bench(`index ${firstSize} records`, () => {
      createIndex(firstBatch);
    }).run(runOptions);
  });

  test(`adds ${secondSize} records incrementally`, async ({ bench }) => {
    let index = createIndex(firstBatch);
    await bench(
      `add ${secondSize} records`,
      {
        beforeEach: () => {
          index = createIndex(firstBatch);
        },
      },
      () => {
        index.payments.add(secondBatch);
      },
    ).run(runOptions);
  });

  test("filters by date range", async ({ bench }) => {
    const index = createIndex(paymentRecords);
    const today = startOfDay(new Date());
    await bench("filter by date range", () => {
      index.date.filterRange([addDays(today, -14), today]);
      readDisplay(index);
      index.date.filterAll();
    }).run(runOptions);
  });

  test("filters by day of week", async ({ bench }) => {
    const index = createIndex(paymentRecords);
    await bench("filter by day of week", () => {
      index.day.filterRange([1, 5]);
      readDisplay(index);
      index.day.filterAll();
    }).run(runOptions);
  });

  test("filters by hour of day", async ({ bench }) => {
    const index = createIndex(paymentRecords);
    await bench("filter by hour of day", () => {
      index.hour.filterRange([9, 17]);
      readDisplay(index);
      index.hour.filterAll();
    }).run(runOptions);
  });

  test("filters by amount", async ({ bench }) => {
    const index = createIndex(paymentRecords);
    await bench("filter by amount", () => {
      index.amount.filterRange([5, 20]);
      readDisplay(index);
      index.amount.filterAll();
    }).run(runOptions);
  });

  test("removes every tenth record", async ({ bench }) => {
    let index = createIndex(paymentRecords);
    await bench(
      `remove ${totalSize / 10} records`,
      {
        beforeEach: () => {
          index = createIndex(paymentRecords);
        },
      },
      () => {
        index.payments.remove((_record, i) => i % 10 === 1);
      },
    ).run(runOptions);
  });
});
