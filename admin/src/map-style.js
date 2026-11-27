export const PARIS_SECOND_ARRONDISSEMENT = [2.3415, 48.8608];

export function createMapStyle() {
  return {
    version: 8,
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/backup_planet',
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#f5f7fa' },
      },
      {
        id: 'green-spaces',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: { 'fill-color': '#c8e6c9' },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': '#aad3df' },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['!=', ['get', 'class'], 'motorway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 18, 8],
        },
      },
      {
        id: 'motorways',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'motorway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#f6b93b',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 18, 12],
        },
      },
    ],
  };
}
