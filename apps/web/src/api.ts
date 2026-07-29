import type {
  Alert,
  AuditEvent,
  Dashboard,
  Dataset,
  Experiment,
  Job,
  JobDetail,
  Model,
  Project,
  Session,
  SystemStatus,
  Worker
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.message ?? "The request could not be completed."
    );
  }
  return payload as T;
}

export const api = {
  login(email: string, password: string) {
    return request<Session>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },
  dashboard(token: string) {
    return request<Dashboard>("/dashboard", {}, token);
  },
  jobs(token: string, filters: { status?: string; projectId?: string; search?: string } = {}) {
    const query = new URLSearchParams(
      Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1]))
    );
    return request<{ items: Job[]; counts: Record<string, number> }>(
      `/jobs${query.size ? `?${query}` : ""}`,
      {},
      token
    );
  },
  job(token: string, id: string) {
    return request<JobDetail>(`/jobs/${id}`, {}, token);
  },
  createJob(token: string, input: Record<string, unknown>) {
    return request<Job>("/jobs", { method: "POST", body: JSON.stringify(input) }, token);
  },
  cancelJob(token: string, id: string) {
    return request<{ id: string; status: string }>(
      `/jobs/${id}/cancel`,
      { method: "POST" },
      token
    );
  },
  retryJob(token: string, id: string) {
    return request<{ id: string; status: string }>(
      `/jobs/${id}/retry`,
      { method: "POST" },
      token
    );
  },
  projects(token: string) {
    return request<{ items: Project[] }>("/catalog/projects", {}, token);
  },
  datasets(token: string) {
    return request<{ items: Dataset[] }>("/catalog/datasets", {}, token);
  },
  experiments(token: string) {
    return request<{ items: Experiment[] }>("/catalog/experiments", {}, token);
  },
  models(token: string) {
    return request<{ items: Model[] }>("/catalog/models", {}, token);
  },
  workers(token: string) {
    return request<{ items: Worker[] }>("/operations/workers", {}, token);
  },
  alerts(token: string) {
    return request<{ items: Alert[] }>("/operations/alerts", {}, token);
  },
  acknowledgeAlert(token: string, id: string) {
    return request<{ id: string; status: string }>(
      `/operations/alerts/${id}/acknowledge`,
      { method: "POST" },
      token
    );
  },
  audit(token: string) {
    return request<{ items: AuditEvent[] }>("/operations/audit", {}, token);
  },
  system(token: string) {
    return request<SystemStatus>("/operations/system", {}, token);
  }
};

export function subscribeToEvents(
  token: string,
  onEvent: () => void,
  onConnectionChange: (connected: boolean) => void
): () => void {
  const controller = new AbortController();
  let retryTimer: number | undefined;
  let closed = false;

  const connect = async (): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}/events`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      });
      if (!response.ok || !response.body) throw new Error("Realtime stream unavailable.");

      onConnectionChange(true);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          if (
            frame.startsWith(":")
            || frame.includes("event: connected")
            || !frame.includes("event:")
          ) continue;
          onEvent();
        }
      }
      if (!closed) throw new Error("Realtime stream closed.");
    } catch {
      if (closed || controller.signal.aborted) return;
      onConnectionChange(false);
      retryTimer = window.setTimeout(() => void connect(), 2_000);
    }
  };

  void connect();
  return () => {
    closed = true;
    if (retryTimer) window.clearTimeout(retryTimer);
    controller.abort();
    onConnectionChange(false);
  };
}
