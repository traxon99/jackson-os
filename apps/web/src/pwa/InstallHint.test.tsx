import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  InstallHint,
  isStandaloneDisplay,
  STORAGE_KEY,
} from './InstallHint.js';

describe('InstallHint', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('is hidden when running standalone', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('standalone'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const { container } = render(<InstallHint />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is hidden after dismiss', async () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      media: '',
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    const user = userEvent.setup();
    render(<InstallHint />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('exports standalone detection for tests', () => {
    expect(typeof isStandaloneDisplay).toBe('function');
  });
});
