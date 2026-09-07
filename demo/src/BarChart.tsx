import { useEffect, useRef } from "react";
import type { Crossfilter } from "@aias/crossfilter";
import { useDimensionFilter, useGroupAll } from "@aias/crossfilter/react";
import type { DimensionFilterSetter } from "@aias/crossfilter/react";
import { brushX } from "d3-brush";
import type { BrushBehavior, BrushSelection } from "d3-brush";
import { scaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { isRange } from "./flights.ts";
import type { AxisScale, ChartSpec, Flight, Range } from "./flights.ts";

const margin = { top: 10, right: 10, bottom: 20, left: 10 };
const height = 100;

interface BarChartProps<V extends number | Date> {
  flights: Crossfilter<Flight>;
  spec: ChartSpec<V>;
}

export default function BarChart<V extends number | Date>({ flights, spec }: BarChartProps<V>) {
  const { id, title, dimension, group, x } = spec;
  const width = x.range()[1];
  const [currentFilter, setFilter] = useDimensionFilter(flights, dimension);
  const filter = isRange(currentFilter) ? currentFilter : null;
  const bins = useGroupAll(flights, group);
  const y = scaleLinear()
    .domain([0, Math.max(...bins.map((bin) => bin.value))])
    .range([height, 0]);
  const bars = bins.map((bin) => `M${x(bin.key)},${height}V${y(bin.value)}h9V${height}`).join("");
  const clipStart = filter ? x(filter[0]) : 0;
  const clipEnd = filter ? x(filter[1]) : width;
  const brushRef = useBrush(spec, filter, setFilter);
  return (
    <div className="chart" style={{ width: width + margin.left + margin.right }}>
      <div className="title">
        {title}
        {filter ? (
          <button type="button" className="reset" onClick={() => setFilter(null)}>
            reset
          </button>
        ) : null}
      </div>
      <svg width={width + margin.left + margin.right} height={height + margin.top + margin.bottom}>
        <g transform={`translate(${margin.left},${margin.top})`}>
          <clipPath id={`clip-${id}`}>
            <rect x={clipStart} width={clipEnd - clipStart} height={height} />
          </clipPath>
          <path className="background bar" d={bars} />
          <path className="foreground bar" clipPath={`url(#clip-${id})`} d={bars} />
          <Axis x={x} />
          <g className="brush" ref={brushRef} />
          {filter ? (
            <>
              <path className="grip" d={gripPath(-1)} transform={`translate(${clipStart},0)`} />
              <path className="grip" d={gripPath(1)} transform={`translate(${clipEnd},0)`} />
            </>
          ) : null}
        </g>
      </svg>
    </div>
  );
}

function Axis<V extends number | Date>({ x }: { x: AxisScale<V> }) {
  const format = x.tickFormat();
  const [start, end] = x.range();
  return (
    <g className="axis" transform={`translate(0,${height})`} textAnchor="middle">
      <path d={`M${start},6V0H${end}V6`} />
      {x.ticks().map((tick) => (
        <g key={tick.valueOf()} transform={`translate(${x(tick)},0)`}>
          <line y2={6} />
          <text y={9} dy="0.71em">
            {format(tick)}
          </text>
        </g>
      ))}
    </g>
  );
}

function gripPath(direction: 1 | -1) {
  const sweep = direction === 1 ? 1 : 0;
  const y = height / 3;
  return [
    `M${0.5 * direction},${y}`,
    `A6,6 0 0 ${sweep} ${6.5 * direction},${y + 6}`,
    `V${2 * y - 6}`,
    `A6,6 0 0 ${sweep} ${0.5 * direction},${2 * y}`,
    "Z",
    `M${2.5 * direction},${y + 8}`,
    `V${2 * y - 8}`,
    `M${4.5 * direction},${y + 8}`,
    `V${2 * y - 8}`,
  ].join("");
}

function useBrush<V extends number | Date>(
  spec: ChartSpec<V>,
  filter: Range<V>,
  setFilter: DimensionFilterSetter<V>,
) {
  const { x, round } = spec;
  const ref = useRef<SVGGElement>(null);
  const brushRef = useRef<BrushBehavior<unknown>>(null);
  const dragging = useRef(false);
  const pixelStart = filter ? x(filter[0]) : null;
  const pixelEnd = filter ? x(filter[1]) : null;

  useEffect(() => {
    const g = ref.current;
    if (g === null) return;
    const toRange = (selection: BrushSelection | null): Range<V> => {
      if (selection === null) return null;
      const [left, right] = selection;
      if (typeof left !== "number" || typeof right !== "number") return null;
      const start = x.invert(left);
      const end = x.invert(right);
      return round ? [round(start), round(end)] : [start, end];
    };
    const brush = brushX<unknown>()
      .extent([
        [0, 0],
        [x.range()[1], height],
      ])
      .on("start", (event) => {
        if (event.sourceEvent) dragging.current = true;
      })
      .on("brush", (event) => {
        if (!event.sourceEvent) return;
        const range = toRange(event.selection);
        if (range) setFilter(range);
      })
      .on("end", (event) => {
        if (!event.sourceEvent) return;
        dragging.current = false;
        const range = toRange(event.selection);
        setFilter(range);
        if (range && round) brush.move(select(g), [x(range[0]), x(range[1])]);
      });
    select(g).call(brush);
    brushRef.current = brush;
    return () => {
      select(g).on(".brush", null).selectAll("*").remove();
      brushRef.current = null;
    };
  }, [round, setFilter, x]);

  useEffect(() => {
    const g = ref.current;
    const brush = brushRef.current;
    if (g === null || brush === null || dragging.current) return;
    brush.move(select(g), pixelStart === null || pixelEnd === null ? null : [pixelStart, pixelEnd]);
  }, [pixelStart, pixelEnd]);

  return ref;
}
