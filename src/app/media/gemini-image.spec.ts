import { describe, expect, it } from 'vitest';
import { IMAGE_MODEL, explainGeminiError } from './gemini-image.service';

/**
 * These are the failures a real key actually hits, quoted from real responses.
 * The quota one matters most: image generation has no free tier, so a brand-new
 * and otherwise valid key fails on every picture until billing is switched on —
 * and the raw response is a wall of JSON that reads like a broken app.
 */
const NO_FREE_QUOTA =
  '{"error":{"code":429,"message":"You exceeded your current quota, please check ' +
  'your plan and billing details.\\n* Quota exceeded for metric: ' +
  'generativelanguage.googleapis.com/generate_content_free_tier_requests, ' +
  'limit: 0, model: gemini-3.1-flash-image","status":"RESOURCE_EXHAUSTED"}}';

describe('explainGeminiError', () => {
  it('explains that image generation needs billing, when none was ever granted', () => {
    const explained = explainGeminiError(new Error(NO_FREE_QUOTA));
    expect(explained).toContain('no free quota');
    expect(explained).toContain('billing');
    // The point is to replace the JSON, not to prepend to it.
    expect(explained).not.toContain('RESOURCE_EXHAUSTED');
    expect(explained.length).toBeLessThan(NO_FREE_QUOTA.length);
  });

  it('says to top up when a billed account has run dry', () => {
    const explained = explainGeminiError(
      new Error(
        '{"error":{"code":429,"message":"Your prepayment credits are depleted. ' +
          'Please go to AI Studio at https://ai.studio/projects to manage your ' +
          'project and billing.","status":"RESOURCE_EXHAUSTED"}}',
      ),
    );
    expect(explained).toContain('prepaid credits');
    expect(explained).toContain('ai.studio/projects');
    // Not the same advice as a project with no image quota at all.
    expect(explained).not.toContain('no free quota');
  });

  /** A used-up allowance comes back; one that was never granted does not. */
  it('tells a spent allowance apart from one that never existed', () => {
    const spent = explainGeminiError(
      new Error('429 RESOURCE_EXHAUSTED: quota exceeded. Please retry in 11.31s'),
    );
    expect(spent).toContain('12 seconds');
    expect(spent).not.toContain('billing');
  });

  it('names the key when the key is the problem', () => {
    expect(explainGeminiError(new Error('API key not valid. Please pass a valid API key.'))).toContain(
      'Keys tab',
    );
  });

  it('points at the model name when the model has gone', () => {
    const explained = explainGeminiError(
      new Error('models/whatever is no longer available to new users'),
    );
    expect(explained).toContain(IMAGE_MODEL);
  });

  it('passes anything it does not recognise straight through', () => {
    expect(explainGeminiError(new Error('the network went away'))).toBe(
      'the network went away',
    );
    expect(explainGeminiError('a bare string')).toBe('a bare string');
  });
});
