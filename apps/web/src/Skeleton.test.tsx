import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConceptSkeleton, EvidenceSkeleton, SkeletonBlock, SkeletonLine } from "./Skeleton";

describe("Skeleton components", () => {
  it("SkeletonLine renders with correct class", () => {
    const { container } = render(<SkeletonLine />);
    expect(container.querySelector(".skeleton-line")).toBeTruthy();
  });

  it("SkeletonBlock renders multiple lines", () => {
    const { container } = render(<SkeletonBlock lines={4} />);
    expect(container.querySelectorAll(".skeleton-line")).toHaveLength(4);
    expect(container.querySelector(".skeleton-block")).toBeTruthy();
  });

  it("ConceptSkeleton renders with testid", () => {
    render(<ConceptSkeleton />);
    expect(screen.getByTestId("concept-skeleton")).toBeTruthy();
  });

  it("EvidenceSkeleton renders with testid", () => {
    render(<EvidenceSkeleton />);
    expect(screen.getByTestId("evidence-skeleton")).toBeTruthy();
  });
});
