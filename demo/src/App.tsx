import { Suspense, use } from "react";
import { useCrossfilter, useDimensionTop, useGroupValue } from "crossfilter2/react";
import { format } from "d3-format";
import BarChart from "./BarChart.tsx";
import FlightList from "./FlightList.tsx";
import { createModel, loadFlights } from "./flights.ts";
import type { Filters, Flight } from "./flights.ts";

const formatNumber = format(",d");
const flightsPromise = loadFlights();
const clearedFilters: Filters = { hour: null, delay: null, distance: null, date: null };

export default function App() {
  return (
    <>
      <h1>Crossfilter</h1>
      <h2>Fast Multidimensional Filtering for Coordinated Views</h2>
      <p>
        <b>Crossfilter</b> is a{" "}
        <a href="https://github.com/crossfilter/crossfilter">JavaScript library</a> for exploring
        large multivariate datasets in the browser. Crossfilter supports extremely fast (&lt;30ms)
        interaction with coordinated views, even with datasets containing a million or more records.
        This version of Crossfilter is a community fork of the{" "}
        <a href="https://github.com/square/crossfilter">original Crossfilter project</a> developed by
        Square, Inc.
      </p>
      <p>
        Since most interactions only involve a single dimension, and then only small adjustments are
        made to the filter values, incremental filtering and reducing is significantly faster than
        starting from scratch. Crossfilter uses sorted indexes (and a few bit-twiddling hacks) to make
        this possible, dramatically increasing the performance of live histograms and top-<i>K</i>{" "}
        lists. For more details on how Crossfilter works, see the{" "}
        <a href="https://github.com/crossfilter/crossfilter/wiki/API-Reference">API reference</a>.
      </p>
      <h2>Example: Airline on-time performance</h2>
      <p>
        The coordinated visualizations below (built with <a href="https://d3js.org/">D3</a> and{" "}
        <a href="https://react.dev/">React</a>) show nearly a quarter-million flights from early 2001:
        part of the <a href="http://stat-computing.org/dataexpo/2009/">ASA Data Expo</a> dataset. The
        dataset is 5.3MB, so it might take a few seconds to download. Click and drag on any chart to
        filter by the associated dimension. The table beneath shows the eighty most recent flights
        that match the current filters; these are the <i>details on demand</i>, anecdotal evidence
        you can use to weigh different hypotheses.
      </p>
      <Suspense fallback={<p>Loading flights…</p>}>
        <Dashboard records={use(flightsPromise)} />
      </Suspense>
      <footer>
        <span className="license">
          Released under the{" "}
          <a href="http://www.apache.org/licenses/LICENSE-2.0.html">Apache License 2.0</a>.
        </span>
        Copyright 2012-2015 Square, Inc. and crossfilter contributors.
      </footer>
    </>
  );
}

function Dashboard({ records }: { records: Flight[] }) {
  const model = useCrossfilter(records, createModel);
  const { all, charts, date, flights } = model;
  const selected = useGroupValue(flights, all);
  const recent = useDimensionTop(flights, date, 40);
  const question = (filters: Partial<Filters>, label: string) => (
    <button
      type="button"
      className="question"
      onClick={() => model.applyFilters({ ...clearedFilters, ...filters })}
    >
      {label}
    </button>
  );
  return (
    <>
      <p>
        Some questions to consider: How does time-of-day correlate with{" "}
        {question({ delay: [100, 150] }, "arrival delay")}? Are{" "}
        {question({ distance: [1700, 2000] }, "longer")} or{" "}
        {question({ distance: [0, 300] }, "shorter")} flights more likely to arrive early? What
        happened on{" "}
        {question(
          { delay: [80, 150], date: [new Date(2001, 0, 12), new Date(2001, 0, 13)] },
          "January 12",
        )}
        ? How do flight patterns differ between{" "}
        {question({ date: [new Date(2001, 0, 27), new Date(2001, 0, 29)] }, "weekends")} and{" "}
        {question({ date: [new Date(2001, 0, 29), new Date(2001, 1, 3)] }, "weekdays")}, or{" "}
        {question({ hour: [4, 7] }, "mornings")} and {question({ hour: [21, 24] }, "nights")}?
      </p>
      <div className="charts">
        <BarChart flights={flights} spec={charts.hour} />
        <BarChart flights={flights} spec={charts.delay} />
        <BarChart flights={flights} spec={charts.distance} />
        <BarChart flights={flights} spec={charts.date} />
      </div>
      <aside className="totals">
        {formatNumber(selected)} of {formatNumber(flights.size())} flights selected.
      </aside>
      <FlightList flights={recent} />
    </>
  );
}
