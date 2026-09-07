import type { Crossfilter, Dimension, FilterValue, Group } from "crossfilter2";
import { csvParse } from "d3-dsv";
import { scaleLinear, scaleTime } from "d3-scale";
import { timeDay } from "d3-time";

export interface Flight {
  index: number;
  date: Date;
  delay: number;
  distance: number;
  origin: string;
  destination: string;
}

export interface AxisScale<V> {
  (value: V): number;
  invert(pixel: number): V;
  ticks(): V[];
  tickFormat(): (value: V) => string;
  range(): number[];
}

export interface ChartSpec<V extends number | Date> {
  id: string;
  title: string;
  dimension: Dimension<Flight, V>;
  group: Group<Flight, V, number>;
  x: AxisScale<V>;
  round?: (value: V) => V;
}

export type Range<V> = [V, V] | null;

export interface Filters {
  hour: Range<number>;
  delay: Range<number>;
  distance: Range<number>;
  date: Range<Date>;
}

function parseDate(value: string) {
  return new Date(
    2001,
    Number(value.slice(0, 2)) - 1,
    Number(value.slice(2, 4)),
    Number(value.slice(4, 6)),
    Number(value.slice(6, 8)),
  );
}

export function isRange<V>(filter: FilterValue<V> | undefined): filter is [V, V] {
  return Array.isArray(filter);
}

function applyFilter<V extends number | Date>(spec: ChartSpec<V>, range: Range<V>) {
  if (range) spec.dimension.filterRange(range);
  else spec.dimension.filterAll();
}

export function createModel(flights: Crossfilter<Flight>) {
  const date = flights.dimension((flight) => flight.date);
  const hour = flights.dimension(
    (flight) => flight.date.getHours() + flight.date.getMinutes() / 60,
  );
  const delay = flights.dimension((flight) => Math.max(-60, Math.min(149, flight.delay)));
  const distance = flights.dimension((flight) => Math.min(1999, flight.distance));
  const charts = {
    hour: {
      id: "hour",
      title: "Time of Day",
      dimension: hour,
      group: hour.group(Math.floor),
      x: scaleLinear().domain([0, 24]).rangeRound([0, 10 * 24]),
    },
    delay: {
      id: "delay",
      title: "Arrival Delay (min.)",
      dimension: delay,
      group: delay.group((value) => Math.floor(value / 10) * 10),
      x: scaleLinear().domain([-60, 150]).rangeRound([0, 10 * 21]),
    },
    distance: {
      id: "distance",
      title: "Distance (mi.)",
      dimension: distance,
      group: distance.group((value) => Math.floor(value / 50) * 50),
      x: scaleLinear().domain([0, 2000]).rangeRound([0, 10 * 40]),
    },
    date: {
      id: "date",
      title: "Date",
      dimension: date,
      group: date.group(timeDay),
      x: scaleTime()
        .domain([new Date(2001, 0, 1), new Date(2001, 3, 1)])
        .rangeRound([0, 10 * 90]),
      round: timeDay.round,
    },
  } satisfies {
    hour: ChartSpec<number>;
    delay: ChartSpec<number>;
    distance: ChartSpec<number>;
    date: ChartSpec<Date>;
  };
  const model = {
    flights,
    all: flights.groupAll(),
    date,
    charts,
    applyFilters(filters: Filters) {
      applyFilter(charts.hour, filters.hour);
      applyFilter(charts.delay, filters.delay);
      applyFilter(charts.distance, filters.distance);
      applyFilter(charts.date, filters.date);
    },
  };
  model.applyFilters({
    hour: null,
    delay: null,
    distance: null,
    date: [new Date(2001, 1, 1), new Date(2001, 2, 1)],
  });
  return model;
}

export type FlightsModel = ReturnType<typeof createModel>;

export async function loadFlights(): Promise<Flight[]> {
  const response = await fetch("/flights-3m.csv");
  const text = await response.text();
  return csvParse(text, (row, index): Flight => ({
    index,
    date: parseDate(row.date ?? ""),
    delay: Number(row.delay),
    distance: Number(row.distance),
    origin: row.origin ?? "",
    destination: row.destination ?? "",
  }));
}
