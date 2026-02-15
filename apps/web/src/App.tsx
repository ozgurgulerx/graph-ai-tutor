import cytoscape from "cytoscape";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  EdgeTypeSchema,
  type Concept,
  type ConceptSummary,
  type EdgeType,
  type GetEdgeEvidenceResponse,
  type GraphClusteredResponse,
  type GraphResponse,
  type SearchUniversalResponse
} from "@graph-ai-tutor/shared";

import {
  getConceptCached,
  getEdgeEvidence,
  getGraph,
  getGraphClustered,
  getUniversalSearch,
  invalidateConceptCache,
  postConcept,
  prefetchConcept
} from "./api/client";
import { CaptureModal } from "./CaptureModal";
import { ConceptWorkspace } from "./ConceptWorkspace";
import { EdgeEvidencePanel } from "./EdgeEvidencePanel";
import { EdgeTypeFilter } from "./EdgeTypeFilter";
import { InboxPanel } from "./InboxPanel";
import { ReviewPanel } from "./ReviewPanel";
import { ConceptSkeleton, SkeletonBlock } from "./Skeleton";
import { SourcePanel } from "./SourcePanel";
import { TutorPanel } from "./TutorPanel";
import { CommandPalette } from "./CommandPalette";
import { TrainingPanel } from "./TrainingPanel";
import { HighlightedText } from "./search/HighlightedText";
import { collectWithinHops } from "./search/neighborhood";

