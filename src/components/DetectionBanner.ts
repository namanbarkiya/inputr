/**
 * Detection / target panel.
 *
 * Auto-detection runs on every page load via the content script. When
 * it succeeds, the detected dimensions land in the inputs and the
 * matching preset (if any) gets selected. When it fails, the user
 * picks from a preset or types custom values.
 *
 * Layout, top to bottom:
 *   - Status line ("Auto-detected: LinkedIn banner" / "No site detected")
 *   - Preset dropdown with the common upload targets
 *   - Width and Height pixel inputs (free-typing flips preset to Custom)
 *   - Max file size slider (100 KB → 20 MB)
 *   - "Auto detect" button to re-run detection on the current page
 *
 * Every change is debounced and pushed via onOverride, which routes
 * through Mode.updateConstraints so the live cropper retargets in place
 * without losing the loaded image.
 */

import {
  CUSTOM_PRESET_ID as CUSTOM_ID,
  findPreset,
  SIZE_PRESETS as PRESETS,
  type SizePreset as Preset,
} from '../lib/presets';
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

const COMMIT_DEBOUNCE_MS = 250;
const MIN_PX = 8;
const MAX_PX = 16384;
const SIZE_MIN_KB = 100;
const SIZE_MAX_KB = 20 * 1024; // 20 MB
const SIZE_STEP_KB = 100;

export function mountDetectionBanner(
  root: HTMLElement,
  opts: MountOpts,
): void {
  root.replaceChildren();

  const startMatch = findMatchingPreset(opts.constraints);

  // ── Status line ──────────────────────────────────────────
  const status = document.createElement('div');
  status.className = 'ip-detect-status';
  const dot = document.createElement('span');
  dot.className = 'ip-detect-dot';
  const text = document.createElement('span');
  if (opts.detection?.detected) {
    dot.classList.add('is-on');
    const label = opts.constraints.label ?? 'page constraints';
    text.innerHTML = `Auto-detected: <strong></strong>`;
    text.querySelector('strong')!.textContent = label;
  } else {
    text.textContent = 'No site detected. Pick a preset or set custom values.';
  }
  status.append(dot, text);
  root.appendChild(status);

  // ── Preset row ────────────────────────────────────────────
  const presetWrap = document.createElement('label');
  presetWrap.className = 'ip-control';
  const presetLabel = document.createElement('span');
  presetLabel.className = 'ip-label';
  presetLabel.textContent = 'Preset';
  const presetSel = document.createElement('select');
  presetSel.className = 'ip-select';
  presetWrap.append(presetLabel, presetSel);

  const customOpt = document.createElement('option');
  customOpt.value = CUSTOM_ID;
  customOpt.textContent = 'Custom';
  presetSel.appendChild(customOpt);
  for (const p of PRESETS) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.label} · ${p.width} × ${p.height}`;
    presetSel.appendChild(o);
  }
  presetSel.value = startMatch?.id ?? CUSTOM_ID;

  // ── Width / Height row ───────────────────────────────────
  const dimsRow = document.createElement('div');
  dimsRow.className = 'ip-row';
  const width = mkPxInput('Width', opts.constraints.width);
  const height = mkPxInput('Height', opts.constraints.height);
  dimsRow.append(width.wrapper, height.wrapper);

  // ── Size slider row ──────────────────────────────────────
  const sizeWrap = document.createElement('div');
  sizeWrap.className = 'ip-control';
  const sizeHead = document.createElement('div');
  sizeHead.className = 'ip-control-head';
  const sizeLabel = document.createElement('span');
  sizeLabel.className = 'ip-label';
  sizeLabel.textContent = 'Max file size';
  const sizeValue = document.createElement('span');
  sizeValue.className = 'ip-control-value';
  sizeHead.append(sizeLabel, sizeValue);

  const sizeSlider = document.createElement('input');
  sizeSlider.type = 'range';
  sizeSlider.className = 'ip-range';
  sizeSlider.min = String(SIZE_MIN_KB);
  sizeSlider.max = String(SIZE_MAX_KB);
  sizeSlider.step = String(SIZE_STEP_KB);
  sizeSlider.value = String(
    clamp(
      Math.round(opts.constraints.maxSizeBytes / 1024),
      SIZE_MIN_KB,
      SIZE_MAX_KB,
    ),
  );
  sizeValue.textContent = formatSize(Number(sizeSlider.value));

  sizeWrap.append(sizeHead, sizeSlider);

  // ── Auto-detect button ───────────────────────────────────
  const detectWrap = document.createElement('div');
  detectWrap.className = 'ip-detection-actions';
  const detectBtn = document.createElement('button');
  detectBtn.type = 'button';
  detectBtn.className = 'ip-chip-btn';
  detectBtn.innerHTML = `<span class="ip-chip-dot"></span><span>Auto detect</span>`;
  detectBtn.title = 'Re-run detection on the current page';
  detectBtn.addEventListener('click', () => {
    void opts.onRescan();
  });
  detectWrap.appendChild(detectBtn);

  root.append(presetWrap, dimsRow, sizeWrap, detectWrap);

  // ── Wire commits ─────────────────────────────────────────
  let timer: number | null = null;

  const commit = (): void => {
    const w = clamp(Number(width.input.value), MIN_PX, MAX_PX);
    const h = clamp(Number(height.input.value), MIN_PX, MAX_PX);
    const sizeKB = clamp(
      Number(sizeSlider.value),
      SIZE_MIN_KB,
      SIZE_MAX_KB,
    );
    if (!Number.isFinite(w) || !Number.isFinite(h)) return;
    const next: DetectedConstraints = {
      ...opts.constraints,
      width: w,
      height: h,
      maxSizeBytes: sizeKB * 1024,
      source: 'manual',
    };
    if (sameAs(opts.constraints, next)) return;
    opts.constraints = next;
    opts.onOverride(next);
  };

  const debounceCommit = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      commit();
    }, COMMIT_DEBOUNCE_MS);
  };

  // Preset change → load values, commit immediately.
  presetSel.addEventListener('change', () => {
    if (presetSel.value === CUSTOM_ID) return;
    const p = PRESETS.find((x) => x.id === presetSel.value);
    if (!p) return;
    width.input.value = String(p.width);
    height.input.value = String(p.height);
    sizeSlider.value = String(p.sizeMB * 1024);
    sizeValue.textContent = formatSize(Number(sizeSlider.value));
    if (timer !== null) clearTimeout(timer);
    timer = null;
    commit();
  });

  // Manual edits flip the preset back to Custom.
  const onManualEdit = (): void => {
    presetSel.value = CUSTOM_ID;
    debounceCommit();
  };
  width.input.addEventListener('input', onManualEdit);
  height.input.addEventListener('input', onManualEdit);

  // Size slider live updates the value label and commits debounced.
  sizeSlider.addEventListener('input', () => {
    sizeValue.textContent = formatSize(Number(sizeSlider.value));
    // Editing the size doesn't change dimensions, so don't flip preset.
    debounceCommit();
  });

  // Flush on blur so leaving the field always settles.
  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    commit();
  };
  width.input.addEventListener('blur', flush);
  height.input.addEventListener('blur', flush);
  sizeSlider.addEventListener('change', flush);
}

function findMatchingPreset(c: DetectedConstraints): Preset | null {
  return findPreset(c.width, c.height);
}

function sameAs(a: DetectedConstraints, b: DetectedConstraints): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.maxSizeBytes === b.maxSizeBytes
  );
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function formatSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  const mb = kb / 1024;
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
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
