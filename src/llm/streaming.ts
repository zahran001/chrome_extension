import { createGeminiClient, GEMINI_MODEL } from './gemini';
import { buildPrompt } from './prompts';

export interface StreamMessage {
  type: 'generate';
  text: string;
  retryContext?: string;
}

/**
 * Stream a Gemini response through a chrome.runtime.Port.
 * Sends {type:'token', text} for each chunk, {type:'done'} on completion,
 * {type:'error', error, errorType} on failure.
 *
 * port.onDisconnect is wired BEFORE the async loop starts so premature
 * SW kills are always caught (CLAUDE.md hard rule: port.onDisconnect before loop).
 *
 * AbortController is wired to the port disconnect event so the in-flight
 * HTTP request is cancelled immediately on dismiss (Suggestion A).
 */
export async function streamToPort(
  port: chrome.runtime.Port,
  message: StreamMessage
): Promise<void> {
  let portAlive = true;
  const abort = new AbortController();

  // Wire BEFORE async loop — required per CLAUDE.md (port lifecycle hard rule)
  // Also abort the in-flight Gemini HTTP request to stop BYOK charges (Suggestion A)
  port.onDisconnect.addListener(() => {
    portAlive = false;
    abort.abort(); // Cancel in-flight HTTP request
  });

  try {
    const ai = await createGeminiClient();
    const prompt = buildPrompt(message.text, message.retryContext);

    // @google/genai streaming API:
    // ai.models.generateContentStream({ model, contents, config? })
    // abortSignal is a field in GenerateContentConfig (confirmed from type defs)
    const result = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      // Pass AbortSignal so the HTTP request is cancelled on port disconnect
      config: { abortSignal: abort.signal },
    });

    for await (const chunk of result) {
      if (!portAlive) break; // Port was disconnected — stop iterating
      const text = chunk.text;
      if (text) {
        port.postMessage({ type: 'token', text });
      }
    }

    if (portAlive) {
      port.postMessage({ type: 'done' });
    }
  } catch (err) {
    // AbortError is expected on dismiss — don't surface as user-visible error
    if (err instanceof Error && err.name === 'AbortError') return;
    if (!portAlive) return; // Can't send error if port is closed

    const error = err instanceof Error ? err : new Error(String(err));
    const errorType = classifyError(error);

    port.postMessage({
      type: 'error',
      error: humanizeError(error, errorType),
      errorType,
    });
  }
}

type ErrorType = 'invalid-key' | 'rate-limited' | 'network' | 'no-key' | 'unknown';

function classifyError(error: Error): ErrorType {
  const msg = error.message.toLowerCase();
  if (msg.includes('no_api_key') || msg === 'no_api_key') return 'no-key';
  if (msg.includes('api_key_invalid') || msg.includes('api key not valid') || msg.includes('invalid api key')) return 'invalid-key';
  if (msg.includes('quota') || msg.includes('rate') || msg.includes('429')) return 'rate-limited';
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('networkerror')) return 'network';
  return 'unknown';
}

function humanizeError(error: Error, errorType: ErrorType): string {
  // Locked decision from CONTEXT.md: human-readable, no raw API error codes
  switch (errorType) {
    case 'no-key':
      return 'No API key configured — open settings to add your Gemini key.';
    case 'invalid-key':
      return 'API key invalid — check your key in settings.';
    case 'rate-limited':
      return 'Rate limit reached — wait a moment and try again.';
    case 'network':
      return 'Network error — check your connection and try again.';
    default:
      return 'Something went wrong — try again.';
  }
}
