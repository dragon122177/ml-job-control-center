import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders progress and an accessible label", () => {
    render(<ProgressBar value={64} />);
    expect(screen.getByLabelText("64% complete")).toBeInTheDocument();
    expect(screen.getByText("64%")).toBeInTheDocument();
  });
});
