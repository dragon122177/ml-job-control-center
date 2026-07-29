import {
  AlertCircle,
  Box,
  Calendar,
  Cpu,
  Database,
  HardDrive,
  RotateCcw,
  Server,
  Square,
  Timer,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { JobDetail, Role } from "../types";
import { formatDuration, relativeTime, titleCase } from "../utils";
import { Loading } from "./Loading";
import { MetricChart } from "./MetricChart";
import { ProgressBar } from "./ProgressBar";
import { StatusBadge } from "./StatusBadge";

export function JobDetailDrawer({
  token,
  jobId,
  role,
  refreshKey,
  onClose,
  onChanged
}: {
  token: string;
  jobId: string;
  role: Role;
  refreshKey: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    api.job(token, jobId)
      .then((value) => active && setJob(value))
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : "Unable to load job."));
    return () => { active = false; };
  }, [token, jobId, refreshKey]);

  const act = async (operation: "cancel" | "retry") => {
    setWorking(true);
    setError("");
    try {
      if (operation === "cancel") await api.cancelJob(token, jobId);
      else await api.retryJob(token, jobId);
      onChanged();
      setJob(await api.job(token, jobId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Operation failed.");
    } finally {
      setWorking(false);
    }
  };

  const canWrite = role !== "VIEWER";
  const canCancel = job && ["RUNNING", "QUEUED", "SCHEDULED"].includes(job.status);
  const canRetry = job && ["FAILED", "CANCELLED"].includes(job.status) && job.attempt <= job.maxRetries;

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="job-drawer">
        <button className="drawer-close icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        {!job && !error && <Loading label="Loading job telemetry" />}
        {error && <div className="form-error drawer-error">{error}</div>}
        {job && (
          <>
            <div className="drawer-heading">
              <span className="eyebrow">{titleCase(job.type)} · {job.id.slice(0, 16)}</span>
              <h2>{job.name}</h2>
              <div className="drawer-status-line">
                <StatusBadge value={job.status} />
                <span>{job.projectName}</span>
                <span>Updated {relativeTime(job.updatedAt)}</span>
              </div>
            </div>

            <section className="drawer-progress">
              <div><strong>Execution progress</strong><span>{job.progress}%</span></div>
              <ProgressBar value={job.progress} showLabel={false} />
              <small>Attempt {job.attempt || 1} of {job.maxRetries + 1} · {formatDuration(job.durationSeconds)}</small>
            </section>

            {job.errorMessage && (
              <div className="job-error-banner">
                <AlertCircle size={18} />
                <div><strong>Runtime error</strong><p>{job.errorMessage}</p></div>
              </div>
            )}

            {canWrite && (canCancel || canRetry) && (
              <div className="drawer-actions">
                {canCancel && <button className="button button-danger" disabled={working} onClick={() => void act("cancel")}><Square size={15} /> Cancel job</button>}
                {canRetry && <button className="button button-primary" disabled={working} onClick={() => void act("retry")}><RotateCcw size={15} /> Retry job</button>}
              </div>
            )}

            <section className="drawer-section">
              <h3>Run configuration</h3>
              <div className="detail-grid">
                <div><Cpu size={16} /><span>Framework</span><strong>{job.framework}</strong></div>
                <div><Server size={16} /><span>Worker</span><strong>{job.workerName ?? "Awaiting assignment"}</strong></div>
                <div><Box size={16} /><span>Resources</span><strong>{job.requestedGpu} GPU · {job.requestedCpu} CPU</strong></div>
                <div><HardDrive size={16} /><span>Memory</span><strong>{job.requestedMemoryGb} GB</strong></div>
                <div><Database size={16} /><span>Dataset</span><strong>{job.datasetName ?? "None"}</strong></div>
                <div><Timer size={16} /><span>Duration</span><strong>{formatDuration(job.durationSeconds)}</strong></div>
                <div><Calendar size={16} /><span>Created</span><strong>{new Date(job.createdAt).toLocaleString()}</strong></div>
                <div><Box size={16} /><span>Priority</span><strong>{titleCase(job.priority)}</strong></div>
              </div>
            </section>

            <section className="drawer-section">
              <h3>Training telemetry</h3>
              <div className="charts-grid">
                <MetricChart points={job.metrics.map((point) => ({ step: point.step, value: point.loss }))} label="Training loss" color="#55e6a5" />
                <MetricChart points={job.metrics.map((point) => ({ step: point.step, value: point.accuracy }))} label="Accuracy" color="#60a5fa" />
              </div>
            </section>

            <section className="drawer-section">
              <h3>Event timeline</h3>
              <div className="event-timeline">
                {job.events.map((event) => (
                  <div className={`event-item event-${event.level.toLowerCase()}`} key={event.id}>
                    <span className="event-marker" />
                    <div>
                      <div><strong>{titleCase(event.event)}</strong><time>{relativeTime(event.createdAt)}</time></div>
                      <p>{event.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}
