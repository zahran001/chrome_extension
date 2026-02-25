// Panel stub — minimal export so content-script.ts static import compiles.
// Full implementation overwritten by Plan 06.

export interface PanelOptions {
  mode: 'loading' | 'setup' | 'result';
}

export function showPanel(_options: PanelOptions): void {
  // Stub — implemented in Plan 06
}
