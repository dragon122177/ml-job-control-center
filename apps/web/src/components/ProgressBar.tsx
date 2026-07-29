type Props = {
  value: number;
  showLabel?: boolean;
};

export function ProgressBar({ value, showLabel = true }: Props) {
  return (
    <div className="progress-wrap" aria-label={`${value}% complete`}>
      <div className="progress-track">
        <div className="progress-value" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      {showLabel && <span>{value}%</span>}
    </div>
  );
}
