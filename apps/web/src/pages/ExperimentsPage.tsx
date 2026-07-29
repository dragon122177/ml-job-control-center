import { ArrowUpRight, Beaker, FlaskConical, GitCompareArrows, Plus, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";
import { StatusBadge } from "../components/StatusBadge";
import type { Experiment, Project, Role } from "../types";
import { relativeTime } from "../utils";

export function ExperimentsPage({ token, role, refreshKey }: { token: string; role: Role; refreshKey: number }) {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.experiments(token), api.projects(token)])
      .then(([experimentData, projectData]) => {
        setExperiments(experimentData.items);
        setProjects(projectData.items);
      })
      .finally(() => setLoading(false));
  }, [token, refreshKey]);

  if (loading) return <Loading label="Loading experiment catalog" />;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Research workspace</span>
          <h2>Experiments</h2>
          <p>Track comparable runs, owners, and best-performing metrics.</p>
        </div>
        {role !== "VIEWER" && <button className="button button-primary" disabled title="Creation is available through the API"><Plus size={17} /> New experiment</button>}
      </section>

      <section className="experiment-summary">
        <article><span className="summary-icon"><FlaskConical size={19} /></span><div><strong>{experiments.length}</strong><small>Total experiments</small></div></article>
        <article><span className="summary-icon summary-green"><Beaker size={19} /></span><div><strong>{experiments.filter((item) => item.status === "ACTIVE").length}</strong><small>Active studies</small></div></article>
        <article><span className="summary-icon summary-blue"><GitCompareArrows size={19} /></span><div><strong>{experiments.reduce((sum, item) => sum + Number(item.runCount), 0)}</strong><small>Tracked runs</small></div></article>
        <article><span className="summary-icon summary-violet"><Target size={19} /></span><div><strong>{Math.max(...experiments.map((item) => Number(item.bestMetric ?? 0))).toFixed(3)}</strong><small>Best metric</small></div></article>
      </section>

      <div className="project-filter-row">
        <button className="project-filter project-filter-active">All projects</button>
        {projects.map((project) => <button className="project-filter" key={project.id}>{project.name}</button>)}
      </div>

      {experiments.length ? (
        <section className="experiment-grid">
          {experiments.map((experiment) => (
            <article className="experiment-card" key={experiment.id}>
              <div className="experiment-card-head">
                <span className="experiment-icon"><FlaskConical size={18} /></span>
                <StatusBadge value={experiment.status} pulse={false} />
              </div>
              <span className="card-kicker">{experiment.projectName}</span>
              <h3>{experiment.name}</h3>
              <p>Owned by {experiment.ownerName} · updated {relativeTime(experiment.createdAt)}</p>
              <div className="experiment-metric">
                <span><small>Best metric</small><strong>{Number(experiment.bestMetric ?? 0).toFixed(3)}</strong></span>
                <span><small>Runs</small><strong>{experiment.runCount}</strong></span>
              </div>
              <div className="experiment-spark">
                {[42, 54, 48, 64, 58, 73, 68, 81].map((value, index) => (
                  <span key={index} style={{ height: `${value}%` }} />
                ))}
              </div>
              <button className="card-link">Open experiment <ArrowUpRight size={15} /></button>
            </article>
          ))}
        </section>
      ) : <EmptyState title="No experiments" body="Create an experiment to compare training runs." />}
    </div>
  );
}
