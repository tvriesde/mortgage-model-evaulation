import { AzureOpenAI } from 'openai';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import {
  computeMortgageDecision,
  type MortgageRequest,
  type Verdict,
} from '../rules/mortgageRules.js';
import { SYSTEM_PROMPT, buildUserMessage } from '../prompts/systemPrompt.js';

export interface AgentResult {
  verdict: Verdict;
  reason: string;
}

const VALID_VERDICTS: Verdict[] = ['approved', 'needs_review', 'declined'];

const COGNITIVE_SERVICES_SCOPE = 'https://cognitiveservices.azure.com/.default';

let cachedClient: AzureOpenAI | undefined;

function getClient(): AzureOpenAI {
  if (cachedClient) {
    return cachedClient;
  }

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-10-21';

  if (!endpoint || !deployment) {
    throw new Error(
      'Missing Azure OpenAI configuration: AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT are required.',
    );
  }

  const azureADTokenProvider = getBearerTokenProvider(
    new DefaultAzureCredential(),
    COGNITIVE_SERVICES_SCOPE,
  );

  cachedClient = new AzureOpenAI({ endpoint, deployment, apiVersion, azureADTokenProvider });
  return cachedClient;
}

function parseAgentResponse(content: string | null): AgentResult {
  if (!content) {
    throw new Error('Agent returned an empty response.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Agent response was not valid JSON.');
  }

  const record = parsed as Record<string, unknown>;
  const verdict = record.verdict;
  const reason = record.reason;

  if (typeof verdict !== 'string' || !VALID_VERDICTS.includes(verdict as Verdict)) {
    throw new Error(`Agent returned an invalid verdict: ${String(verdict)}`);
  }

  return {
    verdict: verdict as Verdict,
    reason: typeof reason === 'string' ? reason : '',
  };
}

// When AGENT_MOCK=true, the deterministic rules engine stands in for the model.
// This keeps local development and functional tests fully offline and reproducible.
function mockAgent(request: MortgageRequest): AgentResult {
  const decision = computeMortgageDecision(request);
  return { verdict: decision.verdict, reason: decision.reason };
}

export async function evaluateWithAgent(request: MortgageRequest): Promise<AgentResult> {
  if (process.env.AGENT_MOCK === 'true') {
    return mockAgent(request);
  }

  const client = getClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT as string;

  const completion = await client.chat.completions.create({
    model: deployment,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage(request) },
    ],
  });

  return parseAgentResponse(completion.choices[0]?.message?.content ?? null);
}
