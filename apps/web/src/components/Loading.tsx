import { LoaderCircle } from "lucide-react";

export function Loading({ label = "Loading control plane" }: { label?: string }) {
  return (
    <div className="loading-state">
      <LoaderCircle size={22} className="spin" />
      <span>{label}</span>
    </div>
  );
}
