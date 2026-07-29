import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders human-readable status labels", () => {
    render(<StatusBadge value="DATA_PREPARATION" />);
    expect(screen.getByText("Data Preparation")).toBeInTheDocument();
  });

  it("marks running jobs with the running style", () => {
    const { container } = render(<StatusBadge value="RUNNING" />);
    expect(container.firstChild).toHaveClass("status-running");
  });
});
