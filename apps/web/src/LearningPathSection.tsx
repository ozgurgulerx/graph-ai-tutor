import { useMemo } from "react";

import { computePrerequisitePath, type GraphResponse } from "@graph-ai-tutor/shared";

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function formatMastery(score: number | undefined): string {
  const pct = Math.round(clamp01(score ?? 0) * 100);
  return `${pct}%`;
}

export function LearningPathSection(props: {
  graph: GraphResponse;
  conceptId: string;
  onOpenConcept: (conceptId: string) => void;
}) {
  const nodeById = useMemo(() => {
    const map = new Map<string, GraphResponse["nodes"][number]>();
    for (const n of props.graph.nodes) map.set(n.id, n);
    return map;
  }, [props.graph.nodes]);

  const prereqs = useMemo(() => {
    return computePrerequisitePath({
      targetConceptId: props.conceptId,
      edges: props.graph.edges,
      sortKey: (id) => nodeById.get(id)?.title ?? id
    });
  }, [props.conceptId, props.graph.edges, nodeById]);

  const dependents = useMemo(() => {
    const ids = new Set<string>();
    for (const e of props.graph.edges) {
      if (e.type !== "PREREQUISITE_OF") continue;
      if (e.fromConceptId !== props.conceptId) continue;
      ids.add(e.toConceptId);
    }

    const all = [...ids].map((id) => ({
      id,
      title: nodeById.get(id)?.title ?? id,
      masteryScore: nodeById.get(id)?.masteryScore ?? 0
    }));

    all.sort((a, b) => {
      if (a.masteryScore !== b.masteryScore) return a.masteryScore - b.masteryScore;
      return a.title.localeCompare(b.title);
    });

    return all;
  }, [props.conceptId, props.graph.edges, nodeById]);

  return (
    <div className="conceptSection" aria-label="Learning path" data-testid="learning-path">
      <div className="sectionTitle">Path</div>

      <div className="mutedText">Prerequisites (topological)</div>
      {prereqs.ok ? (
        prereqs.orderedConceptIds.length <= 1 ? (
          <p className="mutedText">(No prerequisites)</p>
        ) : (
          <ol className="bullets" aria-label="Prerequisites">
            {prereqs.orderedConceptIds.slice(0, -1).map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="linkButton"
                  onClick={() => props.onOpenConcept(id)}
                >
                  {nodeById.get(id)?.title ?? id}
                </button>
              </li>
            ))}
          </ol>
        )
      ) : (
        <>
          <p role="alert" className="errorText">
            Cycle detected in PREREQUISITE_OF edges; cannot compute a stable prerequisite order.
          </p>
          {prereqs.cycleNodeIds.length > 0 ? (
            <ul className="bullets" aria-label="Cycle nodes">
              {prereqs.cycleNodeIds.map((id) => (
                <li key={id}>{nodeById.get(id)?.title ?? id}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      <div className="mutedText">Next (lowest mastery among dependents)</div>
      {dependents.length === 0 ? (
        <p className="mutedText">(No dependents yet)</p>
      ) : (
        <ul className="bullets" aria-label="Next concepts">
          {dependents.slice(0, 8).map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className="linkButton"
                onClick={() => props.onOpenConcept(d.id)}
              >
                {d.title}
              </button>{" "}
              <span className="mutedText">(mastery {formatMastery(d.masteryScore)})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

