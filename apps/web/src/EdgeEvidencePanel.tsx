import type {
  Edge,
  EdgeSummary,
  GetEdgeEvidenceResponse,
  GraphResponse
} from "@graph-ai-tutor/shared";

function getConceptTitle(graph: GraphResponse | null, conceptId: string): string {
  const match = graph?.nodes.find((n) => n.id === conceptId);
  return match?.title ?? conceptId;
}

function getEdgeLabel(graph: GraphResponse | null, edge: Pick<Edge, "fromConceptId" | "toConceptId" | "type">) {
  const fromTitle = getConceptTitle(graph, edge.fromConceptId);
  const toTitle = getConceptTitle(graph, edge.toConceptId);
  return `${fromTitle} ${edge.type} ${toTitle}`;
}

export function EdgeEvidencePanel(props: {
  selectedEdgeId: string | null;
  graph: GraphResponse | null;
  evidence: GetEdgeEvidenceResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const { selectedEdgeId, graph, evidence, loading, error } = props;

  const fallbackEdge: EdgeSummary | null =
    selectedEdgeId && graph ? graph.edges.find((e) => e.id === selectedEdgeId) ?? null : null;

  const edgeForLabel:
    | Pick<Edge, "fromConceptId" | "toConceptId" | "type">
    | Pick<EdgeSummary, "fromConceptId" | "toConceptId" | "type">
    | null = evidence?.edge ?? fallbackEdge;

  return (
    <div className="evidencePanel" data-testid="edge-evidence-panel">
      <div className="evidenceHeader">
        <h3 className="paneTitle">Evidence</h3>
        {edgeForLabel ? (
          <p className="mutedText">{getEdgeLabel(graph, edgeForLabel)}</p>
        ) : (
          <p className="mutedText">Select an edge to view evidence.</p>
        )}
      </div>

      {!selectedEdgeId ? null : loading ? (
        <p className="mutedText">Loading evidence...</p>
      ) : error ? (
        <p role="alert" className="errorText">
          {error}
        </p>
      ) : evidence ? (
        evidence.evidence.length > 0 ? (
          <div className="evidenceList" aria-label="Evidence chunks">
            {evidence.evidence.map((ev) => (
              <div className="evidenceItem" key={ev.chunk.id}>
                <div className="evidenceSourceRow">
                  <a href={ev.source.url} target="_blank" rel="noreferrer">
                    {ev.source.title ?? ev.source.url}
                  </a>
                  <span className="mutedText evidenceChunkMeta">
                    Chunk {ev.chunk.id} • {ev.chunk.startOffset}-{ev.chunk.endOffset}
                  </span>
                </div>
                <pre className="evidenceChunk">{ev.chunk.content}</pre>
              </div>
            ))}
          </div>
        ) : (
          <p className="mutedText">(No evidence attached yet)</p>
        )
      ) : (
        <p className="mutedText">Select an edge to view evidence.</p>
      )}
    </div>
  );
}

