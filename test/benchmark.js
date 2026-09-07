import crossfilter from "../main.js";

const firstSize = 9e4;
const secondSize = 1e4;
const totalSize = firstSize + secondSize;
const barWidth = 20;
const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

const formatNumber = (value) => Number(value.toPrecision(2)).toLocaleString("en-US");
const formatInteger = (value) => String(Math.trunc(value)).padStart(8);
const formatDate = (date) => date.toLocaleDateString("en-US");
const formatDay = (index) => `       ${dayNames[index]}`;
const elapsed = (since) => `${formatNumber(Date.now() - since)}ms`;
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

function addDays(date, days) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function randomIndex(distribution) {
  const total = distribution.reduce((sum, weight) => sum + weight, 0);
  let cumulative = 0;
  const thresholds = distribution.map((weight) => (cumulative += weight / total));
  return () => crossfilter.bisect.left(thresholds, Math.random(), 0, thresholds.length);
}

function randomNormal() {
  let uniform = 0;
  while (uniform === 0) uniform = Math.random();
  return Math.sqrt(-2 * Math.log(uniform)) * Math.cos(2 * Math.PI * Math.random());
}

function randomLogNormal(mean, deviation) {
  return () => Math.exp(mean + deviation * randomNormal());
}

function randomRecentDate(randomDayOfWeek, randomHourOfDay, weeks) {
  return () => {
    const date = addDays(new Date(), -7 * Math.floor(Math.random() * weeks));
    date.setDate(date.getDate() + randomDayOfWeek() - date.getDay());
    date.setHours(randomHourOfDay(), Math.random() * 60, Math.random() * 60, Math.random() * 1000);
    return date;
  };
}

const randomDayOfWeek = randomIndex([0, 0.6, 0.7, 0.75, 0.8, 0.76, 0]);
const randomHourOfDay = randomIndex([
  0, 0, 0, 0, 0, 0, 0, 0.2, 0.5, 0.7, 0.85, 0.9, 0.8, 0.69, 0.72, 0.8, 0.78, 0.7, 0.3, 0, 0, 0, 0, 0,
]);
const randomDate = randomRecentDate(randomDayOfWeek, randomHourOfDay, 13);
const randomAmount = randomLogNormal(2.5, 0.5);

let started = Date.now();
const paymentRecords = Array.from({ length: totalSize }, () => ({
  date: randomDate(),
  amount: randomAmount(),
}));
console.log(`Synthesizing ${formatNumber(totalSize)} records: ${elapsed(started)}.`);

const firstBatch = paymentRecords.slice(0, firstSize);
const secondBatch = paymentRecords.slice(firstSize);

started = Date.now();
const indexingStarted = started;
const payments = crossfilter(firstBatch);
const all = payments.groupAll();
const amount = payments.dimension((d) => d.amount);
const amounts = amount.group(Math.floor);
const date = payments.dimension((d) => d.date);
const dates = date.group(startOfDay);
const day = payments.dimension((d) => d.date.getDay());
const days = day.group();
const hour = payments.dimension((d) => d.date.getHours());
const hours = hour.group();
console.log(`Indexing ${formatNumber(firstSize)} records: ${elapsed(started)}.`);

started = Date.now();
payments.add(secondBatch);
console.log(`Indexing ${formatNumber(secondSize)} records: ${elapsed(started)}.`);
console.log(`Total indexing time: ${elapsed(indexingStarted)}.`);
console.log("");

let frames = 0;
function updateDisplay() {
  dates.all();
  days.all();
  hours.all();
  amounts.all();
  all.value();
  date.top(40);
  frames++;
}

function measureFiltering(label, dimension, run) {
  frames = 0;
  const filteringStarted = Date.now();
  run();
  console.log(`Filtering by ${label}: ${formatNumber((Date.now() - filteringStarted) / frames)}ms/op.`);
  dimension.filterAll();
}

function filterRanges(dimension, count) {
  for (let i = 0; i < count; i++) {
    for (let j = i; j < count; j++) {
      dimension.filterRange([i, j]);
      updateDisplay();
    }
  }
}

const today = startOfDay(new Date());
measureFiltering("date", date, () => {
  for (let i = 0; i < 90; i++) {
    const from = addDays(today, -i);
    for (let j = 0; j < i; j++) {
      date.filterRange([from, addDays(today, -j)]);
      updateDisplay();
    }
  }
});
measureFiltering("day", day, () => filterRanges(day, 7));
measureFiltering("hour", hour, () => filterRanges(hour, 24));
measureFiltering("amount", amount, () => filterRanges(amount, 35));

started = Date.now();
payments.remove((d, i) => i % 10 === 1);
console.log(`Removing ${totalSize / 10} records: ${elapsed(started)}.`);
console.log("");

function printHistogram(title, group, formatKey, showEmpty = true) {
  const max = group.top(1)[0].value;
  console.log(title);
  for (const { key, value } of group.all()) {
    const width = Math.round((value / max) * barWidth);
    if (width > 0 || showEmpty) console.log(`${formatKey(key)}: ${"▇".repeat(width)}`);
  }
  console.log("");
}

printHistogram("Day of Week:", days, formatDay);
printHistogram("Hour of Day:", hours, formatInteger);
printHistogram("Date:", dates, formatDate);
printHistogram("Amount:", amounts, formatInteger, false);
