import { useMemo, useState } from "react";

import type { EvidenceChunk, GraphResponse, PostTutorResponse } from "@graph-ai-tutor/shared";

import { postTutor } from "./api/client";

function byId<T extends { id: string }>(items: T[] | undefined): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items ?? []) map.set(item.id, item);
  return map;
}

export function TutorPanel(props: {
  graph: GraphResponse | null;
  onHighlightConceptIds: (ids: string[]) => void;
}) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PostTutorResponse | null>(null);

  const nodeMap = useMemo(() => byId(props.graph?.nodes), [props.graph]);
  const edgeMap = useMemo(() => byId(props.graph?.edges), [props.graph]);

  const citationMap = useMemo(() => byId(response?.citations), [response]);

  async function ask() {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await postTutor({ question: q });
      setResponse(res);
      props.onHighlightConceptIds(res.result.used_concept_ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tutor request failed");
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setResponse(null);
    setError(null);
    props.onHighlightConceptIds([]);
  }

  return (
    <div className="tutorPanel">
      <div className="tutorHeader">
        <h3>Tutor</h3>
        <div className="buttonRow">
          <button
            type="button"
            className="ghostButton"
            onClick={clear}
            disabled={loading}
          >
            Clear
          </button>
        </div>
      </div>

      <label className="mutedText" htmlFor="tutor-question">
        Question
      </label>
      <textarea
        id="tutor-question"
        className="textInput"
        rows={4}
        placeholder="Ask about a concept..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <div className="buttonRow">
        <button
          type="button"
          className="primaryButton"
          onClick={ask}
          disabled={loading || !question.trim()}
        >
          Ask
        </button>
      </div>

      {loading ? <p className="mutedText">Thinking...</p> : null}

      {error ? (
        <p role="alert" className="errorText">
          {error}
        </p>
      ) : null}

      {response ? (
        <>
          <div className="conceptSection" aria-label="Tutor answer">
            <div className="sectionTitle">Answer</div>
            <pre className="tutorAnswer">{response.result.answer_markdown}</pre>
          </div>

          <div className="conceptSection" aria-label="Tutor citations">
            <div className="sectionTitle">Citations</div>
            <ul className="bullets">
              {response.result.cited_chunk_ids.map((id) => {
                const c = citationMap.get(id) as EvidenceChunk | undefined;
                return (
                  <li key={id}>
                    <div>
                      <code>{id}</code>
                      {c ? (
                        <>
                          {" "}
                          <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                            {c.sourceTitle ?? c.sourceUrl}
                          </a>
                        </>
                      ) : null}
                    </div>
                    {c ? <div className="tutorCitationText">{c.content}</div> : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="conceptSection" aria-label="Tutor used subgraph">
            <div className="sectionTitle">Used subgraph</div>

            <div className="tutorUsed">
              <div className="tutorUsedCol">
                <div className="mutedText">Nodes</div>
                <ul className="bullets">
                  {response.result.used_concept_ids.length === 0 ? (
                    <li className="mutedText">(None)</li>
                  ) : (
                    response.result.used_concept_ids.map((id) => (
                      <li key={id}>
                        <code>{id}</code>{" "}
                        <span>{nodeMap.get(id)?.title ?? "(missing title)"}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="tutorUsedCol">
                <div className="mutedText">Edges</div>
                <ul className="bullets">
                  {response.result.used_edge_ids.length === 0 ? (
                    <li className="mutedText">(None)</li>
                  ) : (
                    response.result.used_edge_ids.map((id) => {
                      const e = edgeMap.get(id);
                      return (
                        <li key={id}>
                          <code>{id}</code>{" "}
                          {e ? (
                            <span>
                              {e.fromConceptId} → {e.toConceptId} ({e.type})
                            </span>
                          ) : (
                            <span>(missing edge)</span>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="mutedText">Ask a question to get a grounded answer with citations.</p>
      )}
    </div>
  );
}

