import type { AgentResult, MortgageRequest } from './types';

// Same-origin `/api` works when the Static Web App is linked to the Functions backend.
// Override with VITE_API_BASE_URL for local development against a separate func host.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

export async function evaluateMortgage(request: MortgageRequest): Promise<AgentResult> {
  const response = await fetch(`${API_BASE_URL}/mortgage/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let message = 'The mortgage check could not be completed. Please try again.';
    try {
      const body = await response.json();
      if (body?.error) {
        message = body.error;
      }
    } catch {
      // keep the default message
    }
    throw new Error(message);
  }

  return (await response.json()) as AgentResult;
}
