import { describe, expect, it } from 'vitest';
import { defaultNotificationPreferences, normalizeNotificationPreferences } from './notifications';

describe('normalizeNotificationPreferences', () => {
  it('fills defaults for missing values', () => {
    expect(normalizeNotificationPreferences({ startsSoon: false })).toEqual({
      ...defaultNotificationPreferences,
      startsSoon: false,
    });
  });
});
