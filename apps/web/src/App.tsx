import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

cytoscape.use(fcose);

import {
  getDefaultEdgeTypes,
  type Concept,
  type PostDraftEdgeRequest,
  type EdgeType,
  type EdgeTypeCategory,
  type GetEdgeEvidenceResponse,
  type GraphClusteredResponse,
  type GraphLensResponse,
  type GraphResponse,
  type LensNodeMetadata,
  type SearchUniversalResponse
} from "@graph-ai-tutor/shared";

import {
  getConceptCached,
  getChangesets,
  getEdgeEvidence,
  getGraph,
  getGraphClustered,
  getGraphLens,
  getReviewDue,
  getUniversalSearch,
  invalidateConceptCache,
  invalidateGraphCache,
  postConcept,
  postDraftEdge
} from "./api/client";
import { CaptureModal } from "./CaptureModal";
import { ConceptInspectorV2 } from "./concept/ConceptInspectorV2";
import { ConceptTree } from "./ConceptTree";
import { ConceptWorkspace } from "./ConceptWorkspace";
import { EdgeEvidencePanel } from "./EdgeEvidencePanel";
import { EdgeTypeFilter } from "./EdgeTypeFilter";
import { InboxPanel } from "./InboxPanel";
import { ReviewPanel } from "./ReviewPanel";
import { ConceptSkeleton, SkeletonBlock } from "./Skeleton";
import { SourcePanel } from "./SourcePanel";
import { TutorPanel } from "./TutorPanel";
import { TutorDrawer } from "./tutor/TutorDrawer";
import { WorkbenchModal } from "./workbench/WorkbenchModal";
import { CommandPalette } from "./CommandPalette";
import { useLayoutWorker } from "./useLayoutWorker";
import { EdgeTypePicker } from "./EdgeTypePicker";
import type { InteractionMode } from "./GraphNavToolbar";
import { GraphNavToolbar } from "./GraphNavToolbar";
import type { EdgeDraftState } from "./LensEditToolbar";
import { LensEditToolbar } from "./LensEditToolbar";
import { TrainingPanel } from "./TrainingPanel";
import { collectTieredNeighborhood, collectWithinHops } from "./search/neighborhood";
import { HighlightedText } from "./search/HighlightedText";
import { usePanelResize } from "./usePanelResize";
import { useUiFlags } from "./state/uiFlags";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { useOnDemandNeighborhood } from "./graph/useOnDemandNeighborhood";

type GraphViewMode = "classic" | "focus" | "lens" | "explore";
type SelectionSource =
  | "atlas_click"
  | "tree_click"
  | "search_show_in_graph"
  | "relationship_click"
  | "programmatic";

type GraphMode = "full" | "clustered" | "onDemand";

