import type { Survey } from "@/lib/survey";
import { comparableObservationSeries } from "@/lib/observation-series";
export function ObservationTrend({
  surveys,
  onOpen,
}: {
  surveys: Survey[];
  onOpen: (s: Survey) => void;
}) {
  const series = comparableObservationSeries(surveys);
  if (!series.length)
    return (
      <section className="notice">
        <h2>Building an observation series</h2>
        <p>
          A connected trend requires at least three consecutive comparable
          observations from the same area and viewpoint. Unconfirmed dates,
          missing method records, different framing or incomplete reviews create
          gaps. Two photographs can still be inspected as a pair.
        </p>
      </section>
    );
  return (
    <section>
      <h2>Comparable observation series</h2>
      <p>
        Each point is an original saved index. Connections show reviewed
        comparability, not established ecosystem health or the cause of a
        change. Gaps are not interpolated.
      </p>
      {series.map((rows, i) => (
        <article key={rows[0].id}>
          <h3>
            Series {i + 1} · {rows.length} comparable observations
          </h3>
          <svg
            role="img"
            aria-label={`Saved index sequence: ${rows.map((s) => s.assessmentHistory!.at(-1)!.score).join(", ")}`}
            viewBox="0 0 600 180"
          >
            <line x1="30" y1="150" x2="570" y2="150" stroke="#8e9eaa" />
            <polyline
              fill="none"
              stroke="#087f6d"
              strokeWidth="3"
              points={rows
                .map(
                  (s, j) =>
                    `${30 + (j * 540) / (rows.length - 1)},${150 - s.assessmentHistory!.at(-1)!.score! * 1.2}`,
                )
                .join(" ")}
            />
            {rows.map((s, j) => (
              <g key={s.id}>
                <circle
                  cx={30 + (j * 540) / (rows.length - 1)}
                  cy={150 - s.assessmentHistory!.at(-1)!.score! * 1.2}
                  r="5"
                  fill="#123952"
                />
                <text
                  x={30 + (j * 540) / (rows.length - 1)}
                  y={140 - s.assessmentHistory!.at(-1)!.score! * 1.2}
                  textAnchor="middle"
                  fontSize="13"
                >
                  {s.assessmentHistory!.at(-1)!.score}
                </text>
              </g>
            ))}
          </svg>
          <table>
            <caption>Saved observation values</caption>
            <thead>
              <tr>
                <th>Capture date</th>
                <th>Saved index</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.capture!.capturedAt!).toLocaleString()}</td>
                  <td>{s.assessmentHistory!.at(-1)!.score}/100</td>
                  <td>
                    <button className="text-button" onClick={() => onOpen(s)}>
                      Open survey
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </section>
  );
}
