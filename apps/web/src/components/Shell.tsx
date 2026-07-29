import {
  Activity,
  Boxes,
  BrainCircuit,
  ChevronDown,
  CircleGauge,
  Database,
  FlaskConical,
  History,
  LogOut,
  Menu,
  ServerCog,
  X
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { NavSection, User } from "../types";
import { initials, titleCase } from "../utils";

const navigation: Array<{
  id: NavSection;
  label: string;
  icon: typeof Activity;
  adminOnly?: boolean;
}> = [
  { id: "overview", label: "Overview", icon: CircleGauge },
  { id: "jobs", label: "Jobs", icon: Activity },
  { id: "experiments", label: "Experiments", icon: FlaskConical },
  { id: "models", label: "Model registry", icon: BrainCircuit },
  { id: "datasets", label: "Datasets", icon: Database },
  { id: "infrastructure", label: "Infrastructure", icon: ServerCog },
  { id: "audit", label: "Audit trail", icon: History, adminOnly: true }
];

export function Shell({
  user,
  active,
  connected,
  onNavigate,
  onLogout,
  children
}: {
  user: User;
  active: NavSection;
  connected: boolean;
  onNavigate: (section: NavSection) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const visibleNavigation = navigation.filter((item) => !item.adminOnly || user.role === "ADMIN");
  const activeLabel = visibleNavigation.find((item) => item.id === active)?.label ?? titleCase(active);

  const navigate = (section: NavSection) => {
    onNavigate(section);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className={mobileOpen ? "sidebar sidebar-open" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark"><Boxes size={22} /></div>
          <div>
            <strong>ML Control</strong>
            <span>Operations center</span>
          </div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={active === item.id ? "nav-item nav-item-active" : "nav-item"}
                onClick={() => navigate(item.id)}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.id === "jobs" && <span className="nav-live-dot" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="environment-card">
            <div className="environment-head">
              <span className="connection-dot" />
              <strong>Production demo</strong>
            </div>
            <p>Embedded control plane</p>
            <span className="environment-region">us-central · healthy</span>
          </div>
          <button className="profile-button">
            <span className="avatar">{initials(user.name)}</span>
            <span className="profile-copy">
              <strong>{user.name}</strong>
              <small>{titleCase(user.role)}</small>
            </span>
            <ChevronDown size={16} />
          </button>
          <button className="logout-button" onClick={onLogout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && <button className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button className="menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div>
              <span>ML Operations</span>
              <h1>{activeLabel}</h1>
            </div>
          </div>
          <div className={connected ? "live-status live-connected" : "live-status"}>
            <span />
            {connected ? "Live updates" : "Reconnecting"}
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
