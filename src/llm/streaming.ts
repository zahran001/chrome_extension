import { createOpenAIClient, OPENAI_MODEL } from './openai';
import { buildPrompt } from './prompts';

export interface StreamMessage {
  type: 'generate';
  text: string;
  retryContext?: string;
}

/**
 * Stream an OpenAI response through a chrome.runtime.Port.
 * Sends {type:'token', text} for each chunk, {type:'done'} on completion,
 * {type:'error', error, errorType} on failure.
 *
 * port.onDisconnect is wired BEFORE the async loop starts so premature
 * SW kills are always caught (CLAUDE.md hard rule: port.onDisconnect before loop).
 *
 * AbortController is wired to the port disconnect event so the in-flight
 * HTTP request is cancelled immediately on dismiss.
 */
export async function streamToPort(
  port: chrome.runtime.Port,
  message: StreamMessage
): Promise<void> {
  let portAlive = true;
  const abort = new AbortController();

  // Wire BEFORE async loop — required per CLAUDE.md (port lifecycle hard rule)
  port.onDisconnect.addListener(() => {
    portAlive = false;
    abort.abort(); // Cancel in-flight HTTP request
  });

  try {
    const client = await createOpenAIClient();
    const { system, user } = buildPrompt(message.text, message.retryContext);

    const stream = await client.chat.completions.create(
      {
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: true,
      },
      { signal: abort.signal }
    );

    for await (const chunk of stream) {
      if (!portAlive) break;
      const text = chunk.choices[0]?.delta?.content;
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
    console.error('[RBA SW] OpenAI error (raw):', error.message, error);
    const errorType = classifyError(error);
    console.error('[RBA SW] Classified as:', errorType);

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
  if (msg.includes('incorrect api key') || msg.includes('invalid api key') || msg.includes('401')) return 'invalid-key';
  if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('429')) return 'rate-limited';
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('networkerror')) return 'network';
  return 'unknown';
}

function humanizeError(error: Error, errorType: ErrorType): string {
  switch (errorType) {
    case 'no-key':
      return 'No API key configured — open settings to add your OpenAI key.';
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
