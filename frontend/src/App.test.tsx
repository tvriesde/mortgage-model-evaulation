import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

function mockFetchOnce(verdict: string, reason: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ verdict, reason }),
    })) as unknown as typeof fetch,
  );
}

describe('App wizard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('walks through the full flow and shows an approved result', async () => {
    mockFetchOnce('approved', 'requested loan is within income and property-value limits');
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/gross annual income/i), '50000');
    await user.type(screen.getByLabelText(/price of the home/i), '250000');
    await user.type(screen.getByLabelText(/how much do you want to borrow/i), '200000');
    await user.click(screen.getByRole('button', { name: /about you/i }));

    await user.type(screen.getByLabelText(/your age/i), '30');
    await user.click(screen.getByRole('button', { name: /check my mortgage/i }));

    await waitFor(() => expect(screen.getByTestId('result-verdict')).toHaveTextContent('approved'));
  });

  it('blocks progressing when required money fields are missing', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /about you/i }));

    expect(screen.getByText(/enter your gross annual income/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/your age/i)).not.toBeInTheDocument();
  });
});
