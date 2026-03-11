export interface RememberPayload {
  selectedText: string;
  aiResponse: string;
  url: string;
  title: string;
  containerTag: string; // window.location.hostname — for future site-scoped search
}

export async function rememberDocument(
  apiKey: string,
  payload: RememberPayload
): Promise<void> {
  const content = `${payload.selectedText}\n\n---\n\n${payload.aiResponse}`;

  const response = await fetch('https://api.supermemory.ai/v3/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      content,
      containerTag: payload.containerTag.replace(/[^a-zA-Z0-9_-]/g, '-'),
      metadata: {
        source: 'rubber-band-ai',
        url: payload.url,
        title: payload.title,
        savedAt: new Date().toISOString(),
        model: 'gpt-4o-mini',
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supermemory ${response.status}: ${body}`);
  }
}
