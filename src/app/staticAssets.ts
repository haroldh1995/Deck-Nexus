const baseUrl = import.meta.env.BASE_URL;

export const staticAppAssets = Object.freeze({
  homeReference: `${baseUrl}assets/deck-nexus-home-reference.jpg`,
  deckWorkspaceReference: `${baseUrl}assets/deck-workspace-reference.jpg`,
  nexusMark: `${baseUrl}assets/deck-nexus-mark.svg`,
});

export const criticalHomeAssets = Object.freeze([
  staticAppAssets.homeReference,
]);
