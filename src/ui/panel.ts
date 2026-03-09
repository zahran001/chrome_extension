// Vite inline import — REQUIRED for Shadow DOM CSS (per CONTEXT.md locked decision)
import panelStyles from './panel.css?inline';

export type PanelMode = 'loading' | 'setup' | 'streaming' | 'done' | 'error' | 'scratchpad';

export interface PanelOptions {
  mode: PanelMode;
  onRetry?: (retryContext: string) => void;
  onSend?: (text: string) => void;
  initialText?: string;
}

let activePanel: StreamPanel | null = null;

/** Create or update the result panel. */
export function showPanel(options: PanelOptions): StreamPanel {
  // Dismiss existing panel if present
  if (activePanel) {
    activePanel.dismiss();
  }
  activePanel = new StreamPanel(options);
  return activePanel;
}

export class StreamPanel {
  private dialog: HTMLDialogElement;
  private shadow!: ShadowRoot;
  private titleEl: HTMLSpanElement | null = null;
  private responseEl: HTMLDivElement | null = null;
  private accumulatedText = '';
  private onRetry: ((ctx: string) => void) | null = null;
  private onSend: ((text: string) => void) | null = null;
  private escapeHandler: ((e: KeyboardEvent) => void) | null = null;
  /** True only after a stream port has been opened — guards rba-dismiss from firing prematurely */
  hasActiveStream = false;
  private dragAbort: AbortController | null = null;

