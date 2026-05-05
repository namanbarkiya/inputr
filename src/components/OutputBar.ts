/**
 * Output bar at the bottom of the panel: Download / Copy / Try insert.
 *
 * The bar stays disabled until a mode reports an output blob, so users
 * never click into a no-op state.
 */

interface OutputElements {
  download: HTMLButtonElement;
  copy: HTMLButtonElement;
  insert: HTMLButtonElement;
}

interface BindOpts {
  onDownload: () => void | Promise<void>;
  onCopy: () => void | Promise<void>;
  onInsert: () => void | Promise<void>;
}

export class OutputBar {
  private els: OutputElements;

  constructor(els: OutputElements) {
    this.els = els;
  }

  bind(opts: BindOpts): void {
    this.els.download.addEventListener('click', () => {
      void opts.onDownload();
    });
    this.els.copy.addEventListener('click', () => {
      void opts.onCopy();
    });
    this.els.insert.addEventListener('click', () => {
      void opts.onInsert();
    });
  }

  setEnabled(enabled: boolean): void {
    this.els.download.disabled = !enabled;
    this.els.copy.disabled = !enabled;
    this.els.insert.disabled = !enabled;
  }
}
