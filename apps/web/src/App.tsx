import { useEffect, useState } from "react";
import { subscribeToEvents } from "./api";
import { Shell } from "./components/Shell";
import { AuditPage } from "./pages/AuditPage";
import { DatasetsPage } from "./pages/DatasetsPage";
import { ExperimentsPage } from "./pages/ExperimentsPage";
import { InfrastructurePage } from "./pages/InfrastructurePage";
import { JobsPage } from "./pages/JobsPage";
import { LoginPage } from "./pages/LoginPage";
import { ModelsPage } from "./pages/ModelsPage";
import { OverviewPage } from "./pages/OverviewPage";
import type { NavSection, Session } from "./types";

const SESSION_KEY = "mlcc-session";

function loadSession(): Session | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) as Session : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [active, setActive] = useState<NavSection>("overview");
  const [connected, setConnected] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [initialJobId, setInitialJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    return subscribeToEvents(
      session.token,
      () => setRefreshKey((value) => value + 1),
      setConnected
    );
  }, [session]);

  const login = (next: Session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setConnected(false);
    setActive("overview");
  };

  if (!session) return <LoginPage onLogin={login} />;

  const openJob = (jobId: string) => {
    setInitialJobId(jobId);
    setActive("jobs");
  };

  let content;
  switch (active) {
    case "jobs":
      content = (
        <JobsPage
          token={session.token}
          role={session.user.role}
          refreshKey={refreshKey}
          initialJobId={initialJobId}
          onConsumedInitialJob={() => setInitialJobId(null)}
        />
      );
      break;
    case "experiments":
      content = <ExperimentsPage token={session.token} role={session.user.role} refreshKey={refreshKey} />;
      break;
    case "models":
      content = <ModelsPage token={session.token} role={session.user.role} refreshKey={refreshKey} />;
      break;
    case "datasets":
      content = <DatasetsPage token={session.token} role={session.user.role} refreshKey={refreshKey} />;
      break;
    case "infrastructure":
      content = <InfrastructurePage token={session.token} role={session.user.role} refreshKey={refreshKey} />;
      break;
    case "audit":
      content = session.user.role === "ADMIN"
        ? <AuditPage token={session.token} refreshKey={refreshKey} />
        : <OverviewPage token={session.token} refreshKey={refreshKey} onNavigate={setActive} onOpenJob={openJob} />;
      break;
    default:
      content = <OverviewPage token={session.token} refreshKey={refreshKey} onNavigate={setActive} onOpenJob={openJob} />;
  }

  return (
    <Shell
      user={session.user}
      active={active}
      connected={connected}
      onNavigate={setActive}
      onLogout={logout}
    >
      {content}
    </Shell>
  );
}
