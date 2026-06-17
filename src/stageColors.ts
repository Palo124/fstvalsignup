/** Stage colors — keep aligned with STAGE_COLORS_ in apps-script/NotificationPlanning.gs */
export const stageColors: Record<string, string> = {
  'ABSOLUT': '#546e7a',
  'BRICKHOUSE AFTERPARTY MAIN': '#d84315',
  'BRICKHOUSE AFTERPARTY SECOND': '#ef6c57',
  'D&B FORGE': '#03A9F4',
  'EMPIRE': '#e57373',
  'FABRIC AFTERPARTY MAIN': '#6a1b9a',
  'FABRIC AFTERPARTY SECOND': '#8e24aa',
  'FREEDOM': '#43a047',
  'FUTURE': '#9570ff',
  'HARMONY HOUSE SQUARE': '#4db6ac',
  'HARMONY HOUSE SQUARE by EVROPA 2': '#4db6ac',
  'IQOS 18+': '#455a64',
  'KOFOLA NÁMĚSTÍ LÁSKY': '#f06292',
  'LOVE': '#e07599',
  'LOVE by ČSOB': '#e07599',
  'PSY': '#9c27b0',
  'TALKING BEATS': '#fb8c00',
  'TECHNO DOME': '#ba68c8',
  'TECHNO DOME by PROUD': '#ba68c8',
  'TUNNEL by ZYN': '#3949ab',
  'ZION by PENNY': '#00897b',
};

function stageColorLookupKeys(stage: string): string[] {
  const trimmed = stage.trim();
  if (!trimmed) {
    return [];
  }

  const keys = [trimmed];
  const withoutSuffix = trimmed.split(/\s+by\s+/i)[0]?.trim();
  if (withoutSuffix && withoutSuffix !== trimmed) {
    keys.push(withoutSuffix);
  }

  return keys;
}

export function colorForStage(stage: string): string | undefined {
  for (const candidate of stageColorLookupKeys(stage)) {
    const direct = stageColors[candidate];
    if (direct) {
      return direct;
    }

    const upper = candidate.toUpperCase();
    for (const [name, color] of Object.entries(stageColors)) {
      if (name.toUpperCase() === upper) {
        return color;
      }
    }
  }

  return undefined;
}
