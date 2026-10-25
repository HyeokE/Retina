import { describe, expect, it } from 'vitest';
import { resolveLocator, type LocatorMap } from '../../src/index.ts';

const LOCATORS: LocatorMap = {
  'profile.name': { web: 'profile-name', ios: 'profile-name', android: 'profile_name' },
  'profile.save': { web: 'profile-save' },
};

describe('resolveLocator', () => {
  it('resolves a logical id to the identifier of the requested platform', () => {
    expect(resolveLocator(LOCATORS, 'profile.name', 'android')).toEqual({ ok: true, locator: 'profile_name' });
    expect(resolveLocator(LOCATORS, 'profile.save', 'web')).toEqual({ ok: true, locator: 'profile-save' });
  });

  it('reports an unknown logical id', () => {
    expect(resolveLocator(LOCATORS, 'profile.missing', 'web')).toEqual({ ok: false, reason: 'unknown_locator' });
  });

  it('reports a logical id without an identifier for the platform', () => {
    expect(resolveLocator(LOCATORS, 'profile.save', 'ios')).toEqual({ ok: false, reason: 'locator_missing_for_platform' });
  });

  it('does not resolve inherited object properties', () => {
    expect(resolveLocator(LOCATORS, 'toString', 'web')).toEqual({ ok: false, reason: 'unknown_locator' });
  });
});
