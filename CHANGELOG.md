# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file is auto-updated from conventional commit history on each release.

## [Unreleased]

### Added

- Initial v1 scaffolding: WXT-based MV3 extension, side panel host,
  detection content script with hardcoded sites + regex fallback.
- Mode 1: Upload + Crop (Cropper.js v2 + browser-image-compression).
- Mode 2: Create (vanilla canvas — background, text, optional logo).
- Mode 3: Draw (Konva.js — pen, eraser, shapes, undo/redo).
- Output paths: download, copy to clipboard, try-insert via DataTransfer.
- Settings page for default mode / format / JPEG quality / badge toggle.
- CI: lint, typecheck, unit + integration tests, build, bundle-size guard.

## [0.1.0] — TBD

First public release. See [README](./README.md) for install instructions.
