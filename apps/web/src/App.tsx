import { useEffect, useMemo, useState } from "react";

import { getConcept, getGraph } from "@graph-ai-tutor/shared";
import type { Concept, ConceptSummary, GraphResponse } from "@graph-ai-tutor/shared";

export default function App() {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);

  const [query, setQuery] = useState("");

  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get("conceptId");
  });
  const [concept, setConcept] = useState<Concept | null>(null);
  const [conceptError, setConceptError] = useState<string | null>(null);
  const [conceptLoading, setConceptLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setGraphError(null);

    getGraph()
      .then((g) => {
        if (cancelled) return;
        setGraph(g);
      })
      .catch((err) => {
        if (cancelled) return;
        setGraphError(err instanceof Error ? err.message : "Failed to load graph");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setSelectedConceptId(new URLSearchParams(window.location.search).get("conceptId"));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!selectedConceptId) {
      setConcept(null);
      setConceptError(null);
      return;
    }

    let cancelled = false;
    setConceptLoading(true);
    setConceptError(null);

    getConcept(selectedConceptId)
      .then((res) => {
        if (cancelled) return;
        setConcept(res.concept);
      })
      .catch((err) => {
        if (cancelled) return;
        setConcept(null);
        setConceptError(err instanceof Error ? err.message : "Failed to load concept");
      })
      .finally(() => {
        if (cancelled) return;
        setConceptLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedConceptId]);

  const filteredNodes = useMemo(() => {
    const nodes: ConceptSummary[] = graph?.nodes ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => n.title.toLowerCase().includes(q));
  }, [graph, query]);

  function selectConcept(id: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("conceptId", id);
    window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
    setSelectedConceptId(id);
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Graph AI Tutor</h1>
      </header>

      <div className="shell">
        <aside className="pane leftPane" aria-label="Navigation">
          <div className="section">
            <div className="sectionTitle">Nav</div>
            <div className="navItem" aria-current="page">
              Atlas
            </div>
          </div>

          <div className="section">
            <label className="sectionTitle" htmlFor="search">
              Search
            </label>
            <input
              id="search"
              className="searchInput"
              placeholder="Search concepts..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {graphError ? (
              <p role="alert" className="errorText">
                {graphError}
              </p>
            ) : null}

            {!graph ? (
              <p className="mutedText">Loading graph...</p>
            ) : (
              <ul className="nodeList" aria-label="Concepts">
                {filteredNodes.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className="nodeButton"
                      onClick={() => selectConcept(n.id)}
                      aria-current={selectedConceptId === n.id ? "true" : undefined}
                    >
                      <span className="nodeTitle">{n.title}</span>
                      {n.module ? <span className="nodeModule">{n.module}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <main className="pane centerPane" aria-label="Atlas">
          <h2>Atlas</h2>
          <p className="mutedText">Atlas placeholder (Cytoscape arrives in Task 6).</p>
          {graph ? (
            <p className="mutedText">
              Nodes: {graph.nodes.length} • Edges: {graph.edges.length}
            </p>
          ) : null}
        </main>

        <section className="pane rightPane" aria-label="Concept">
          <h2>Concept</h2>

          {!selectedConceptId ? (
            <p className="mutedText">Select a concept to view details.</p>
          ) : conceptLoading ? (
            <p className="mutedText">Loading concept...</p>
          ) : conceptError ? (
            <p role="alert" className="errorText">
              {conceptError}
            </p>
          ) : concept ? (
            <div className="concept">
              <h3 data-testid="concept-title">{concept.title}</h3>
              {concept.l0 ? <p>{concept.l0}</p> : <p className="mutedText">(No L0 yet)</p>}
              {concept.l1.length > 0 ? (
                <ul>
                  {concept.l1.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : (
                <p className="mutedText">(No L1 yet)</p>
              )}
            </div>
          ) : (
            <p className="mutedText">Concept not found.</p>
          )}
        </section>
      </div>
    </div>
  );
}
