import { GoogleGenAI } from '@google/genai';
import { getApiKey } from '../storage/keys';

// @google/genai is the new SDK replacing the deprecated @google/generative-ai (Issue D fix).
// API surface change: GoogleGenAI instance is used directly for streaming calls.

export type GeminiClient = GoogleGenAI;
export const GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Create a GoogleGenAI instance with the stored API key.
 * Throws if no API key is stored.
 */
export async function createGeminiClient(): Promise<GeminiClient> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  // @google/genai constructor: new GoogleGenAI({ apiKey })
  return new GoogleGenAI({ apiKey });
}
