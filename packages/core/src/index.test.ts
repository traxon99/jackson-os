import { describe, expect, it } from 'vitest';
import { CORE_VERSION } from './index.js';

describe('CORE_VERSION', () => {
  it('is a string', () => {
    expect(typeof CORE_VERSION).toBe('string');
  });
});
