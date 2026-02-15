export function SkeletonLine() {
  return <div className="skeleton-line" />;
}

export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-block">
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} />
      ))}
    </div>
  );
}

export function ConceptSkeleton() {
  return (
    <div className="skeleton-block" data-testid="concept-skeleton">
      <div className="skeleton-line" style={{ width: "60%" }} />
      <div className="skeleton-line" style={{ width: "80%" }} />
      <div className="skeleton-line" style={{ width: "45%" }} />
      <div className="skeleton-line" style={{ width: "70%" }} />
    </div>
  );
}

export function EvidenceSkeleton() {
  return (
    <div className="skeleton-block" data-testid="evidence-skeleton">
      <div className="skeleton-line" style={{ width: "50%" }} />
      <div className="skeleton-line" style={{ width: "90%" }} />
      <div className="skeleton-line" style={{ width: "75%" }} />
    </div>
  );
}
