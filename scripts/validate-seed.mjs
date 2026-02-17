import fs from "node:fs";
const g = JSON.parse(fs.readFileSync("fixtures/seed.graph.json", "utf8"));
console.log("Concepts:", g.concepts.length);
console.log("Edges:", g.edges.length);
console.log("Sources:", g.sources.length);
console.log("Chunks:", g.chunks.length);
console.log("Changesets:", g.changesets.length);
console.log("ChangesetItems:", g.changesetItems.length);
console.log("ReviewItems:", g.reviewItems.length);
console.log("ConceptSources:", g.conceptSources.length);

let issues = 0;
for (const c of g.concepts) {
  if (!c.id || !c.title || !c.kind) { console.log("Bad concept:", c.id); issues++; }
}
for (const e of g.edges) {
  if (!e.id || !e.fromConceptId || !e.toConceptId || !e.type) { console.log("Bad edge:", e.id); issues++; }
}
const validTypes = new Set(["PREREQUISITE_OF","PART_OF","USED_IN","CONTRASTS_WITH","ADDRESSES_FAILURE_MODE","INTRODUCED_BY","POPULARIZED_BY","CONFUSED_WITH","IS_A","ENABLES","REQUIRES","OPTIMIZED_BY","TRAINED_WITH","ALIGNED_WITH","EVALUATED_BY","INSTRUMENTED_BY","ATTACKED_BY","MITIGATED_BY","GOVERNED_BY","STANDARDIZED_BY","PRODUCES","CONSUMES","HAS_MAJOR_AREA","ANSWERED_BY","INSTANCE_OF","ADVANCES","COMPETES_WITH","DEPENDS_ON","INTRODUCED","GENERATIVE_PARADIGM","OFFERS_MODEL","INCLUDES_MODEL","HAS_VENDOR","HAS_MODEL_FAMILY","HAS_PLATFORM","IMPLEMENTS"]);
for (const e of g.edges) {
  if (!validTypes.has(e.type)) { console.log("Invalid edge type:", e.type, "in", e.id); issues++; }
}
const validKinds = new Set(["Domain","Concept","Method","Architecture","Pattern","Threat","Control","Metric","Benchmark","Protocol","Standard","Regulation","Tool","System","Artifact","Question","Company","ModelFamily","Model","Platform","Repository","License"]);
for (const c of g.concepts) {
  if (!validKinds.has(c.kind)) { console.log("Invalid kind:", c.kind, "in", c.id); issues++; }
}

const conceptIds = new Set(g.concepts.map(c => c.id));
for (const e of g.edges) {
  if (!conceptIds.has(e.fromConceptId)) { console.log("Dangling from:", e.fromConceptId, "in", e.id); issues++; }
  if (!conceptIds.has(e.toConceptId)) { console.log("Dangling to:", e.toConceptId, "in", e.id); issues++; }
}

console.log("\nValidation issues:", issues);

const byKind = {};
for (const c of g.concepts) { byKind[c.kind] = (byKind[c.kind] || 0) + 1; }
console.log("\nBy kind:", JSON.stringify(byKind, null, 2));

const byType = {};
for (const e of g.edges) { byType[e.type] = (byType[e.type] || 0) + 1; }
console.log("\nBy edge type:", JSON.stringify(byType, null, 2));
