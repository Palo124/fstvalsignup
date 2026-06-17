import { describe, expect, it } from 'vitest';
import { colorForStage, stageColors } from './stageColors';

describe('colorForStage', () => {
  it('returns configured colors by stage name', () => {
    expect(colorForStage('LOVE')).toBe(stageColors.LOVE);
    expect(colorForStage('D&B FORGE')).toBe(stageColors['D&B FORGE']);
    expect(colorForStage('TUNNEL by ZYN')).toBe(stageColors['TUNNEL by ZYN']);
  });

  it('matches case-insensitively', () => {
    expect(colorForStage('love')).toBe(stageColors.LOVE);
    expect(colorForStage('talking beats')).toBe(stageColors['TALKING BEATS']);
  });

  it('matches sponsor suffixes used on the B4L site', () => {
    expect(colorForStage('LOVE by ČSOB')).toBe(stageColors['LOVE by ČSOB']);
    expect(colorForStage('TECHNO DOME by PROUD')).toBe(stageColors['TECHNO DOME by PROUD']);
    expect(colorForStage('HARMONY HOUSE SQUARE by EVROPA 2')).toBe(stageColors['HARMONY HOUSE SQUARE by EVROPA 2']);
  });

  it('returns undefined for unknown stages', () => {
    expect(colorForStage('VIP')).toBeUndefined();
  });
});
