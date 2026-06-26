const TOOL_ID = 'afb55ad9-258a-4d1a-84fa-a8713fb2c47f'
const DISPLAY_NAME = 'Fusion exporter'

figma.root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
figma.showUI(__html__, { width: 300, height: 360, themeColors: true })

function notifySelection(): void {
  const sel = figma.currentPage.selection
  const frame = sel.length === 1 && sel[0].type === 'FRAME' ? (sel[0] as FrameNode) : null
  figma.ui.postMessage({
    type: 'selection',
    hasFrame: !!frame,
    frameName: frame ? frame.name : '',
    childCount: frame ? frame.children.length : 0,
  })
}
figma.on('selectionchange', notifySelection)
setTimeout(notifySelection, 200)

figma.ui.onmessage = async (msg: {
  type: string
  fps?: number
  width?: number
  height?: number
  videoPlaceholder?: string
  text?: string
}) => {
  if (msg.type === 'notify') { figma.notify(msg.text ?? ''); return }
  if (msg.type === 'close') { figma.closePlugin(); return }
  if (msg.type !== 'export') return

  const sel = figma.currentPage.selection
  if (sel.length !== 1 || sel[0].type !== 'FRAME') {
    figma.notify('Select exactly one frame first.', { error: true })
    return
  }

  const root = sel[0] as FrameNode
  const fps = Math.max(1, msg.fps ?? 30)
  const compW = Math.round(msg.width ?? root.width)
  const compH = Math.round(msg.height ?? root.height)
  const videoPlaceholder = msg.videoPlaceholder ?? '[video]'

  // Read animation duration from the frame's motion timeline
  let duration = 3
  try {
    const tls = (root as unknown as { timelines?: { duration: number }[] }).timelines
    if (tls && tls.length > 0) duration = tls[0].duration ?? 3
  } catch { /* ignore */ }
  const frameCount = Math.max(1, Math.ceil(duration * fps))

  figma.notify(`Processing "${root.name}" — ${root.children.length} layers`)
  figma.ui.postMessage({ type: 'status', text: `Processing ${root.children.length} layers…` })

  const layers: unknown[] = []

  for (const child of root.children) {
    if (!child.visible) continue

    // Positions computed from absoluteBoundingBox — auto-layout bakes correctly.
    const abs = child.absoluteBoundingBox
    const rootAbs = root.absoluteBoundingBox
    const x = abs && rootAbs ? abs.x - rootAbs.x : 0
    const y = abs && rootAbs ? abs.y - rootAbs.y : 0
    const w = abs ? abs.width : ('width' in child ? (child as FrameNode).width : 100)
    const h = abs ? abs.height : ('height' in child ? (child as FrameNode).height : 100)
    const opacity = 'opacity' in child ? (child.opacity ?? 1) : 1
    const rotation = 'rotation' in child ? (child.rotation ?? 0) : 0

    // Read keyframe tracks from the motion timeline
    const tracks: Record<string, unknown> = {}
    try {
      const kft = (child as unknown as {
        manualKeyframeTracks?: Record<string, {
          keyframes: { timelinePosition: number; value: unknown; easing?: unknown }[]
        }>
      }).manualKeyframeTracks
      if (kft) {
        for (const [k, t] of Object.entries(kft)) {
          if (t && Array.isArray(t.keyframes)) {
            tracks[k] = {
              keyframes: t.keyframes.map(kf => ({
                time: kf.timelinePosition,
                value: kf.value,
                easing: kf.easing,
              })),
            }
          }
        }
      }
    } catch { /* ignore */ }

    const base = {
      id: child.id, name: child.name,
      x, y, width: w, height: h,
      opacity, rotation,
      tracks: Object.keys(tracks).length ? tracks : undefined,
    }

    // Video fill / dropzone — v0.1: name convention. v0.2: VideoPaint fill detection.
    if (child.name === videoPlaceholder || child.name.toLowerCase().includes('[video]')) {
      layers.push({ ...base, type: 'VIDEO_PLACEHOLDER' })
      continue
    }

    // TEXT → TextPlus
    if (child.type === 'TEXT') {
      const t = child as TextNode
      const fn = (typeof t.fontName === 'object' && 'family' in t.fontName)
        ? t.fontName as FontName : { family: 'Inter', style: 'Regular' }
      const fs = typeof t.fontSize === 'number' ? t.fontSize : 24
      let color = { r: 1, g: 1, b: 1, a: 1 }
      if (Array.isArray(t.fills) && t.fills.length > 0 && t.fills[0].type === 'SOLID') {
        const p = t.fills[0] as SolidPaint
        color = { r: p.color.r, g: p.color.g, b: p.color.b, a: p.opacity ?? 1 }
      }
      layers.push({ ...base, type: 'TEXT', text: t.characters,
        fontFamily: fn.family, fontStyle: fn.style, fontSize: fs, textColor: color })
      continue
    }

    // RECTANGLE (solid fill) → Background + RectangleMask
    if (child.type === 'RECTANGLE') {
      const r = child as RectangleNode
      if (Array.isArray(r.fills)) {
        const solid = r.fills.find(f => f.type === 'SOLID' && f.visible !== false) as SolidPaint | undefined
        if (solid) {
          const cr = typeof r.cornerRadius === 'number' ? r.cornerRadius : 0
          layers.push({ ...base, type: 'RECT',
            fill: { r: solid.color.r, g: solid.color.g, b: solid.color.b, a: solid.opacity ?? 1 },
            cornerRadius: cr })
          continue
        }
      }
    }

    // Everything else → rasterize to PNG
    try {
      const bytes = await child.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } })
      let bin = ''
      const u8 = new Uint8Array(bytes)
      for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
      layers.push({ ...base, type: 'PNG', pngBase64: btoa(bin) })
    } catch (_e) {
      figma.notify('Skipped: ' + child.name, { error: true })
    }
  }

  figma.notify(`${layers.length} layers ready — building .comp`)
  figma.ui.postMessage({ type: 'generate', layers, fps, compW, compH, frameCount,
    animDuration: duration, compName: root.name })
}
