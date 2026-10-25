import { describe, expect, it } from 'vitest';
import { SEED_PROFILE } from 'retina-example-shared';
import { RunCapacityError, createRunStoreRegistry } from '../src/run-stores.ts';

const TTL = 1_000;

function fakeClock(start = 0) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

const edited = { name: 'Active Run', email: 'active@example.com', city: 'Northfield' };

describe('createRunStoreRegistry', () => {
  it('never evicts a run that was used within the idle TTL, even when many other runs arrive', () => {
    const clock = fakeClock();
    const registry = createRunStoreRegistry({ maxRuns: 3, idleTtlMs: TTL, now: clock.now });
    registry.forRun('active-a').write(edited);

    registry.forRun('run-b');
    registry.forRun('run-c');
    clock.advance(TTL - 1);

    expect(() => registry.forRun('run-d')).toThrow(RunCapacityError);
    expect(registry.forRun('active-a').read()).toEqual(edited);
    expect(registry.size()).toBe(3);
  });

  it('rejects only the new run when full, keeping every existing run intact', () => {
    const clock = fakeClock();
    const registry = createRunStoreRegistry({ maxRuns: 2, idleTtlMs: TTL, now: clock.now });
    registry.forRun('run-a').write(edited);
    registry.forRun('run-b').write({ ...edited, name: 'Second' });

    for (let i = 0; i < 50; i += 1) {
      expect(() => registry.forRun(`newcomer-${i}`)).toThrow(RunCapacityError);
    }

    expect(registry.forRun('run-a').read().name).toBe('Active Run');
    expect(registry.forRun('run-b').read().name).toBe('Second');
  });

  it('reclaims a run idle past the TTL to admit a new run', () => {
    const clock = fakeClock();
    const registry = createRunStoreRegistry({ maxRuns: 2, idleTtlMs: TTL, now: clock.now });
    registry.forRun('idle-a').write(edited);
    clock.advance(TTL / 2);
    registry.forRun('busy-b').write({ ...edited, name: 'Busy' });
    clock.advance(TTL / 2);

    expect(() => registry.forRun('new-c')).not.toThrow();
    expect(registry.size()).toBe(2);
    expect(registry.forRun('busy-b').read().name).toBe('Busy');
  });

  it('counts any access, not only writes, as use', () => {
    const clock = fakeClock();
    const registry = createRunStoreRegistry({ maxRuns: 1, idleTtlMs: TTL, now: clock.now });
    registry.forRun('reader').write(edited);
    clock.advance(TTL - 1);
    registry.forRun('reader').read();
    clock.advance(TTL - 1);

    expect(() => registry.forRun('other')).toThrow(RunCapacityError);
    expect(registry.forRun('reader').read()).toEqual(edited);
  });

  it('end releases a run so its slot can be reused, and its data is gone', () => {
    const clock = fakeClock();
    const registry = createRunStoreRegistry({ maxRuns: 1, idleTtlMs: TTL, now: clock.now });
    registry.forRun('run-a').write(edited);

    expect(registry.end('run-a')).toBe(true);
    expect(registry.end('run-a')).toBe(false);
    expect(() => registry.forRun('run-b')).not.toThrow();
    expect(registry.end('run-b')).toBe(true);
    expect(registry.forRun('run-a').read()).toEqual(SEED_PROFILE);
  });

  it('keeps the default store outside the run limit', () => {
    const registry = createRunStoreRegistry({ maxRuns: 1, idleTtlMs: TTL, now: () => 0 });
    registry.forRun('run-a');
    registry.forRun(undefined).write(edited);

    expect(registry.size()).toBe(1);
    expect(registry.forRun(undefined).read()).toEqual(edited);
    expect(registry.forRun('run-a').read()).toEqual(SEED_PROFILE);
  });
});
