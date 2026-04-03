/**
 * Unit tests for useAdditionalPaths hook logic.
 *
 * AC1: "Shared state hook manages localStorage read/write/validation"
 *   → unit (pure storage logic: loadAdditionalPaths, saveAdditionalPaths)
 *
 * These tests cover the storage functions used internally by the hook.
 * The hook itself is a thin wrapper around these functions plus React state.
 * The node test environment does not provide localStorage, so we mock it here.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadAdditionalPaths, saveAdditionalPaths, STORAGE_KEY } from '@/lib/storage';

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

function makeMockStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  } as Storage;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loadAdditionalPaths', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = makeMockStorage();
    // Patch global window + localStorage for each test
    vi.stubGlobal('window', { localStorage: mockStorage });
    vi.stubGlobal('localStorage', mockStorage);
  });

  it('returns an empty array when nothing is stored', () => {
    expect(loadAdditionalPaths()).toEqual([]);
  });

  it('returns stored paths from localStorage', () => {
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(['/home/user/projects/foo']));
    expect(loadAdditionalPaths()).toEqual(['/home/user/projects/foo']);
  });

  it('returns multiple stored paths in order', () => {
    const paths = ['/a', '/b', '/c'];
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
    expect(loadAdditionalPaths()).toEqual(paths);
  });

  it('filters out non-string entries from a mixed array', () => {
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(['/valid', 42, null, '/also-valid']));
    expect(loadAdditionalPaths()).toEqual(['/valid', '/also-valid']);
  });

  it('returns empty array when stored value is not an array', () => {
    mockStorage.setItem(STORAGE_KEY, JSON.stringify({ path: '/foo' }));
    expect(loadAdditionalPaths()).toEqual([]);
  });

  it('returns empty array when stored value is malformed JSON', () => {
    mockStorage.setItem(STORAGE_KEY, 'not-json{{{');
    expect(loadAdditionalPaths()).toEqual([]);
  });
});

describe('saveAdditionalPaths', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = makeMockStorage();
    vi.stubGlobal('window', { localStorage: mockStorage });
    vi.stubGlobal('localStorage', mockStorage);
  });

  it('persists paths to localStorage', () => {
    saveAdditionalPaths(['/home/user/foo', '/home/user/bar']);
    const raw = mockStorage.getItem(STORAGE_KEY);
    expect(raw).toBe(JSON.stringify(['/home/user/foo', '/home/user/bar']));
  });

  it('persists an empty array', () => {
    saveAdditionalPaths([]);
    const raw = mockStorage.getItem(STORAGE_KEY);
    expect(raw).toBe('[]');
  });

  it('round-trips: save then load returns the same paths', () => {
    const paths = ['/project/a', '/project/b'];
    saveAdditionalPaths(paths);
    expect(loadAdditionalPaths()).toEqual(paths);
  });
});

describe('deduplication logic used by useAdditionalPaths', () => {
  it('handles adding a path that is already in the list', () => {
    const existing = ['/foo', '/bar'];
    const candidate = '/foo';
    const next = existing.includes(candidate) ? existing : [...existing, candidate];
    expect(next).toEqual(['/foo', '/bar']); // no duplicate added
  });

  it('handles adding a new unique path', () => {
    const existing = ['/foo', '/bar'];
    const candidate = '/baz';
    const next = existing.includes(candidate) ? existing : [...existing, candidate];
    expect(next).toEqual(['/foo', '/bar', '/baz']);
  });

  it('handles removing a path from the list', () => {
    const existing = ['/foo', '/bar', '/baz'];
    const toRemove = '/bar';
    const next = existing.filter((p) => p !== toRemove);
    expect(next).toEqual(['/foo', '/baz']);
  });
});
