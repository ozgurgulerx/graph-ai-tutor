import { useCallback, useMemo, useRef, useState } from "react";

import type { ConceptSummary, EdgeSummary } from "@graph-ai-tutor/shared";

import { buildConceptForest, filterConceptForest, type OrphanGroup, type TreeNode } from "./buildConceptTree";
import { prefetchConcept } from "./api/client";

// --- Props ---

type ConceptTreeProps = {
  nodes: ConceptSummary[];
  edges: EdgeSummary[];
  query: string;
  selectedConceptId: string | null;
  onSelect: (id: string) => void;
};

// --- TreeItem ---

function TreeItem(props: {
  node: TreeNode;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  selectedConceptId: string | null;
  onSelect: (id: string) => void;
}) {
  const { node, expandedIds, onToggle, selectedConceptId, onSelect } = props;
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.concept.id);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter() {
    timerRef.current = setTimeout(() => {
      prefetchConcept(node.concept.id);
    }, 200);
  }

  function handleMouseLeave() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={selectedConceptId === node.concept.id}>
      <div className="treeRow">
        {hasChildren ? (
          <button
            type="button"
            className="treeDisclosure"
            onClick={() => onToggle(node.concept.id)}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? "\u25BE" : "\u25B8"}
          </button>
        ) : (
          <span className="treeDisclosurePlaceholder" />
        )}
        <button
          type="button"
          className="nodeButton treeNodeButton"
          onClick={() => onSelect(node.concept.id)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-current={selectedConceptId === node.concept.id ? "true" : undefined}
        >
          <span className="nodeTitle">{node.concept.title}</span>
          <span className="nodeModule">
            {node.concept.kind}
            {node.concept.module ? ` \u2022 ${node.concept.module}` : ""}
          </span>
        </button>
      </div>
      {hasChildren && expanded && (
        <ul role="group" className="treeChildren">
          {node.children.map((child) => (
            <TreeItem
              key={child.concept.id}
              node={child}
              expandedIds={expandedIds}
              onToggle={onToggle}
              selectedConceptId={selectedConceptId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// --- OrphanGroupSection ---

function OrphanGroupSection(props: {
  group: OrphanGroup;
  expandedGroups: Set<string | null>;
  onToggleGroup: (mod: string | null) => void;
  selectedConceptId: string | null;
  onSelect: (id: string) => void;
}) {
  const { group, expandedGroups, onToggleGroup, selectedConceptId, onSelect } = props;
  const expanded = expandedGroups.has(group.module);
  const label = group.module ?? "Ungrouped";

  return (
    <li role="treeitem" aria-expanded={expanded}>
      <div className="treeRow">
        <button
          type="button"
          className="treeDisclosure"
          onClick={() => onToggleGroup(group.module)}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "\u25BE" : "\u25B8"}
        </button>
        <span className="treeGroupLabel">{label} ({group.nodes.length})</span>
      </div>
      {expanded && (
        <ul role="group" className="treeChildren">
          {group.nodes.map((n) => (
            <OrphanItem
              key={n.id}
              node={n}
              selectedConceptId={selectedConceptId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// --- OrphanItem ---

function OrphanItem(props: {
  node: ConceptSummary;
  selectedConceptId: string | null;
  onSelect: (id: string) => void;
}) {
  const { node, selectedConceptId, onSelect } = props;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    <li role="treeitem" aria-selected={selectedConceptId === node.id}>
      <div className="treeRow">
        <span className="treeDisclosurePlaceholder" />
        <button
          type="button"
          className="nodeButton treeNodeButton"
          onClick={() => onSelect(node.id)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-current={selectedConceptId === node.id ? "true" : undefined}
        >
          <span className="nodeTitle">{node.title}</span>
          <span className="nodeModule">
            {node.kind}
            {node.module ? ` \u2022 ${node.module}` : ""}
          </span>
        </button>
      </div>
    </li>
  );
}

// --- ConceptTree ---

export function ConceptTree({ nodes, edges, query, selectedConceptId, onSelect }: ConceptTreeProps) {
  const [userExpanded, setUserExpanded] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string | null>>(new Set());

  const forest = useMemo(() => buildConceptForest(nodes, edges), [nodes, edges]);

  const isSearching = query.trim().length > 0;

  const { displayForest, autoExpandIds } = useMemo(() => {
    if (!isSearching) {
      return { displayForest: forest, autoExpandIds: null };
    }
    const q = query.trim().toLowerCase();
    const matchingIds = new Set<string>();
    for (const n of nodes) {
      if (n.title.toLowerCase().includes(q)) matchingIds.add(n.id);
    }
    const { forest: filtered, expandedIds } = filterConceptForest(forest, matchingIds);
    return { displayForest: filtered, autoExpandIds: expandedIds };
  }, [forest, query, isSearching, nodes]);

  // When searching, auto-expand overrides user state
  const effectiveExpanded = autoExpandIds ?? userExpanded;

  const handleToggle = useCallback((id: string) => {
    setUserExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleGroup = useCallback((mod: string | null) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  }, []);

  const allGroupModules = useMemo(
    () => new Set(displayForest.orphanGroups.map((g) => g.module)),
    [displayForest]
  );

  const hasRoots = displayForest.roots.length > 0;
  const hasOrphans = displayForest.orphanGroups.length > 0;

  if (!hasRoots && !hasOrphans) {
    return null;
  }

  return (
    <ul className="conceptTree" role="tree" aria-label="Concepts">
      {displayForest.roots.map((root) => (
        <TreeItem
          key={root.concept.id}
          node={root}
          expandedIds={effectiveExpanded}
          onToggle={handleToggle}
          selectedConceptId={selectedConceptId}
          onSelect={onSelect}
        />
      ))}
      {displayForest.orphanGroups.map((group) => (
        <OrphanGroupSection
          key={group.module ?? "__null__"}
          group={group}
          expandedGroups={isSearching ? allGroupModules : expandedGroups}
          onToggleGroup={handleToggleGroup}
          selectedConceptId={selectedConceptId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
