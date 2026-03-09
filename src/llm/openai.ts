import OpenAI from 'openai';
import { getApiKey } from '../storage/keys';

export type OpenAIClient = OpenAI;
export const OPENAI_MODEL = 'gpt-4o-mini';

/**
 * Create an OpenAI instance with the stored API key.
 * Throws if no API key is stored.
 */
export async function createOpenAIClient(): Promise<OpenAIClient> {
  const apiKey = await getApiKey();
  console.log('[RBA SW] createOpenAIClient: apiKey present?', !!apiKey, 'length:', apiKey?.length ?? 0);
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  return new OpenAI({ apiKey, dangerouslyAllowBrowser: false });
}
