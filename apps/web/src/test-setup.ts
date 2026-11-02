import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.mock('./dashboard/useNow.js', () => ({
  useNow: () => new Date('2026-06-01T12:05:00.000Z'),
}));

afterEach(() => {
  cleanup();
});
