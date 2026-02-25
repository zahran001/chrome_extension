export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class SelectionRenderer {
  private svgOverlay: SVGSVGElement | null = null;
  private confirmButton: HTMLButtonElement | null = null;
  private onConfirm: ((rect: DOMRect) => void) | null = null;
  private selectionStart: { x: number; y: number } | null = null;
  private currentSelection: SelectionRect | null = null;

  /** Attach confirm callback before starting drag */
  setOnConfirm(cb: (rect: DOMRect) => void): void {
    this.onConfirm = cb;
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
  endDrag(endX: number, endY: number): void {
    if (!this.selectionStart) return;

    const x = Math.min(this.selectionStart.x, endX);
    const y = Math.min(this.selectionStart.y, endY);
    const width = Math.abs(endX - this.selectionStart.x);
    const height = Math.abs(endY - this.selectionStart.y);

    // Skip if selection is too small (< 4x4px — accidental click)
    if (width < 4 || height < 4) {
      this.cleanup();
      return;
    }

    this.currentSelection = { x, y, width, height };
    this.showConfirmButton(x + width, y + height);
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

    const btn = document.createElement('button');
    btn.id = 'rubber-band-ai-confirm';
    btn.setAttribute('aria-label', 'Submit selection to AI');
    btn.textContent = '\u2192';

    // Position just outside bottom-right corner (per CONTEXT.md locked decision)
    Object.assign(btn.style, {
      position: 'fixed',
      left: `${rightX + 6}px`,
      top: `${bottomY + 6}px`,
      zIndex: '2147483647',
      background: '#4CAF50',
      color: 'white',
      border: 'none',
      borderRadius: '50%',
      width: '32px',
      height: '32px',
      fontSize: '16px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      fontFamily: 'sans-serif',
      lineHeight: '1',
    });

    btn.addEventListener('click', () => {
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

    document.documentElement.appendChild(btn);
    this.confirmButton = btn;
  }
}
