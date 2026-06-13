/** Stage border colors — add entries here as new stages appear. */
export const stageColors: Record<string, string> = {
  'LOVE': '#e07599',
  'D&B FORGE': '#03A9F4',
  'HARMONY HOUSE SQUARE': '#4db6ac',
  'TECHNO DOME': '#ba68c8',
  'EMPIRE': '#e57373',
  'FUTURE': '#9570ff',
};

export function colorForStage(stage: string): string | undefined {
  const trimmed = stage.trim();
  if (!trimmed) return undefined;

  const direct = stageColors[trimmed];
  if (direct) return direct;

  const upper = trimmed.toUpperCase();
  for (const [name, color] of Object.entries(stageColors)) {
    if (name.toUpperCase() === upper) return color;
  }

  return undefined;
}