type AtlasViewProps = {
  graph: GraphResponse | null;
  clusteredData: GraphClusteredResponse | null;
  graphMode: "full" | "clustered";
  edgeTypeAllowlist: ReadonlySet<EdgeType>;
  highlightConceptIds: ReadonlySet<string>;
  changesetHighlightConceptIds: ReadonlySet<string>;
  masteryOverlayEnabled: boolean;
  selectedConceptId: string | null;
  pinnedConceptIds: ReadonlySet<string>;
  focusModeEnabled: boolean;
  focusDepth: number;
  onSelectConcept: (conceptId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onCyReady?: (cy: cytoscape.Core | null) => void;
};

function buildElements(
  graph: GraphResponse,
  clustered?: GraphClusteredResponse | null,
  mode?: "full" | "clustered"
): cytoscape.ElementDefinition[] {
  const elements: cytoscape.ElementDefinition[] = [];

  // Build module -> parentId map for clustered mode
  const nodeParent = new Map<string, string>();
  if (mode === "clustered" && clustered) {
    for (const cluster of clustered.clusters) {
      const parentId = `cluster:${cluster.module}`;
      elements.push({
        group: "nodes",
        data: {
          id: parentId,
          label: `${cluster.module} (${cluster.count})`,
          isCluster: true
        }
      });
      for (const cid of cluster.conceptIds) {
        nodeParent.set(cid, parentId);
      }
    }
  }

  for (const n of graph.nodes) {
    const parent = nodeParent.get(n.id);
    elements.push({
      group: "nodes",
      data: {
        id: n.id,
        label: n.title,
        module: n.module,
        masteryScore: typeof n.masteryScore === "number" ? n.masteryScore : 0,
        ...(parent ? { parent } : {})
      }
    });
  }

  for (const e of graph.edges) {
    elements.push({
      group: "edges",
      data: {
        id: e.id,
        source: e.fromConceptId,
        target: e.toConceptId,
        type: e.type
      }
    });
  }

  return elements;
}

function applyEdgeFilter(cy: cytoscape.Core, allowlist: ReadonlySet<EdgeType>) {
  cy.edges().forEach((edge) => {
    const type = edge.data("type") as EdgeType;
    edge.style("display", allowlist.has(type) ? "element" : "none");
  });
}

function applyConceptHighlight(cy: cytoscape.Core, conceptIds: ReadonlySet<string>) {
  cy.nodes().removeClass("tutorUsed");
  for (const id of conceptIds) {
    cy.$id(id).addClass("tutorUsed");
  }
}

function applyChangesetHighlight(cy: cytoscape.Core, conceptIds: ReadonlySet<string>) {
  cy.nodes().removeClass("changesetAffected");
  for (const id of conceptIds) {
    cy.$id(id).addClass("changesetAffected");
  }
}

const MASTERY_CLASS_NAMES = ["masteryLow", "masteryMid", "masteryHigh"] as const;
type MasteryClassName = (typeof MASTERY_CLASS_NAMES)[number];

function masteryClassForScore(score: unknown): MasteryClassName {
  const s = typeof score === "number" && Number.isFinite(score) ? score : 0;
  if (s >= 0.67) return "masteryHigh";
  if (s >= 0.34) return "masteryMid";
  return "masteryLow";
}

function applyMasteryOverlay(
  cy: cytoscape.Core,
  graph: GraphResponse | null,
  enabled: boolean
) {
  cy.nodes().removeClass(MASTERY_CLASS_NAMES.join(" "));
  if (!enabled || !graph) return;
  for (const n of graph.nodes) {
    cy.$id(n.id).addClass(masteryClassForScore(n.masteryScore));
  }
}

function applyPinnedNodes(cy: cytoscape.Core, pinnedConceptIds: ReadonlySet<string>) {
  cy.nodes().removeClass("pinned");
  for (const id of pinnedConceptIds) {
    cy.$id(id).addClass("pinned");
  }
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function computeFocusNodeIds(
  cy: cytoscape.Core,
  seedConceptIds: ReadonlySet<string>,
  depth: number,
  edgeTypeAllowlist: ReadonlySet<EdgeType>
): Set<string> {
  const kept = new Set<string>();
  let frontier: string[] = [];

  for (const id of seedConceptIds) {
    kept.add(id);
    frontier.push(id);
  }

  const maxDepth = clampInt(depth, 1, 3);

  for (let step = 0; step < maxDepth; step++) {
    if (frontier.length === 0) break;
    const next: string[] = [];

    for (const nodeId of frontier) {
      const node = cy.$id(nodeId);
      if (node.empty()) continue;

      node.connectedEdges().forEach((edge) => {
        const type = edge.data("type") as EdgeType;
        if (!edgeTypeAllowlist.has(type)) return;

        const source = edge.data("source");
        const target = edge.data("target");
        if (typeof source !== "string" || typeof target !== "string") return;

        const other = source === nodeId ? target : source;
        if (!kept.has(other)) {
          kept.add(other);
          next.push(other);
        }
      });
    }

    frontier = next;
  }

  return kept;
}

function applyFocusMode(
  cy: cytoscape.Core,
  opts: {
    enabled: boolean;
    depth: number;
    selectedConceptId: string | null;
    pinnedConceptIds: ReadonlySet<string>;
    edgeTypeAllowlist: ReadonlySet<EdgeType>;
  }
) {
  const seedConceptIds = new Set<string>(opts.pinnedConceptIds);
  if (typeof opts.selectedConceptId === "string" && opts.selectedConceptId.length > 0) {
    seedConceptIds.add(opts.selectedConceptId);
  }

  cy.nodes().removeClass("dimmed");
  cy.edges().removeClass("dimmed");

  if (!opts.enabled || seedConceptIds.size === 0) return;

  const keptNodeIds = computeFocusNodeIds(
    cy,
    seedConceptIds,
    opts.depth,
    opts.edgeTypeAllowlist
  );

  cy.nodes().addClass("dimmed");
  cy.edges().addClass("dimmed");

  for (const nodeId of keptNodeIds) {
    cy.$id(nodeId).removeClass("dimmed");
  }

  cy.edges().forEach((edge) => {
    const type = edge.data("type") as EdgeType;
    if (!opts.edgeTypeAllowlist.has(type)) return;
    const source = edge.data("source");
    const target = edge.data("target");
    if (typeof source !== "string" || typeof target !== "string") return;
    if (!keptNodeIds.has(source) || !keptNodeIds.has(target)) return;
    edge.removeClass("dimmed");
  });
}

function AtlasView({
  graph,
  clusteredData,
  graphMode,
  edgeTypeAllowlist,
  highlightConceptIds,
  changesetHighlightConceptIds,
  masteryOverlayEnabled,
  selectedConceptId,
  pinnedConceptIds,
  focusModeEnabled,
  focusDepth,
  onSelectConcept,
  onSelectEdge
}: AtlasViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const onSelectRef = useRef(onSelectConcept);
  useEffect(() => {
    onSelectRef.current = onSelectConcept;
  }, [onSelectConcept]);

  const onSelectEdgeRef = useRef(onSelectEdge);
  useEffect(() => {
    onSelectEdgeRef.current = onSelectEdge;
  }, [onSelectEdge]);

  const allowlistRef = useRef(edgeTypeAllowlist);
  useEffect(() => {
    allowlistRef.current = edgeTypeAllowlist;
  }, [edgeTypeAllowlist]);

  const highlightRef = useRef(highlightConceptIds);
  useEffect(() => {
    highlightRef.current = highlightConceptIds;
  }, [highlightConceptIds]);

  const changesetHighlightRef = useRef(changesetHighlightConceptIds);
  useEffect(() => {
    changesetHighlightRef.current = changesetHighlightConceptIds;
  }, [changesetHighlightConceptIds]);

  const pinnedRef = useRef(pinnedConceptIds);
  useEffect(() => {
    pinnedRef.current = pinnedConceptIds;
  }, [pinnedConceptIds]);

  const elements = useMemo(
    () => (graph ? buildElements(graph, clusteredData, graphMode) : []),
    [graph, clusteredData, graphMode]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cy = cytoscape({
      container,
      elements: [],
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "font-size": "11px",
            "text-wrap": "wrap",
            "text-max-width": "120px",
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.9,
            "text-background-padding": "3px",
            "text-background-shape": "roundrectangle",
            "background-color": "#111827",
            color: "#0f172a"
          }
        },
        {
          selector: "node.masteryLow",
          style: {
            "background-color": "#ef4444",
            "border-width": 2,
            "border-color": "#7f1d1d"
          }
        },
        {
          selector: "node.masteryMid",
          style: {
            "background-color": "#f59e0b",
            "border-width": 2,
            "border-color": "#78350f"
          }
        },
        {
          selector: "node.masteryHigh",
          style: {
            "background-color": "#10b981",
            "border-width": 2,
            "border-color": "#064e3b"
          }
        },
        {
          selector: "node.tutorUsed",
          style: {
            "border-width": 4,
            "border-color": "#f59e0b"
          }
        },
        {
          selector: "node.pinned",
          style: {
            "border-width": 4,
            "border-color": "#0ea5e9"
          }
        },
        {
          selector: "node.changesetAffected",
          style: {
            "border-width": 3,
            "border-color": "#8b5cf6",
            "border-style": "dashed"
          }
        },
        {
          selector: "node.searchFocused",
          style: {
            "border-width": 6,
            "border-color": "#e11d48"
          }
        },
        {
          selector: "node.dimmed",
          style: {
            opacity: 0.15,
            "text-opacity": 0.25
          }
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#94a3b8",
            "target-arrow-color": "#94a3b8",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier"
          }
        },
        {
          selector: "edge.dimmed",
          style: {
            opacity: 0.15
          }
        },
        {
          selector: "$node > node",
          style: {
            "background-color": "#f1f5f9",
            "border-width": 1,
            "border-color": "#cbd5e1",
            shape: "roundrectangle",
            "padding-top": "12px" as unknown as number,
            label: "data(label)",
            "font-size": "13px",
            "text-valign": "top",
            "text-halign": "center",
            color: "#475569"
          }
        }
      ],
      layout: { name: "cose", animate: false, fit: true }
    });

    const onTapNode = (evt: cytoscape.EventObject) => {
      const id = evt.target.id();
      if (typeof id === "string" && id.length > 0) onSelectRef.current(id);
    };

    const onTapEdge = (evt: cytoscape.EventObject) => {
      const id = evt.target.id();
      if (typeof id === "string" && id.length > 0) onSelectEdgeRef.current(id);
    };

    cy.on("tap", "node", onTapNode);
    cy.on("tap", "edge", onTapEdge);
    cyRef.current = cy;

    if (import.meta.env.DEV) window.__CY__ = cy;

    return () => {
      if (import.meta.env.DEV && window.__CY__ === cy) delete window.__CY__;
      cy.removeListener("tap", "node", onTapNode);
      cy.removeListener("tap", "edge", onTapEdge);
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().remove();
    if (elements.length > 0) {
      cy.add(elements);
      cy.layout({ name: "cose", animate: false, fit: true }).run();
    }

    applyEdgeFilter(cy, allowlistRef.current);
    applyConceptHighlight(cy, highlightRef.current);
    applyChangesetHighlight(cy, changesetHighlightRef.current);
    applyPinnedNodes(cy, pinnedRef.current);
  }, [elements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applyEdgeFilter(cy, edgeTypeAllowlist);
  }, [edgeTypeAllowlist]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applyConceptHighlight(cy, highlightConceptIds);
  }, [highlightConceptIds]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applyChangesetHighlight(cy, changesetHighlightConceptIds);
  }, [changesetHighlightConceptIds]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applyPinnedNodes(cy, pinnedConceptIds);
  }, [pinnedConceptIds]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applyFocusMode(cy, {
      enabled: focusModeEnabled,
      depth: focusDepth,
      selectedConceptId,
      pinnedConceptIds,
      edgeTypeAllowlist
    });
  }, [elements, focusModeEnabled, focusDepth, selectedConceptId, pinnedConceptIds, edgeTypeAllowlist]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applyMasteryOverlay(cy, graph, masteryOverlayEnabled);
  }, [graph, masteryOverlayEnabled]);

  return <div className="atlas" data-testid="atlas" ref={containerRef} />;
}

