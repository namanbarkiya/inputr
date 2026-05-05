/**
 * Service worker entrypoint.
 *
 * Manifest V3 service workers go to sleep after ~30s of inactivity and lose
 * top-level state. Every handler in here re-reads from chrome.storage.local
 * and never relies on cached module-level variables.
 *
 * Responsibilities:
 *   - Configure the side panel to open on toolbar action click.
 *   - Receive detection results from content scripts and persist them.
 *   - Update the toolbar badge to indicate detection state.
 *   - Forward "try insert" requests from the panel to the active tab.
 */

import { defineBackground } from 'wxt/sandbox';

import { onMessage, sendToTab } from '../src/lib/messaging';
import {
  clearDetection,
  loadSettings,
  saveDetection,
} from '../src/lib/storage';
import { log } from '../src/lib/logger';

const BADGE_COLOR = '#22c55e';
const BADGE_TEXT = '●';

export default defineBackground(() => {
  // First-install / update: configure side panel behavior.
  chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((err: unknown) => {
        log.warn('background', 'setPanelBehavior failed', err);
      });
  });

  // Persist detection results pushed by the content script and update the
  // badge for the originating tab.
  onMessage('detection:report', async (msg, sender) => {
    const tabId = sender.tab?.id;
    if (typeof tabId !== 'number') return { ok: false };

    await saveDetection(tabId, msg.payload);

    const settings = await loadSettings();
    const showDot = settings.showBadge && msg.payload.detected;
    await setBadgeForTab(tabId, showDot);
    return { ok: true };
  });

  // Forward "try insert" from the side panel to the active tab's content
  // script. We re-resolve the active tab on every request — never cache it.
  onMessage('page:try-insert', async (msg) => {
    const tab = await getActiveTab();
    if (!tab?.id) return { ok: false, reason: 'no-active-tab' };
    try {
      const result = (await sendToTab(tab.id, msg)) as
        | { kind: 'page:try-insert:result'; payload: { ok: boolean; reason?: string } }
        | undefined;
      return result?.payload ?? { ok: false, reason: 'no-response' };
    } catch (err) {
      log.warn('background', 'try-insert forward failed', err);
      return { ok: false, reason: 'forward-failed' };
    }
  });

  // Clear detection records for tabs that closed.
  chrome.tabs.onRemoved.addListener((tabId) => {
    void clearDetection(tabId);
  });

  // Reset the badge whenever the active tab changes; the new tab's content
  // script will re-report shortly if applicable.
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    void chrome.action.setBadgeText({ text: '', tabId });
  });
});

async function setBadgeForTab(tabId: number, on: boolean): Promise<void> {
  try {
    if (on) {
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR, tabId });
      await chrome.action.setBadgeText({ text: BADGE_TEXT, tabId });
    } else {
      await chrome.action.setBadgeText({ text: '', tabId });
    }
  } catch (err) {
    log.warn('background', 'setBadge failed', err);
  }
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
