/**
 * Centralized logger so production builds don't ship console.log spam.
 *
 * In dev (the WXT define replaces __DEV__) every level prints. In prod only
 * warn/error reach the console — info/debug become no-ops.
 */

declare const __DEV__: boolean;

const dev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

export const log = {
  debug(scope: string, ...args: unknown[]): void {
    if (!dev) return;
    // eslint-disable-next-line no-console
    console.log(`[inputr ${ts()} ${scope}]`, ...args);
  },
  info(scope: string, ...args: unknown[]): void {
    if (!dev) return;
    // eslint-disable-next-line no-console
    console.log(`[inputr ${ts()} ${scope}]`, ...args);
  },
  warn(scope: string, ...args: unknown[]): void {
    console.warn(`[inputr ${ts()} ${scope}]`, ...args);
  },
  error(scope: string, ...args: unknown[]): void {
    console.error(`[inputr ${ts()} ${scope}]`, ...args);
  },
};
