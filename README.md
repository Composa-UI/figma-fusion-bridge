# figma-fusion-bridge

Export Figma animations to DaVinci Resolve Fusion — text, shapes, keyframes, easing curves, and video placeholders.

## What it does

A Figma plugin that exports a selected animated frame as a DaVinci Resolve Fusion `.comp` composition. Place all exported files in one folder and open the `.comp` directly in DaVinci Resolve Fusion.

```
Figma (design + motion)
  └── Fusion exporter plugin
       ├── comp_name.comp   ← open in DaVinci Resolve Fusion
       ├── layer_0.png      ← rasterized layers
       └── setup.lua        ← (v0.2) auto-wires everything in DaVinci
```

## Status

| Version | Status | Output |
|---|---|---|
| v0.1 | ✅ Released | `.comp` file + PNG rasters |
| v0.2 | 🚧 Planned | Lua script — higher fidelity, auto-wiring, blend modes, live effects |

## Layer mapping (v0.1)

| Figma layer | Fusion node | Notes |
|---|---|---|
| TEXT | `TextPlus` | Font, size, color, position |
| RECTANGLE (solid fill) | `Background` + `RectangleMask` | Corner radius supported |
| Layer named `[video]` | `Loader` placeholder | Replace filename in DaVinci |
| All other layers | PNG → `Loader` | Rasterized at 2× |

Keyframe animation (position X/Y, opacity, scale, rotation) exports as BezierSpline keyframes with correct handle math. Spring easing is baked to sampled frames.

## Workflow

1. Design your motion graphics in Figma using the **motion timeline** (not prototype Smart Animate)
2. Select a FRAME layer
3. Open the plugin → set FPS / comp dimensions → **Export .comp**
4. Place all downloaded files in one folder
5. Open the `.comp` in DaVinci Resolve → Fusion
6. Replace the `REPLACE_WITH_VIDEO.mp4` Loader node with your footage

### Dropzone / video placeholder

Name any rectangle `[video]` in Figma. The plugin exports it as a `Loader` placeholder at the correct position and size. In DaVinci, point it at your footage file.

v0.2 will also detect `VideoPaint` fill type — no naming convention needed.

### Animation constraints

- Use **Figma motion timeline** keyframes — these export cleanly
- Avoid prototype **Smart Animate** transitions — not keyframe data, cannot export
- For shape reveals: use **path trim** (`PATH_TRIM_START/END`) — this does export

## Planned: v0.2 Lua-first generation

Replaces `.comp` with a DaVinci Lua setup script for higher fidelity:

- **Blend modes** → `Merge.Operator` (Multiply, Screen, Overlay, Add…)
- **Drop shadows** → live Fusion `Shadow` tool (not rasterized)
- **Blur** → live Fusion `Blur` tool
- **Gradients** → `Background` gradient nodes
- **SVG vectors** → `BSplineMask` + `PolyStroke`
- **Video fill** → `MediaIn` auto-wired with file picker
- **Figma components** → Fusion macros with exposed parameters
- **GLSL shaders** → DCTL transpiler (~75% of procedural shaders)
- **Auto-layout expressions** for text hug behavior

## Fidelity roadmap

| Figma feature | v0.1 | v0.2 (Lua) |
|---|---|---|
| Text, position, opacity, scale, rotation | ✅ ~95% | ✅ ~95% |
| Blend modes | ❌ Normal only | ✅ Full mapping |
| Drop shadow | ❌ Rasterized | ✅ Live Shadow tool |
| Blur | ❌ Rasterized | ✅ Live Blur tool |
| Gradient fills | ❌ Rasterized | ✅ Background gradient |
| SVG pen vectors | ❌ Rasterized | ✅ BSplineMask |
| Video fill → MediaIn | ✅ Loader stub | ✅ Auto-wired |
| Spring easing | ✅ Baked | ✅ Baked |
| Bezier easing | ✅ Spline handles | ✅ Spline handles |
| GLSL shaders | ❌ Manual | ⚠️ ~75% DCTL transpiler |
| Draw brushes (simple) | ❌ Rasterized | ⚠️ Fusion Paint |
| Auto-layout positions | ✅ Baked | ✅ Baked + expressions |
| Figma components | ❌ | ✅ Fusion macros |

## Contributing

The `dctl/` shader library benefits from community contributions — if you've ported a GLSL/WGSL effect to DCTL, PRs are welcome.

See [docs/node-mapping.md](docs/node-mapping.md) for the full Figma → Fusion node and easing reference.

## License

MIT © Composa UI
