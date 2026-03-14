export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class SelectionRenderer {
  private svgOverlay: SVGSVGElement | null = null;
  private confirmButton: HTMLElement | null = null;
  private onConfirm: ((rect: DOMRect) => void) | null = null;
  private onPreview: ((rect: DOMRect) => void) | null = null;
  private selectionStart: { x: number; y: number } | null = null;
  private currentSelection: SelectionRect | null = null;

  /** Attach confirm callback before starting drag */
  setOnConfirm(cb: (rect: DOMRect) => void): void {
    this.onConfirm = cb;
  }

  /** Attach preview/scratchpad callback before starting drag */
  setOnPreview(cb: (rect: DOMRect) => void): void {
    this.onPreview = cb;
  }

  /** Called on mousedown to initialize the overlay SVG */
  startDrag(startX: number, startY: number): void {
    this.selectionStart = { x: startX, y: startY };
    this.createSvgOverlay();
  }

  /** Called on mousemove to update rubber-band in real time */
  updateDrag(currentX: number, currentY: number): void {
    if (!this.selectionStart || !this.svgOverlay) return;

    const x = Math.min(this.selectionStart.x, currentX);
    const y = Math.min(this.selectionStart.y, currentY);
    const width = Math.abs(currentX - this.selectionStart.x);
    const height = Math.abs(currentY - this.selectionStart.y);

    this.currentSelection = { x, y, width, height };
    this.updateSvgRect(x, y, width, height);
  }

  /** Called on mouseup — remove rubber-band, show confirm button */
  /** Returns false if the selection was too small (caller should deactivate selection mode). */
  endDrag(endX: number, endY: number): boolean {
    if (!this.selectionStart) return false;

    const x = Math.min(this.selectionStart.x, endX);
    const y = Math.min(this.selectionStart.y, endY);
    const width = Math.abs(endX - this.selectionStart.x);
    const height = Math.abs(endY - this.selectionStart.y);

    // Skip if selection is too small (< 4x4px — accidental click)
    if (width < 4 || height < 4) {
      this.cleanup();
      return false;
    }

    this.currentSelection = { x, y, width, height };
    this.showConfirmButton(x + width, y + height);
    return true;
  }

  /** Remove all visual elements (cancel or after confirm) */
  cleanup(): void {
    this.svgOverlay?.remove();
    this.svgOverlay = null;
    this.confirmButton?.remove();
    this.confirmButton = null;
    this.selectionStart = null;
    this.currentSelection = null;
  }

  private createSvgOverlay(): void {
    if (this.svgOverlay) this.svgOverlay.remove();

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'rubber-band-ai-overlay');
    svg.setAttribute('style', [
      'position: fixed',
      'top: 0',
      'left: 0',
      'width: 100vw',
      'height: 100vh',
      'pointer-events: none',
      'z-index: 2147483646',
    ].join('; '));

    // Marching ants keyframes (locked decision: animated dashed border)
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      @keyframes marching-ants {
        0% { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: 20; }
      }
    `;
    defs.appendChild(style);

    // Fill rect (semi-transparent ~20% opacity — per CONTEXT.md)
    const fillRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    fillRect.setAttribute('id', 'rba-fill');
    fillRect.setAttribute('fill', 'rgba(76, 175, 80, 0.2)');
    fillRect.setAttribute('stroke', 'none');

    // Border rect (marching ants — white + dark for light/dark page compatibility)
    const borderOuter = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    borderOuter.setAttribute('id', 'rba-border-outer');
    borderOuter.setAttribute('fill', 'none');
    borderOuter.setAttribute('stroke', 'rgba(0,0,0,0.5)');
    borderOuter.setAttribute('stroke-width', '2');

    const borderInner = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    borderInner.setAttribute('id', 'rba-border-inner');
    borderInner.setAttribute('fill', 'none');
    borderInner.setAttribute('stroke', 'white');
    borderInner.setAttribute('stroke-width', '2');
    borderInner.setAttribute('stroke-dasharray', '5, 5');
    borderInner.setAttribute('style', 'animation: marching-ants 0.4s linear infinite;');

    svg.appendChild(defs);
    svg.appendChild(fillRect);
    svg.appendChild(borderOuter);
    svg.appendChild(borderInner);
    document.documentElement.appendChild(svg);
    this.svgOverlay = svg;
  }

  private updateSvgRect(x: number, y: number, width: number, height: number): void {
    const attrs = { x: String(x), y: String(y), width: String(width), height: String(height) };
    for (const id of ['rba-fill', 'rba-border-outer', 'rba-border-inner']) {
      const el = this.svgOverlay?.getElementById(id);
      if (el) {
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      }
    }
  }

  private showConfirmButton(rightX: number, bottomY: number): void {
    // Remove rubber-band SVG on confirm
    this.svgOverlay?.remove();
    this.svgOverlay = null;

    // Wrapper container holds both buttons side by side
    const container = document.createElement('div');
    container.id = 'rubber-band-ai-confirm';
    Object.assign(container.style, {
      position: 'fixed',
      zIndex: '2147483647',
      display: 'flex',
      gap: '6px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      borderRadius: '6px',
      fontFamily: 'sans-serif',
    });

    // Shared button base styles
    const baseStyle: Partial<CSSStyleDeclaration> = {
      border: 'none',
      borderRadius: '6px',
      padding: '6px 12px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      lineHeight: '1',
      whiteSpace: 'nowrap',
    };

    // Primary: Analyze
    const analyzeBtn = document.createElement('button');
    analyzeBtn.setAttribute('aria-label', 'Analyze selection with AI');
    analyzeBtn.textContent = 'Analyze';
    Object.assign(analyzeBtn.style, {
      ...baseStyle,
      background: '#4CAF50',
      color: 'white',
    });
    analyzeBtn.addEventListener('click', () => {
      if (this.currentSelection && this.onConfirm) {
        const domRect = new DOMRect(
          this.currentSelection.x,
          this.currentSelection.y,
          this.currentSelection.width,
          this.currentSelection.height
        );
        this.cleanup();
        this.onConfirm(domRect);
      }
    });

    // Secondary: Edit text (scratchpad)
    const editBtn = document.createElement('button');
    editBtn.setAttribute('aria-label', 'Inspect and edit extracted text');
    editBtn.textContent = '✎ Edit text';
    Object.assign(editBtn.style, {
      ...baseStyle,
      background: '#ffffff',
      color: '#333',
      border: '1px solid #d0d0d0',
    });
    editBtn.addEventListener('click', () => {
      if (this.currentSelection && this.onPreview) {
        const domRect = new DOMRect(
          this.currentSelection.x,
          this.currentSelection.y,
          this.currentSelection.width,
          this.currentSelection.height
        );
        this.cleanup();
        this.onPreview(domRect);
      }
    });

    container.appendChild(analyzeBtn);
    container.appendChild(editBtn);

    // Clamp to viewport — measure combined width estimate (2 buttons ~180px)
    const containerWidth = 186;
    const containerHeight = 32;
    const clampedLeft = Math.min(rightX + 6, document.documentElement.clientWidth - containerWidth - 8);
    const clampedTop = Math.min(bottomY + 6, document.documentElement.clientHeight - containerHeight - 8);
    container.style.left = `${clampedLeft}px`;
    container.style.top = `${clampedTop}px`;

    document.documentElement.appendChild(container);
    this.confirmButton = container;
  }
}
