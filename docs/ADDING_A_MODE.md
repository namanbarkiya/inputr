# Adding a new mode

Modes are self-contained image producers. v1 ships three (Upload + Crop,
Create, Draw); v2 will likely add PDF Split / Merge / AI Generate. They all
satisfy the same contract.

## The contract

`src/types/modes.ts`:

```ts
export interface Mode {
  id: ModeId;
  label: string;
  render(ctx: ModeContext): Promise<void> | void;
  getOutputBlob(): Promise<Blob | null>;
  destroy(): void;
}
```

`ModeContext` gives the mode:

- a DOM `container` to mount into
- `constraints` (width, height, accepted formats, max bytes)
- `onOutput(blob, suggestedFilename)` — call whenever you produce a result
- `onToast(message, kind)` — for transient feedback

The shell handles tab switching, the output bar (Download / Copy / Try
insert), and the detection banner.

## File layout

```
src/modes/<mode-id>/
├── index.ts          # exports `class XxxMode implements Mode`
├── ui.ts             # DOM scaffolding (no business logic)
├── renderer.ts       # pure rendering / image processing (optional)
└── <mode-id>.test.ts # tests
```

Use Mode 1 (`upload-crop`) as the smallest viable template. Mode 2
(`create`) is a good example when your mode has form-driven config and a
preview canvas. Mode 3 (`draw`) shows how to integrate a third-party canvas
library (Konva).

## Conventions

- Encode at the **native target resolution**, not the displayed size.
- Always run output through `compressToBudget` before reporting it — keeps
  uploads under the size limit.
- Use `pickOutputFormat(settings.defaultFormat, constraints.acceptedFormats)`
  to pick the right MIME type.
- Use `buildFilename({ constraints, format })` for the suggested filename.
- Tear down everything in `destroy()`. Each mode mounts/unmounts whenever
  the user switches tabs — leaks compound.

## Wiring it into the panel

1. Export your class from `src/modes/<mode-id>/index.ts`.
2. Add the mode id to the `ModeId` union in `src/types/modes.ts`.
3. Add a tab button in `entrypoints/sidepanel/index.html`.
4. Add a case in the `mountMode` switch in
   `entrypoints/sidepanel/main.ts`.

## Tests

Required:

- Happy path (UI mounts, blob is produced)
- One error path (e.g. invalid input)
- One edge case relevant to the mode (e.g. size budget exceeded)

Mocking heavy libraries (Cropper.js, Konva) is fine — see
`src/modes/draw/draw.test.ts` for an example.
