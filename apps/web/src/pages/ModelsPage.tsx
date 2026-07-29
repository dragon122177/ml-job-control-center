import { Boxes, CheckCircle2, GitBranch, Plus, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";
import { StatusBadge } from "../components/StatusBadge";
import type { Model, Role } from "../types";
import { relativeTime } from "../utils";

export function ModelsPage({ token, role, refreshKey }: { token: string; role: Role; refreshKey: number }) {
  const [models, setModels] = useState<Model[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.models(token).then((data) => setModels(data.items)).finally(() => setLoading(false));
  }, [token, refreshKey]);

  const filtered = useMemo(
    () => models.filter((model) => `${model.name} ${model.projectName} ${model.framework}`.toLowerCase().includes(search.toLowerCase())),
    [models, search]
  );

  if (loading) return <Loading label="Loading model registry" />;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Governed artifacts</span>
          <h2>Model registry</h2>
          <p>Trace model versions from experimentation to production.</p>
        </div>
        {role !== "VIEWER" && <button className="button button-primary" disabled title="Registration is available through the API"><Plus size={17} /> Register model</button>}
      </section>

      <section className="registry-hero">
        <div><span className="registry-icon"><ShieldCheck size={22} /></span><div><strong>Registry integrity verified</strong><p>Every artifact is versioned and linked to its originating project.</p></div></div>
        <div className="registry-hero-stats">
          <span><strong>{models.filter((model) => model.stage === "PRODUCTION").length}</strong><small>Production</small></span>
          <span><strong>{models.filter((model) => model.stage === "STAGING").length}</strong><small>Staging</small></span>
          <span><strong>{models.length}</strong><small>Versions</small></span>
        </div>
      </section>

      <section className="panel">
        <div className="table-toolbar">
          <div><span className="panel-kicker">Artifacts</span><h3>Registered versions</h3></div>
          <label className="search-field"><Search size={16} /><input placeholder="Search registry…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        </div>
        {filtered.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Model</th><th>Version</th><th>Stage</th><th>Framework</th><th>Accuracy</th><th>Registered</th><th>Artifact</th></tr></thead>
              <tbody>
                {filtered.map((model) => (
                  <tr key={model.id}>
                    <td><div className="table-primary"><span className="model-cube"><Boxes size={16} /></span><span><strong>{model.name}</strong><small>{model.projectName}</small></span></div></td>
                    <td><span className="version-chip"><GitBranch size={13} /> {model.version}</span></td>
                    <td><StatusBadge value={model.stage} pulse={false} /></td>
                    <td>{model.framework}</td>
                    <td>{model.accuracy ? <span className="accuracy-value"><CheckCircle2 size={14} /> {(Number(model.accuracy) * 100).toFixed(1)}%</span> : "—"}</td>
                    <td className="muted">{relativeTime(model.createdAt)}</td>
                    <td><code className="uri-cell">{model.artifactUri}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No models found" body="Try another search term." />}
      </section>
    </div>
  );
}
