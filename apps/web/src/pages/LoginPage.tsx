import { ArrowRight, Boxes, CheckCircle2, Cpu, LockKeyhole, RadioTower } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../api";
import type { Session } from "../types";

const demoAccounts = [
  { label: "Administrator", email: "admin@mlcontrol.demo" },
  { label: "Operator", email: "operator@mlcontrol.demo" },
  { label: "Viewer", email: "viewer@mlcontrol.demo" }
];

export function LoginPage({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState(demoAccounts[0].email);
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      onLogin(await api.login(email, password));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-grid" />
        <div className="login-brand">
          <span className="brand-mark brand-mark-large"><Boxes size={26} /></span>
          <div><strong>ML Control</strong><span>Operations center</span></div>
        </div>
        <div className="login-pitch">
          <span className="eyebrow"><RadioTower size={14} /> Live workload orchestration</span>
          <h1>Operate machine learning with confidence.</h1>
          <p>Schedule jobs, govern model lifecycles, and observe every workload from one production-shaped control plane.</p>
          <div className="login-features">
            <span><CheckCircle2 size={17} /> Real-time job telemetry</span>
            <span><CheckCircle2 size={17} /> Role-based operations</span>
            <span><CheckCircle2 size={17} /> Retry and audit history</span>
          </div>
        </div>
        <div className="login-terminal">
          <div className="terminal-head"><span /><span /><span /><small>worker-events.log</small></div>
          <code><em>10:42:08</em> scheduler assigned <b>job_train_live</b></code>
          <code><em>10:42:09</em> gpu-a100-01 accepted workload</code>
          <code><em>10:42:12</em> checkpoint persisted · epoch 32</code>
          <code className="terminal-success"><em>10:42:15</em> validation mAP improved · 0.932</code>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="login-icon"><LockKeyhole size={22} /></div>
          <span className="eyebrow">Secure access</span>
          <h2>Welcome back</h2>
          <p>Sign in to the ML operations workspace.</p>

          <label>
            Work email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="button button-primary login-submit" disabled={loading}>
            {loading ? "Authenticating…" : "Open control center"}
            {!loading && <ArrowRight size={17} />}
          </button>

          <div className="demo-divider"><span>Demo access</span></div>
          <div className="demo-accounts">
            {demoAccounts.map((account) => (
              <button
                type="button"
                key={account.email}
                className={email === account.email ? "demo-account demo-account-active" : "demo-account"}
                onClick={() => {
                  setEmail(account.email);
                  setPassword("demo1234");
                }}
              >
                <Cpu size={14} />
                <span>{account.label}</span>
              </button>
            ))}
          </div>
          <small className="demo-password">All demo accounts use <code>demo1234</code></small>
        </form>
      </section>
    </div>
  );
}
