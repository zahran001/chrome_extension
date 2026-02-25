/**
 * Build a Gemini prompt that auto-detects intent from the selected content.
 * The AI decides whether to explain, summarize, or solve based on the content itself.
 * This removes the need for user mode selection (LLM-02).
 */
export function buildPrompt(selectedText: string, retryContext?: string): string {
  const systemInstruction = `You are a helpful AI assistant embedded in a browser extension called Rubber-Band AI.
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

  const userContent = retryContext
    ? `Selected content:\n${selectedText}\n\nAdditional context from user:\n${retryContext}`
    : `Selected content:\n${selectedText}`;

  return `${systemInstruction}\n\n${userContent}`;
}
