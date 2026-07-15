# VRena Official UI Color System

The official VRena UI palette is versioned in
[`vrena-ui-color-palette-official.svg`](./vrena-ui-color-palette-official.svg).
It supersedes earlier palette and CTA direction references.

Source asset SHA-256:
`ee18f5f6a58d239faf2156a9dae0988ca26b9b8b268ad802f288b56531e4e0a7`

## Implementation Sources

- CSS scales and semantic UI tokens: `styles/vrena-tokens.css`
- TypeScript palette and exported semantic values: `lib/theme/vrenaPalette.ts`
- Palette drift check: `npm run verify:palette`

## CTA Contract

- Day primary: `linear-gradient(90deg, #00FFEA 0%, #109FFF 100%)`
- Dark primary: `linear-gradient(90deg, #FFB800 0%, #FD5901 100%)`
- Primary CTA text: Neutral 950 (`#020E0E`) in both modes
- Day secondary: white surface with Purple 500 border and Purple 600 label
- Dark secondary: Neutral 900 surface with Orange 400 border and label
- Tertiary: transparent navigation action with mode-specific hover and pressed surfaces
- Destructive actions: use the VRena Danger Red scale, never a brand gradient
- Keyboard focus: a 2px mode surface ring plus a 6px Cyan halo

Only one filled primary CTA should appear in a decision block. Navigation,
filters, tabs, disclosure controls, and alternative choices must use secondary
or tertiary styling so the completion action remains obvious.

The logo gradients remain separate decorative assets and must keep their
original angle, stops, opacity, and sRGB interpolation.
