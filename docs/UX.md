# Graph AI Tutor (UX Spec)

## Product Metaphor (IDE for Concepts)
- Atlas (graph) = your dependency graph / architecture diagram
- Concept Workspace = the "file" you edit + distill
- Inbox = diagnostics / PRs (new edges, merges, contradictions)
- Review (quizzes) = unit tests for understanding

North star for UX decisions: everything should reduce to either (a) a subgraph you can see, (b) a mechanism you can step through, or (c) a test of recall you can pass.

## Screens
- Atlas (primary, 3-pane)
- Concept Workspace (right pane tab on Atlas)
- Inbox (review Changesets like PRs)
- Tutor (right pane tab on Atlas)
- Review (right pane tab + dedicated screen if needed)

## Primary Screen: Atlas (3-Pane Layout)
The Atlas screen is the default workspace and follows a fixed 3-pane layout:
- Left rail: Navigate
  - Global search (concepts, sources, edges, quizzes).
  - Filters (module labels like post-training / inference / agents / architectures).
  - Learning Paths list (auto + manual).
  - Inbox counter (pending extractions, merge suggestions, contradictions).
- Center: Visual Atlas
  - Zoomable graph (clustered by module).
  - Click node -> focus the node (k-hop neighborhood).
  - Shift-click two nodes -> highlight shortest path / prerequisite chain; allow "compare" diff.
  - Edge filtering by type; path highlighting; selection drives the right pane.
- Right: Work Area (tabbed)
  - Concept (canonical explanation + mechanism steps + prereqs + edges)
  - Evidence (source chunks justifying selected edges/claims)
  - Tutor (grounded chat + "show subgraph used")
  - Quizzes (review deck for this concept)
  - Notes (your edits + progressive summaries)

## Top Bar
- Command palette (Cmd/Ctrl-K): Add concept, Capture URL, Distill, Generate quiz, Merge duplicates, Show contradictions.
- Session context selector (optional): I'm learning / I'm teaching / I'm debugging confusion / I'm building graph.

Key visual principle: the graph is always present, but it collapses into Focus Mode whenever you're reading/learning so it never becomes a hairball.

## Atlas Focus Mode
Focus Mode is a UI state that prioritizes the Center pane for deep reading/study.
- Trigger:
  - User toggles Focus Mode (button + keyboard shortcut).
- Behavior:
  - Center pane expands.
  - Left pane becomes a minimized navigator (mini-map + search).
  - Right pane collapses to a narrow rail (recent tutor messages + "open" affordance).
- Exit:
  - User toggles off, or explicitly expands another pane.

## Concept Workspace (Right Pane)
The Concept Workspace is the default tab for the currently focused concept.
- Shows:
  - Title
  - Multi-resolution summaries:
    - L0: one-liner
    - L1: bullets
    - L2: step-by-step mechanism
    - L3+: deep dive (optional later)
  - Prerequisites (incoming PREREQUISITE_OF)
  - Dependents (outgoing edges)
  - Confusions (CONFUSED_WITH, if present)
- Edit rules:
  - User edits are direct (no LLM required).
  - Saving must round-trip through the API and update the Atlas without a full reload.

### Mechanism View (Default)
When possible, render concepts as a pipeline, not prose:
- What it is (1-2 lines)
- Inputs/Outputs
- Steps (5-12 steps)
- Where it breaks (failure modes)
- Knobs (parameters/design choices)
- Costs (latency/memory/bandwidth)

## Review Loop (Core Interaction)
The review loop is a tight cycle that turns exploration into practice.

### Review Objects
- ReviewItem:
  - Prompt (question)
  - Type (e.g., CLOZE, ORDERING_STEPS, COMPARE_CONTRAST)
  - Answer key + rubric (when applicable)
  - Evidence links (sources/chunks and/or Atlas nodes)
  - State: `draft | active | archived`
- Review attempt:
  - User answer
  - AI feedback (structured, not freeform JSON)
  - Outcome: `pass | needs_work` + rubric notes
  - User decision: accept/store vs discard

### Review Flow
1. User starts a review session from the right pane.
2. App shows the next review item.
3. User submits an answer.
4. Tutor returns feedback and a grade.
5. User explicitly approves storing the attempt and scheduling the next review.

### Review Rules
- Nothing is saved without explicit user approval.
- Tutor feedback must include citations to the context it used (sources/nodes).
- The UI must clearly indicate which context was provided to the tutor for that grade.

### Creating Review Items ("Remember")
From any concept (or tutor response), the user can pin a claim to remember:
- A mechanism step
- A contrast
- A failure mode
- A rule of thumb

This creates a ReviewItem draft linked back to the relevant concept(s)/edge(s)/chunk(s).

## Tutor Chat Rules
- Grounding is always explicit:
  - Show "Context pills" above the composer (focused node + any additional selected nodes/sources).
  - Messages that are not grounded should be labeled as such and discouraged.
- Tool/action boundaries are explicit:
  - Any action that modifies persisted state (creating review items, editing nodes, adding edges) is a proposal until user approves.
- Streaming:
  - Tutor responses may stream, but structured outputs must validate before being used for state updates.

## Navigation Patterns
- Breadcrumbs for conceptual hierarchy (module -> topic -> concept).
- "Concept call stack" while reading/explaining (jump back to prereqs quickly).
- Path highlighting:
  - Shift-click nodes A then B highlights connecting edges and shows why they connect (with evidence).

## Capture -> Extract -> Accept -> Distill
Two capture paths:
- Fast capture (lowest friction): paste text, drop PDF, paste URL -> goes to Capture Inbox -> pipeline runs (chunk/embed -> propose nodes/edges/merges/quizzes) -> nothing becomes truth until approved.
- Intent capture: add a concept stub -> ask to connect it to the existing graph -> approve edges like a PR review.

## Diagnostics (Always-On, Planned)
Graph diagnostics should be visible and actionable:
- orphan concepts (no prereqs, no dependents)
- high-degree hubs (need decomposition)
- duplicate clusters (synonym explosion)
- contradictions (two edges that cannot both be true)
- thin evidence edges (weak support)

## Inbox (Changeset Review)
Inbox is where LLM-proposed changes are reviewed and applied.
- List changesets with status (draft/applied) and source provenance.
- Changeset detail view:
  - Each item shows the proposed Concept/Edge change and its evidence chunks.
  - Per-item accept/reject.
  - "Apply accepted" writes to the graph tables; nothing applies automatically.
  - Items may include: new nodes/edges, merge suggestions, contradictions, low-confidence items needing review.

## Evidence Viewer
Evidence is always a first-class UI affordance.
- Selecting an edge shows its supporting chunk text and source metadata/link.
- Evidence must be visible in Inbox and in-context while exploring the Atlas.

## Quiz Types (Graph-Native, Planned)
- Mechanism ordering (drag/drop steps).
- Label-the-diagram (fill missing nodes/edges).
- Edge completion (fill the relationship).
- Counterfactual debugging ("if you disable X, what changes?").
- Teach-back (Feynman mode): compare a 60s explanation to the canonical neighborhood and show missing pieces.

## Key Flows (Minimum Set)
- Create workspace -> Import sources -> Build Atlas -> Explore -> Ask tutor -> Create review item -> Review.
- Explore -> Enter Focus Mode -> Ask tutor about focused node -> Exit Focus Mode.
- Review session -> Attempt -> Feedback -> Approve store -> Next item.