type AtlasViewProps = {
  graph: GraphResponse | null;
  clusteredData: GraphClusteredResponse | null;
  graphMode: GraphMode;
  edgeTypeAllowlist: ReadonlySet<EdgeType>;
  edgeVisMode: EdgeVisMode;
  highlightConceptIds: ReadonlySet<string>;
  changesetHighlightConceptIds: ReadonlySet<string>;
  hoveredRelationConceptId: string | null;
  hoveredRelationEdgeId: string | null;
  masteryOverlayEnabled: boolean;
  selectedConceptId: string | null;
  pinnedConceptIds: ReadonlySet<string>;
  focusModeEnabled: boolean;
  focusDepth: number;
  viewMode: GraphViewMode;
  lensData: GraphLensResponse | null;
  exploreCenter: string | null;
  onDemandData: GraphResponse | null;
  onDemandHops: Map<string, number>;
  onDemandLoading: boolean;
  onDemandCapped: boolean;
  onSelectConcept: (conceptId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onExploreNavigate?: (conceptId: string) => void;
  onPinToggle?: (conceptId: string) => void;
  onCyReady?: (cy: cytoscape.Core | null) => void;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

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
        pagerank: typeof n.pagerank === "number" ? n.pagerank : 0,
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

type EdgeVisMode = "all" | "prereq_only" | "filtered";

function applyEdgeFilter(
  cy: cytoscape.Core,
  allowlist: ReadonlySet<EdgeType>,
  edgeVisMode: EdgeVisMode = "filtered"
) {
  cy.edges().forEach((edge) => {
    const type = edge.data("type") as EdgeType;
    let visible: boolean;
    if (edgeVisMode === "all") {
      visible = true;
    } else if (edgeVisMode === "prereq_only") {
      visible = type === "PREREQUISITE_OF";
    } else {
      visible = allowlist.has(type);
    }
    edge.style("display", visible ? "element" : "none");
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

function applyRelationshipHover(
  cy: cytoscape.Core,
  hoveredConceptId: string | null,
  hoveredEdgeId: string | null
) {
  cy.nodes().removeClass("relationshipHover");
  cy.edges().removeClass("relationshipHover");

  if (hoveredConceptId) {
    cy.$id(hoveredConceptId).addClass("relationshipHover");
  }
  if (!hoveredEdgeId) return;

  const edge = cy.$id(hoveredEdgeId);
  if (edge.empty()) return;
  edge.addClass("relationshipHover");

  const source = edge.data("source");
  const target = edge.data("target");
  if (typeof source === "string") cy.$id(source).addClass("relationshipHover");
  if (typeof target === "string") cy.$id(target).addClass("relationshipHover");
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

const ANIM_NODE_THRESHOLD = 200;
const WORKER_LAYOUT_THRESHOLD = 300;

const LENS_X_GAP = 250;
const LENS_Y_GAP = 80;

const ZOOM_FAR = 0.5;
const ZOOM_MID = 1.0;
const SEMANTIC_ZOOM_TOP_K = 10;

function computeLensPositions(metadata: LensNodeMetadata[]): Map<string, { x: number; y: number }> {
  const groups = new Map<string, LensNodeMetadata[]>();
  for (const m of metadata) {
    const key = `${m.side}:${m.depth}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const m of metadata) {
    const x = m.side === "prereq" ? -m.depth * LENS_X_GAP
            : m.side === "dependent" ? m.depth * LENS_X_GAP
            : 0;
    const groupSize = groups.get(`${m.side}:${m.depth}`)?.length ?? 1;
    const y = (m.rank - (groupSize - 1) / 2) * LENS_Y_GAP;
    positions.set(m.id, { x, y });
  }
  return positions;
}

const LENS_CLASSES = [
  "lensCenter", "lensPrereq", "lensDependent",
  "lensHidden", "lensEdgeBackbone", "lensEdgeSecondary"
] as const;

function applyLensMode(
  cy: cytoscape.Core,
  opts: {
    enabled: boolean;
    data: GraphLensResponse | null;
  }
) {
  // 1. Clear all lens classes
  cy.nodes().removeClass(LENS_CLASSES.join(" "));
  cy.edges().removeClass(LENS_CLASSES.join(" "));

  // 2. Exit path
  if (!opts.enabled || !opts.data) return;

  const lensNodeIds = new Set(opts.data.metadata.map((m) => m.id));
  const lensEdgeIds = new Set(opts.data.edges.map((e) => e.id));

  // 3. Hide non-lens nodes/edges
  cy.nodes().forEach((node) => {
    if (!lensNodeIds.has(node.id())) node.addClass("lensHidden");
  });
  cy.edges().forEach((edge) => {
    if (!lensEdgeIds.has(edge.id())) edge.addClass("lensHidden");
  });

  // 4. Position lens nodes (animated)
  const positions = computeLensPositions(opts.data.metadata);
  for (const [id, pos] of positions) {
    const node = cy.$id(id);
    if (!node.empty()) {
      node.stop().animate({ position: pos, duration: 400, easing: "ease-in-out-sine" });
    }
  }

  // 5. Classify nodes
  const sideById = new Map<string, string>();
  for (const m of opts.data.metadata) {
    sideById.set(m.id, m.side);
  }
  for (const id of lensNodeIds) {
    const node = cy.$id(id);
    if (node.empty()) continue;
    const side = sideById.get(id);
    if (side === "center") node.addClass("lensCenter");
    else if (side === "prereq") node.addClass("lensPrereq");
    else if (side === "dependent") node.addClass("lensDependent");
  }

  // 6. Classify edges
  for (const edgeId of lensEdgeIds) {
    const edge = cy.$id(edgeId);
    if (edge.empty()) continue;
    const type = edge.data("type");
    if (type === "PREREQUISITE_OF") edge.addClass("lensEdgeBackbone");
    else edge.addClass("lensEdgeSecondary");
  }
}

const EXPLORE_CLASSES = [
  "exploreCenter", "exploreL1", "exploreL2",
  "exploreHidden", "exploreBackbone", "exploreSecondary"
] as const;

function applyExploreMode(
  cy: cytoscape.Core,
  opts: {
    enabled: boolean;
    center: string;
    l1: Set<string>;
    l2: Set<string>;
  }
) {
  // 1. Clear all explore classes
  cy.nodes().removeClass(EXPLORE_CLASSES.join(" "));
  cy.edges().removeClass(EXPLORE_CLASSES.join(" "));

  // 2. Exit path
  if (!opts.enabled) return;

  const visibleIds = new Set([opts.center, ...opts.l1, ...opts.l2]);

  // 3. Classify nodes
  cy.nodes().forEach((node) => {
    if (node.isParent?.()) {
      node.addClass("exploreHidden");
      return;
    }
    const id = node.id();
    if (id === opts.center) node.addClass("exploreCenter");
    else if (opts.l1.has(id)) node.addClass("exploreL1");
    else if (opts.l2.has(id)) node.addClass("exploreL2");
    else node.addClass("exploreHidden");
  });

  // 4. Classify edges
  cy.edges().forEach((edge) => {
    const source = edge.data("source") as string;
    const target = edge.data("target") as string;
    if (!visibleIds.has(source) || !visibleIds.has(target)) {
      edge.addClass("exploreHidden");
      return;
    }
    // Backbone: edge touches center
    if (source === opts.center || target === opts.center) {
      edge.addClass("exploreBackbone");
    } else {
      edge.addClass("exploreSecondary");
    }
  });
}

function runExploreConcentric(
  cy: cytoscape.Core,
  opts: {
    center: string;
    l1: Set<string>;
    l2: Set<string>;
    animate: boolean;
  }
) {
  const visibleNodes = cy.nodes().not(".exploreHidden");
  if (visibleNodes.empty()) return;

  const centerWeight = 3;
  const l1Weight = 2;
  const l2Weight = 1;

  visibleNodes.layout({
    name: "concentric",
    fit: true,
    padding: 80,
    animate: opts.animate,
    animationDuration: 500,
    animationEasing: "ease-out-cubic" as string,
    concentric: (node: cytoscape.NodeSingular) => {
      const id = node.id();
      if (id === opts.center) return centerWeight;
      if (opts.l1.has(id)) return l1Weight;
      return l2Weight;
    },
    levelWidth: () => 1,
    minNodeSpacing: 50
  } as cytoscape.LayoutOptions).run();
}

function buildOnDemandElements(
  data: GraphResponse,
  hops: Map<string, number>,
  centerId: string,
  pinnedIds: ReadonlySet<string>
): cytoscape.ElementDefinition[] {
  const elements: cytoscape.ElementDefinition[] = [];
  for (const node of data.nodes) {
    const hop = hops.get(node.id);
    const cls =
      node.id === centerId
        ? "exploreCenter"
        : hop === 1
          ? "exploreL1"
          : "exploreL2";
    const classes = pinnedIds.has(node.id) ? `${cls} pinned` : cls;
    elements.push({
      group: "nodes",
      data: {
        id: node.id,
        label: node.title,
        kind: node.kind ?? "Concept",
        module: node.module ?? "",
        masteryScore: node.masteryScore ?? 0,
        pagerank: node.pagerank ?? 0
      },
      classes
    });
  }
  for (const edge of data.edges) {
    const cls =
      edge.fromConceptId === centerId || edge.toConceptId === centerId
        ? "exploreBackbone"
        : "exploreSecondary";
    elements.push({
      group: "edges",
      data: {
        id: edge.id,
        source: edge.fromConceptId,
        target: edge.toConceptId,
        type: edge.type
      },
      classes: cls
    });
  }
  return elements;
}

function runOnDemandLayout(
  cy: cytoscape.Core,
  centerId: string,
  hops: Map<string, number>
) {
  const allNodes = cy.nodes();
  if (allNodes.empty()) return;

  allNodes.layout({
    name: "concentric",
    fit: true,
    padding: 80,
    animate: false,
    concentric: (node: cytoscape.NodeSingular) => {
      const id = node.id();
      if (id === centerId) return 3;
      const hop = hops.get(id) ?? 3;
      return Math.max(0, 3 - hop);
    },
    levelWidth: () => 1,
    minNodeSpacing: 50
  } as cytoscape.LayoutOptions).run();
}

const VIEWPORT_CULL_MARGIN = 0.2;
const VIEWPORT_CULL_NODE_THRESHOLD = 500;

function applySemanticZoom(
  cy: cytoscape.Core,
  opts: {
    viewMode: GraphViewMode;
    lensData: GraphLensResponse | null;
    selectedConceptId: string | null;
    pinnedConceptIds: ReadonlySet<string>;
    topKNodeIds: ReadonlySet<string>;
  }
) {
  const zoom = cy.zoom();
  const nodeCount = cy.nodes().length;

  // Viewport culling: hide nodes far outside the visible area for large graphs
  if (nodeCount >= VIEWPORT_CULL_NODE_THRESHOLD) {
    const ext = cy.extent();
    const marginW = (ext.x2 - ext.x1) * VIEWPORT_CULL_MARGIN;
    const marginH = (ext.y2 - ext.y1) * VIEWPORT_CULL_MARGIN;
    const minX = ext.x1 - marginW;
    const maxX = ext.x2 + marginW;
    const minY = ext.y1 - marginH;
    const maxY = ext.y2 + marginH;

    cy.batch(() => {
      cy.nodes().forEach((node) => {
        if (node.isParent?.()) return;
        const pos = node.position();
        if (pos.x < minX || pos.x > maxX || pos.y < minY || pos.y > maxY) {
          node.addClass("viewportCulled");
        } else {
          node.removeClass("viewportCulled");
        }
      });
    });
  } else {
    cy.nodes().removeClass("viewportCulled");
  }

  // In lens mode, all lens nodes show labels; others already hidden
  if (opts.viewMode === "lens" && opts.lensData) {
    cy.nodes().removeClass("labelHidden");
    return;
  }

  // In explore mode, visible nodes show labels (L2 hides via Cytoscape style)
  if (opts.viewMode === "explore") {
    cy.nodes().removeClass("labelHidden");
    return;
  }

  // Close zoom: all labels visible
  if (zoom >= ZOOM_MID) {
    cy.nodes().removeClass("labelHidden");
    return;
  }

  // Far zoom: no labels
  if (zoom < ZOOM_FAR) {
    cy.batch(() => { cy.nodes().addClass("labelHidden"); });
    return;
  }

  // Mid zoom: selective labels
  cy.batch(() => {
    cy.nodes().forEach((node) => {
      const id = node.id();
      const keep = node.data("isCluster") === true
        || id === opts.selectedConceptId
        || opts.pinnedConceptIds.has(id)
        || opts.topKNodeIds.has(id);
      if (keep) node.removeClass("labelHidden");
      else node.addClass("labelHidden");
    });
  });
}

function AtlasView({
  graph,
  clusteredData,
  graphMode,
  edgeTypeAllowlist,
  edgeVisMode,
  highlightConceptIds,
  changesetHighlightConceptIds,
  hoveredRelationConceptId,
  hoveredRelationEdgeId,
  masteryOverlayEnabled,
  selectedConceptId,
  pinnedConceptIds,
  focusModeEnabled,
  focusDepth,
  viewMode,
  lensData,
  exploreCenter,
  onDemandData,
  onDemandHops,
  onSelectConcept,
  onSelectEdge,
  onExploreNavigate,
  onPinToggle,
  onCyReady
}: AtlasViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const preLensPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);
  const preExplorePositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);
  const runLayoutInWorker = useLayoutWorker();

  const onSelectRef = useRef(onSelectConcept);
  useEffect(() => {
    onSelectRef.current = onSelectConcept;
  }, [onSelectConcept]);

  const onSelectEdgeRef = useRef(onSelectEdge);
  useEffect(() => {
    onSelectEdgeRef.current = onSelectEdge;
  }, [onSelectEdge]);

  const onExploreNavigateRef = useRef(onExploreNavigate);
  useEffect(() => {
    onExploreNavigateRef.current = onExploreNavigate;
  }, [onExploreNavigate]);

  const onPinToggleRef = useRef(onPinToggle);
  useEffect(() => {
    onPinToggleRef.current = onPinToggle;
  }, [onPinToggle]);

  const graphModeRef = useRef(graphMode);
  useEffect(() => {
    graphModeRef.current = graphMode;
  }, [graphMode]);

  const onCyReadyRef = useRef(onCyReady);
  useEffect(() => {
    onCyReadyRef.current = onCyReady;
  }, [onCyReady]);

  const allowlistRef = useRef(edgeTypeAllowlist);
  useEffect(() => {
    allowlistRef.current = edgeTypeAllowlist;
  }, [edgeTypeAllowlist]);

  const edgeVisModeRef = useRef(edgeVisMode);
  useEffect(() => {
    edgeVisModeRef.current = edgeVisMode;
  }, [edgeVisMode]);

  const highlightRef = useRef(highlightConceptIds);
  useEffect(() => {
    highlightRef.current = highlightConceptIds;
  }, [highlightConceptIds]);

  const changesetHighlightRef = useRef(changesetHighlightConceptIds);
  useEffect(() => {
    changesetHighlightRef.current = changesetHighlightConceptIds;
  }, [changesetHighlightConceptIds]);

  const hoveredRelationConceptRef = useRef(hoveredRelationConceptId);
  useEffect(() => {
    hoveredRelationConceptRef.current = hoveredRelationConceptId;
  }, [hoveredRelationConceptId]);

  const hoveredRelationEdgeRef = useRef(hoveredRelationEdgeId);
  useEffect(() => {
    hoveredRelationEdgeRef.current = hoveredRelationEdgeId;
  }, [hoveredRelationEdgeId]);

  const pinnedRef = useRef(pinnedConceptIds);
  useEffect(() => {
    pinnedRef.current = pinnedConceptIds;
  }, [pinnedConceptIds]);

  const viewModeRef = useRef(viewMode);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  const lensDataRef = useRef(lensData);
  useEffect(() => {
    lensDataRef.current = lensData;
  }, [lensData]);

  const exploreCenterRef = useRef(exploreCenter);
  useEffect(() => {
    exploreCenterRef.current = exploreCenter;
  }, [exploreCenter]);

  const selectedConceptIdRef = useRef(selectedConceptId);
  useEffect(() => {
    selectedConceptIdRef.current = selectedConceptId;
  }, [selectedConceptId]);

  const topKRef = useRef<Set<string>>(new Set());

  const elements = useMemo(
    () => (graph && graphMode !== "onDemand" ? buildElements(graph, clusteredData, graphMode) : []),
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
            "font-size": "12px",
            "text-wrap": "wrap",
            "text-max-width": "120px",
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.9,
            "text-background-padding": "3px",
            "text-background-shape": "roundrectangle",
            "background-color": "#111827",
            width: "mapData(pagerank, 0, 0.05, 30, 50)",
            height: "mapData(pagerank, 0, 0.05, 30, 50)",
            color: "#0f172a",
            "transition-property": "opacity, background-color, border-width, border-color, width, height",
            "transition-duration": 300,
            "transition-timing-function": "ease-in-out-sine"
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
          selector: "node.selectPulse",
          style: {
            "border-width": 5,
            "border-color": "#3b82f6",
            "overlay-opacity": 0.1,
            "overlay-color": "#3b82f6"
          }
        },
        {
          selector: "node.relationshipHover",
          style: {
            "border-width": 5,
            "border-color": "#f97316",
            "overlay-opacity": 0.12,
            "overlay-color": "#f97316",
            opacity: 1
          }
        },
        {
          selector: "node.edgeDraftSource",
          style: {
            "border-width": 4,
            "border-color": "#f59e0b",
            "border-style": "double"
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
            "curve-style": "bezier",
            "transition-property": "opacity, line-color, width",
            "transition-duration": 300,
            "transition-timing-function": "ease-in-out-sine"
          }
        },
        {
          selector: "edge.dimmed",
          style: {
            opacity: 0.15
          }
        },
        {
          selector: "edge.relationshipHover",
          style: {
            width: 4,
            "line-color": "#f97316",
            "target-arrow-color": "#f97316",
            opacity: 1
          }
        },
        {
          selector: "node.lensCenter",
          style: {
            "background-color": "#2563eb",
            "border-width": 4,
            "border-color": "#1d4ed8",
            width: 40,
            height: 40,
            "font-weight": "bold" as cytoscape.Css.FontWeight
          }
        },
        {
          selector: "node.lensPrereq",
          style: {
            "background-color": "#0d9488",
            "border-width": 2,
            "border-color": "#0f766e"
          }
        },
        {
          selector: "node.lensDependent",
          style: {
            "background-color": "#7c3aed",
            "border-width": 2,
            "border-color": "#6d28d9"
          }
        },
        {
          selector: "node.lensHidden",
          style: {
            display: "none"
          }
        },
        {
          selector: "edge.lensEdgeBackbone",
          style: {
            width: 4,
            "line-color": "#334155",
            "target-arrow-color": "#334155",
            opacity: 1
          }
        },
        {
          selector: "edge.lensEdgeSecondary",
          style: {
            width: 1.5,
            "line-color": "#cbd5e1",
            "target-arrow-color": "#cbd5e1",
            "line-style": "dashed",
            opacity: 0.6
          }
        },
        {
          selector: "edge.lensHidden",
          style: {
            display: "none"
          }
        },
        {
          selector: "node.exploreCenter",
          style: {
            "background-color": "#2563eb",
            "border-width": 6,
            "border-color": "#1d4ed8",
            width: 50,
            height: 50,
            "font-weight": "bold" as cytoscape.Css.FontWeight,
            "font-size": "14px"
          }
        },
        {
          selector: "node.exploreL1",
          style: {
            "background-color": "#0d9488",
            "border-width": 2,
            "border-color": "#0f766e",
            width: 30,
            height: 30,
            opacity: 1
          }
        },
        {
          selector: "node.exploreL2",
          style: {
            "background-color": "#64748b",
            "border-width": 1,
            "border-color": "#475569",
            width: 22,
            height: 22,
            opacity: 0.4,
            "text-opacity": 0,
            "text-background-opacity": 0
          }
        },
        {
          selector: "node.exploreHidden",
          style: {
            display: "none"
          }
        },
        {
          selector: "edge.exploreBackbone",
          style: {
            width: 3,
            "line-color": "#334155",
            "target-arrow-color": "#334155",
            opacity: 1
          }
        },
        {
          selector: "edge.exploreSecondary",
          style: {
            width: 1.5,
            "line-color": "#94a3b8",
            "target-arrow-color": "#94a3b8",
            opacity: 0.5
          }
        },
        {
          selector: "edge.exploreHidden",
          style: {
            display: "none"
          }
        },
        {
          selector: "node.viewportCulled",
          style: {
            display: "none"
          }
        },
        {
          selector: "$node > node",
          style: {
            "background-color": "#f1f5f9",
            "border-width": 1,
            "border-color": "#cbd5e1",
            shape: "roundrectangle",
            padding: "12px",
            label: "data(label)",
            "font-size": "13px",
            "text-valign": "top",
            "text-halign": "center",
            color: "#475569"
          }
        },
        {
          selector: "node.labelHidden",
          style: {
            "text-opacity": 0,
            "text-background-opacity": 0
          }
        }
      ],
      layout: { name: "fcose", animate: false, fit: true } as cytoscape.LayoutOptions
    });

    const onTapNode = (evt: cytoscape.EventObject) => {
      const node = evt.target;
      if (node.isParent?.()) return;
      const id = node.id();
      if (typeof id !== "string" || id.length === 0) return;

      // On-demand explore: Shift+click = pin toggle, regular click = navigate
      if (graphModeRef.current === "onDemand" && viewModeRef.current === "explore") {
        if (evt.originalEvent?.shiftKey) {
          onPinToggleRef.current?.(id);
        } else {
          onSelectRef.current(id);
          onExploreNavigateRef.current?.(id);
        }
        return;
      }

      node.flashClass("selectPulse", 400);
      onSelectRef.current(id);
    };

    const onTapEdge = (evt: cytoscape.EventObject) => {
      const id = evt.target.id();
      if (typeof id === "string" && id.length > 0) onSelectEdgeRef.current(id);
    };

    const onMouseOver = (evt: cytoscape.EventObject) => {
      const node = evt.target;
      if (node.isParent?.()) return;
      node.stop().animate({
        style: { width: 38, height: 38 },
        duration: 150,
        easing: "ease-out-cubic"
      });
    };

    const onMouseOut = (evt: cytoscape.EventObject) => {
      const node = evt.target;
      if (node.isParent?.()) return;
      node.stop().animate({
        style: { width: 30, height: 30 },
        duration: 150,
        easing: "ease-out-cubic"
      });
    };

    const onDbltapNode = (evt: cytoscape.EventObject) => {
      if (viewModeRef.current !== "explore") return;
      const node = evt.target;
      if (node.isParent?.()) return;
      const id = node.id();
      if (typeof id === "string" && id.length > 0) {
        onExploreNavigateRef.current?.(id);
      }
    };

    cy.on("tap", "node", onTapNode);
    cy.on("dbltap", "node", onDbltapNode);
    cy.on("tap", "edge", onTapEdge);
    cy.on("mouseover", "node", onMouseOver);
    cy.on("mouseout", "node", onMouseOut);
    cyRef.current = cy;
    onCyReadyRef.current?.(cy);

    if (import.meta.env.DEV) window.__CY__ = cy;

    let rafId: number | null = null;
    const onViewport = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        applySemanticZoom(cy, {
          viewMode: viewModeRef.current,
          lensData: lensDataRef.current,
          selectedConceptId: selectedConceptIdRef.current,
          pinnedConceptIds: pinnedRef.current,
          topKNodeIds: topKRef.current
        });
      });
    };
    cy.on("viewport", onViewport);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      cy.removeListener("viewport", onViewport);
      if (import.meta.env.DEV && window.__CY__ === cy) delete window.__CY__;
      cy.removeListener("tap", "node", onTapNode);
      cy.removeListener("dbltap", "node", onDbltapNode);
      cy.removeListener("tap", "edge", onTapEdge);
      cy.removeListener("mouseover", "node", onMouseOver);
      cy.removeListener("mouseout", "node", onMouseOut);
      cy.destroy();
      cyRef.current = null;
      onCyReadyRef.current?.(null);
    };
  }, [onCyReady]);

  useEffect(() => {
    const cyVal = cyRef.current;
    if (!cyVal) return;
    const cy: cytoscape.Core = cyVal;

    preLensPositionsRef.current = null;
    preExplorePositionsRef.current = null;

    cy.elements().remove();
    if (elements.length === 0) return;

    cy.add(elements);

    const nodeCount = cy.nodes().length;
    const useWorker = nodeCount > WORKER_LAYOUT_THRESHOLD && typeof Worker !== "undefined";

    function applyPostLayout() {
      applyEdgeFilter(cy, allowlistRef.current, edgeVisModeRef.current);
      applyConceptHighlight(cy, highlightRef.current);
      applyChangesetHighlight(cy, changesetHighlightRef.current);
      applyRelationshipHover(
        cy,
        hoveredRelationConceptRef.current,
        hoveredRelationEdgeRef.current
      );
      applyPinnedNodes(cy, pinnedRef.current);

      // Compute top-K by degree for semantic zoom
      const leafNodes = cy.nodes().filter((n: cytoscape.NodeSingular) => !n.isParent());
      const sorted = leafNodes.sort((a: cytoscape.NodeSingular, b: cytoscape.NodeSingular) =>
        b.degree(false) - a.degree(false)
      );
      const topK = new Set<string>();
      const limit = Math.min(SEMANTIC_ZOOM_TOP_K, sorted.length);
      for (let i = 0; i < limit; i++) {
        topK.add(sorted[i].id());
      }
      topKRef.current = topK;

      applySemanticZoom(cy, {
        viewMode: viewModeRef.current,
        lensData: lensDataRef.current,
        selectedConceptId: selectedConceptIdRef.current,
        pinnedConceptIds: pinnedRef.current,
        topKNodeIds: topK
      });

      // If currently in lens mode, save fresh positions and reapply lens
      if (viewModeRef.current === "lens" && lensDataRef.current) {
        const saved = new Map<string, { x: number; y: number }>();
        cy.nodes().forEach((n) => {
          const pos = n.position();
          saved.set(n.id(), { x: pos.x, y: pos.y });
        });
        preLensPositionsRef.current = saved;
        applyLensMode(cy, { enabled: true, data: lensDataRef.current });
        cy.animate({ fit: { eles: cy.nodes().not(".lensHidden"), padding: 60 }, duration: 400 });
      }
    }

    if (useWorker) {
      // Off-main-thread layout for large graphs
      const workerNodes = cy.nodes().map((n) => ({
        group: "nodes" as const,
        data: n.data() as { id: string; parent?: string }
      }));
      const workerEdges = cy.edges().map((e) => ({
        group: "edges" as const,
        data: e.data() as { id: string; source: string; target: string }
      }));
      runLayoutInWorker({ nodes: workerNodes, edges: workerEdges }, (positions) => {
        if (cyRef.current !== cy) return; // stale
        cy.batch(() => {
          for (const { id, x, y } of positions) {
            const node = cy.$id(id);
            if (!node.empty()) node.position({ x, y });
          }
        });
        cy.fit();
        applyPostLayout();
      });
    } else {
      cy.layout({
        name: "fcose",
        animate: (elements.length <= ANIM_NODE_THRESHOLD ? "end" : false),
        animationDuration: 600,
        animationEasing: "ease-out-cubic",
        fit: true
      } as cytoscape.LayoutOptions).run();
      applyPostLayout();
    }
  }, [elements, runLayoutInWorker]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applyEdgeFilter(cy, edgeTypeAllowlist, edgeVisMode);
  }, [edgeTypeAllowlist, edgeVisMode]);

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
    applyRelationshipHover(cy, hoveredRelationConceptId, hoveredRelationEdgeId);
  }, [hoveredRelationConceptId, hoveredRelationEdgeId]);

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

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    if (viewMode === "lens" && lensData) {
      // Save current positions before repositioning
      if (!preLensPositionsRef.current) {
        const saved = new Map<string, { x: number; y: number }>();
        cy.nodes().forEach((n) => {
          const pos = n.position();
          saved.set(n.id(), { x: pos.x, y: pos.y });
        });
        preLensPositionsRef.current = saved;
      }
      applyLensMode(cy, { enabled: true, data: lensData });
      cy.animate({ fit: { eles: cy.nodes().not(".lensHidden"), padding: 60 }, duration: 400 });
    } else {
      // Clear lens mode
      applyLensMode(cy, { enabled: false, data: null });
      // Restore saved positions
      if (preLensPositionsRef.current) {
        for (const [id, pos] of preLensPositionsRef.current) {
          const node = cy.$id(id);
          if (!node.empty()) {
            node.stop().animate({ position: pos, duration: 400, easing: "ease-in-out-sine" });
          }
        }
        preLensPositionsRef.current = null;
        cy.animate({ fit: { eles: cy.elements(), padding: 50 }, duration: 400 });
      }
    }
  }, [viewMode, lensData]);

  // Full-graph explore mode (skip for on-demand)
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (graphMode === "onDemand") return;

    if (viewMode === "explore" && exploreCenter && graph) {
      // Save current positions before repositioning
      if (!preExplorePositionsRef.current) {
        const saved = new Map<string, { x: number; y: number }>();
        cy.nodes().forEach((n) => {
          const pos = n.position();
          saved.set(n.id(), { x: pos.x, y: pos.y });
        });
        preExplorePositionsRef.current = saved;
      }

      const allowedTypes = new Set<string>();
      for (const t of edgeTypeAllowlist) allowedTypes.add(t);

      const neighborhood = collectTieredNeighborhood(graph.edges, exploreCenter, allowedTypes);
      applyExploreMode(cy, {
        enabled: true,
        center: neighborhood.center,
        l1: neighborhood.l1,
        l2: neighborhood.l2
      });
      runExploreConcentric(cy, {
        center: neighborhood.center,
        l1: neighborhood.l1,
        l2: neighborhood.l2,
        animate: true
      });
    } else {
      // Clear explore mode
      applyExploreMode(cy, { enabled: false, center: "", l1: new Set(), l2: new Set() });
      // Restore saved positions
      if (preExplorePositionsRef.current) {
        for (const [id, pos] of preExplorePositionsRef.current) {
          const node = cy.$id(id);
          if (!node.empty()) {
            node.stop().animate({ position: pos, duration: 400, easing: "ease-in-out-sine" });
          }
        }
        preExplorePositionsRef.current = null;
        cy.animate({ fit: { eles: cy.elements(), padding: 50 }, duration: 400 });
      }
    }
  }, [viewMode, exploreCenter, graph, edgeTypeAllowlist, graphMode]);

  // On-demand explore: replace elements when data arrives
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (graphMode !== "onDemand") return;
    if (viewMode !== "explore") return;
    if (!onDemandData || !exploreCenter) return;

    cy.elements().remove();
    const elems = buildOnDemandElements(onDemandData, onDemandHops, exploreCenter, pinnedConceptIds);
    cy.add(elems);
    runOnDemandLayout(cy, exploreCenter, onDemandHops);
  }, [viewMode, graphMode, onDemandData, exploreCenter, onDemandHops, pinnedConceptIds]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applySemanticZoom(cy, {
      viewMode,
      lensData,
      selectedConceptId,
      pinnedConceptIds,
      topKNodeIds: topKRef.current
    });
  }, [elements, selectedConceptId, pinnedConceptIds, viewMode, lensData]);

  useEffect(() => {
    const el = containerRef.current;
    const cy = cyRef.current;
    if (!el || !cy) return;
    const ro = new ResizeObserver(() => cy.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return <div className="atlas" data-testid="atlas" ref={containerRef} />;
}


export default function App() {
  const {
    shellRef,
    leftDividerProps,
    rightDividerProps,
    gridTemplateColumns,
    toggleLeftPane,
    toggleRightPane
  } = usePanelResize();
  const atlasCyRef = useRef<cytoscape.Core | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const { flags, setFlag, resetFlags } = useUiFlags();
  const isDesignV2 = flags.designV2Enabled;
  const isRightPaneV2 = isDesignV2 && flags.rightPaneV2Enabled;
  const isConceptInspectorV2 = isDesignV2 && flags.conceptInspectorV2Enabled;
  const autoLensGateEnabled = isDesignV2 && flags.autoLensOnSelectEnabled;
  const isTutorDrawerEnabled = isDesignV2 && flags.tutorDrawerEnabled;
  const isWorkbenchEnabled = isDesignV2;
  const isV2PaneLabel = isRightPaneV2 || isConceptInspectorV2;

  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [graphMode, setGraphMode] = useState<GraphMode>("onDemand");
  const [clusteredData, setClusteredData] = useState<GraphClusteredResponse | null>(null);

  const [leftTab, setLeftTab] = useState<"browse" | "filters">("browse");

  const [query, setQuery] = useState("");
  const [universalSearch, setUniversalSearch] = useState<SearchUniversalResponse | null>(null);
  const [universalSearchError, setUniversalSearchError] = useState<string | null>(null);
  const [universalSearchLoading, setUniversalSearchLoading] = useState(false);
  const [searchScopeOverride, setSearchScopeOverride] = useState<"neighborhood" | "global" | null>(null);
  const [searchFacetAllowlist, setSearchFacetAllowlist] = useState<Set<"concepts" | "sources" | "evidence">>(
    () => new Set(["concepts", "sources", "evidence"])
  );

  const [selectedEdgeTypes, setSelectedEdgeTypes] = useState<Set<EdgeType>>(getDefaultEdgeTypes);

  const [masteryOverlayEnabled, setMasteryOverlayEnabled] = useState(false);

  const [viewMode, setViewMode] = useState<GraphViewMode>("explore");
  const [userOverrodeAutoView, setUserOverrodeAutoView] = useState(true);
  const focusModeEnabled = viewMode === "focus";
  const [focusDepth, setFocusDepth] = useState(1);
  const [pinnedConceptIds, setPinnedConceptIds] = useState<Set<string>>(() => new Set());

  const [lensData, setLensData] = useState<GraphLensResponse | null>(null);
  const [lensLoading, setLensLoading] = useState(false);
  const [lensError, setLensError] = useState<string | null>(null);
  const [lensRadius, setLensRadius] = useState(1);

  const [exploreCenter, setExploreCenter] = useState<string | null>(null);
  const [exploreHistory, setExploreHistory] = useState<string[]>([]);
  const [exploreFuture, setExploreFuture] = useState<string[]>([]);

  const onDemandTypeFilters = useMemo(() => Array.from(selectedEdgeTypes), [selectedEdgeTypes]);
  const {
    data: onDemandData,
    hops: onDemandHops,
    loading: onDemandLoading,
    error: onDemandError,
    capped: onDemandCapped,
    fetchNeighborhood,
    clearCache: clearOnDemandCache
  } = useOnDemandNeighborhood({
    depth: 2,
    typeFilters: onDemandTypeFilters,
    maxNodes: 200,
    maxEdges: 500
  });

  // When edge filters change in on-demand mode, clear cache and refetch current center
  const prevEdgeTypesRef = useRef(onDemandTypeFilters);
  useEffect(() => {
    if (prevEdgeTypesRef.current === onDemandTypeFilters) return;
    prevEdgeTypesRef.current = onDemandTypeFilters;
    if (graphMode === "onDemand" && exploreCenter) {
      clearOnDemandCache();
      fetchNeighborhood(exploreCenter);
    }
  }, [onDemandTypeFilters, graphMode, exploreCenter, clearOnDemandCache, fetchNeighborhood]);

  const [edgeVisMode, setEdgeVisMode] = useState<EdgeVisMode>("filtered");
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [debugZoom, setDebugZoom] = useState(1);

  const [activeRightTab, setActiveRightTab] = useState<
    "concept" | "source" | "evidence" | "inbox" | "review" | "tutor"
  >("concept");
  const [workbenchMode, setWorkbenchMode] = useState<"inbox" | "review" | null>(null);
  const [inboxPendingCount, setInboxPendingCount] = useState<number | null>(null);
  const [reviewDueCount, setReviewDueCount] = useState<number | null>(null);

  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get("conceptId");
  });

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourcesRefreshToken, setSourcesRefreshToken] = useState(0);

  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredRelationConceptId, setHoveredRelationConceptId] = useState<string | null>(null);
  const [hoveredRelationEdgeId, setHoveredRelationEdgeId] = useState<string | null>(null);
  const [edgeEvidence, setEdgeEvidence] = useState<GetEdgeEvidenceResponse | null>(null);
  const [edgeEvidenceLoading, setEdgeEvidenceLoading] = useState(false);
  const [edgeEvidenceError, setEdgeEvidenceError] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const [concept, setConcept] = useState<Concept | null>(null);
  const [conceptError, setConceptError] = useState<string | null>(null);
  const [conceptLoading, setConceptLoading] = useState(false);

  const [tutorHighlightedConceptIds, setTutorHighlightedConceptIds] = useState<Set<string>>(
    () => new Set()
  );
  const [tutorDrawerOpen, setTutorDrawerOpen] = useState(false);
  const [tutorSeedQuestion, setTutorSeedQuestion] = useState("");
  const [tutorSeedQuestionToken, setTutorSeedQuestionToken] = useState(0);

  const [captureOpen, setCaptureOpen] = useState(false);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [trainingPanelOpen, setTrainingPanelOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  const [lensRefreshToken, setLensRefreshToken] = useState(0);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("pointer");
  const [edgeDraftState, setEdgeDraftState] = useState<EdgeDraftState>({ phase: "idle" });
  const [lensEditError, setLensEditError] = useState<string | null>(null);
  const [lensEditSaving, setLensEditSaving] = useState(false);
  const [addConceptOpen, setAddConceptOpen] = useState(false);
  const [addConceptTitle, setAddConceptTitle] = useState("");

  const [changesetHighlightConceptIds, setChangesetHighlightConceptIds] = useState<Set<string>>(
    () => new Set()
  );
  const [inspectorActionRequest, setInspectorActionRequest] = useState<{
    type: "new_note" | "generate_quiz" | "add_relation";
    token: number;
  } | null>(null);

  useEffect(() => {
    if (activeRightTab !== "inbox") {
      setChangesetHighlightConceptIds(new Set());
    }
  }, [activeRightTab]);

  const refreshWorkbenchCounts = useCallback(async () => {
    try {
      const [changesetsRes, reviewRes] = await Promise.all([
        getChangesets(),
        getReviewDue(100)
      ]);
      setInboxPendingCount(changesetsRes.changesets.filter((c) => c.status === "draft").length);
      setReviewDueCount(reviewRes.items.length);
    } catch {
      setInboxPendingCount(null);
      setReviewDueCount(null);
    }
  }, []);

  useEffect(() => {
    if (!isWorkbenchEnabled) return;
    void refreshWorkbenchCounts();
  }, [isWorkbenchEnabled, refreshWorkbenchCounts]);

  useEffect(() => {
    if (!isWorkbenchEnabled) {
      setWorkbenchMode(null);
      return;
    }
    if (activeRightTab === "inbox" || activeRightTab === "review") {
      setActiveRightTab("concept");
    }
  }, [activeRightTab, isWorkbenchEnabled]);

  useEffect(() => {
    if (!isTutorDrawerEnabled) {
      setTutorDrawerOpen(false);
      return;
    }
    if (activeRightTab === "tutor") {
      setActiveRightTab("concept");
    }
  }, [activeRightTab, isTutorDrawerEnabled]);

  useEffect(() => {
    if (!snackbarMessage) return;
    const timer = window.setTimeout(() => setSnackbarMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [snackbarMessage]);

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

  const handleCyReady = useCallback((cy: cytoscape.Core | null) => {
    if (atlasCyRef.current) {
      atlasCyRef.current.removeListener("viewport");
    }
    atlasCyRef.current = cy;
    if (cy) {
      cy.on("viewport", () => setDebugZoom(cy.zoom()));
    }
  }, []);

  useEffect(() => {
    const cy = atlasCyRef.current;
    if (!cy) return;
    cy.autoungrabify(interactionMode === "pan");
  }, [interactionMode]);

  const focusConceptInGraph = useCallback((conceptId: string) => {
    const cy = atlasCyRef.current;
    if (!cy) return;

    cy.nodes().removeClass("searchFocused");
    const node = cy.$id(conceptId);
    if (node.empty()) return;

    node.addClass("searchFocused");
    cy.animate({ fit: { eles: node, padding: 80 }, duration: 350 });

    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => {
      node.removeClass("searchFocused");
      focusTimerRef.current = null;
    }, 1400);
  }, []);

  function selectAndFocusConcept(id: string) {
    selectConcept(id, "tree_click");
    if (viewMode === "explore") {
      handleExploreNavigate(id);
    } else {
      focusConceptInGraph(id);
    }
  }

  function navigateToConceptInGraph(id: string, source: SelectionSource = "search_show_in_graph") {
    if (graphMode === "onDemand") {
      if (viewMode !== "explore") {
        // path 2a: entering explore mode fresh
        selectConcept(id, source);
        setUserOverrodeAutoView(true);
        setViewMode("explore");
        setExploreCenter(id);
        setExploreHistory([]);
        setExploreFuture([]);
        fetchNeighborhood(id);
      } else {
        // path 2b: already in explore — handleExploreNavigate does selectConcept + fetchNeighborhood
        handleExploreNavigate(id);
      }
    } else {
      selectConcept(id, source);
      focusConceptInGraph(id);
    }
  }

  const openTutorDrawer = useCallback((seedQuestion?: string) => {
    if (typeof seedQuestion === "string" && seedQuestion.trim().length > 0) {
      setTutorSeedQuestion(seedQuestion.trim());
      setTutorSeedQuestionToken((v) => v + 1);
    }
    setTutorDrawerOpen(true);
  }, []);

  const openWorkbench = useCallback((mode: "inbox" | "review") => {
    if (isWorkbenchEnabled) {
      setWorkbenchMode(mode);
      void refreshWorkbenchCounts();
      return;
    }
    setActiveRightTab(mode);
  }, [isWorkbenchEnabled, refreshWorkbenchCounts]);

  const triggerInspectorAction = useCallback(
    (type: "new_note" | "generate_quiz" | "add_relation") => {
      if (!selectedConceptId) {
        setSnackbarMessage("Select a concept first");
        return;
      }
      setActiveRightTab("concept");
      if (!isConceptInspectorV2) {
        setSnackbarMessage("Enable Concept Inspector V2 to use this action");
        return;
      }
      setInspectorActionRequest({ type, token: Date.now() });
    },
    [isConceptInspectorV2, selectedConceptId]
  );

  const clearGraphSelection = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("conceptId");
    const nextUrl = params.toString().length > 0
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.pushState({}, "", nextUrl);
    setSelectedConceptId(null);
    setSelectedEdgeId(null);
    setSelectedSourceId(null);
    setHoveredRelationConceptId(null);
    setHoveredRelationEdgeId(null);
    setActiveRightTab("concept");
  }, []);

  const closeTopLayer = useCallback((): boolean => {
    if (shortcutsHelpOpen) {
      setShortcutsHelpOpen(false);
      return true;
    }
    if (commandPaletteOpen) {
      setCommandPaletteOpen(false);
      return true;
    }
    if (trainingPanelOpen) {
      setTrainingPanelOpen(false);
      return true;
    }
    if (workbenchMode) {
      setWorkbenchMode(null);
      return true;
    }
    if (tutorDrawerOpen) {
      setTutorDrawerOpen(false);
      return true;
    }
    if (captureOpen) {
      setCaptureOpen(false);
      return true;
    }
    if (addConceptOpen) {
      setAddConceptOpen(false);
      return true;
    }
    if (edgeDraftState.phase !== "idle") {
      cancelEdgeDraft();
      return true;
    }
    return false;
  }, [
    addConceptOpen,
    shortcutsHelpOpen,
    captureOpen,
    commandPaletteOpen,
    edgeDraftState.phase,
    tutorDrawerOpen,
    workbenchMode,
    trainingPanelOpen
  ]);

  const handleShowShortcuts = useCallback(() => {
    setShortcutsHelpOpen(true);
  }, []);

  const exploreBackRef = useRef(() => handleExploreBack());
  exploreBackRef.current = () => handleExploreBack();
  const exploreForwardRef = useRef(() => handleExploreForward());
  exploreForwardRef.current = () => handleExploreForward();
  const exploreExitRef = useRef(() => handleViewModeChange("classic"));
  exploreExitRef.current = () => handleViewModeChange("classic");

  // Cmd+K command palette, core shortcuts, and layer-close escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      if (activeRightTab === "source") return;

      const key = e.key;

      if ((e.metaKey || e.ctrlKey) && key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }
      if (key === "?") {
        e.preventDefault();
        handleShowShortcuts();
        return;
      }

      if (key === "n") {
        e.preventDefault();
        triggerInspectorAction("new_note");
        return;
      }
      if (key === "q") {
        e.preventDefault();
        triggerInspectorAction("generate_quiz");
        return;
      }
      if (key === "e") {
        e.preventDefault();
        triggerInspectorAction("add_relation");
        return;
      }
      if (key === "[") {
        e.preventDefault();
        toggleLeftPane();
        return;
      }
      if (key === "]") {
        e.preventDefault();
        toggleRightPane();
        return;
      }
      if (key === "Backspace" && viewMode === "explore") {
        e.preventDefault();
        exploreBackRef.current();
        return;
      }
      if (key === "Escape") {
        e.preventDefault();
        if (closeTopLayer()) return;
        if (viewMode === "explore") {
          exploreExitRef.current();
          // Also exit on-demand mode since it has no full graph to fall back to
          setGraphMode((m) => (m === "onDemand" ? "clustered" : m));
          return;
        }
        clearGraphSelection();
        setTutorHighlightedConceptIds(new Set());
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeTopLayer,
    clearGraphSelection,
    activeRightTab,
    handleShowShortcuts,
    toggleLeftPane,
    toggleRightPane,
    triggerInspectorAction,
    viewMode
  ]);

  const commandPaletteActions = useMemo(
    () => [
      {
        id: "start-training",
        label: "Start training session",
        onSelect: () => setTrainingPanelOpen(true)
      },
      {
        id: "open-inbox",
        label: "Open Inbox",
        onSelect: () => openWorkbench("inbox")
      },
      {
        id: "open-review-queue",
        label: "Open Review Queue",
        onSelect: () => openWorkbench("review")
      },
      {
        id: "new-note",
        label: "New Note",
        onSelect: () => triggerInspectorAction("new_note")
      },
      {
        id: "generate-quiz-selection",
        label: "Generate Quiz",
        onSelect: () => triggerInspectorAction("generate_quiz")
      },
      {
        id: "add-relation-selection",
        label: "Add relation",
        onSelect: () => triggerInspectorAction("add_relation")
      },
      {
        id: "ask-tutor-selection",
        label: "Ask Tutor about selection",
        onSelect: () => {
          if (isTutorDrawerEnabled) {
            openTutorDrawer();
          } else {
            setActiveRightTab("tutor");
          }
        }
      },
      {
        id: "show-shortcuts",
        label: "Show shortcuts",
        onSelect: () => {
          handleShowShortcuts();
        }
      }
    ],
    [
      isTutorDrawerEnabled,
      openTutorDrawer,
      openWorkbench,
      handleShowShortcuts,
      triggerInspectorAction
    ]
  );

  useEffect(() => {
    if (graphMode === "onDemand") return;
    let cancelled = false;
    setGraphError(null);

    getGraph()
      .then((g) => {
        if (cancelled) return;
        setGraph(g);
        getGraphClustered()
          .then((c) => {
            if (!cancelled) setClusteredData(c);
          })
          .catch(() => {});
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setGraphError(err instanceof Error ? err.message : "Failed to load graph");
      });

    return () => {
      cancelled = true;
    };
  }, [graphMode]);

  async function refreshGraph() {
    invalidateGraphCache();
    setGraphError(null);
    try {
      const g = await getGraph();
      setGraph(g);
    } catch (err) {
      setGraphError(err instanceof Error ? err.message : "Failed to load graph");
    }
  }

  useEffect(() => {
    if (viewMode !== "lens" || !selectedConceptId) {
      setLensData(null);
      setLensError(null);
      setLensLoading(false);
      return;
    }

    let cancelled = false;
    setLensLoading(true);
    setLensError(null);

    getGraphLens(selectedConceptId, lensRadius)
      .then((res) => {
        if (cancelled) return;
        setLensData(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLensData(null);
        setLensError(err instanceof Error ? err.message : "Failed to load lens");
      })
      .finally(() => {
        if (cancelled) return;
        setLensLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewMode, selectedConceptId, lensRadius, lensRefreshToken]);

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

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setUniversalSearch(null);
      setUniversalSearchError(null);
      setUniversalSearchLoading(false);
      return;
    }

    let cancelled = false;
    setUniversalSearchLoading(true);
    setUniversalSearchError(null);

    const timer = window.setTimeout(() => {
      getUniversalSearch(q, 20)
        .then((res) => {
          if (cancelled) return;
          setUniversalSearch(res);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setUniversalSearch(null);
          setUniversalSearchError(err instanceof Error ? err.message : "Search failed");
        })
        .finally(() => {
          if (cancelled) return;
          setUniversalSearchLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    setSearchScopeOverride(null);
  }, [selectedConceptId]);

  const effectiveSearchScope: "neighborhood" | "global" = selectedConceptId
    ? (searchScopeOverride ?? "neighborhood")
    : "global";

  const neighborhoodConceptIds = useMemo(() => {
    if (!graph || !selectedConceptId) return null;
    return collectWithinHops(graph.edges, selectedConceptId, 2);
  }, [graph, selectedConceptId]);

  const scopedUniversalSearch = useMemo(() => {
    if (!universalSearch) return null;
    if (effectiveSearchScope !== "neighborhood" || !neighborhoodConceptIds) return universalSearch;

    const within = (conceptIds: string[]) => conceptIds.some((id) => neighborhoodConceptIds.has(id));

    return {
      concepts: universalSearch.concepts.filter((c) => neighborhoodConceptIds.has(c.id)),
      sources: universalSearch.sources.filter((s) => within(s.conceptIds)),
      evidence: universalSearch.evidence.filter((e) => within(e.conceptIds))
    };
  }, [effectiveSearchScope, neighborhoodConceptIds, universalSearch]);

  const facetCounts = useMemo(() => {
    const data = scopedUniversalSearch ?? { concepts: [], sources: [], evidence: [] };
    return {
      concepts: data.concepts.length,
      sources: data.sources.length,
      evidence: data.evidence.length
    };
  }, [scopedUniversalSearch]);

  function toggleSearchFacet(facet: "concepts" | "sources" | "evidence") {
    setSearchFacetAllowlist((prev) => {
      const next = new Set(prev);
      if (next.has(facet)) next.delete(facet);
      else next.add(facet);
      return next;
    });
  }

  function selectConcept(id: string, source: SelectionSource = "programmatic") {
    const params = new URLSearchParams(window.location.search);
    params.set("conceptId", id);
    window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
    setSelectedConceptId(id);
    setSelectedEdgeId(null);
    setSelectedSourceId(null);
    setHoveredRelationConceptId(null);
    setHoveredRelationEdgeId(null);
    setActiveRightTab("concept");

    if (autoLensGateEnabled && !userOverrodeAutoView && source !== "programmatic" && graphMode !== "onDemand") {
      setViewMode("lens");
      setEdgeVisMode("prereq_only");
    }
  }

  function selectEdge(id: string) {
    setSelectedEdgeId(id);
    setActiveRightTab("evidence");
  }

  function selectEdgeWithoutPanel(id: string) {
    setSelectedEdgeId(id);
  }

  async function createDraftEdge(input: PostDraftEdgeRequest): Promise<void> {
    const res = await postDraftEdge(input);
    openWorkbench("inbox");
    setChangesetHighlightConceptIds(new Set([input.fromConceptId, input.toConceptId]));
    setSnackbarMessage("Draft edge added to Inbox");
    setHoveredRelationConceptId(null);
    setHoveredRelationEdgeId(null);
    if (!res.item || !res.changeset) {
      throw new Error("Failed to stage draft edge");
    }
  }

  function cancelEdgeDraft() {
    setEdgeDraftState({ phase: "idle" });
    const cy = atlasCyRef.current;
    if (cy) cy.nodes().removeClass("edgeDraftSource");
  }

  function handleAtlasConceptSelect(id: string) {
    if (viewMode === "lens" && edgeDraftState.phase !== "idle") {
      handleLensNodeTap(id);
    } else {
      selectConcept(id, "atlas_click");
    }
  }

  function handleViewModeChange(nextMode: GraphViewMode) {
    if (autoLensGateEnabled && nextMode !== viewMode) {
      setUserOverrodeAutoView(true);
    }
    // When entering explore, center on currently selected concept
    if (nextMode === "explore") {
      const centerId = selectedConceptId ?? graph?.nodes[0]?.id ?? null;
      setExploreCenter(centerId);
      setExploreHistory([]);
      setExploreFuture([]);
      if (graphMode === "onDemand" && centerId) {
        fetchNeighborhood(centerId);
      }
    }
    // When leaving explore, clear state
    if (viewMode === "explore" && nextMode !== "explore") {
      setExploreCenter(null);
      setExploreHistory([]);
      setExploreFuture([]);
    }
    setViewMode(nextMode);
  }

  function handleExploreNavigate(targetId: string) {
    if (exploreCenter) {
      setExploreHistory((prev) => [...prev, exploreCenter]);
    }
    setExploreFuture([]);
    setExploreCenter(targetId);
    selectConcept(targetId, "programmatic");
    if (graphMode === "onDemand") {
      fetchNeighborhood(targetId);
    }
  }

  function handleExploreBack() {
    setExploreHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const previousCenter = next.pop()!;
      if (exploreCenter) {
        setExploreFuture((f) => [...f, exploreCenter]);
      }
      setExploreCenter(previousCenter);
      selectConcept(previousCenter, "programmatic");
      if (graphMode === "onDemand") {
        fetchNeighborhood(previousCenter);
      }
      return next;
    });
  }

  function handleExploreForward() {
    setExploreFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const forwardCenter = next.pop()!;
      if (exploreCenter) {
        setExploreHistory((h) => [...h, exploreCenter]);
      }
      setExploreCenter(forwardCenter);
      selectConcept(forwardCenter, "programmatic");
      if (graphMode === "onDemand") {
        fetchNeighborhood(forwardCenter);
      }
      return next;
    });
  }

  function handlePinToggle(id: string) {
    setPinnedConceptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAutoLensFlagChange(enabled: boolean) {
    setFlag("autoLensOnSelectEnabled", enabled);
    // Re-arm auto behavior on explicit toggle.
    setUserOverrodeAutoView(false);
  }

  function handleResetFlags() {
    resetFlags();
    setUserOverrodeAutoView(false);
  }

  function handleLensNodeTap(id: string) {
    const cy = atlasCyRef.current;
    const node = cy?.$id(id);
    const title = (node && !node.empty() ? node.data("label") : id) as string;

    if (edgeDraftState.phase === "pickSource") {
      setEdgeDraftState({ phase: "pickTarget", sourceId: id, sourceTitle: title });
      if (cy) {
        cy.nodes().removeClass("edgeDraftSource");
        cy.$id(id).addClass("edgeDraftSource");
      }
    } else if (edgeDraftState.phase === "pickTarget") {
      setEdgeDraftState({
        phase: "pickType",
        sourceId: edgeDraftState.sourceId,
        targetId: id,
        sourceTitle: edgeDraftState.sourceTitle,
        targetTitle: title
      });
    }
  }

  async function handleEdgeTypeSelected(type: EdgeType) {
    if (edgeDraftState.phase !== "pickType") return;
    const { sourceId, targetId } = edgeDraftState;
    setLensEditSaving(true);
    setLensEditError(null);

    try {
      await createDraftEdge({
        fromConceptId: sourceId,
        toConceptId: targetId,
        type,
        evidenceChunkIds: []
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stage draft edge";
      if (message.includes("EDGE_WOULD_CYCLE")) {
        setLensEditError("Cannot create: would form a prerequisite cycle");
      } else {
        setLensEditError(message);
      }
    } finally {
      setLensEditSaving(false);
      cancelEdgeDraft();
    }
  }

  async function handleAddConcept() {
    const title = addConceptTitle.trim();
    if (!title) return;
    setLensEditSaving(true);
    setLensEditError(null);

    try {
      const res = await postConcept({ title });
      setAddConceptTitle("");
      setAddConceptOpen(false);
      await refreshGraph();
      setLensRefreshToken((t) => t + 1);
      selectConcept(res.concept.id);
    } catch (err) {
      setLensEditError(err instanceof Error ? err.message : "Failed to create concept");
    } finally {
      setLensEditSaving(false);
    }
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

  function toggleEdgeTypeCategory(category: EdgeTypeCategory) {
    setSelectedEdgeTypes((prev) => {
      const next = new Set(prev);
      const allOn = category.types.every((t) => next.has(t));
      for (const t of category.types) {
        if (allOn) next.delete(t); else next.add(t);
      }
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

  const tutorGraphContext = useMemo(() => {
    const lensNodeIds = Array.from(new Set((lensData?.nodes ?? []).map((n) => n.id)));
    const lensEdgeIds = Array.from(new Set((lensData?.edges ?? []).map((e) => e.id)));
    const evidenceChunkIds = Array.from(
      new Set((edgeEvidence?.evidence ?? []).map((item) => item.chunk.id))
    );
    return { lensNodeIds, lensEdgeIds, evidenceChunkIds };
  }, [edgeEvidence?.evidence, lensData?.edges, lensData?.nodes]);

  const inboxBadge = inboxPendingCount === null ? "—" : String(inboxPendingCount);
  const reviewBadge =
    reviewDueCount === null ? "—" : reviewDueCount >= 100 ? "100+" : String(reviewDueCount);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Graph AI Tutor</h1>
        <div className="buttonRow">
          {isWorkbenchEnabled ? (
            <>
              <button
                type="button"
                className="secondaryButton topbarCountButton"
                onClick={() => openWorkbench("inbox")}
                data-testid="topbar-inbox-count"
              >
                Inbox <span className="topbarCountBadge">{inboxBadge}</span>
              </button>
              <button
                type="button"
                className="secondaryButton topbarCountButton"
                onClick={() => openWorkbench("review")}
                data-testid="topbar-review-count"
              >
                Due <span className="topbarCountBadge">{reviewBadge}</span>
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="ghostButton"
            onClick={() => setShortcutsHelpOpen(true)}
            aria-label="Show keyboard shortcuts"
            title="Show keyboard shortcuts"
            data-testid="open-shortcuts-help"
          >
            ?
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => setCaptureOpen(true)}
            data-testid="capture-open"
          >
            Capture
          </button>
        </div>
      </header>

      {captureOpen ? (
        <CaptureModal
          onCaptured={() => {
            setCaptureOpen(false);
            openWorkbench("inbox");
            void refreshWorkbenchCounts();
            void refreshGraph();
          }}
          onClose={() => setCaptureOpen(false)}
        />
      ) : null}

      <ShortcutsHelp
        open={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />

      <div className="shell" ref={shellRef} style={{ gridTemplateColumns }}>
        <aside className="pane leftPane" aria-label="Navigation">
          <div className="leftTabBar">
            <button
              type="button"
              className={`leftTab${leftTab === "browse" ? " active" : ""}`}
              onClick={() => setLeftTab("browse")}
            >
              Browse
            </button>
            <button
              type="button"
              className={`leftTab${leftTab === "filters" ? " active" : ""}`}
              onClick={() => setLeftTab("filters")}
            >
              Filters
            </button>
          </div>

          <div className="leftTabContent">
            {leftTab === "browse" ? (
              <>
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

              {query.trim().length >= 2 ? (
                <>
                  {selectedConceptId ? (
                    <div className="searchControls">
                      <label className="mutedText" htmlFor="search-scope">
                        Scope
                      </label>
                      <select
                        id="search-scope"
                        className="searchInput"
                        value={effectiveSearchScope}
                        onChange={(e) =>
                          setSearchScopeOverride(e.target.value as "neighborhood" | "global")
                        }
                      >
                        <option value="neighborhood">Neighborhood (2 hops)</option>
                        <option value="global">Global</option>
                      </select>
                    </div>
                  ) : (
                    <p className="mutedText">Scope: Global</p>
                  )}

                  <div className="searchFacets" role="group" aria-label="Result types">
                    <button
                      type="button"
                      className={`facetButton ${
                        searchFacetAllowlist.has("concepts") ? "facetButtonActive" : ""
                      }`}
                      onClick={() => toggleSearchFacet("concepts")}
                    >
                      Concepts ({facetCounts.concepts})
                    </button>
                    <button
                      type="button"
                      className={`facetButton ${
                        searchFacetAllowlist.has("sources") ? "facetButtonActive" : ""
                      }`}
                      onClick={() => toggleSearchFacet("sources")}
                    >
                      Sources ({facetCounts.sources})
                    </button>
                    <button
                      type="button"
                      className={`facetButton ${
                        searchFacetAllowlist.has("evidence") ? "facetButtonActive" : ""
                      }`}
                      onClick={() => toggleSearchFacet("evidence")}
                    >
                      Evidence ({facetCounts.evidence})
                    </button>
                  </div>

                  {universalSearchError ? (
                    <p role="alert" className="errorText">
                      {universalSearchError}
                    </p>
                  ) : null}

                  {universalSearchLoading ? <p className="mutedText">Searching...</p> : null}

                  {!universalSearchLoading && scopedUniversalSearch ? (
                    facetCounts.concepts + facetCounts.sources + facetCounts.evidence === 0 ? (
                      <p className="mutedText">(No results)</p>
                    ) : (
                      <div className="searchResults" aria-label="Search results">
                        {searchFacetAllowlist.has("concepts") ? (
                          <div className="searchGroup">
                            <div className="searchGroupTitle">Concepts</div>
                            <ul className="searchResultList" aria-label="Concept results">
                              {scopedUniversalSearch.concepts.map((r) => (
                                <li key={r.id} className="searchResult">
                                  <div className="searchResultTop">
                                    <div className="searchResultTitle">
                                      <HighlightedText
                                        value={r.titleHighlight}
                                        fallback={r.title}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      className="ghostButton"
                                      onClick={() => {
                                        navigateToConceptInGraph(r.id);
                                      }}
                                      data-testid={`search-show-${r.id}`}
                                    >
                                      Show in graph
                                    </button>
                                  </div>
                                  <div className="mutedText">
                                    {r.kind}
                                    {r.module ? ` • ${r.module}` : ""}
                                  </div>
                                  {r.snippetHighlight ? (
                                    <div className="searchWhy">
                                      <span className="mutedText">Why matched: </span>
                                      <HighlightedText value={r.snippetHighlight} />
                                    </div>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {searchFacetAllowlist.has("sources") ? (
                          <div className="searchGroup">
                            <div className="searchGroupTitle">Sources</div>
                            <ul className="searchResultList" aria-label="Source results">
                              {scopedUniversalSearch.sources.map((s) => {
                                const targetConceptId = s.conceptIds[0] ?? null;
                                const titleFallback = s.source.title ?? s.source.url;
                                return (
                                  <li key={s.source.id} className="searchResult">
                                    <div className="searchResultTop">
                                      <div className="searchResultTitle">
                                        <HighlightedText
                                          value={s.titleHighlight}
                                          fallback={titleFallback}
                                        />
                                      </div>
                                      <div className="searchResultActions">
                                        <button
                                          type="button"
                                          className="ghostButton"
                                          onClick={() => openSource(s.source.id)}
                                        >
                                          Open
                                        </button>
                                        <button
                                          type="button"
                                          className="ghostButton"
                                          disabled={!targetConceptId}
                                          onClick={() => {
                                            if (!targetConceptId) return;
                                            navigateToConceptInGraph(targetConceptId);
                                          }}
                                        >
                                          Show in graph
                                        </button>
                                      </div>
                                    </div>
                                    <div className="mutedText">
                                      {s.conceptIds.length > 0
                                        ? `Attached to ${s.conceptIds.length} concept(s)`
                                        : "Not attached to a concept"}
                                    </div>
                                    <div className="searchWhy">
                                      <span className="mutedText">Why matched: </span>
                                      <HighlightedText
                                        value={s.snippetHighlight}
                                        fallback={s.source.url}
                                      />
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : null}

                        {searchFacetAllowlist.has("evidence") ? (
                          <div className="searchGroup">
                            <div className="searchGroupTitle">Evidence</div>
                            <ul className="searchResultList" aria-label="Evidence results">
                              {scopedUniversalSearch.evidence.map((e) => {
                                const targetConceptId = e.conceptIds[0] ?? null;
                                const sourceLabel = e.chunk.sourceTitle ?? e.chunk.sourceUrl;
                                return (
                                  <li key={e.chunk.id} className="searchResult">
                                    <div className="searchResultTop">
                                      <div className="searchResultTitle">
                                        <HighlightedText
                                          value={e.snippetHighlight}
                                          fallback={e.chunk.content}
                                        />
                                      </div>
                                      <div className="searchResultActions">
                                        <button
                                          type="button"
                                          className="ghostButton"
                                          onClick={() => openSource(e.chunk.sourceId)}
                                        >
                                          Open
                                        </button>
                                        <button
                                          type="button"
                                          className="ghostButton"
                                          disabled={!targetConceptId}
                                          onClick={() => {
                                            if (!targetConceptId) return;
                                            navigateToConceptInGraph(targetConceptId);
                                          }}
                                        >
                                          Show in graph
                                        </button>
                                      </div>
                                    </div>
                                    <div className="mutedText">{sourceLabel}</div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )
                  ) : null}
                </>
              ) : !graph ? (
                <SkeletonBlock lines={6} />
              ) : (
                <ConceptTree
                  nodes={graph.nodes}
                  edges={graph.edges}
                  query={query}
                  selectedConceptId={selectedConceptId}
                  onSelect={selectAndFocusConcept}
                />
              )}
            </div>
              </>
            ) : (
              <>
          <div className="section">
            <label className="sectionTitle" htmlFor="edge-vis-mode-select">
              Edge visibility
            </label>
            <select
              id="edge-vis-mode-select"
              className="searchInput"
              value={edgeVisMode}
              onChange={(e) => setEdgeVisMode(e.target.value as EdgeVisMode)}
            >
              <option value="filtered">Filtered (use checkboxes)</option>
              <option value="all">All edges</option>
              <option value="prereq_only">Prerequisites only</option>
            </select>
          </div>

          <div className="section">
            <EdgeTypeFilter
              selected={selectedEdgeTypes}
              onToggle={toggleEdgeType}
              onToggleCategory={toggleEdgeTypeCategory}
              disabled={edgeVisMode !== "filtered"}
            />
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

            <label className="mutedText" htmlFor="view-mode-select">
              View mode
            </label>
            <select
              id="view-mode-select"
              className="searchInput"
              value={viewMode}
              onChange={(e) => handleViewModeChange(e.target.value as GraphViewMode)}
            >
              <option value="classic">Classic</option>
              <option value="focus">Focus</option>
              <option value="lens">Lens</option>
              <option value="explore">Explore</option>
            </select>

            <label className="mutedText" htmlFor="auto-lens-select-toggle">
              <input
                id="auto-lens-select-toggle"
                type="checkbox"
                checked={flags.autoLensOnSelectEnabled}
                onChange={(e) => handleAutoLensFlagChange(e.target.checked)}
              />{" "}
              Auto dependency view on select
            </label>
            {autoLensGateEnabled && userOverrodeAutoView ? (
              <p className="mutedText" data-testid="auto-view-override-hint">
                Manual override active. Toggle Auto off/on to re-enable.
              </p>
            ) : null}

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

            {viewMode === "lens" ? (
              <>
                <label className="mutedText" htmlFor="lens-radius-select">
                  Lens radius
                </label>
                <select
                  id="lens-radius-select"
                  className="searchInput"
                  value={lensRadius}
                  onChange={(e) => setLensRadius(clampInt(Number(e.target.value), 1, 3))}
                >
                  <option value={1}>1 hop</option>
                  <option value={2}>2 hops</option>
                  <option value={3}>3 hops</option>
                </select>
                {lensLoading ? <p className="mutedText">Loading lens...</p> : null}
                {lensError ? (
                  <p role="alert" className="errorText">
                    {lensError}
                  </p>
                ) : null}
                {!selectedConceptId ? (
                  <p className="mutedText">Select a concept to view its lens.</p>
                ) : null}
              </>
            ) : null}

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
              </>
            )}
          </div>
        </aside>

        <div className="divider" {...leftDividerProps} role="separator" aria-label="Resize left panel" />

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
                {graph || graphMode === "onDemand" ? (
                  <div className="buttonRow">
                    <p className="mutedText">
                      {graphMode === "onDemand"
                        ? `On-demand${onDemandData ? ` • ${onDemandData.nodes.length} nodes` : ""}`
                        : `Nodes: ${graph!.nodes.length} • Edges: ${graph!.edges.length}${graphMode === "clustered" ? " (clustered)" : ""}`
                      }
                    </p>
                    {graphMode !== "onDemand" && (
                      <button
                        type="button"
                        className="ghostButton"
                        onClick={() => setGraphMode((m) => (m === "full" ? "clustered" : "full"))}
                      >
                        {graphMode === "clustered" ? "Show full graph" : "Show clusters"}
                      </button>
                    )}
                    <button
                      type="button"
                      className={graphMode === "onDemand" ? "secondaryButton" : "ghostButton"}
                      onClick={() => {
                        if (graphMode === "onDemand") {
                          setGraphMode("clustered");
                          if (viewMode === "explore") handleViewModeChange("classic");
                        } else {
                          setGraphMode("onDemand");
                          setUserOverrodeAutoView(true);
                          const centerId = selectedConceptId ?? graph?.nodes[0]?.id ?? null;
                          setViewMode("explore");
                          setExploreCenter(centerId);
                          setExploreHistory([]);
                          setExploreFuture([]);
                          if (centerId) {
                            fetchNeighborhood(centerId);
                          }
                        }
                      }}
                    >
                      {graphMode === "onDemand" ? "Exit on-demand" : "On-demand explore"}
                    </button>
                    <button
                      type="button"
                      className="ghostButton"
                      onClick={() => setDebugPanelOpen((v) => !v)}
                    >
                      {debugPanelOpen ? "Hide debug" : "Debug"}
                    </button>
                  </div>
                ) : (
                  <SkeletonBlock lines={1} />
                )}
                {debugPanelOpen && graph ? (
                  <details className="debugPanel" open>
                    <summary className="debugPanelSummary">Debug info</summary>
                    <div className="debugPanelBody">
                      <p>Nodes: {graph.nodes.length}</p>
                      <p>Edges: {graph.edges.length}</p>
                      <p>Visible nodes: {atlasCyRef.current?.nodes(":visible").length ?? "—"}</p>
                      <p>Visible edges: {atlasCyRef.current?.edges(":visible").length ?? "—"}</p>
                      <p>Zoom: {debugZoom.toFixed(3)}</p>
                      <p>View mode: {viewMode}</p>
                      <p>Edge vis: {edgeVisMode}</p>
                      <div className="debugFlagsSection" data-testid="debug-v2-flags">
                        <div className="debugFlagsTitle">V2</div>
                        <p>Design V2 active: {isDesignV2 ? "yes" : "no"}</p>
                        <label className="debugFlagRow" htmlFor="flag-design-v2">
                          <input
                            id="flag-design-v2"
                            type="checkbox"
                            checked={flags.designV2Enabled}
                            onChange={(e) => setFlag("designV2Enabled", e.target.checked)}
                          />{" "}
                          designV2Enabled
                        </label>
                        <label className="debugFlagRow" htmlFor="flag-right-pane-v2">
                          <input
                            id="flag-right-pane-v2"
                            type="checkbox"
                            checked={flags.rightPaneV2Enabled}
                            onChange={(e) => setFlag("rightPaneV2Enabled", e.target.checked)}
                          />{" "}
                          rightPaneV2Enabled
                        </label>
                        <label className="debugFlagRow" htmlFor="flag-concept-inspector-v2">
                          <input
                            id="flag-concept-inspector-v2"
                            type="checkbox"
                            checked={flags.conceptInspectorV2Enabled}
                            onChange={(e) => setFlag("conceptInspectorV2Enabled", e.target.checked)}
                          />{" "}
                          conceptInspectorV2Enabled
                        </label>
                        <label className="debugFlagRow" htmlFor="flag-tutor-drawer">
                          <input
                            id="flag-tutor-drawer"
                            type="checkbox"
                            checked={flags.tutorDrawerEnabled}
                            onChange={(e) => setFlag("tutorDrawerEnabled", e.target.checked)}
                          />{" "}
                          tutorDrawerEnabled
                        </label>
                        <label className="debugFlagRow" htmlFor="flag-auto-lens-on-select">
                          <input
                            id="flag-auto-lens-on-select"
                            type="checkbox"
                            checked={flags.autoLensOnSelectEnabled}
                            onChange={(e) => handleAutoLensFlagChange(e.target.checked)}
                          />{" "}
                          autoLensOnSelectEnabled
                        </label>
                        <div className="buttonRow debugFlagsActions">
                          <button
                            type="button"
                            className="ghostButton"
                            onClick={handleResetFlags}
                          >
                            Reset to defaults
                          </button>
                        </div>
                      </div>
                    </div>
                  </details>
                ) : null}
              </div>

              <div className={`atlasWrap${interactionMode === "pan" ? " atlasWrap--panMode" : ""}`}>
                  <AtlasView
                    graph={graph}
                    clusteredData={clusteredData}
                    graphMode={graphMode}
                    edgeTypeAllowlist={selectedEdgeTypes}
                    edgeVisMode={edgeVisMode}
                    highlightConceptIds={tutorHighlightedConceptIds}
                    changesetHighlightConceptIds={changesetHighlightConceptIds}
                    hoveredRelationConceptId={hoveredRelationConceptId}
                    hoveredRelationEdgeId={hoveredRelationEdgeId}
                    masteryOverlayEnabled={masteryOverlayEnabled}
                    selectedConceptId={selectedConceptId}
                    pinnedConceptIds={pinnedConceptIds}
                    focusModeEnabled={focusModeEnabled}
                    focusDepth={focusDepth}
                    viewMode={viewMode}
                    lensData={lensData}
                    exploreCenter={exploreCenter}
                    onDemandData={onDemandData}
                    onDemandHops={onDemandHops}
                    onDemandLoading={onDemandLoading}
                    onDemandCapped={onDemandCapped}
                    onSelectConcept={handleAtlasConceptSelect}
                    onSelectEdge={selectEdge}
                    onExploreNavigate={handleExploreNavigate}
                    onPinToggle={handlePinToggle}
                    onCyReady={handleCyReady}
                  />
                <GraphNavToolbar
                  cy={atlasCyRef.current}
                  interactionMode={interactionMode}
                  onInteractionModeChange={setInteractionMode}
                />
                {viewMode === "lens" && lensData && (
                  <LensEditToolbar
                    onAddConcept={() => {
                      setAddConceptTitle("");
                      setAddConceptOpen(true);
                    }}
                    edgeDraftState={edgeDraftState}
                    onStartEdgeDraft={() => {
                      setInteractionMode("pointer");
                      setEdgeDraftState({ phase: "pickSource" });
                    }}
                    onCancelEdgeDraft={cancelEdgeDraft}
                    error={lensEditError}
                    saving={lensEditSaving}
                  />
                )}
                {viewMode === "explore" && exploreCenter && (
                  <div className="exploreToolbar" data-testid="explore-toolbar">
                    <button
                      type="button"
                      className="secondaryButton"
                      disabled={exploreHistory.length === 0}
                      onClick={handleExploreBack}
                      title="Go back (Backspace)"
                    >
                      ← Back{exploreHistory.length > 0 ? ` (${exploreHistory.length})` : ""}
                    </button>
                    <span className="exploreToolbar__center">
                      {(graphMode === "onDemand"
                        ? onDemandData?.nodes.find((n) => n.id === exploreCenter)?.title
                        : graph?.nodes.find((n) => n.id === exploreCenter)?.title
                      ) ?? exploreCenter}
                      {graphMode === "onDemand" && onDemandData ? (
                        <span className="mutedText" style={{ marginLeft: 6, fontSize: "0.85em" }}>
                          ({onDemandData.nodes.length} nodes)
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="secondaryButton"
                      disabled={exploreFuture.length === 0}
                      onClick={handleExploreForward}
                      title="Go forward"
                    >
                      Forward{exploreFuture.length > 0 ? ` (${exploreFuture.length})` : ""} →
                    </button>
                    <button
                      type="button"
                      className="ghostButton"
                      onClick={() => handleViewModeChange("classic")}
                      title="Exit explore mode (Escape)"
                    >
                      Exit
                    </button>
                  </div>
                )}
                {/* On-demand overlays */}
                {graphMode === "onDemand" && viewMode === "explore" && !onDemandData && !onDemandLoading && (
                  <div className="onDemandOverlay" data-testid="on-demand-overlay">
                    Search to begin exploring
                  </div>
                )}
                {graphMode === "onDemand" && onDemandLoading && (
                  <div className="onDemandLoading" data-testid="on-demand-loading">
                    Loading neighborhood…
                  </div>
                )}
                {graphMode === "onDemand" && onDemandCapped && !onDemandLoading && (
                  <div className="cappedBanner" data-testid="capped-banner">
                    Results capped — zoom in or filter edge types for more detail
                  </div>
                )}
                {graphMode === "onDemand" && onDemandError && !onDemandLoading && (
                  <div className="cappedBanner" style={{ background: "rgba(239,68,68,0.9)" }}>
                    {onDemandError}
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        <div className="divider" {...rightDividerProps} role="separator" aria-label="Resize right panel" />

        <section className="pane rightPane" aria-label="Concept">
          {isRightPaneV2 ? (
            <div className="rightPaneV2Preview" data-testid="right-pane-v2-preview">
              V2 Inspector preview is enabled.
            </div>
          ) : null}
          <div className="tabs" role="tablist" aria-label="Right panel tabs">
            <button
              type="button"
              className={`tab ${activeRightTab === "concept" ? "tabActive" : ""}`}
              aria-current={activeRightTab === "concept" ? "page" : undefined}
              onClick={() => setActiveRightTab("concept")}
            >
              {isV2PaneLabel ? "Inspector" : "Concept Workspace"}
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
            {!isWorkbenchEnabled ? (
              <button
                type="button"
                className={`tab ${activeRightTab === "inbox" ? "tabActive" : ""}`}
                aria-current={activeRightTab === "inbox" ? "page" : undefined}
                onClick={() => setActiveRightTab("inbox")}
              >
                Inbox
              </button>
            ) : null}
            {!isTutorDrawerEnabled ? (
              <button
                type="button"
                className={`tab ${activeRightTab === "tutor" ? "tabActive" : ""}`}
                aria-current={activeRightTab === "tutor" ? "page" : undefined}
                onClick={() => setActiveRightTab("tutor")}
              >
                Tutor
              </button>
            ) : null}
            {!isWorkbenchEnabled ? (
              <button
                type="button"
                className={`tab ${activeRightTab === "review" ? "tabActive" : ""}`}
                aria-current={activeRightTab === "review" ? "page" : undefined}
                onClick={() => setActiveRightTab("review")}
              >
                Review
              </button>
            ) : null}
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
              isConceptInspectorV2 ? (
                <ConceptInspectorV2
                  concept={concept}
                  graph={graph}
                  onOpenConcept={selectAndFocusConcept}
                  onShowContextPack={showContextPack}
                  onGraphUpdated={refreshGraph}
                  onOpenSource={openSource}
                  sourcesRefreshToken={sourcesRefreshToken}
                  onConceptUpdated={(next) => setConcept(next)}
                  actionRequest={inspectorActionRequest}
                  onOpenTutorTab={() => {
                    if (isTutorDrawerEnabled) {
                      openTutorDrawer(`Explain ${concept.title} with prerequisites and examples.`);
                    } else {
                      setActiveRightTab("tutor");
                    }
                  }}
                  onHoverRelationship={(input) => {
                    if (!input) {
                      setHoveredRelationConceptId(null);
                      setHoveredRelationEdgeId(null);
                      return;
                    }
                    setHoveredRelationConceptId(input.conceptId);
                    setHoveredRelationEdgeId(input.edgeId);
                  }}
                  onSelectRelationship={({ conceptId, edgeId }) => {
                    setHoveredRelationConceptId(null);
                    setHoveredRelationEdgeId(null);
                    navigateToConceptInGraph(conceptId, "relationship_click");
                    selectEdgeWithoutPanel(edgeId);
                  }}
                  onCreateDraftRelation={async (input) => {
                    await createDraftEdge(input);
                  }}
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
                <ConceptWorkspace
                  concept={concept}
                  graph={graph}
                  onOpenConcept={selectAndFocusConcept}
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
              )
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
          ) : activeRightTab === "inbox" && !isWorkbenchEnabled ? (
            <InboxPanel
              graph={graph}
              onGraphUpdated={refreshGraph}
              onHighlightChangesetConceptIds={(ids) =>
                setChangesetHighlightConceptIds(new Set(ids))
              }
            />
          ) : activeRightTab === "review" && !isWorkbenchEnabled ? (
            <ReviewPanel graph={graph} onOpenConcept={selectAndFocusConcept} />
          ) : activeRightTab === "tutor" ? (
            <TutorPanel
              graph={graph}
              selectionContext={{
                conceptId: selectedConceptId,
                edgeId: selectedEdgeId,
                lensNodeIds: tutorGraphContext.lensNodeIds,
                lensEdgeIds: tutorGraphContext.lensEdgeIds,
                evidenceChunkIds: tutorGraphContext.evidenceChunkIds
              }}
              onHighlightConceptIds={(ids) => setTutorHighlightedConceptIds(new Set(ids))}
            />
          ) : (
            <p className="mutedText">Select a tab to continue.</p>
          )}
        </section>
      </div>

      {isWorkbenchEnabled ? (
        <WorkbenchModal
          mode={workbenchMode}
          graph={graph}
          onClose={() => setWorkbenchMode(null)}
          onGraphUpdated={refreshGraph}
          onOpenConcept={selectAndFocusConcept}
          onHighlightChangesetConceptIds={(ids) => setChangesetHighlightConceptIds(new Set(ids))}
          onCountsMaybeChanged={() => void refreshWorkbenchCounts()}
        />
      ) : null}

      {isTutorDrawerEnabled ? (
        <TutorDrawer
          open={tutorDrawerOpen}
          setOpen={setTutorDrawerOpen}
          graph={graph}
          onHighlightConceptIds={(ids) => setTutorHighlightedConceptIds(new Set(ids))}
          selectedConceptId={selectedConceptId}
          selectedEdgeId={selectedEdgeId}
          currentGraphContext={tutorGraphContext}
          seedQuestion={tutorSeedQuestion}
          seedQuestionToken={tutorSeedQuestionToken}
        />
      ) : null}

      {snackbarMessage ? (
        <div className="snackbar" role="status" aria-live="polite">
          {snackbarMessage}
        </div>
      ) : null}

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        actions={commandPaletteActions}
        concepts={graph?.nodes}
        onSelectConcept={(conceptId) => {
          selectConcept(conceptId, "programmatic");
          setViewMode("lens");
        }}
      />

      <EdgeTypePicker
        open={edgeDraftState.phase === "pickType"}
        onSelect={handleEdgeTypeSelected}
        onClose={cancelEdgeDraft}
      />

      {addConceptOpen ? (
        <div className="modalOverlay" onClick={(e) => {
          if (e.target === e.currentTarget) setAddConceptOpen(false);
        }}>
          <div className="modalContent" data-testid="add-concept-modal">
            <h3>Add concept</h3>
            <input
              className="searchInput"
              placeholder="Concept title..."
              value={addConceptTitle}
              onChange={(e) => setAddConceptTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddConcept();
                if (e.key === "Escape") setAddConceptOpen(false);
              }}
              autoFocus
              data-testid="add-concept-input"
            />
            <div className="buttonRow">
              <button
                type="button"
                className="secondaryButton"
                onClick={() => void handleAddConcept()}
                disabled={!addConceptTitle.trim() || lensEditSaving}
                data-testid="add-concept-submit"
              >
                {lensEditSaving ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                className="ghostButton"
                onClick={() => setAddConceptOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <TrainingPanel
        open={trainingPanelOpen}
        onClose={() => setTrainingPanelOpen(false)}
        graph={graph}
        conceptIds={selectedConceptId ? [selectedConceptId] : undefined}
      />
    </div>
  );
}
