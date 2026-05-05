# Security Policy

Inputr is a browser extension that runs on every page. We take that
responsibility seriously.

## Reporting a vulnerability

**Please do not file a public issue for security problems.**

Email `security@inputr.dev` with:

- A description of the issue
- Steps to reproduce
- The version affected
- Any proof-of-concept (if applicable)

We aim to acknowledge within **72 hours** and ship a fix within **14 days**
for confirmed issues.

## Scope

In scope:

- Code execution in the extension or any extension-rendered page
- Privilege escalation across origins
- Leaks of user data outside the local machine
- Bypasses of the content security policy in the manifest

Out of scope:

- Issues that require physical access to the user's machine
- Reports against third-party libraries that don't translate to a working
  exploit against Inputr
- Social engineering of users or maintainers

## Disclosure

We follow coordinated disclosure. Once a fix is shipped to the Chrome Web
Store, we credit reporters in the release notes (with their permission).
