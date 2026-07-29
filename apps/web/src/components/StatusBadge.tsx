import type { JobStatus } from "../types";
import { titleCase } from "../utils";

type Props = {
  value: JobStatus | string;
  pulse?: boolean;
};

export function StatusBadge({ value, pulse = value === "RUNNING" }: Props) {
  return (
    <span className={`status-badge status-${value.toLowerCase()}`}>
      <span className={pulse ? "status-dot status-dot-pulse" : "status-dot"} />
      {titleCase(value)}
    </span>
  );
}
