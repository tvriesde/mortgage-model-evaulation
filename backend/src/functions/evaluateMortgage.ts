import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { validateMortgageRequest } from '../rules/validation.js';
import { evaluateWithAgent } from '../services/foundryAgent.js';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function evaluateMortgage(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return { status: 204, headers: CORS_HEADERS };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      status: 400,
      headers: CORS_HEADERS,
      jsonBody: { error: 'Request body must be valid JSON.' },
    };
  }

  const validation = validateMortgageRequest(body);
  if (!validation.ok || !validation.request) {
    return {
      status: 400,
      headers: CORS_HEADERS,
      jsonBody: { error: 'Invalid mortgage request.', details: validation.errors },
    };
  }

  try {
    const result = await evaluateWithAgent(validation.request);
    return {
      status: 200,
      headers: CORS_HEADERS,
      jsonBody: result,
    };
  } catch (error) {
    context.error('Agent evaluation failed', error);
    return {
      status: 502,
      headers: CORS_HEADERS,
      jsonBody: { error: 'The mortgage agent could not complete the evaluation.' },
    };
  }
}

app.http('evaluateMortgage', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'mortgage/evaluate',
  handler: evaluateMortgage,
});
