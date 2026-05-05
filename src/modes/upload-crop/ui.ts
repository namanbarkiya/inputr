/**
 * Upload + Crop DOM scaffolding. Splits cleanly from the controller logic
 * in index.ts so tests can mount the UI without involving Cropper.js.
 *
 * The cropper container is hidden in the initial empty state, and the
 * drop zone takes the full available area. Once a file is picked,
 * setHasImage(true) flips the layout: the drop zone shrinks back to a
 * compact "swap image" affordance and the cropper takes the rest.
 */

export interface UploadCropUI {
  imgEl: HTMLImageElement;
  setStatus(text: string): void;
  setHasImage(yes: boolean): void;
  onFile(handler: (file: File) => void | Promise<void>): void;
  destroy(): void;
}

export function renderUploadCropUI(container: HTMLElement): UploadCropUI {
  container.replaceChildren();

  const drop = document.createElement('label');
  drop.className = 'ip-drop is-empty';
  drop.tabIndex = 0;
  drop.innerHTML = `
    <div class="ip-drop-line">Drop an image</div>
    <div class="ip-drop-sub">or <strong>click to browse</strong></div>
    <input type="file" accept="image/*" />
  `;

  const fileInput = drop.querySelector(
    'input[type=file]',
  ) as HTMLInputElement;

  const cropFrame = document.createElement('div');
  cropFrame.className = 'ip-cropper';
  cropFrame.style.display = 'none';
  const imgEl = document.createElement('img');
  imgEl.alt = '';
  imgEl.style.display = 'block';
  imgEl.style.maxWidth = '100%';
  cropFrame.appendChild(imgEl);

  const status = document.createElement('div');
  status.className = 'ip-label';

  container.append(drop, cropFrame, status);

  let fileHandler: ((file: File) => void | Promise<void>) | null = null;

  function pickFile(file: File | null | undefined): void {
    if (!file) return;
    fileHandler?.(file);
  }

  fileInput.addEventListener('change', () => {
    pickFile(fileInput.files?.[0] ?? null);
  });

  drop.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    drop.classList.add('is-drag');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-drag'));
  drop.addEventListener('drop', (ev) => {
    ev.preventDefault();
    drop.classList.remove('is-drag');
    pickFile(ev.dataTransfer?.files?.[0] ?? null);
  });

  return {
    imgEl,
    setStatus(text: string): void {
      status.textContent = text;
    },
    setHasImage(yes: boolean): void {
      drop.classList.toggle('is-empty', !yes);
      cropFrame.style.display = yes ? '' : 'none';
      // When loaded, replace the drop-zone copy so it reads as a swap
      // affordance rather than the primary action.
      drop.querySelector('.ip-drop-line')!.textContent = yes
        ? 'Replace image'
        : 'Drop an image';
    },
    onFile(handler) {
      fileHandler = handler;
    },
    destroy() {
      container.replaceChildren();
    },
  };
}