function ConceptListItem(props: {
  node: ConceptSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { node, selected, onSelect } = props;

  function handleMouseEnter() {
    timerRef.current = setTimeout(() => {
      prefetchConcept(node.id);
    }, 200);
  }

  function handleMouseLeave() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return (
    <li>
      <button
        type="button"
        className="nodeButton"
        onClick={() => onSelect(node.id)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-current={selected ? "true" : undefined}
      >
        <span className="nodeTitle">{node.title}</span>
        <span className="nodeModule">
          {node.kind}
          {node.module ? ` • ${node.module}` : ""}
        </span>
      </button>
    </li>
  );
}

export default function App() {
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [graphMode, setGraphMode] = useState<"full" | "clustered">("full");
  const [clusteredData, setClusteredData] = useState<GraphClusteredResponse | null>(null);

  const [query, setQuery] = useState("");
  const [universalSearch, setUniversalSearch] = useState<SearchUniversalResponse | null>(null);
  const [universalSearchLoading, setUniversalSearchLoading] = useState(false);
  const [universalSearchError, setUniversalSearchError] = useState<string | null>(null);

  const [searchScopeOverride, setSearchScopeOverride] = useState<"neighborhood" | "global" | null>(
    null
  );
  const [searchFacetAllowlist, setSearchFacetAllowlist] = useState<
    Set<"concepts" | "sources" | "evidence">
  >(() => new Set(["concepts", "sources", "evidence"]));

  const atlasCyRef = useRef<cytoscape.Core | null>(null);
  const focusTimerRef = useRef<number | null>(null);

  const [selectedEdgeTypes, setSelectedEdgeTypes] = useState<Set<EdgeType>>(
    () => new Set(EdgeTypeSchema.options)
  );

  const [masteryOverlayEnabled, setMasteryOverlayEnabled] = useState(false);

  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [focusDepth, setFocusDepth] = useState(1);
  const [pinnedConceptIds, setPinnedConceptIds] = useState<Set<string>>(() => new Set());

  const [activeRightTab, setActiveRightTab] = useState<
    "concept" | "source" | "evidence" | "inbox" | "review" | "tutor"
  >("concept");

  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get("conceptId");
  });

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourcesRefreshToken, setSourcesRefreshToken] = useState(0);

  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeEvidence, setEdgeEvidence] = useState<GetEdgeEvidenceResponse | null>(null);
  const [edgeEvidenceLoading, setEdgeEvidenceLoading] = useState(false);
  const [edgeEvidenceError, setEdgeEvidenceError] = useState<string | null>(null);

  const [concept, setConcept] = useState<Concept | null>(null);
  const [conceptError, setConceptError] = useState<string | null>(null);
  const [conceptLoading, setConceptLoading] = useState(false);

  const [tutorHighlightedConceptIds, setTutorHighlightedConceptIds] = useState<Set<string>>(
    () => new Set()
  );

  const [captureOpen, setCaptureOpen] = useState(false);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [trainingPanelOpen, setTrainingPanelOpen] = useState(false);

  const [changesetHighlightConceptIds, setChangesetHighlightConceptIds] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    if (activeRightTab !== "inbox") {
      setChangesetHighlightConceptIds(new Set());
    }
  }, [activeRightTab]);

  const [contextPackContent, setContextPackContent] = useState<{
    markdown: string;
    fileName: string;
  } | null>(null);

  function showContextPack(markdown: string, fileName: string) {
    setContextPackContent({ markdown, fileName });
  }

  function closeContextPack() {
    setContextPackContent(null);
  }

  function downloadContextPack() {
    if (!contextPackContent) return;
    const blob = new Blob([contextPackContent.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = contextPackContent.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Cmd+K command palette shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const commandPaletteActions = useMemo(
    () => [
      {
        id: "start-training",
        label: "Start training session",
        onSelect: () => setTrainingPanelOpen(true)
      }
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;
    setGraphError(null);

    getGraph()
      .then((g) => {
        if (cancelled) return;
        setGraph(g);
        if (g.nodes.length > 200) {
          setGraphMode("clustered");
          getGraphClustered()
            .then((c) => {
              if (!cancelled) setClusteredData(c);
            })
            .catch(() => {});
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setGraphError(err instanceof Error ? err.message : "Failed to load graph");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshGraph() {
    setGraphError(null);
    try {
      const g = await getGraph();
      setGraph(g);
    } catch (err) {
      setGraphError(err instanceof Error ? err.message : "Failed to load graph");
    }
  }

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

    getConceptCached(selectedConceptId)
      .then((res) => {
        if (cancelled) return;
        setConcept(res.concept);
      })
      .catch((err: unknown) => {
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
    setSelectedEdgeId(null);
    setSelectedSourceId(null);
    setActiveRightTab("concept");
  }

  function selectEdge(id: string) {
    setSelectedEdgeId(id);
    setActiveRightTab("evidence");
  }

  function openSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    setSelectedEdgeId(null);
    setActiveRightTab("source");
  }

  function toggleEdgeType(edgeType: EdgeType) {
    setSelectedEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(edgeType)) next.delete(edgeType);
      else next.add(edgeType);
      return next;
    });
  }

  const selectedPinned = Boolean(selectedConceptId && pinnedConceptIds.has(selectedConceptId));

  function togglePinSelected() {
    if (!selectedConceptId) return;
    setPinnedConceptIds((prev) => {
      const next = new Set(prev);
      if (next.has(selectedConceptId)) next.delete(selectedConceptId);
      else next.add(selectedConceptId);
      return next;
    });
  }

  function clearPins() {
    setPinnedConceptIds(new Set());
  }

  useEffect(() => {
    if (!selectedEdgeId) {
      setEdgeEvidence(null);
      setEdgeEvidenceError(null);
      setEdgeEvidenceLoading(false);
      return;
    }

    let cancelled = false;
    setEdgeEvidenceLoading(true);
    setEdgeEvidenceError(null);
    setEdgeEvidence(null);

    getEdgeEvidence(selectedEdgeId)
      .then((res) => {
        if (cancelled) return;
        setEdgeEvidence(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setEdgeEvidenceError(err instanceof Error ? err.message : "Failed to load evidence");
      })
      .finally(() => {
        if (cancelled) return;
        setEdgeEvidenceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEdgeId]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Graph AI Tutor</h1>
        <button
          type="button"
          className="secondaryButton"
          onClick={() => setCaptureOpen(true)}
          data-testid="capture-open"
        >
          Capture
        </button>
      </header>

      {captureOpen ? (
        <CaptureModal
          onCaptured={() => {
            setCaptureOpen(false);
            setActiveRightTab("inbox");
            void refreshGraph();
          }}
          onClose={() => setCaptureOpen(false)}
        />
      ) : null}

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
              <SkeletonBlock lines={6} />
            ) : (
              <ul className="nodeList" aria-label="Concepts">
                {filteredNodes.map((n) => (
                  <ConceptListItem
                    key={n.id}
                    node={n}
                    selected={selectedConceptId === n.id}
                    onSelect={selectConcept}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="section">
            <EdgeTypeFilter selected={selectedEdgeTypes} onToggle={toggleEdgeType} />
          </div>

          <div className="section" aria-label="Overlays">
            <div className="sectionTitle">Overlays</div>
            <label className="mutedText" htmlFor="mastery-overlay-toggle">
              <input
                id="mastery-overlay-toggle"
                type="checkbox"
                checked={masteryOverlayEnabled}
                onChange={(e) => setMasteryOverlayEnabled(e.target.checked)}
              />{" "}
              Mastery overlay
            </label>

            <label className="mutedText" htmlFor="focus-mode-toggle">
              <input
                id="focus-mode-toggle"
                type="checkbox"
                checked={focusModeEnabled}
                onChange={(e) => setFocusModeEnabled(e.target.checked)}
              />{" "}
              Focus mode
            </label>

            <label className="mutedText" htmlFor="focus-depth-select">
              Focus depth
            </label>
            <select
              id="focus-depth-select"
              className="searchInput"
              value={focusDepth}
              disabled={!focusModeEnabled}
              onChange={(e) => setFocusDepth(clampInt(Number(e.target.value), 1, 3))}
            >
              <option value={1}>1 hop</option>
              <option value={2}>2 hops</option>
              <option value={3}>3 hops</option>
            </select>

            <div className="buttonRow">
              <button
                type="button"
                className="secondaryButton"
                onClick={togglePinSelected}
                disabled={!selectedConceptId}
              >
                {selectedPinned ? "Unpin selected" : "Pin selected"}
              </button>
              <button
                type="button"
                className="ghostButton"
                onClick={clearPins}
                disabled={pinnedConceptIds.size === 0}
              >
                Clear pins ({pinnedConceptIds.size})
              </button>
            </div>
          </div>
        </aside>

        <main className="pane centerPane" aria-label={contextPackContent ? "Context Pack" : "Atlas"}>
          {contextPackContent ? (
            <>
              <div className="centerHeader">
                <h2>Context Pack</h2>
                <div className="buttonRow">
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={downloadContextPack}
                  >
                    Download .md
                  </button>
                  <button
                    type="button"
                    className="ghostButton"
                    onClick={closeContextPack}
                  >
                    Back to Atlas
                  </button>
                </div>
              </div>
              <div className="contextPackContent" data-testid="context-pack-viewer">
                <pre className="contextPackPre">{contextPackContent.markdown}</pre>
              </div>
            </>
          ) : (
            <>
              <div className="centerHeader">
                <h2>Atlas</h2>
                {graph ? (
                  <div className="buttonRow">
                    <p className="mutedText">
                      Nodes: {graph.nodes.length} • Edges: {graph.edges.length}
                      {graphMode === "clustered" ? " (clustered)" : ""}
                    </p>
                    {graph.nodes.length > 200 ? (
                      <button
                        type="button"
                        className="ghostButton"
                        onClick={() => setGraphMode((m) => (m === "full" ? "clustered" : "full"))}
                      >
                        {graphMode === "clustered" ? "Show full graph" : "Show clusters"}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <SkeletonBlock lines={1} />
                )}
              </div>

              <div className="atlasWrap">
                <AtlasView
                  graph={graph}
                  clusteredData={clusteredData}
                  graphMode={graphMode}
                  edgeTypeAllowlist={selectedEdgeTypes}
                  highlightConceptIds={tutorHighlightedConceptIds}
                  changesetHighlightConceptIds={changesetHighlightConceptIds}
                  masteryOverlayEnabled={masteryOverlayEnabled}
                  selectedConceptId={selectedConceptId}
                  pinnedConceptIds={pinnedConceptIds}
                  focusModeEnabled={focusModeEnabled}
                  focusDepth={focusDepth}
                  onSelectConcept={selectConcept}
                  onSelectEdge={selectEdge}
                />
              </div>
            </>
          )}
        </main>

        <section className="pane rightPane" aria-label="Concept">
          <div className="tabs" role="tablist" aria-label="Right panel tabs">
            <button
              type="button"
              className={`tab ${activeRightTab === "concept" ? "tabActive" : ""}`}
              aria-current={activeRightTab === "concept" ? "page" : undefined}
              onClick={() => setActiveRightTab("concept")}
            >
              Concept Workspace
            </button>
            <button
              type="button"
              className={`tab ${activeRightTab === "source" ? "tabActive" : ""}`}
              aria-current={activeRightTab === "source" ? "page" : undefined}
              onClick={() => setActiveRightTab("source")}
              disabled={!selectedSourceId}
              title={selectedSourceId ? undefined : "Open a local source to enable"}
            >
              Source
            </button>
            <button
              type="button"
              className={`tab ${activeRightTab === "evidence" ? "tabActive" : ""}`}
              aria-current={activeRightTab === "evidence" ? "page" : undefined}
              onClick={() => setActiveRightTab("evidence")}
            >
              Evidence
            </button>
            <button
              type="button"
              className={`tab ${activeRightTab === "inbox" ? "tabActive" : ""}`}
              aria-current={activeRightTab === "inbox" ? "page" : undefined}
              onClick={() => setActiveRightTab("inbox")}
            >
              Inbox
            </button>
            <button
              type="button"
              className={`tab ${activeRightTab === "tutor" ? "tabActive" : ""}`}
              aria-current={activeRightTab === "tutor" ? "page" : undefined}
              onClick={() => setActiveRightTab("tutor")}
            >
              Tutor
            </button>
            <button
              type="button"
              className={`tab ${activeRightTab === "review" ? "tabActive" : ""}`}
              aria-current={activeRightTab === "review" ? "page" : undefined}
              onClick={() => setActiveRightTab("review")}
            >
              Review
            </button>
          </div>

          {activeRightTab === "concept" ? (
            !selectedConceptId ? (
              <p className="mutedText">Select a concept to view details.</p>
            ) : conceptLoading ? (
              <ConceptSkeleton />
            ) : conceptError ? (
              <p role="alert" className="errorText">
                {conceptError}
              </p>
            ) : concept ? (
              <ConceptWorkspace
                concept={concept}
                graph={graph}
                onOpenConcept={selectConcept}
                onShowContextPack={showContextPack}
                onGraphUpdated={refreshGraph}
                onOpenSource={openSource}
                sourcesRefreshToken={sourcesRefreshToken}
                onConceptUpdated={(next) => setConcept(next)}
                onSave={async (input) => {
                  const res = await postConcept({
                    id: input.id,
                    l0: input.l0,
                    l1: input.l1,
                    l2: input.l2
                  });
                  invalidateConceptCache(input.id);
                  setConcept(res.concept);
                  return res.concept;
                }}
              />
            ) : (
              <p className="mutedText">Concept not found.</p>
            )
          ) : activeRightTab === "source" ? (
            <SourcePanel
              sourceId={selectedSourceId}
              onSaved={() => setSourcesRefreshToken((t) => t + 1)}
            />
          ) : activeRightTab === "evidence" ? (
              <EdgeEvidencePanel
                selectedEdgeId={selectedEdgeId}
                graph={graph}
                evidence={edgeEvidence}
                loading={edgeEvidenceLoading}
                error={edgeEvidenceError}
              />
          ) : activeRightTab === "inbox" ? (
            <InboxPanel
              graph={graph}
              onGraphUpdated={refreshGraph}
              onHighlightChangesetConceptIds={(ids) =>
                setChangesetHighlightConceptIds(new Set(ids))
              }
            />
          ) : activeRightTab === "review" ? (
            <ReviewPanel graph={graph} onOpenConcept={selectConcept} />
          ) : (
            <TutorPanel
              graph={graph}
              onHighlightConceptIds={(ids) => setTutorHighlightedConceptIds(new Set(ids))}
            />
          )}
        </section>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        actions={commandPaletteActions}
      />

      <TrainingPanel
        open={trainingPanelOpen}
        onClose={() => setTrainingPanelOpen(false)}
        graph={graph}
        conceptIds={selectedConceptId ? [selectedConceptId] : undefined}
      />
    </div>
  );
}
