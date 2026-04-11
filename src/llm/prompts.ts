const MCQ_STORAGE_KEY = 'mcqMode';

/** Read MCQ mode from chrome.storage.local. Defaults to true. */
export async function getMcqMode(): Promise<boolean> {
  const result = await chrome.storage.local.get(MCQ_STORAGE_KEY);
  return result[MCQ_STORAGE_KEY] ?? true;
}

/** Save MCQ mode to chrome.storage.local. */
export async function setMcqMode(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [MCQ_STORAGE_KEY]: enabled });
}

/**
 * Build an OpenAI chat prompt that auto-detects intent from the selected content.
 * The AI decides whether to explain, summarize, or solve based on the content itself.
 * This removes the need for user mode selection (LLM-02).
 */
export function buildPrompt(selectedText: string, retryContext?: string, mcqMode = false): { system: string; user: string } {
  let system = `You are a helpful AI assistant embedded in a browser extension called Rubber-Band AI.
The user has selected a region of a webpage and wants immediate understanding.

Automatically detect the user's intent from the content:
- Technical explanation (code, formulas, technical terms) → explain clearly
- Long prose or articles → summarize concisely
- Problems, questions, or exercises → solve or answer
- Unknown content type → describe and explain

Rules:
- Be concise but complete. No preamble like "Sure!" or "Of course!"
- Plain text only. No markdown, no bullet points, no headers.
- If the selected text is too short or unclear, say so briefly.
- Respond in the same language as the selected text.`;

  if (mcqMode) {
    system += `

MCQ Mode is ON. If the selected content contains a multiple-choice question:
- Start your response with the correct answer on its own line.
  - If options are labeled (A, B, C, D or 1, 2, 3, 4), write: "Answer: B) the option text"
  - If options are listed without labels, write: "Answer: the correct option text"
- Then leave a blank line and provide a brief explanation.
- If the selected content is NOT a question, ignore these MCQ instructions and respond normally.`;
  }

  const user = retryContext
    ? `Selected content:\n${selectedText}\n\nAdditional context from user:\n${retryContext}`
    : `Selected content:\n${selectedText}`;

  return { system, user };
}
