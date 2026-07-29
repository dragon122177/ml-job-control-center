import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers3,
  PlayCircle,
  Server,
  Sparkles
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";
import { ProgressBar } from "../components/ProgressBar";
import { StatusBadge } from "../components/StatusBadge";
import type { Dashboard, NavSection } from "../types";
import { formatDuration, relativeTime, titleCase } from "../utils";

export function OverviewPage({
  token,
  refreshKey,
  onNavigate,
  onOpenJob
}: {
  token: string;
  refreshKey: number;
  onNavigate: (section: NavSection) => void;
  onOpenJob: (id: string) => void;
}) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.dashboard(token)
      .then((value) => active && setData(value))
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : "Unable to load."));
    return () => { active = false; };
  }, [token, refreshKey]);

  if (!data && !error) return <Loading />;
  if (!data) return <div className="page-error">{error}</div>;

  const stats = [
    {
      label: "Running jobs",
      value: data.metrics.runningJobs,
      helper: `${data.metrics.waitingJobs} waiting in queue`,
      icon: PlayCircle,
      tone: "green"
    },
    {
      label: "Success rate",
      value: `${data.metrics.successRate}%`,
      helper: "Across completed runs",
      icon: CheckCircle2,
      tone: "blue"
    },
    {
      label: "Worker capacity",
      value: `${data.metrics.activeSlots}/${data.metrics.totalSlots}`,
      helper: `${data.metrics.onlineWorkers} workers online`,
      icon: Server,
      tone: "violet"
    },
    {
      label: "Registered models",
      value: data.metrics.registeredModels,
      helper: `Across ${data.metrics.projects} projects`,
      icon: Layers3,
      tone: "amber"
    }
  ];

  return (
    <div className="page-stack">
      <section className="hero-strip">
        <div>
          <span className="eyebrow"><Sparkles size={14} /> Control plane healthy</span>
          <h2>Good morning, operator.</h2>
          <p>Your worker fleet is processing workloads normally. Live scheduler events are reflected throughout this dashboard.</p>
        </div>
        <button className="button button-primary" onClick={() => onNavigate("jobs")}>
          <PlayCircle size={17} /> Launch a job
        </button>
      </section>

      <section className="stat-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="stat-card" key={stat.label}>
              <div className={`stat-icon stat-${stat.tone}`}><Icon size={19} /></div>
              <div className="stat-copy">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.helper}</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className="overview-grid">
        <article className="panel panel-jobs">
          <div className="panel-header">
            <div><span className="panel-kicker">Live operations</span><h3>Recent workloads</h3></div>
            <button className="text-button" onClick={() => onNavigate("jobs")}>View all <ArrowRight size={15} /></button>
          </div>
          {data.recentJobs.length ? (
            <div className="job-list">
              {data.recentJobs.map((job) => (
                <button className="job-row" key={job.id} onClick={() => onOpenJob(job.id)}>
                  <span className={`job-type-icon type-${job.type.toLowerCase()}`}>
                    {job.type === "TRAINING" ? <Activity size={17} /> : <Cpu size={17} />}
                  </span>
                  <span className="job-primary">
                    <strong>{job.name}</strong>
                    <small>{job.projectName} · {titleCase(job.type)}</small>
                  </span>
                  <span className="job-status"><StatusBadge value={job.status} /></span>
                  <span className="job-progress">
                    {job.status === "RUNNING" ? <ProgressBar value={job.progress} /> : <small>{formatDuration(job.durationSeconds)}</small>}
                  </span>
                  <span className="job-time">{relativeTime(job.updatedAt)}</span>
                </button>
              ))}
            </div>
          ) : <EmptyState title="No workloads yet" body="Launch a job to populate the control plane." />}
        </article>

        <article className="panel alert-panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Needs attention</span><h3>Active alerts</h3></div>
            <span className="count-pill">{data.alerts.length}</span>
          </div>
          <div className="alert-list">
            {data.alerts.map((alert) => (
              <div className="alert-row" key={alert.id}>
                <span className={`alert-icon alert-${alert.severity.toLowerCase()}`}><AlertTriangle size={16} /></span>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.message}</p>
                  <small>{alert.source} · {relativeTime(alert.createdAt)}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="overview-grid overview-bottom">
        <article className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Workload health</span><h3>Status distribution</h3></div>
          </div>
          <div className="distribution-list">
            {data.statusDistribution.map((entry) => {
              const total = data.statusDistribution.reduce((sum, item) => sum + Number(item.count), 0);
              const percentage = total ? Math.round((Number(entry.count) / total) * 100) : 0;
              return (
                <div className="distribution-row" key={entry.status}>
                  <span><StatusBadge value={entry.status} /></span>
                  <div className="distribution-track"><span style={{ width: `${percentage}%` }} /></div>
                  <strong>{entry.count}</strong>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel cluster-panel">
          <div className="panel-header">
            <div><span className="panel-kicker">Compute</span><h3>Cluster capacity</h3></div>
          </div>
          <div className="cluster-gauge">
            <div className="gauge-ring" style={{ "--value": `${Math.round((data.metrics.activeSlots / Math.max(1, data.metrics.totalSlots)) * 100)}%` } as React.CSSProperties}>
              <span><strong>{data.metrics.activeSlots}</strong><small>active slots</small></span>
            </div>
            <div className="cluster-details">
              <div><span className="legend-dot legend-online" /><span>Online workers</span><strong>{data.metrics.onlineWorkers}</strong></div>
              <div><span className="legend-dot legend-queue" /><span>Queued jobs</span><strong>{data.metrics.waitingJobs}</strong></div>
              <div><span className="legend-dot legend-total" /><span>Total slots</span><strong>{data.metrics.totalSlots}</strong></div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
