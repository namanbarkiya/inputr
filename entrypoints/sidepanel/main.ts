/**
 * Side panel entrypoint.
 *
 * v0.1 ships a single mode: Upload + Crop. The shell wires up:
 *   - Detection banner (reads chrome.storage.local for the active tab)
 *   - Output bar (Format select + Download / Copy / Try insert)
 *   - Toasts for transient feedback
 *
 * The Mode contract (src/types/modes.ts) is generic enough that future
 * modes (Create, Draw) drop in by satisfying the interface, and the
 * shell adds tabs back when there is more than one to choose between.
 */

import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';

import { mountDetectionBanner } from '../../src/components/DetectionBanner';
import { OutputBar } from '../../src/components/OutputBar';
import { ToastStack } from '../../src/components/Toast';
import {
  blobToBase64,
  copyBlobToClipboard,
  downloadBlob,
} from '../../src/lib/clipboard';
import { buildFilename } from '../../src/lib/filename';
import { pickOutputFormat } from '../../src/lib/format';
import { log } from '../../src/lib/logger';
import { sendMessage } from '../../src/lib/messaging';
import { loadDetection, loadSettings } from '../../src/lib/storage';
import { UploadCropMode } from '../../src/modes/upload-crop';
import {
  DEFAULT_CONSTRAINTS,
  type DetectedConstraints,
  type DetectionResult,
  type ImageFormat,
} from '../../src/types/detection';
import type { Mode, ModeContext } from '../../src/types/modes';

type FormatPreference = 'auto' | 'image/jpeg' | 'image/png';

interface PanelState {
  detection: DetectionResult | null;
  constraints: DetectedConstraints;
  currentMode: Mode | null;
  currentBlob: Blob | null;
  currentFilename: string;
  preferredFormat: FormatPreference;
  jpegQuality: number;
}

const state: PanelState = {
  detection: null,
  constraints: DEFAULT_CONSTRAINTS,
  currentMode: null,
  currentBlob: null,
  currentFilename: 'inputr.png',
  preferredFormat: 'auto',
  jpegQuality: 85,
};

const toasts = new ToastStack(
  document.getElementById('toast-stack') as HTMLElement,
);
const outputBar = new OutputBar({
  download: document.getElementById('btn-download') as HTMLButtonElement,
  copy: document.getElementById('btn-copy') as HTMLButtonElement,
  insert: document.getElementById('btn-insert') as HTMLButtonElement,
});

const modeHost = document.getElementById('mode-host') as HTMLElement;
const settingsBtn = document.getElementById(
  'open-settings',
) as HTMLButtonElement;
const formatSelect = document.getElementById(
  'format-select',
) as HTMLSelectElement;
const filenameLabel = document.getElementById('output-filename') as HTMLElement;

settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage().catch(() => {
    chrome.tabs
      .create({ url: chrome.runtime.getURL('settings.html') })
      .catch((err: unknown) => log.warn('panel', 'open settings failed', err));
  });
});

formatSelect.addEventListener('change', () => {
  state.preferredFormat = formatSelect.value as FormatPreference;
  applyFormatChange();
});

void bootstrap();

async function bootstrap(): Promise<void> {
  const settings = await loadSettings();
  state.preferredFormat = settings.defaultFormat;
  state.jpegQuality = settings.jpegQuality;
  formatSelect.value = settings.defaultFormat;

  const tab = await getActiveTab();
  if (tab?.id !== undefined) {
    state.detection = await loadDetection(tab.id);
  }
  state.constraints = state.detection?.constraints ?? DEFAULT_CONSTRAINTS;

  mountDetectionBanner(
    document.getElementById('detection-banner') as HTMLElement,
    {
      detection: state.detection,
      constraints: state.constraints,
      onOverride: (next) => {
        state.constraints = next;
        applyConstraintsChange();
      },
      onRescan: async () => {
        await sendMessage({ kind: 'detection:rescan' });
        toasts.show('Rescanning page…', 'info');
        setTimeout(() => {
          void refreshDetection();
        }, 800);
      },
    },
  );

  outputBar.bind({
    onDownload: () => handleDownload(),
    onCopy: () => handleCopy(),
    onInsert: () => handleInsert(),
  });
  outputBar.setEnabled(false);

  await mountMode();
}

function resolveFormat(): ImageFormat {
  return pickOutputFormat(
    state.preferredFormat,
    state.constraints.acceptedFormats,
  );
}

