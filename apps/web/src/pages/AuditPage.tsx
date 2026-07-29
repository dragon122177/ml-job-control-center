import { Download, FileClock, Filter, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";
import type { AuditEvent } from "../types";
import { relativeTime, titleCase } from "../utils";

export function AuditPage({ token, refreshKey }: { token: string; refreshKey: number }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.audit(token).then((data) => setEvents(data.items)).finally(() => setLoading(false));
  }, [token, refreshKey]);

  const filtered = useMemo(
    () => events.filter((event) => `${event.action} ${event.actorName} ${event.entityType} ${event.entityId}`.toLowerCase().includes(search.toLowerCase())),
    [events, search]
  );

  if (loading) return <Loading label="Loading immutable audit history" />;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Governance</span>
          <h2>Audit trail</h2>
          <p>Security-sensitive activity recorded at the API command boundary.</p>
        </div>
        <button className="button button-secondary" disabled><Download size={16} /> Export log</button>
      </section>

      <section className="audit-integrity">
        <span><ShieldCheck size={22} /></span>
        <div><strong>Audit integrity enabled</strong><p>Authentication, workload mutations, model promotions, and infrastructure changes are traceable.</p></div>
        <small>Retention policy · 365 days</small>
      </section>

      <section className="panel">
        <div className="jobs-toolbar">
          <div><span className="panel-kicker">Recent activity</span><h3>Security event history</h3></div>
          <div className="jobs-tools">
            <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events…" /></label>
            <button className="icon-button"><Filter size={17} /></button>
          </div>
        </div>
        {filtered.length ? (
          <div className="data-table-wrap">
            <table className="data-table audit-table">
              <thead><tr><th>Event</th><th>Actor</th><th>Target</th><th>Metadata</th><th>Timestamp</th></tr></thead>
              <tbody>
                {filtered.map((event) => (
                  <tr key={event.id}>
                    <td><div className="audit-action"><span><FileClock size={15} /></span><strong>{titleCase(event.action)}</strong></div></td>
                    <td><div className="actor-cell"><strong>{event.actorName ?? "System"}</strong><small>{event.actorEmail ?? "scheduler@internal"}</small></div></td>
                    <td><span className="entity-chip">{event.entityType}</span><code>{event.entityId}</code></td>
                    <td><code className="metadata-cell">{Object.keys(event.metadata ?? {}).length ? JSON.stringify(event.metadata) : "—"}</code></td>
                    <td><span title={new Date(event.createdAt).toLocaleString()}>{relativeTime(event.createdAt)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No matching events" body="Try another search term." />}
      </section>
    </div>
  );
}
