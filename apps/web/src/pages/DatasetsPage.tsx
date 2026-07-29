import { CheckCircle2, Database, FileCheck2, HardDrive, Plus, Rows3, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";
import { StatusBadge } from "../components/StatusBadge";
import type { Dataset, Role } from "../types";
import { formatBytesFromMb, formatNumber, relativeTime } from "../utils";

export function DatasetsPage({ token, role, refreshKey }: { token: string; role: Role; refreshKey: number }) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.datasets(token).then((data) => setDatasets(data.items)).finally(() => setLoading(false));
  }, [token, refreshKey]);

  const filtered = useMemo(
    () => datasets.filter((dataset) => `${dataset.name} ${dataset.projectName} ${dataset.version}`.toLowerCase().includes(search.toLowerCase())),
    [datasets, search]
  );
  const totalRows = datasets.reduce((sum, dataset) => sum + Number(dataset.rowsCount), 0);
  const totalSize = datasets.reduce((sum, dataset) => sum + Number(dataset.sizeMb), 0);

  if (loading) return <Loading label="Loading data catalog" />;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Data lineage</span>
          <h2>Datasets</h2>
          <p>Versioned training and evaluation data with validation status.</p>
        </div>
        {role !== "VIEWER" && <button className="button button-primary" disabled title="Registration is available through the API"><Plus size={17} /> Register dataset</button>}
      </section>

      <section className="dataset-stats">
        <article><Database size={20} /><div><strong>{datasets.length}</strong><span>Dataset versions</span></div></article>
        <article><Rows3 size={20} /><div><strong>{formatNumber(totalRows)}</strong><span>Tracked rows</span></div></article>
        <article><HardDrive size={20} /><div><strong>{formatBytesFromMb(totalSize)}</strong><span>Logical storage</span></div></article>
        <article><FileCheck2 size={20} /><div><strong>{datasets.filter((item) => item.status === "READY").length}</strong><span>Validated assets</span></div></article>
      </section>

      <section className="panel">
        <div className="table-toolbar">
          <div><span className="panel-kicker">Data assets</span><h3>Catalog</h3></div>
          <label className="search-field"><Search size={16} /><input placeholder="Search datasets…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        </div>
        {filtered.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Dataset</th><th>Version</th><th>Status</th><th>Rows</th><th>Size</th><th>Registered</th><th>Storage</th></tr></thead>
              <tbody>
                {filtered.map((dataset) => (
                  <tr key={dataset.id}>
                    <td><div className="table-primary"><span className="dataset-icon"><Database size={16} /></span><span><strong>{dataset.name}</strong><small>{dataset.projectName}</small></span></div></td>
                    <td><span className="version-chip">{dataset.version}</span></td>
                    <td><StatusBadge value={dataset.status} pulse={false} /></td>
                    <td>{formatNumber(Number(dataset.rowsCount))}</td>
                    <td>{formatBytesFromMb(Number(dataset.sizeMb))}</td>
                    <td className="muted">{relativeTime(dataset.createdAt)}</td>
                    <td><span className="storage-verified"><CheckCircle2 size={14} /> Object storage</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No datasets found" body="Try another search term." />}
      </section>
    </div>
  );
}
