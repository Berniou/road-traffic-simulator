export const GOOGLE_ROUTE_COLORS = Object.freeze([
  '#4285F4',
  '#EA4335',
  '#FBBC05',
  '#34A853',
  '#A142F4',
  '#F538A0',
  '#00BFA5',
  '#FF6D01',
  '#00ACC1',
  '#7B61FF',
]);

export function routeColor(routeId) {
  const match = /(\d+)\s*$/.exec(String(routeId ?? ''));
  const index = match ? Number(match[1]) - 1 : 0;
  const normalized = ((index % GOOGLE_ROUTE_COLORS.length) + GOOGLE_ROUTE_COLORS.length)
    % GOOGLE_ROUTE_COLORS.length;

  return GOOGLE_ROUTE_COLORS[normalized];
}
