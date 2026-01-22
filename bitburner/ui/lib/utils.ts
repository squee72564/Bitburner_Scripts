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
