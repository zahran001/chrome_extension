export interface RememberPayload {
  selectedText: string;
  aiResponse: string;
  url: string;
  title: string;
  containerTag: string; // window.location.hostname — for future site-scoped search
}

export interface BookmarkItem {
  id: string;
  title: string | null;
  summary: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface Chunk {
  id: string;
  position: number;
  content: string;
  type: string;
  createdAt: string;
}

export async function listBookmarks(apiKey: string): Promise<BookmarkItem[]> {
  const response = await fetch('https://api.supermemory.ai/v3/documents/list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      filters: {
        AND: [
          { filterType: 'metadata', key: 'source', value: 'rubber-band-ai' },
        ],
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supermemory ${response.status}: ${body}`);
  }

  const data = await response.json();
  // API returns { memories: [...], pagination: { ... } }
  return (data.memories ?? data.documents ?? []) as BookmarkItem[];
}

export async function getDocumentChunks(apiKey: string, docId: string): Promise<Chunk[]> {
  const response = await fetch(`https://api.supermemory.ai/v3/documents/${docId}/chunks`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supermemory ${response.status}: ${body}`);
  }

  const data = await response.json();
  return (data.chunks ?? []) as Chunk[];
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
