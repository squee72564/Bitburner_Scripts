import { NS } from '@ns';
import { ReactDOM, cheatyDocument } from '/ui/react';

 export function cleanup(overlay: HTMLDivElement) {
  if (!overlay.isConnected) return;
  ReactDOM.unmountComponentAtNode(overlay);
  overlay.remove();
};

export function createOverlay(id: string): HTMLDivElement {
  const existing = cheatyDocument.getElementById(id);
  if (existing) {
    existing.remove();
  }
  const overlay = cheatyDocument.createElement('div');
  overlay.id = id;
  cheatyDocument.body.appendChild(overlay);

  return overlay;
}

export function injectTailwindStyles(
  ns: NS,
  options?: { id?: string; path?: string },
): void {
  const id = options?.id ?? 'bb-tailwind-styles';
  const path = options?.path ?? 'ui/tailwind.generated.txt';
  if (cheatyDocument.getElementById(id)) return;
  const css = ns.read(path);
  if (!css) {
    ns.tprint(`WARN no Tailwind CSS found at ${path}. Run build:tailwind.`);
    return;
  }
  const style = cheatyDocument.createElement('style');
  style.id = id;
  style.textContent = css;
  (cheatyDocument.head ?? cheatyDocument.body)?.appendChild(style);
}
