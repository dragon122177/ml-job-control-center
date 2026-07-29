import { CalendarClock, Cpu, Play, X, Zap } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Dataset, Experiment, Model, Project } from "../types";

export function CreateJobModal({
  token,
  onClose,
  onCreated
}: {
  token: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("training-run-");
  const [type, setType] = useState("TRAINING");
  const [framework, setFramework] = useState("PyTorch");
  const [priority, setPriority] = useState("NORMAL");
  const [datasetId, setDatasetId] = useState("");
  const [experimentId, setExperimentId] = useState("");
  const [modelId, setModelId] = useState("");
  const [requestedGpu, setRequestedGpu] = useState(1);
  const [requestedCpu, setRequestedCpu] = useState(8);
  const [requestedMemoryGb, setRequestedMemoryGb] = useState(16);
  const [maxRetries, setMaxRetries] = useState(2);
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.projects(token),
      api.datasets(token),
      api.experiments(token),
      api.models(token)
    ]).then(([projectData, datasetData, experimentData, modelData]) => {
      setProjects(projectData.items);
      setDatasets(datasetData.items);
      setExperiments(experimentData.items);
      setModels(modelData.items);
      const firstProject = projectData.items[0];
      if (firstProject) setProjectId(firstProject.id);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load form data."));
  }, [token]);

  const availableDatasets = useMemo(
    () => datasets.filter((item) => item.projectId === projectId),
    [datasets, projectId]
  );
  const availableExperiments = useMemo(
    () => experiments.filter((item) => item.projectId === projectId),
    [experiments, projectId]
  );
  const availableModels = useMemo(
    () => models.filter((item) => item.projectId === projectId),
    [models, projectId]
  );

  useEffect(() => {
    setDatasetId(availableDatasets[0]?.id ?? "");
    setExperimentId(availableExperiments[0]?.id ?? "");
    setModelId(type === "BATCH_INFERENCE" || type === "EVALUATION" ? availableModels[0]?.id ?? "" : "");
  }, [projectId, type, availableDatasets, availableExperiments, availableModels]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const created = await api.createJob(token, {
        projectId,
        name,
        type,
        framework,
        priority,
        datasetId: datasetId || null,
        experimentId: experimentId || null,
        modelId: modelId || null,
        requestedGpu,
        requestedCpu,
        requestedMemoryGb,
        maxRetries,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        config: {
          source: "control-center",
          reproducible: true,
          checkpointing: type === "TRAINING"
        }
      });
      onCreated(created.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create job.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal-card create-job-modal" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <span className="eyebrow"><Zap size={14} /> New workload</span>
            <h2>Launch an ML job</h2>
            <p>Configure resources and submit the workload to the scheduler.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </div>

        <div className="form-section">
          <span className="form-section-title">Workload</span>
          <div className="form-grid">
            <label className="field-span-2">Job name
              <input value={name} onChange={(event) => setName(event.target.value)} minLength={3} required />
            </label>
            <label>Project
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>
                {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label>Job type
              <select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="TRAINING">Training</option>
                <option value="EVALUATION">Evaluation</option>
                <option value="DATA_PREPARATION">Data preparation</option>
                <option value="BATCH_INFERENCE">Batch inference</option>
              </select>
            </label>
            <label>Framework
              <select value={framework} onChange={(event) => setFramework(event.target.value)}>
                <option>PyTorch</option><option>TensorFlow</option><option>LightGBM</option><option>Python</option>
              </select>
            </label>
            <label>Priority
              <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
              </select>
            </label>
            <label>Dataset
              <select value={datasetId} onChange={(event) => setDatasetId(event.target.value)}>
                <option value="">No dataset</option>
                {availableDatasets.map((dataset) => <option value={dataset.id} key={dataset.id}>{dataset.name} · {dataset.version}</option>)}
              </select>
            </label>
            <label>Experiment
              <select value={experimentId} onChange={(event) => setExperimentId(event.target.value)}>
                <option value="">No experiment</option>
                {availableExperiments.map((experiment) => <option value={experiment.id} key={experiment.id}>{experiment.name}</option>)}
              </select>
            </label>
            {(type === "EVALUATION" || type === "BATCH_INFERENCE") && (
              <label className="field-span-2">Model
                <select value={modelId} onChange={(event) => setModelId(event.target.value)}>
                  <option value="">Select a model</option>
                  {availableModels.map((model) => <option value={model.id} key={model.id}>{model.name} · {model.version}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="form-section">
          <span className="form-section-title"><Cpu size={15} /> Compute request</span>
          <div className="resource-grid">
            <label>GPU
              <input type="number" min="0" max="8" value={requestedGpu} onChange={(event) => setRequestedGpu(Number(event.target.value))} />
              <small>accelerators</small>
            </label>
            <label>CPU
              <input type="number" min="1" max="64" value={requestedCpu} onChange={(event) => setRequestedCpu(Number(event.target.value))} />
              <small>cores</small>
            </label>
            <label>Memory
              <input type="number" min="1" max="512" value={requestedMemoryGb} onChange={(event) => setRequestedMemoryGb(Number(event.target.value))} />
              <small>GB</small>
            </label>
            <label>Retries
              <input type="number" min="0" max="5" value={maxRetries} onChange={(event) => setMaxRetries(Number(event.target.value))} />
              <small>maximum</small>
            </label>
          </div>
        </div>

        <div className="form-section schedule-section">
          <span className="form-section-title"><CalendarClock size={15} /> Scheduling</span>
          <label>Run later (optional)
            <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
          </label>
          <p>Leave empty to place the job in the queue immediately.</p>
        </div>

        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button className="button button-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="button button-primary" disabled={submitting || !projectId || name.length < 3}>
            <Play size={16} /> {submitting ? "Submitting…" : scheduledAt ? "Schedule job" : "Launch job"}
          </button>
        </div>
      </form>
    </div>
  );
}
