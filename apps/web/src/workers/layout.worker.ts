import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";

cytoscape.use(fcose);

export type LayoutRequest = {
  nodes: Array<{ data: { id: string; parent?: string }; [k: string]: unknown }>;
  edges: Array<{ data: { id: string; source: string; target: string }; [k: string]: unknown }>;
};

export type LayoutResponse = {
  positions: Array<{ id: string; x: number; y: number }>;
};

self.onmessage = (evt: MessageEvent<LayoutRequest>) => {
  const { nodes, edges } = evt.data;

  const cy = cytoscape({
    headless: true,
    elements: [...nodes, ...edges]
  });

  const layout = cy.layout({
    name: "fcose",
    animate: false,
    fit: true
  } as cytoscape.LayoutOptions);

  layout.run();

  const positions: LayoutResponse["positions"] = [];
  cy.nodes().forEach((node) => {
    const pos = node.position();
    positions.push({ id: node.id(), x: pos.x, y: pos.y });
  });

  const response: LayoutResponse = { positions };
  self.postMessage(response);

  cy.destroy();
};
