/**
 * Attempts to set a file input's value programmatically using DataTransfer.
 *
 * This works on plain HTML and most React sites. Fails on sites using
 * synthetic events or shadow-DOM file inputs (Twitter, parts of Notion).
 * Caller must handle false return value with a fallback (typically
 * copy-to-clipboard).
 *
 * Spec: HTMLInputElement.files is settable via DataTransferList.
 *   https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/files
 */

export function tryInsertIntoPage(
  fileInput: HTMLInputElement,
  blob: Blob,
  filename: string,
): boolean {
  try {
    const file = new File([blob], filename, { type: blob.type });
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;

    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Find candidate file inputs on the page that accept image uploads. Returns
 * inputs in DOM order; prefers visible ones first.
 */
export function findImageFileInputs(root: ParentNode = document): HTMLInputElement[] {
  const inputs = Array.from(
    root.querySelectorAll<HTMLInputElement>('input[type=file]'),
  ).filter((el) => {
    const accept = (el.getAttribute('accept') ?? '').toLowerCase();
    if (accept === '' || accept === '*') return true;
    return accept.includes('image');
  });

  return inputs.sort((a, b) => Number(isVisible(b)) - Number(isVisible(a)));
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
}

/**
 * Try-insert convenience for "use the first plausible input on the page".
 * Returns the result and the input it picked (or null if no input found).
 */
export function autoInsert(
  blob: Blob,
  filename: string,
  root: ParentNode = document,
): { ok: boolean; reason?: string } {
  const candidates = findImageFileInputs(root);
  if (candidates.length === 0) {
    return { ok: false, reason: 'no-input' };
  }
  const target = candidates[0];
  if (!target) return { ok: false, reason: 'no-input' };
  const ok = tryInsertIntoPage(target, blob, filename);
  return ok ? { ok: true } : { ok: false, reason: 'set-files-failed' };
}
