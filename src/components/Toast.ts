/**
 * Tiny toast renderer. Multiple toasts stack and auto-dismiss after 2.5s.
 */

export type ToastKind = 'info' | 'success' | 'error';

export class ToastStack {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  show(message: string, kind: ToastKind = 'info', durationMs = 2500): void {
    const el = document.createElement('div');
    el.className = `ip-toast is-${kind}`;
    el.textContent = message;
    this.root.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 0.2s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    }, durationMs);
  }
}
