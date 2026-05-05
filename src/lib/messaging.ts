/**
 * Type-safe wrappers around chrome.runtime messaging.
 *
 * Use `sendMessage` from any context, `onMessage` to subscribe, and
 * `sendToTab` from the service worker / panel to reach a specific tab.
 */

import type { Message, MessageKind, MessageOf } from '../types/messages';

type Handler<K extends MessageKind> = (
  msg: MessageOf<K>,
  sender: chrome.runtime.MessageSender,
) =>
  | void
  | Promise<void>
  | unknown
  | Promise<unknown>;

/** Send a message to the service worker / extension pages. */
export async function sendMessage<K extends MessageKind>(
  msg: MessageOf<K>,
): Promise<unknown> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  return chrome.runtime.sendMessage(msg);
}

/** Send a message to a specific tab's content script. */
export async function sendToTab<K extends MessageKind>(
  tabId: number,
  msg: MessageOf<K>,
): Promise<unknown> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.sendMessage) return;
  return chrome.tabs.sendMessage(tabId, msg);
}

/**
 * Subscribe to messages of a particular kind. Returns an unsubscribe fn.
 *
 * Important: handler may return a value (sync) or Promise (async). To return
 * a value asynchronously, return the value/Promise directly — Chrome's
 * messaging will keep the channel open while the Promise resolves.
 */
export function onMessage<K extends MessageKind>(
  kind: K,
  handler: Handler<K>,
): () => void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
    return () => {};
  }
  const listener = (
    msg: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean => {
    if (!isMessage(msg) || msg.kind !== kind) return false;
    const result = handler(msg as MessageOf<K>, sender);
    if (result instanceof Promise) {
      result.then(sendResponse).catch((err: unknown) => {
        sendResponse({ error: String(err) });
      });
      return true;
    }
    sendResponse(result);
    return false;
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

function isMessage(value: unknown): value is Message {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string'
  );
}
