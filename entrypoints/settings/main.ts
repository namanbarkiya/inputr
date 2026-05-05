/**
 * Settings page entrypoint. Reads/writes from chrome.storage.sync via the
 * lib/storage wrapper.
 */

import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';

import {
  loadSettings,
  resetSettings,
  saveSettings,
} from '../../src/lib/storage';
import type { ModeSettings } from '../../src/types/modes';

const els = {
  defaultFormat: document.getElementById(
    'default-format',
  ) as HTMLSelectElement,
  jpegQuality: document.getElementById('jpeg-quality') as HTMLInputElement,
  jpegQualityValue: document.getElementById(
    'jpeg-quality-value',
  ) as HTMLOutputElement,
  showBadge: document.getElementById('show-badge') as HTMLInputElement,
  saveBtn: document.getElementById('save-btn') as HTMLButtonElement,
  resetBtn: document.getElementById('reset-btn') as HTMLButtonElement,
  status: document.getElementById('status') as HTMLElement,
};

function applyToForm(s: ModeSettings): void {
  els.defaultFormat.value = s.defaultFormat;
  els.jpegQuality.value = String(s.jpegQuality);
  els.jpegQualityValue.value = String(s.jpegQuality);
  els.showBadge.checked = s.showBadge;
}

function readForm(): Partial<ModeSettings> {
  return {
    defaultFormat: els.defaultFormat.value as ModeSettings['defaultFormat'],
    jpegQuality: Number(els.jpegQuality.value),
    showBadge: els.showBadge.checked,
  };
}

function flashStatus(message: string): void {
  els.status.textContent = message;
  setTimeout(() => {
    if (els.status.textContent === message) els.status.textContent = '';
  }, 2000);
}

els.jpegQuality.addEventListener('input', () => {
  els.jpegQualityValue.value = els.jpegQuality.value;
});

els.saveBtn.addEventListener('click', () => {
  void (async () => {
    await saveSettings(readForm());
    flashStatus('Saved.');
  })();
});

els.resetBtn.addEventListener('click', () => {
  void (async () => {
    await resetSettings();
    applyToForm(await loadSettings());
    flashStatus('Reset to defaults.');
  })();
});

void (async () => {
  applyToForm(await loadSettings());
})();
