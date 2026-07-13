import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { evaluateWithAgent } from '../src/services/foundryAgent.js';

describe('evaluateWithAgent (mock mode)', () => {
  beforeEach(() => {
    process.env.AGENT_MOCK = 'true';
  });

  afterEach(() => {
    delete process.env.AGENT_MOCK;
  });

  it('returns a deterministic verdict from the rules engine when mocked', async () => {
    const result = await evaluateWithAgent({
      incomeSource: 'permanent',
      grossAnnualIncome: 50000,
      propertyValue: 250000,
      requestedLoanAmount: 200000,
      age: 30,
    });
    expect(result.verdict).toBe('approved');
    expect(typeof result.reason).toBe('string');
  });
});
