type Point = { step: number; value: number };

export function MetricChart({
  points,
  color = "#55e6a5",
  label
}: {
  points: Point[];
  color?: string;
  label: string;
}) {
  if (points.length < 2) {
    return <div className="chart-empty">Metrics will appear when the job starts.</div>;
  }

  const width = 420;
  const height = 120;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const polyline = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.value - min) / range) * (height - 18) - 9;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <figure className="metric-chart">
      <figcaption>
        <span>{label}</span>
        <strong>{values.at(-1)?.toFixed(3)}</strong>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} metric trend`}>
        <defs>
          <linearGradient id={`gradient-${label.replaceAll(" ", "-")}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="30" x2={width} y2="30" className="chart-grid" />
        <line x1="0" y1="75" x2={width} y2="75" className="chart-grid" />
        <polygon
          points={`0,${height} ${polyline} ${width},${height}`}
          fill={`url(#gradient-${label.replaceAll(" ", "-")})`}
        />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </figure>
  );
}
