import { describe, expect, it } from 'vitest';
import { colorForStage, stageColors } from './stageColors';

describe('colorForStage', () => {
  it('returns configured colors by stage name', () => {
    expect(colorForStage('LOVE')).toBe(stageColors.LOVE);
    expect(colorForStage('D&B FORGE')).toBe(stageColors['D&B FORGE']);
  });

  it('matches case-insensitively', () => {
    expect(colorForStage('love')).toBe(stageColors.LOVE);
  });

  it('returns undefined for unknown stages', () => {
    expect(colorForStage('VIP')).toBeUndefined();
  });
});
