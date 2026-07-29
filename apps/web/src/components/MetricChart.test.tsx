import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricChart } from "./MetricChart";

describe("MetricChart", () => {
  it("renders a metric trend when points are available", () => {
    render(<MetricChart label="Training loss" points={[{ step: 1, value: 0.8 }, { step: 2, value: 0.4 }]} />);
    expect(screen.getByRole("img", { name: /training loss metric trend/i })).toBeInTheDocument();
    expect(screen.getByText("0.400")).toBeInTheDocument();
  });

  it("shows an empty state before telemetry arrives", () => {
    render(<MetricChart label="Accuracy" points={[]} />);
    expect(screen.getByText(/metrics will appear/i)).toBeInTheDocument();
  });
});
