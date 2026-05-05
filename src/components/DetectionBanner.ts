/**
 * Detection banner.
 *
 * Top line summarises the current target (detected or manual). Below
 * that, two always-visible pixel inputs let the user retarget width and
 * height in place. Edits are debounced and pushed to the panel via
 * onOverride, which routes through Mode.updateConstraints so the loaded
 * image survives. A Rescan link stays accessible for re-running site
 * detection.
 */

import { formatConstraints } from '../lib/format';
import type {
  DetectedConstraints,
  DetectionResult,
} from '../types/detection';

interface MountOpts {
  detection: DetectionResult | null;
  constraints: DetectedConstraints;
  onOverride: (next: DetectedConstraints) => void;
  onRescan: () => void | Promise<void>;
}

const COMMIT_DEBOUNCE_MS = 300;
const MIN_PX = 8;
const MAX_PX = 16384;

export function mountDetectionBanner(
  root: HTMLElement,
  opts: MountOpts,
): void {
  root.replaceChildren();

  // ── Headline ──────────────────────────────────────────────
  const headline = document.createElement('div');
  if (opts.detection?.detected) {
    headline.innerHTML = `<strong>${
      opts.constraints.label ?? 'Detected on this page'
    }:</strong> ${formatConstraints(opts.constraints)}`;
  } else {
    headline.innerHTML =
      '<strong>No upload constraints detected.</strong> Edit dimensions below.';
  }
  root.appendChild(headline);

  // ── Width / Height inputs ────────────────────────────────
  const dimsRow = document.createElement('div');
  dimsRow.className = 'ip-row';

  const width = mkPxInput('Width', opts.constraints.width);
  const height = mkPxInput('Height', opts.constraints.height);
  dimsRow.append(width.wrapper, height.wrapper);
  root.appendChild(dimsRow);

  // ── Rescan link ──────────────────────────────────────────
  const actions = document.createElement('div');
  actions.className = 'ip-detection-actions';
  const rescan = document.createElement('button');
  rescan.type = 'button';
  rescan.className = 'ip-link-btn';
  rescan.textContent = 'Rescan';
  rescan.addEventListener('click', () => {
    void opts.onRescan();
  });
  actions.appendChild(rescan);
  root.appendChild(actions);

  // ── Live commit ──────────────────────────────────────────
  let timer: number | null = null;
  const commit = (): void => {
    const w = clamp(Number(width.input.value), MIN_PX, MAX_PX);
    const h = clamp(Number(height.input.value), MIN_PX, MAX_PX);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return;
    if (w === opts.constraints.width && h === opts.constraints.height) return;
    const next: DetectedConstraints = {
      ...opts.constraints,
      width: w,
      height: h,
      source: 'manual',
    };
    // Update local copy so the next commit-skip check (above) works
    // against the latest values within this banner instance.
    opts.constraints = next;
    headline.innerHTML = `<strong>${
      next.label ?? 'Custom size'
    }:</strong> ${formatConstraints(next)}`;
    opts.onOverride(next);
  };

  const onInput = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      commit();
    }, COMMIT_DEBOUNCE_MS);
  };

  width.input.addEventListener('input', onInput);
  height.input.addEventListener('input', onInput);

  // Commit on blur immediately so leaving the field always settles.
  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    commit();
  };
  width.input.addEventListener('blur', flush);
  height.input.addEventListener('blur', flush);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function mkPxInput(
  labelText: string,
  initial: number,
): { wrapper: HTMLElement; input: HTMLInputElement } {
  const wrapper = document.createElement('label');
  wrapper.className = 'ip-control';
  const span = document.createElement('span');
  span.className = 'ip-label';
  span.textContent = `${labelText} (px)`;
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'ip-input';
  input.min = String(MIN_PX);
  input.max = String(MAX_PX);
  input.step = '1';
  input.inputMode = 'numeric';
  input.value = String(initial);
  wrapper.append(span, input);
  return { wrapper, input };
}
