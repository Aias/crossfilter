import crossfilter = require("crossfilter2");

interface Record {
  amount: number;
}

const source: crossfilter.Crossfilter<Record> = crossfilter([{ amount: 10 }]);
const dimension: crossfilter.Dimension<Record, number> = source.dimension(
  (record) => record.amount,
);
const total: number = dimension
  .groupAll()
  .reduceSum((record) => record.amount)
  .value();
const version: string = crossfilter.version;
export = { total, version };
