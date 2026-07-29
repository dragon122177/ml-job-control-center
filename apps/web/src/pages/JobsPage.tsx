import { Filter, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { CreateJobModal } from "../components/CreateJobModal";
import { EmptyState } from "../components/EmptyState";
import { JobDetailDrawer } from "../components/JobDetailDrawer";
import { Loading } from "../components/Loading";
import { ProgressBar } from "../components/ProgressBar";
import { StatusBadge } from "../components/StatusBadge";
import type { Job, Role } from "../types";
import { formatDuration, relativeTime, titleCase } from "../utils";

const filters = ["ALL", "RUNNING", "QUEUED", "SCHEDULED", "SUCCEEDED", "FAILED", "CANCELLED"];

export function JobsPage({
  token,
  role,
  refreshKey,
  initialJobId,
  onConsumedInitialJob
}: {
  token: string;
  role: Role;
  refreshKey: number;
  initialJobId?: string | null;
  onConsumedInitialJob: () => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(initialJobId ?? null);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    if (initialJobId) {
      setSelectedJob(initialJobId);
      onConsumedInitialJob();
    }
  }, [initialJobId, onConsumedInitialJob]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.jobs(token, {
      status: status === "ALL" ? undefined : status,
      search: debouncedSearch || undefined
    }).then((data) => {
      if (!active) return;
      setJobs(data.items);
      setCounts(data.counts);
      setError("");
    }).catch((caught) => active && setError(caught instanceof Error ? caught.message : "Unable to load jobs."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token, status, debouncedSearch, refreshKey, localRefresh]);

  const changed = () => setLocalRefresh((value) => value + 1);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Scheduler queue</span>
          <h2>Machine-learning jobs</h2>
          <p>Schedule, observe, cancel, and retry workloads across the worker fleet.</p>
        </div>
        {role !== "VIEWER" && (
          <button className="button button-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={17} /> Launch job
          </button>
        )}
      </section>

      <section className="panel jobs-panel">
        <div className="jobs-toolbar">
          <div className="filter-tabs">
            {filters.map((filter) => (
              <button
                key={filter}
                className={status === filter ? "filter-tab filter-tab-active" : "filter-tab"}
                onClick={() => setStatus(filter)}
              >
                {titleCase(filter)}
                {filter !== "ALL" && counts[filter] !== undefined && <span>{counts[filter]}</span>}
              </button>
            ))}
          </div>
          <div className="jobs-tools">
            <label className="search-field">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search jobs…" />
            </label>
            <button className="icon-button" title="Filters"><Filter size={17} /></button>
            <button className="icon-button" title="Display settings"><SlidersHorizontal size={17} /></button>
          </div>
        </div>

        {loading ? <Loading label="Loading scheduler queue" /> : error ? <div className="page-error">{error}</div> : jobs.length ? (
          <div className="data-table-wrap">
            <table className="data-table jobs-table">
              <thead>
                <tr><th>Workload</th><th>Status</th><th>Progress</th><th>Resources</th><th>Worker</th><th>Duration</th><th>Updated</th></tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} onClick={() => setSelectedJob(job.id)}>
                    <td>
                      <div className="table-primary">
                        <span className={`job-type-mini type-${job.type.toLowerCase()}`}>{job.type === "TRAINING" ? "TR" : job.type === "EVALUATION" ? "EV" : job.type === "DATA_PREPARATION" ? "DP" : "BI"}</span>
                        <span><strong>{job.name}</strong><small>{job.projectName} · {titleCase(job.type)}</small></span>
                      </div>
                    </td>
                    <td><StatusBadge value={job.status} /></td>
                    <td className="progress-cell">
                      {job.status === "RUNNING" ? <ProgressBar value={job.progress} /> : <span className="muted">{job.progress}%</span>}
                    </td>
                    <td><span className="resource-chip">{job.requestedGpu} GPU</span> <span className="resource-chip">{job.requestedCpu} CPU</span></td>
                    <td><span className="worker-cell"><span className={job.workerName ? "worker-dot" : "worker-dot worker-dot-idle"} />{job.workerName ?? "Unassigned"}</span></td>
                    <td>{formatDuration(job.durationSeconds)}</td>
                    <td className="muted">{relativeTime(job.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No matching jobs" body="Change the filters or launch a new workload." />}
      </section>

      {createOpen && (
        <CreateJobModal
          token={token}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            setSelectedJob(id);
            changed();
          }}
        />
      )}
      {selectedJob && (
        <JobDetailDrawer
          token={token}
          jobId={selectedJob}
          role={role}
          refreshKey={refreshKey + localRefresh}
          onClose={() => setSelectedJob(null)}
          onChanged={changed}
        />
      )}
    </div>
  );
}
