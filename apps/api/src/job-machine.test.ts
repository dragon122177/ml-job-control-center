import { describe, expect, it } from "vitest";
import { assertTransition } from "./job-machine.js";

describe("job state machine", () => {
  it("allows a queued workload to start", () => {
    expect(() => assertTransition("QUEUED", "RUNNING", 0, 2)).not.toThrow();
  });

  it("allows active workloads to finish or fail", () => {
    expect(() => assertTransition("RUNNING", "SUCCEEDED", 1, 2)).not.toThrow();
    expect(() => assertTransition("RUNNING", "FAILED", 1, 2)).not.toThrow();
  });

  it("rejects invalid transitions", () => {
    expect(() => assertTransition("SUCCEEDED", "RUNNING", 1, 2))
      .toThrow(/cannot transition/i);
  });

  it("enforces the retry policy", () => {
    expect(() => assertTransition("FAILED", "QUEUED", 3, 2))
      .toThrow(/retry limit/i);
  });
});
