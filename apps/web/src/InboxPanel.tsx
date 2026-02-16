import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  Changeset,
  ChangesetItem,
  EvidenceChunk,
  GraphResponse
} from "@graph-ai-tutor/shared";

import {
  getChangeset,
  getChangesets,
  postApplyChangeset,
  postChangesetItemStatus,
  postChangesetStatus
} from "./api/client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  if (!value.every((x) => typeof x === "string")) return [];
  return value;
}

function getConceptTitle(
  graph: GraphResponse | null,
  proposedTitles: ReadonlyMap<string, string>,
  conceptId: string
): string {
  const existing = graph?.nodes.find((n) => n.id === conceptId);
  if (existing?.title) return existing.title;
  return proposedTitles.get(conceptId) ?? conceptId;
}

type ChangesetListFilter = "proposed" | "applied" | "rejected";

function listFilterForStatus(status: Changeset["status"]): ChangesetListFilter {
  if (status === "draft") return "proposed";
  return status;
}

function formatChangesetStatus(status: Changeset["status"]): string {
  if (status === "draft") return "proposed";
  return status;
}

type ChangesetDetail = {
  changeset: Changeset;
  items: ChangesetItem[];
  evidenceChunks: EvidenceChunk[];
};

export function InboxPanel(props: {
  graph: GraphResponse | null;
  onGraphUpdated: () => Promise<void>;
  onHighlightChangesetConceptIds?: (ids: string[]) => void;
  onChangesetsUpdated?: (changesets: Changeset[]) => void;
}) {
  const onHighlightChangesetConceptIds = props.onHighlightChangesetConceptIds;
  const onChangesetsUpdated = props.onChangesetsUpdated;
  const [changesets, setChangesets] = useState<Changeset[] | null>(null);
  const [changesetsLoading, setChangesetsLoading] = useState(false);
  const [changesetsError, setChangesetsError] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<ChangesetListFilter>("proposed");

  const [selectedChangesetId, setSelectedChangesetId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChangesetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  const refreshChangesets = useCallback(async () => {
    setChangesetsLoading(true);
    setChangesetsError(null);
    try {
      const res = await getChangesets();
      setChangesets(res.changesets);
      onChangesetsUpdated?.(res.changesets);
    } catch (err) {
      setChangesetsError(err instanceof Error ? err.message : "Failed to load changesets");
    } finally {
      setChangesetsLoading(false);
    }
  }, [onChangesetsUpdated]);

  const loadChangeset = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    setApplyError(null);
    setApplyResult(null);

    try {
      const res = await getChangeset(id);
      setDetail({
        changeset: res.changeset,
        items: res.items,
        evidenceChunks: res.evidenceChunks
      });
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load changeset");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshChangesets();
  }, [refreshChangesets]);

  const changesetCounts = useMemo(() => {
    const counts: Record<ChangesetListFilter, number> = {
      proposed: 0,
      applied: 0,
      rejected: 0
    };
    for (const cs of changesets ?? []) {
      counts[listFilterForStatus(cs.status)] += 1;
    }
    return counts;
  }, [changesets]);

  const filteredChangesets = useMemo(() => {
    return (changesets ?? []).filter((cs) => listFilterForStatus(cs.status) === listFilter);
  }, [changesets, listFilter]);

  useEffect(() => {
    if (filteredChangesets.length === 0) {
      setSelectedChangesetId(null);
      return;
    }
    setSelectedChangesetId((prev) => {
      if (prev && filteredChangesets.some((cs) => cs.id === prev)) return prev;
      return filteredChangesets[0]?.id ?? null;
    });
  }, [filteredChangesets]);

  useEffect(() => {
    if (!selectedChangesetId) return;
    void loadChangeset(selectedChangesetId);
  }, [loadChangeset, selectedChangesetId]);

  const proposedConceptTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of detail?.items ?? []) {
      if (item.entityType !== "concept" || item.action !== "create") continue;
      if (!isRecord(item.payload)) continue;
      const id = item.payload.id;
      const title = item.payload.title;
      if (typeof id === "string" && typeof title === "string") {
        map.set(id, title);
      }
    }
    return map;
  }, [detail?.items]);

  const evidenceById = useMemo(() => {
    const map = new Map<string, EvidenceChunk>();
    for (const ev of detail?.evidenceChunks ?? []) map.set(ev.id, ev);
    return map;
  }, [detail?.evidenceChunks]);

  const acceptedCount = useMemo(() => {
    return (detail?.items ?? []).filter((i) => i.status === "accepted").length;
  }, [detail?.items]);

  const affectedConceptIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of detail?.items ?? []) {
      if (!isRecord(item.payload)) continue;
      const payload = item.payload;
      if (item.entityType === "concept" && typeof payload.id === "string") {
        ids.add(payload.id);
      }
      if (item.entityType === "edge") {
        if (typeof payload.fromConceptId === "string") ids.add(payload.fromConceptId);
        if (typeof payload.toConceptId === "string") ids.add(payload.toConceptId);
      }
    }
    return Array.from(ids);
  }, [detail?.items]);

  const impactRadius = useMemo(() => {
    if (!props.graph) return 0;
    const graphIds = new Set(props.graph.nodes.map((n) => n.id));
    return affectedConceptIds.filter((id) => graphIds.has(id)).length;
  }, [affectedConceptIds, props.graph]);

  useEffect(() => {
    onHighlightChangesetConceptIds?.(affectedConceptIds);
  }, [affectedConceptIds, onHighlightChangesetConceptIds]);

  async function setItemStatus(itemId: string, status: "pending" | "accepted" | "rejected") {
    setDetailError(null);
    setApplyError(null);
    setApplyResult(null);
    try {
      const res = await postChangesetItemStatus(itemId, { status });
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) => (i.id === itemId ? res.item : i))
        };
      });
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to update item status");
    }
  }

  async function applyAccepted() {
    if (!detail) return;
    setApplyLoading(true);
    setApplyError(null);
    setApplyResult(null);

    try {
      const res = await postApplyChangeset(detail.changeset.id);
      setApplyResult(
        `Applied ${res.applied.conceptIds.length} concept(s) and ${res.applied.edgeIds.length} edge(s).`
      );
      await props.onGraphUpdated();
      await refreshChangesets();
      await loadChangeset(detail.changeset.id);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Failed to apply changeset");
    } finally {
      setApplyLoading(false);
    }
  }

  async function rejectChangeset() {
    if (!detail) return;
    setDetailError(null);
    setApplyError(null);
    setApplyResult(null);

    try {
      const res = await postChangesetStatus(detail.changeset.id, { status: "rejected" });
      setDetail((prev) => (prev ? { ...prev, changeset: res.changeset } : prev));
      await refreshChangesets();
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to reject changeset");
    }
  }

  return (
    <div className="inboxPanel" data-testid="inbox-panel">
      <div className="inboxHeader">
        <h3 className="paneTitle">Inbox</h3>
        <button
          type="button"
          className="secondaryButton"
          onClick={() => refreshChangesets()}
          disabled={changesetsLoading}
        >
          Refresh
        </button>
      </div>

      <div className="buttonRow" aria-label="Changeset status filters">
        <button
          type="button"
          className={listFilter === "proposed" ? "primaryButton" : "secondaryButton"}
          onClick={() => setListFilter("proposed")}
          disabled={changesetsLoading}
        >
          Proposed ({changesetCounts.proposed})
        </button>
        <button
          type="button"
          className={listFilter === "applied" ? "primaryButton" : "secondaryButton"}
          onClick={() => setListFilter("applied")}
          disabled={changesetsLoading}
        >
          Applied ({changesetCounts.applied})
        </button>
        <button
          type="button"
          className={listFilter === "rejected" ? "primaryButton" : "secondaryButton"}
          onClick={() => setListFilter("rejected")}
          disabled={changesetsLoading}
        >
          Rejected ({changesetCounts.rejected})
        </button>
      </div>

      {changesetsError ? (
        <p role="alert" className="errorText">
          {changesetsError}
        </p>
      ) : null}

      {changesetsLoading ? (
        <p className="mutedText">Loading changesets...</p>
      ) : filteredChangesets.length > 0 ? (
        <ul className="inboxList" aria-label="Changesets">
          {filteredChangesets.map((cs) => (
            <li key={cs.id}>
              <button
                type="button"
                className="nodeButton"
                data-testid={`changeset-${cs.id}`}
                onClick={() => setSelectedChangesetId(cs.id)}
                aria-current={selectedChangesetId === cs.id ? "true" : undefined}
              >
                <span className="nodeTitle">{cs.id}</span>
                <span className="nodeModule">{formatChangesetStatus(cs.status)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mutedText">(No {listFilter} changesets)</p>
      )}

      <div className="conceptSection" aria-label="Changeset details">
        {detailLoading ? (
          <p className="mutedText">Loading changeset...</p>
        ) : detailError ? (
          <p role="alert" className="errorText">
            {detailError}
          </p>
        ) : detail ? (
          <>
            <div className="inboxChangesetMeta">
              <span className="mutedText">
                {detail.changeset.id} • {formatChangesetStatus(detail.changeset.status)}
              </span>
              <span className="mutedText">
                Accepted: {acceptedCount}/{detail.items.length}
              </span>
              {impactRadius > 0 ? (
                <span className="impactRadius" data-testid="impact-radius">
                  Impact: {impactRadius} existing node{impactRadius !== 1 ? "s" : ""}
                </span>
              ) : null}
            </div>

            <div className="inboxItems" aria-label="Changeset items">
              {detail.items.map((item) => {
                const payload = isRecord(item.payload) ? item.payload : {};

                const evidenceChunkIds = toStringArray(payload.evidenceChunkIds);
                const hasEvidence = evidenceChunkIds.length > 0;

                const title =
                  item.entityType === "concept" && item.action === "create"
                    ? typeof payload.title === "string"
                      ? payload.title
                      : item.id
                    : item.entityType === "edge" && item.action === "create"
                      ? (() => {
                          const fromId =
                            typeof payload.fromConceptId === "string" ? payload.fromConceptId : "";
                          const toId =
                            typeof payload.toConceptId === "string" ? payload.toConceptId : "";
                          const type = typeof payload.type === "string" ? payload.type : "EDGE";
                          return `${getConceptTitle(
                            props.graph,
                            proposedConceptTitles,
                            fromId
                          )} ${type} ${getConceptTitle(props.graph, proposedConceptTitles, toId)}`;
                        })()
                      : item.entityType === "file" && item.action === "patch"
                        ? typeof payload.filePath === "string"
                          ? `Patch ${payload.filePath}`
                          : item.id
                      : `${item.entityType}/${item.action}`;

                return (
                  <div className="inboxItem" key={item.id} data-testid={`changeset-item-${item.id}`}>
                    <div className="inboxItemTop">
                      <div>
                        <div className="inboxItemTitle">{title}</div>
                        <div className="mutedText inboxItemMeta">
                          {item.entityType}/{item.action} • {item.status}
                        </div>
                      </div>

                      <div className="buttonRow">
                        <button
                          type="button"
                          className={item.status === "accepted" ? "primaryButton" : "secondaryButton"}
                          onClick={() => setItemStatus(item.id, "accepted")}
                          disabled={item.status === "applied"}
                          aria-label={`Accept item ${item.id}`}
                          data-testid={`changeset-item-${item.id}-accept`}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className={item.status === "rejected" ? "dangerButton" : "secondaryButton"}
                          onClick={() => setItemStatus(item.id, "rejected")}
                          disabled={item.status === "applied"}
                          aria-label={`Reject item ${item.id}`}
                          data-testid={`changeset-item-${item.id}-reject`}
                        >
                          Reject
                        </button>
                      </div>
                    </div>

                    {item.entityType === "concept" && item.action === "create" ? (
                      <div className="inboxPayload">
                        <div className="mutedText">
                          id: {typeof payload.id === "string" ? payload.id : "(missing)"}
                        </div>
                        {typeof payload.module === "string" ? (
                          <div className="mutedText">module: {payload.module}</div>
                        ) : null}
                      </div>
                    ) : null}

                    {item.entityType === "edge" && item.action === "create" ? (
                      <div className="inboxPayload">
                        <div className="mutedText">
                          from:{" "}
                          {typeof payload.fromConceptId === "string"
                            ? payload.fromConceptId
                            : "(missing)"}
                        </div>
                        <div className="mutedText">
                          to:{" "}
                          {typeof payload.toConceptId === "string"
                            ? payload.toConceptId
                            : "(missing)"}
                        </div>
                        <div className="mutedText">
                          type: {typeof payload.type === "string" ? payload.type : "(missing)"}
                        </div>
                      </div>
                    ) : null}

                    {item.entityType === "file" && item.action === "patch" ? (
                      <div className="inboxPayload">
                        <div className="mutedText">
                          file:{" "}
                          {typeof payload.filePath === "string" ? payload.filePath : "(missing)"}
                        </div>
                        {typeof payload.unifiedDiff === "string" ? (
                          <pre className="revisionDiff">{payload.unifiedDiff}</pre>
                        ) : (
                          <div className="mutedText">(missing diff)</div>
                        )}
                      </div>
                    ) : null}

                    {hasEvidence ? (
                      <div className="inboxEvidence" aria-label="Evidence chunks">
                        {evidenceChunkIds.map((id) => {
                          const ev = evidenceById.get(id);
                          if (!ev) {
                            return (
                              <div key={id} className="mutedText">
                                Missing evidence chunk: {id}
                              </div>
                            );
                          }
                          return (
                            <div className="evidenceItem" key={id}>
                              <div className="evidenceSourceRow">
                                <a href={ev.sourceUrl} target="_blank" rel="noreferrer">
                                  {ev.sourceTitle ?? ev.sourceUrl}
                                </a>
                                <span className="mutedText evidenceChunkMeta">Chunk {ev.id}</span>
                              </div>
                              <pre className="evidenceChunk">{ev.content}</pre>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="inboxApplyRow">
              <button
                type="button"
                className="primaryButton"
                data-testid="changeset-apply"
                onClick={applyAccepted}
                disabled={
                  applyLoading ||
                  detail.changeset.status === "applied" ||
                  detail.changeset.status === "rejected" ||
                  acceptedCount === 0 ||
                  detailLoading
                }
              >
                Apply accepted
              </button>
              {detail.changeset.status === "draft" ? (
                <button
                  type="button"
                  className="dangerButton"
                  onClick={rejectChangeset}
                  disabled={applyLoading || detailLoading}
                >
                  Reject changeset
                </button>
              ) : null}
              {applyResult ? <span className="mutedText">{applyResult}</span> : null}
            </div>

            {applyError ? (
              <p role="alert" className="errorText">
                {applyError}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mutedText">Select a changeset to inspect.</p>
        )}
      </div>
    </div>
  );
}
