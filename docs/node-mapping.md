# Figma → Fusion node mapping

Reference for how each Figma layer type and property maps to a Fusion node or parameter.

## Layer types

| Figma | Fusion node(s) | v0.1 | v0.2 |
|---|---|---|---|
| TEXT | `TextPlus` | ✅ | ✅ extended params |
| RECTANGLE (solid fill) | `Background` + `RectangleMask` | ✅ | ✅ |
| RECTANGLE (gradient fill) | `Background` (gradient) + `RectangleMask` | ❌ rasterized | ✅ |
| RECTANGLE (video fill) | `MediaIn` / `Loader` placeholder | ✅ name-based | ✅ fill-type detection |
| ELLIPSE | `Background` + `EllipseMask` | ❌ rasterized | ✅ |
| VECTOR (pen path) | `Background` + `BSplineMask` | ❌ rasterized | ✅ |
| FRAME / GROUP / component | PNG → `Loader` | ✅ fallback | ✅ fallback |

## Animated properties

| Figma field | Fusion target | Conversion |
|---|---|---|
| `TRANSLATION_X` | `Merge.Center.X` | `(x + w/2) / compW` |
| `TRANSLATION_Y` | `Merge.Center.Y` | `1 - (y + h/2) / compH` |
| `OPACITY` | `Merge.Blend` | `value / 100` |
| `SCALE_X` | `Transform.Size` | direct |
| `SCALE_Y` | `Transform.YSize` | direct |
| `ROTATION` | `Transform.Angle` | radians → degrees, negated |
| `PATH_TRIM_START` | `Trim.TrimPathStart` | v0.2 |
| `PATH_TRIM_END` | `Trim.TrimPathEnd` | v0.2 |

## Easing types

| Figma easing | Fusion handling |
|---|---|
| `LINEAR` | `Flags = { Linear = true }` |
| `EASE_IN` | Bezier handles `(x1=0.42, y1=0, x2=1, y2=1)` |
| `EASE_OUT` | Bezier handles `(x1=0, y1=0, x2=0.58, y2=1)` |
| `EASE_IN_AND_OUT` | Bezier handles `(x1=0.42, y1=0, x2=0.58, y2=1)` |
| `CUSTOM_CUBIC_BEZIER` | Bezier handles from `(x1,y1,x2,y2)` |
| `CUSTOM_SPRING` | Baked per-frame via damped harmonic oscillator |

### Bezier handle math

Given keyframe A at `(f0, v0)` and keyframe B at `(f1, v1)` with easing `(x1, y1, x2, y2)`:

```
RH of A = { f0 + x1*(f1-f0),  v0 + y1*(v1-v0) }
LH of B = { f0 + x2*(f1-f0),  v0 + y2*(v1-v0) }
```

### Spring baking

```
ω  = sqrt(stiffness / mass)
ζ  = damping / (2 * sqrt(stiffness * mass))

if ζ < 1:  p(t) = 1 - exp(-ζωt) * (cos(ωd·t) + (ζ/sqrt(1-ζ²)) * sin(ωd·t))
else:       p(t) = 1 - exp(-ω·t) * (1 + ω·t)
```

## Coordinate conversion

Figma: pixels, top-left origin. Fusion: 0–1 normalized, bottom-left origin.

```
fusion_x = (figma_x + layer_width  / 2) / comp_width
fusion_y = 1 - (figma_y + layer_height / 2) / comp_height
```

## Effects (v0.2)

| Figma effect | Fusion node | Key params |
|---|---|---|
| Drop shadow | `Shadow` | `SoftnessMul`, `XOffset`, `YOffset`, `Red/Green/Blue/Alpha` |
| Layer blur | `Blur` | `XBlurSize`, `YBlurSize` |
| Background blur | `Blur` on background input | |
| Noise shader | `FastNoise` | Frequency, contrast |
| Glass shader | `Displace` + `Blur` | Approximate |

## Blend modes (v0.2)

| Figma | Fusion `Merge.Operator` value |
|---|---|
| Normal | `0` |
| Multiply | `18` |
| Screen | `19` |
| Overlay | `20` |
| Darken | `10` |
| Lighten | `11` |
| Add | `6` |
| Difference | `15` |
| Exclusion | `17` |
| Color Dodge | `22` |
| Color Burn | `21` |
| Hue | `29` |
| Saturation | `30` |
| Color | `31` |
| Luminosity | `32` |
