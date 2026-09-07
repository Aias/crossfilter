import { groups } from "d3-array";
import { format } from "d3-format";
import { timeDay } from "d3-time";
import { timeFormat } from "d3-time-format";
import type { Flight } from "./flights.ts";

const formatNumber = format(",d");
const formatChange = format("+,d");
const formatDate = timeFormat("%B %d, %Y");
const formatTime = timeFormat("%I:%M %p");

export default function FlightList({ flights }: { flights: Flight[] }) {
  const byDay = groups(flights, (flight) => timeDay(flight.date).valueOf());
  return (
    <div className="list">
      {byDay.map(([day, dayFlights]) => (
        <div className="date" key={day}>
          <div className="day">{formatDate(dayFlights[0].date)}</div>
          {dayFlights.map((flight) => (
            <div className="flight" key={flight.index}>
              <div className="time">{formatTime(flight.date)}</div>
              <div className="origin">{flight.origin}</div>
              <div className="destination">{flight.destination}</div>
              <div className="distance">{formatNumber(flight.distance)} mi.</div>
              <div className={flight.delay < 0 ? "delay early" : "delay"}>
                {formatChange(flight.delay)} min.
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
