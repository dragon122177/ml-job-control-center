import {
  Activity,
  AlertTriangle,
  Check,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  MemoryStick,
  Radio,
  Server,
  ShieldCheck
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { Loading } from "../components/Loading";
import { StatusBadge } from "../components/StatusBadge";
import type { Alert, Role, SystemStatus, Worker } from "../types";
import { relativeTime } from "../utils";

export function InfrastructurePage({
  token,
  role,
  refreshKey
}: {
  token: string;
  role: Role;
  refreshKey: number;
}) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [localRefresh, setLocalRefresh] = useState(0);

  useEffect(() => {
    Promise.all([api.workers(token), api.alerts(token), api.system(token)])
      .then(([workerData, alertData, systemData]) => {
        setWorkers(workerData.items);
        setAlerts(alertData.items);
        setSystem(systemData);
      })
      .finally(() => setLoading(false));
  }, [token, refreshKey, localRefresh]);

  const acknowledge = async (id: string) => {
    await api.acknowledgeAlert(token, id);
    setLocalRefresh((value) => value + 1);
  };

  if (loading || !system) return <Loading label="Inspecting worker fleet" />;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Compute plane</span>
          <h2>Infrastructure</h2>
          <p>Worker capacity, service health, and operational alerts.</p>
        </div>
        <div className="health-chip"><span /> All core services operational</div>
      </section>

      <section className="system-strip">
        <article><span className="system-icon"><Database size={18} /></span><div><small>Database</small><strong>{system.database.mode === "embedded" ? "Embedded PostgreSQL" : "PostgreSQL"}</strong></div><Check size={16} /></article>
        <article><span className="system-icon"><Activity size={18} /></span><div><small>Scheduler</small><strong>{system.scheduler.activeJobs} active · {system.scheduler.queueDepth} queued</strong></div><Check size={16} /></article>
        <article><span className="system-icon"><ShieldCheck size={18} /></span><div><small>Control API</small><strong>Healthy · {system.runtime.node}</strong></div><Check size={16} /></article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div><span className="panel-kicker">Compute inventory</span><h3>Worker fleet</h3></div>
          <div className="fleet-legend"><span><i className="legend-online" /> Online</span><span><i className="legend-draining" /> Draining</span></div>
        </div>
        <div className="worker-grid">
          {workers.map((worker) => (
            <article className="worker-card" key={worker.id}>
              <div className="worker-card-head">
                <span className="worker-server"><Server size={18} /></span>
                <StatusBadge value={worker.status} pulse={worker.status === "ONLINE"} />
              </div>
              <h4>{worker.name}</h4>
              <p>{worker.pool}</p>
              <div className="worker-device"><Cpu size={15} /><span>{worker.device}</span></div>
              <div className="worker-capacity">
                <div><span>Slot utilization</span><strong>{worker.currentJobs}/{worker.maxJobs}</strong></div>
                <div className="capacity-track"><span style={{ width: `${worker.slotUtilization}%` }} /></div>
              </div>
              <div className="worker-details">
                <span><MemoryStick size={14} /> {worker.gpuMemoryGb ? `${worker.gpuMemoryGb} GB VRAM` : "System memory"}</span>
                <span><Radio size={14} /> {relativeTime(worker.lastHeartbeat)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="infrastructure-bottom">
        <article className="panel">
          <div className="panel-header"><div><span className="panel-kicker">Operations</span><h3>Alert center</h3></div><span className="count-pill">{alerts.filter((alert) => alert.status === "OPEN").length} open</span></div>
          <div className="operations-alert-list">
            {alerts.map((alert) => (
              <div className={alert.status === "ACKNOWLEDGED" ? "operations-alert acknowledged" : "operations-alert"} key={alert.id}>
                <span className={`alert-icon alert-${alert.severity.toLowerCase()}`}><AlertTriangle size={16} /></span>
                <div><strong>{alert.title}</strong><p>{alert.message}</p><small>{alert.source} · {relativeTime(alert.createdAt)}</small></div>
                {alert.status === "OPEN" && role !== "VIEWER"
                  ? <button className="text-button" onClick={() => void acknowledge(alert.id)}>Acknowledge</button>
                  : <span className="ack-label"><Check size={13} /> Acknowledged</span>}
              </div>
            ))}
          </div>
        </article>

        <article className="panel resource-panel">
          <div className="panel-header"><div><span className="panel-kicker">Fleet summary</span><h3>Resources</h3></div></div>
          <div className="resource-overview">
            <div className="resource-ring"><Gauge size={25} /><strong>{Math.round(workers.reduce((sum, worker) => sum + Number(worker.slotUtilization), 0) / Math.max(1, workers.length))}%</strong><span>Average utilization</span></div>
            <div className="resource-lines">
              <div><span><Cpu size={15} /> Accelerators</span><strong>{workers.filter((worker) => worker.gpuMemoryGb > 0).length}</strong></div>
              <div><span><HardDrive size={15} /> Total VRAM</span><strong>{workers.reduce((sum, worker) => sum + Number(worker.gpuMemoryGb), 0)} GB</strong></div>
              <div><span><Server size={15} /> Worker pools</span><strong>{new Set(workers.map((worker) => worker.pool)).size}</strong></div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
