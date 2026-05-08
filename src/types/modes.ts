/**
 * Mode contract.
 *
 * v0.1 ships a single mode (upload-crop). The Mode interface is kept
 * intentionally generic so future modes (Create, Draw, ...) can drop in
 * by satisfying this shape without touching the panel shell.
 */

import type { DetectedConstraints, ImageFormat } from './detection';

export type ModeId = 'upload-crop' | 'create' | 'draw';

export interface ModeContext {
  /** The container element where the mode mounts its UI. */
  container: HTMLElement;
  /** Detected constraints driving the output dimensions and format. */
  constraints: DetectedConstraints;
  /** Resolved output MIME (panel-controlled, honors user's format pick). */
  format: ImageFormat;
  /** JPEG quality, 1-100. PNG ignores this. */
  jpegQuality: number;
  /** Called by the mode when the user has produced an output blob. */
  onOutput: (blob: Blob, suggestedFilename: string) => void;
  /** Called when the mode wants to surface a transient toast message. */
  onToast: (message: string, kind?: 'info' | 'success' | 'error') => void;
}

export interface Mode {
  id: ModeId;
  label: string;
  /** Mounts the mode UI into the provided container. */
  render(ctx: ModeContext): Promise<void> | void;
  /** Returns the current output blob, null if the user hasn't produced one. */
  getOutputBlob(): Promise<Blob | null>;
  /** Tears down event listeners and DOM. */
  destroy(): void;
  /**
   * Optional: update constraints in place without remounting. Lets the
   * panel react to override/rescan without wiping any image the user
   * already loaded.
   */
  updateConstraints?(constraints: DetectedConstraints): void;
  /** Optional: update output format / quality without remounting. */
  updateFormat?(format: ImageFormat, jpegQuality: number): void;
}

export interface ModeSettings {
  defaultFormat: 'image/jpeg' | 'image/png' | 'auto';
  jpegQuality: number;
  showBadge: boolean;
}

export const DEFAULT_SETTINGS: ModeSettings = {
  defaultFormat: 'auto',
  jpegQuality: 85,
  showBadge: true,
};
