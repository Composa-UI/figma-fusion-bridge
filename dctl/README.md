# DCTL shader library

GLSL → DCTL translated shaders for use with figma-fusion-bridge.

## What is DCTL?

DCTL (DaVinci Color Transform Language) is DaVinci Resolve's shader language — compiles to CUDA, OpenCL, and Metal, runs per-pixel in Fusion.

## Translation rules (GLSL → DCTL)

| GLSL | DCTL |
|---|---|
| `vec2`, `vec3`, `vec4` | `float2`, `float3`, `float4` |
| `mix(a, b, t)` | `_mix(a, b, t)` |
| `clamp(x, a, b)` | `_clamp(x, a, b)` |
| `fract(x)` | `x - _floor(x)` |
| `mod(x, y)` | `_fmod(x, y)` |
| `texture2D(s, uv)` | `_tex2DVecR(s, uv, 0)` |
| `gl_FragCoord.xy` | `float2((float)p_X, (float)p_Y)` |
| `iTime` | `(float)p_Frame / fps` |
| `iResolution` | `float2((float)p_Width, (float)p_Height)` |
| `main()` | `__DEVICE__ float3 transform(int p_Width, int p_Height, int p_X, int p_Y, ...)` |

## Contributing

Add one `.dctl` file per effect with the original GLSL source as a comment block at the top.
Reference: [J-i-P-i/Shadertoys](https://github.com/J-i-P-i/Shadertoys) for manually-ported examples.
