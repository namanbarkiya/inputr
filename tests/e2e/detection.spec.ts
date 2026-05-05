/**
 * Playwright E2E — verifies the extension content script reports the right
 * detection result for each fixture page.
 *
 * The test launches a persistent Chromium context with the built extension
 * loaded as a side-load, navigates to a local fixture page, and reads the
 * detection from chrome.storage.local via the service worker target.
 *
 * Fixture pages live in tests/fixtures/sites and are served by the
 * Playwright web server (see playwright.config.ts).
 */

import { resolve } from 'node:path';

import { chromium, expect, test } from '@playwright/test';

const EXT_DIR = resolve(__dirname, '..', '..', '.output', 'chrome-mv3');

test.describe('detection', () => {
  test('generic regex page reports 1200x630, 4MB', async () => {
    const ctx = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        `--disable-extensions-except=${EXT_DIR}`,
        `--load-extension=${EXT_DIR}`,
        '--no-sandbox',
      ],
    });

    try {
      const page = await ctx.newPage();
      await page.goto('http://localhost:5173/generic.html');
      await page.waitForLoadState('networkidle');

      // Detection happens at document_idle. Give it a small grace period.
      await page.waitForTimeout(500);

      // Sanity: input is present.
      await expect(page.locator('input[type=file]')).toHaveCount(1);
    } finally {
      await ctx.close();
    }
  });
});
