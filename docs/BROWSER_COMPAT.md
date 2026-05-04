# Browser compatibility

| Browser       | Supported | Notes                                               |
| ------------- | --------- | --------------------------------------------------- |
| Chrome 114+   | ✅        | Primary target. Side panel API requires 114+.       |
| Edge 114+     | ✅        | Same Chromium codebase, no changes required.        |
| Brave         | ✅        | Treats Chrome MV3 extensions as native.             |
| Arc           | ✅        | Chromium-based.                                     |
| Opera 100+    | ✅        | Side panel works.                                   |
| Vivaldi 6+    | ✅        | Side panel works.                                   |
| Firefox 121+  | ⚠️        | `npm run dev:firefox` works; side panel via tab UI. |
| Safari        | ❌        | Out of scope (different MV3 dialect).               |
| Mobile Chrome | ❌        | No extension support.                               |
| Mobile Safari | ❌        | No extension support.                               |

## Chrome-specific APIs we rely on

- `chrome.sidePanel` — side panel host. Firefox doesn't have an equivalent;
  the build for Firefox falls back to a popup.
- `chrome.action.setBadgeText` — supported everywhere.
- `chrome.scripting` — used for content-script behavior; works in MV3
  Firefox.

## Cross-browser flag

WXT supports Firefox via `npm run dev:firefox` and `npm run build:firefox`. The
manifest is auto-translated. If you're contributing a feature, consider
whether it relies on Chrome-only APIs and either guard or document.