async function mountMode(): Promise<void> {
  state.currentMode?.destroy();
  modeHost.replaceChildren();
  state.currentBlob = null;
  outputBar.setEnabled(false);
  filenameLabel.textContent = '';

  const mode: Mode = new UploadCropMode();
  state.currentMode = mode;

  const ctx: ModeContext = {
    container: modeHost,
    constraints: state.constraints,
    format: resolveFormat(),
    jpegQuality: state.jpegQuality,
    onOutput: (blob, filename) => {
      state.currentBlob = blob;
      state.currentFilename = filename;
      outputBar.setEnabled(true);
      filenameLabel.textContent = filename;
    },
    onToast: (msg, kind) => toasts.show(msg, kind ?? 'info'),
  };

  try {
    await mode.render(ctx);
  } catch (err) {
    log.error('panel', 'mode render failed', err);
    toasts.show('Failed to load mode', 'error');
  }
}

async function refreshDetection(): Promise<void> {
  const tab = await getActiveTab();
  if (tab?.id === undefined) return;
  state.detection = await loadDetection(tab.id);
  state.constraints = state.detection?.constraints ?? DEFAULT_CONSTRAINTS;
  mountDetectionBanner(
    document.getElementById('detection-banner') as HTMLElement,
    {
      detection: state.detection,
      constraints: state.constraints,
      onOverride: (next) => {
        state.constraints = next;
        applyConstraintsChange();
      },
      onRescan: async () => {
        await sendMessage({ kind: 'detection:rescan' });
      },
    },
  );
  applyConstraintsChange();
}

/**
 * Push a constraints change into the live mode without remounting.
 * If the mode does not implement updateConstraints, fall back to a full
 * remount (which loses any in-progress state).
 */
function applyConstraintsChange(): void {
  const mode = state.currentMode;
  if (mode?.updateConstraints) {
    mode.updateConstraints(state.constraints);
    state.currentBlob = null;
    outputBar.setEnabled(false);
    filenameLabel.textContent = '';
  } else {
    void mountMode();
  }
}

function applyFormatChange(): void {
  const mode = state.currentMode;
  const f = resolveFormat();
  if (mode?.updateFormat) {
    mode.updateFormat(f, state.jpegQuality);
    state.currentBlob = null;
    outputBar.setEnabled(false);
    filenameLabel.textContent = '';
  } else {
    void mountMode();
  }
}

async function handleDownload(): Promise<void> {
  const blob = await currentBlob();
  if (!blob) return;
  downloadBlob(blob, state.currentFilename);
  toasts.show('Saved to Downloads', 'success');
}

async function handleCopy(): Promise<void> {
  const blob = await currentBlob();
  if (!blob) return;
  const ok = await copyBlobToClipboard(blob);
  toasts.show(
    ok ? 'Copied. Paste into the upload box.' : 'Copy failed',
    ok ? 'success' : 'error',
  );
}

async function handleInsert(): Promise<void> {
  const blob = await currentBlob();
  if (!blob) return;
  try {
    const dataB64 = await blobToBase64(blob);
    const result = (await sendMessage({
      kind: 'page:try-insert',
      payload: {
        dataB64,
        mime: blob.type || 'image/png',
        filename: state.currentFilename,
      },
    })) as { ok: boolean; reason?: string } | undefined;

    if (result?.ok) {
      toasts.show(
        'Inserted. If the site rejects it, click Download instead.',
        'success',
      );
      return;
    }
    // Fallback: copy to clipboard for the user to paste.
    const copied = await copyBlobToClipboard(blob);
    toasts.show(
      copied
        ? 'Insert not supported on this site. Copied to clipboard instead.'
        : 'Insert and copy both failed. Use Download.',
      copied ? 'info' : 'error',
    );
  } catch (err) {
    log.warn('panel', 'try-insert error', err);
    toasts.show('Insert failed. Use Download instead.', 'error');
  }
}

async function currentBlob(): Promise<Blob | null> {
  if (state.currentBlob) return state.currentBlob;
  const fromMode = (await state.currentMode?.getOutputBlob()) ?? null;
  if (fromMode) {
    state.currentBlob = fromMode;
    const format = (fromMode.type as ImageFormat) || resolveFormat();
    state.currentFilename = buildFilename({
      constraints: state.constraints,
      format,
    });
    filenameLabel.textContent = state.currentFilename;
  }
  return state.currentBlob;
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return undefined;
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tab;
}
