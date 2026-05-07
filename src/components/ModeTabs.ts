/**
 * Mode tab strip.
 *
 * Renders one button per mode and reports clicks via onSelect. Visual
 * state (which tab is active) is reflected through `aria-selected`, so
 * styling drives off the attribute.
 */

import type { ModeId } from '../types/modes';

export interface ModeTabSpec {
  id: ModeId;
  label: string;
  /** Optional small caption shown under the label. Useful for hint
   *  text like "from your image" / "from scratch". */
  hint?: string;
}

export interface MountTabsOpts {
  tabs: ModeTabSpec[];
  active: ModeId;
  onSelect: (id: ModeId) => void;
}

export function mountModeTabs(
  root: HTMLElement,
  opts: MountTabsOpts,
): { setActive: (id: ModeId) => void } {
  root.replaceChildren();

  const buttons = new Map<ModeId, HTMLButtonElement>();

  for (const t of opts.tabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ip-tab';
    btn.role = 'tab';
    btn.dataset['mode'] = t.id;
    btn.setAttribute('aria-selected', String(t.id === opts.active));

    const label = document.createElement('span');
    label.className = 'ip-tab-label';
    label.textContent = t.label;
    btn.appendChild(label);

    if (t.hint) {
      const hint = document.createElement('span');
      hint.className = 'ip-tab-hint';
      hint.textContent = t.hint;
      btn.appendChild(hint);
    }

    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-selected') === 'true') return;
      opts.onSelect(t.id);
    });

    buttons.set(t.id, btn);
    root.appendChild(btn);
  }

  return {
    setActive(id: ModeId): void {
      for (const [tabId, btn] of buttons) {
        btn.setAttribute('aria-selected', String(tabId === id));
      }
    },
  };
}