  constructor(options: PanelOptions) {
    this.onRetry = options.onRetry ?? null;
    this.onSend = options.onSend ?? null;
    this.dialog = this.createDialog();
    document.documentElement.appendChild(this.dialog);
    this.dialog.showModal(); // Top Layer (PNL-01)

    // Dismiss on Escape (PNL-05 locked)
    this.escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.dismiss();
      }
    };
    document.addEventListener('keydown', this.escapeHandler, { capture: true });

    // Render initial mode
    switch (options.mode) {
      case 'loading': this.showSkeleton(); break;
      case 'setup': this.showSetup(); break;
      case 'scratchpad': this.showScratchpad(options.initialText ?? ''); break;
      default: this.showSkeleton(); break;
    }

    // Listen for streaming events from content-script.ts
    this.bindStreamEvents();
  }

  /** Create the dialog element with Shadow DOM */
  private createDialog(): HTMLDialogElement {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('data-rba', 'result-panel');

    // Viewport-centered fixed positioning (PNL-01 locked: center of viewport always)
    Object.assign(dialog.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      margin: '0',
      padding: '0',
      border: 'none',
      background: 'transparent',
      maxWidth: 'none',
      maxHeight: 'none',
      outline: 'none',
    });

    // <dialog> does not support attachShadow per HTML spec (only specific elements do).
    // Use an inner <div> as the Shadow DOM host instead.
    const shadowHost = document.createElement('div');
    dialog.appendChild(shadowHost);

    // Shadow DOM on the inner host (PNL-01 locked: style isolation)
    this.shadow = shadowHost.attachShadow({ mode: 'open' });

    // adoptedStyleSheets pattern (CONTEXT.md REQUIRED implementation constraint)
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(panelStyles);
    this.shadow.adoptedStyleSheets = [sheet];

    // Build panel structure
    const container = document.createElement('div');
    container.className = 'panel-container';

    const header = document.createElement('div');
    header.className = 'panel-header';

    const title = document.createElement('span');
    title.className = 'panel-title';
    title.textContent = 'Rubber-Band AI';
    this.titleEl = title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '\u2715';
    closeBtn.setAttribute('aria-label', 'Close panel');
    closeBtn.addEventListener('click', () => this.dismiss());

    header.appendChild(title);
    header.appendChild(closeBtn);
    container.appendChild(header);
    this.shadow.appendChild(container);

    this.makeDraggable(dialog, header);

    return dialog;
  }

  /** Make the panel draggable by its header */
  private makeDraggable(dialog: HTMLDialogElement, header: HTMLDivElement): void {
    header.style.cursor = 'grab';

    header.addEventListener('mousedown', (e: MouseEvent) => {
      // Only drag on left-click on the header itself, not the close button
      if (e.button !== 0) return;
      if ((e.target as Element)?.closest('.close-btn')) return;

      // Resolve current position — first drag starts from centered transform
      const rect = dialog.getBoundingClientRect();
      dialog.style.transform = 'none';
      dialog.style.left = `${rect.left}px`;
      dialog.style.top = `${rect.top}px`;

      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;

      header.style.cursor = 'grabbing';

      const abort = new AbortController();
      this.dragAbort = abort;

      document.addEventListener('mousemove', (moveE: MouseEvent) => {
        const newLeft = moveE.clientX - startX;
        const newTop  = moveE.clientY - startY;
        // Clamp so panel stays on screen
        const maxLeft = window.innerWidth  - dialog.offsetWidth;
        const maxTop  = window.innerHeight - dialog.offsetHeight;
        dialog.style.left = `${Math.max(0, Math.min(newLeft, maxLeft))}px`;
        dialog.style.top  = `${Math.max(0, Math.min(newTop,  maxTop))}px`;
      }, { signal: abort.signal });

      document.addEventListener('mouseup', () => {
        header.style.cursor = 'grab';
        abort.abort();
        this.dragAbort = null;
      }, { signal: abort.signal, once: true });
    });
  }

  /** Show loading skeleton (PNL-02: within 500ms of confirmation) */
  private showSkeleton(): void {
    const body = this.getOrCreateBody();
    // Clear existing — safe here: skeleton is static HTML, no user content
    while (body.firstChild) body.removeChild(body.firstChild);
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-container';
    for (let i = 0; i < 4; i++) {
      const line = document.createElement('div');
      line.className = 'skeleton-line';
      skeleton.appendChild(line);
    }
    body.appendChild(skeleton);
  }

  /** Show API key setup prompt (KEY-04 first-run) */
  private showSetup(): void {
    const body = this.getOrCreateBody();
    // Safe — static content, no user data
    while (body.firstChild) body.removeChild(body.firstChild);

    const container = document.createElement('div');
    container.className = 'setup-container';

    const msg = document.createElement('p');
    msg.className = 'setup-message';
    // textContent only — no user data
    msg.textContent = 'Add your OpenAI API key to get started.';

    const setupBtn = document.createElement('button');
    setupBtn.className = 'setup-btn';
    setupBtn.textContent = 'Open Settings';
    setupBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'open-popup' });
    });

    container.appendChild(msg);
    container.appendChild(setupBtn);
    body.appendChild(container);
  }

  /** Show editable scratchpad — user can trim extracted text before sending */
  private showScratchpad(initialText: string): void {
    if (this.titleEl) this.titleEl.textContent = 'Inspect';

    const body = this.getOrCreateBody();
    while (body.firstChild) body.removeChild(body.firstChild);

    const wrapper = document.createElement('div');
    wrapper.className = 'scratchpad-wrapper';

    const textarea = document.createElement('textarea');
    textarea.className = 'scratchpad-textarea';
    textarea.setAttribute('aria-label', 'Extracted text — edit before sending');
    // textContent via .value — plain string, no HTML parsing, XSS safe
    textarea.value = initialText;
    textarea.autofocus = true;

    const charCount = document.createElement('div');
    charCount.className = 'char-count';

    const updateCharCount = () => {
      const len = textarea.value.length;
      charCount.textContent = `${len.toLocaleString()} / 20,000 chars`;
      charCount.className = 'char-count' + (len >= 20_000 ? ' limit' : len >= 15_000 ? ' warn' : '');
      sendBtn.disabled = textarea.value.trim().length === 0 || len > 20_000;
    };

    textarea.addEventListener('input', updateCharCount);

    wrapper.appendChild(textarea);
    wrapper.appendChild(charCount);
    body.appendChild(wrapper);

    // Action row
    const container = this.shadow.querySelector('.panel-container')!;

    const actions = document.createElement('div');
    actions.className = 'scratchpad-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'scratchpad-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.dismiss());

    const sendBtn = document.createElement('button');
    sendBtn.className = 'scratchpad-send-btn';
    sendBtn.textContent = 'Send →';
    sendBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text || text.length > 20_000) return;
      sendBtn.disabled = true;
      cancelBtn.disabled = true;
      if (this.onSend) this.onSend(text);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(sendBtn);
    container.appendChild(actions);

    // Init char count display
    updateCharCount();

    // Focus textarea after render
    requestAnimationFrame(() => textarea.focus());
  }

  /** Start streaming mode — shows response area + cursor */
  private startStreaming(): void {
    const body = this.getOrCreateBody();
    // Safe — clearing skeleton, no user content yet
    while (body.firstChild) body.removeChild(body.firstChild);

    const responseEl = document.createElement('div');
    responseEl.className = 'response-text';
    // XSS constraint: textContent only, NEVER innerHTML (CONTEXT.md HARD CONSTRAINT)
    responseEl.textContent = '';
    body.appendChild(responseEl);
    this.responseEl = responseEl;
  }

  /** Append a token to the streaming response (PNL-03) */
  appendToken(token: string): void {
    if (!this.responseEl) {
      this.startStreaming();
    }
    // XSS constraint: textContent += token (NEVER innerHTML)
    this.accumulatedText += token;
    this.responseEl!.textContent = this.accumulatedText;
  }

  /** Mark streaming as done — remove cursor, show actions */
  streamingDone(): void {
    if (this.responseEl) {
      this.responseEl.classList.add('streaming-done');
    }
    this.showActions();
  }

  /** Show error state (PNL-06) */
  showError(errorMessage: string, errorType: string): void {
    const body = this.getOrCreateBody();

    // Preserve partial response if we have any (locked: mid-stream failure)
    if (this.accumulatedText) {
      // Keep existing responseEl with partial text
      // Append interrupted notice below
      const notice = document.createElement('div');
      notice.className = 'interrupted-notice';
      // textContent only — error message may include user-adjacent text
      notice.textContent = 'Stream interrupted \u2014 partial response shown.';
      body.appendChild(notice);
    } else {
      // No partial response — show full error state
      // Safe — clearing skeleton
      while (body.firstChild) body.removeChild(body.firstChild);

      const container = document.createElement('div');
      container.className = 'error-container';

      const msg = document.createElement('div');
      msg.className = 'error-message';
      // textContent only — humanized error, no user content
      msg.textContent = errorMessage;

      container.appendChild(msg);

      // Action button for key errors (CONTEXT.md locked: clickable action buttons)
      if (errorType === 'invalid-key' || errorType === 'no-key') {
        const actionBtn = document.createElement('button');
        actionBtn.className = 'error-action-btn';
        actionBtn.textContent = 'Open Settings';
        actionBtn.addEventListener('click', () => {
          chrome.runtime.sendMessage({ type: 'open-popup' });
        });
        container.appendChild(actionBtn);
      }

      body.appendChild(container);
    }
  }

  /** Show mid-stream interruption (port.onDisconnect from SW kill) */
  showInterrupted(): void {
    if (!this.responseEl) return;
    if (this.responseEl) {
      this.responseEl.classList.add('streaming-done');
    }
    const body = this.getOrCreateBody();
    const notice = document.createElement('div');
    notice.className = 'interrupted-notice';
    notice.textContent = 'Stream interrupted \u2014 partial response shown.';
    body.appendChild(notice);
    this.showActions();
  }

  /** Show copy + retry actions after streaming completes */
  private showActions(): void {
    const container = this.shadow.querySelector('.panel-container');
    if (!container) return;

    // Action bar
    const actionBar = document.createElement('div');
    actionBar.className = 'panel-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(this.accumulatedText);
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.classList.remove('copied');
      }, 2000);
    });

    actionBar.appendChild(copyBtn);
    container.appendChild(actionBar);

    // Retry section (locked decision: text input + Enter/Send)
    const retrySection = document.createElement('div');
    retrySection.className = 'retry-section';

    const retryInput = document.createElement('input');
    retryInput.type = 'text';
    retryInput.className = 'retry-input';
    retryInput.placeholder = 'Add context or follow-up...';

    const retrySendBtn = document.createElement('button');
    retrySendBtn.className = 'retry-send-btn';
    retrySendBtn.textContent = 'Send';

    const submitRetry = () => {
      const ctx = retryInput.value.trim();
      if (!ctx) return;
      retrySendBtn.disabled = true;
      retryInput.disabled = true;
      if (this.onRetry) {
        this.onRetry(ctx);
      }
    };

    retryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitRetry();
    });
    retrySendBtn.addEventListener('click', submitRetry);

    retrySection.appendChild(retryInput);
    retrySection.appendChild(retrySendBtn);
    container.appendChild(retrySection);
  }

  /** Dismiss (close) the panel and cancel any in-flight OpenAI request */
  dismiss(): void {
    this.dragAbort?.abort();
    this.dragAbort = null;
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler, { capture: true });
      this.escapeHandler = null;
    }
    // Unbind stream events
    document.removeEventListener('rba-token', this.handleToken as EventListener);
    document.removeEventListener('rba-done', this.handleDone as EventListener);
    document.removeEventListener('rba-error', this.handleError as EventListener);
    document.removeEventListener('rba-interrupted', this.handleInterrupted as EventListener);

    // Cancel in-flight OpenAI request to stop BYOK charges (Suggestion A).
    // Only fire rba-dismiss if a stream port was actually opened — scratchpad panels
    // never open a port, so firing here would kill the next panel's port instead.
    if (this.hasActiveStream) {
      document.dispatchEvent(new CustomEvent('rba-dismiss'));
    }

    this.dialog.close();
    this.dialog.remove();

    if (activePanel === this) {
      activePanel = null;
    }
  }

  /** Bind custom events from content-script.ts for streaming */
  private bindStreamEvents(): void {
    document.addEventListener('rba-token', this.handleToken as EventListener);
    document.addEventListener('rba-done', this.handleDone as EventListener);
    document.addEventListener('rba-error', this.handleError as EventListener);
    document.addEventListener('rba-interrupted', this.handleInterrupted as EventListener);
  }

  private handleToken = (e: Event) => {
    const detail = (e as CustomEvent<string>).detail;
    this.appendToken(detail);
  };

  private handleDone = () => {
    this.streamingDone();
  };

  private handleError = (e: Event) => {
    const detail = (e as CustomEvent<{ error: string; errorType: string }>).detail;
    this.showError(detail.error, detail.errorType);
  };

  private handleInterrupted = () => {
    this.showInterrupted();
  };

  private getOrCreateBody(): HTMLDivElement {
    let body = this.shadow.querySelector('.panel-body') as HTMLDivElement;
    if (!body) {
      body = document.createElement('div');
      body.className = 'panel-body';
      const container = this.shadow.querySelector('.panel-container');
      container?.appendChild(body);
    }
    return body;
  }
}
