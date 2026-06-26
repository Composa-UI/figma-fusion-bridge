const TOOL_ID = 'afb55ad9-258a-4d1a-84fa-a8713fb2c47f'
const DISPLAY_NAME = 'Fusion exporter'

figma.root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
figma.showUI(__html__, { width: 300, height: 420, themeColors: true })

function notifySelection(): void {
  const sel = figma.currentPage.selection
  const frame = sel.length === 1 && sel[0].type === 'FRAME' ? (sel[0] as FrameNode) : null
  figma.ui.postMessage({
    type: 'selection',
    hasFrame: !!frame,
    frameName: frame ? frame.name : '',
    frameW: frame ? Math.round(frame.width) : 1920,
    frameH: frame ? Math.round(frame.height) : 1080,
    childCount: frame ? frame.children.length : 0,
  })
}
figma.on('selectionchange', notifySelection)
setTimeout(notifySelection, 200)

function hasVideoFill(node: SceneNode): boolean {
  if (!('fills' in node)) return false
  const fills = (node as GeometryMixin).fills
  return Array.isArray(fills) && fills.some(f => (f as Paint).type === 'VIDEO')
}

function getEffects(node: SceneNode): object[] {
  if (!('effects' in node)) return []
  const effects = (node as BlendMixin).effects
  if (!Array.isArray(effects)) return []
  return effects.filter(e => e.visible !== false).map(e => {
    if (e.type === 'DROP_SHADOW') {
      const ds = e as DropShadowEffect
      return { type: 'DROP_SHADOW', radius: ds.radius, spread: ds.spread ?? 0,
        offsetX: ds.offset?.x ?? 0, offsetY: ds.offset?.y ?? 0, color: ds.color }
    }
    if (e.type === 'LAYER_BLUR') return { type: 'LAYER_BLUR', radius: (e as BlurEffect).radius }
    return { type: e.type }
  })
}

figma.ui.onmessage = async (msg: {
  type: string; fps?: number; width?: number; height?: number
  videoPlaceholder?: string; outputFormat?: string; text?: string
}) => {
  if (msg.type === 'notify') { figma.notify(msg.text ?? ''); return }
  if (msg.type === 'close') { figma.closePlugin(); return }
  if (msg.type !== 'export') return

  const sel = figma.currentPage.selection
  if (sel.length !== 1 || sel[0].type !== 'FRAME') {
    figma.notify('Select exactly one frame first.', { error: true }); return
  }
  const root = sel[0] as FrameNode
  const fps = Math.max(1, msg.fps ?? 30)
  const compW = Math.round(msg.width ?? root.width)
  const compH = Math.round(msg.height ?? root.height)

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
    const abs = child.absoluteBoundingBox
    const rootAbs = root.absoluteBoundingBox
    const x = abs && rootAbs ? abs.x - rootAbs.x : 0
    const y = abs && rootAbs ? abs.y - rootAbs.y : 0
    const w = abs ? abs.width : ('width' in child ? (child as FrameNode).width : 100)
    const h = abs ? abs.height : ('height' in child ? (child as FrameNode).height : 100)
    const opacity = 'opacity' in child ? (child.opacity ?? 1) : 1
    const rotation = 'rotation' in child ? (child.rotation ?? 0) : 0
    const blendMode = 'blendMode' in child ? String(child.blendMode) : 'NORMAL'
    const effects = getEffects(child)

    const tracks: Record<string, unknown> = {}
    try {
      const kft = (child as unknown as {
        manualKeyframeTracks?: Record<string, { keyframes: { timelinePosition: number; value: unknown; easing?: unknown }[] }>
      }).manualKeyframeTracks
      if (kft) {
        for (const [k, t] of Object.entries(kft)) {
          if (t && Array.isArray(t.keyframes)) {
            tracks[k] = { keyframes: t.keyframes.map(kf => ({ time: kf.timelinePosition, value: kf.value, easing: kf.easing })) }
          }
        }
      }
    } catch { /* ignore */ }

    const base = { id: child.id, name: child.name, x, y, width: w, height: h,
      opacity, rotation, blendMode, effects,
      tracks: Object.keys(tracks).length ? tracks : undefined }

    // Dropzone: VideoPaint fill (v0.2) or name convention (v0.1 fallback)
    if (hasVideoFill(child) || child.name.toLowerCase().includes('[video]')) {
      layers.push({ ...base, type: 'VIDEO_PLACEHOLDER' }); continue
    }

    if (child.type === 'TEXT') {
      const t = child as TextNode
      const fn = (typeof t.fontName === 'object' && 'family' in t.fontName) ? t.fontName as FontName : { family: 'Inter', style: 'Regular' }
      const fs = typeof t.fontSize === 'number' ? t.fontSize : 24
      let color = { r: 1, g: 1, b: 1, a: 1 }
      if (Array.isArray(t.fills) && t.fills.length > 0 && t.fills[0].type === 'SOLID') {
        const p = t.fills[0] as SolidPaint
        color = { r: p.color.r, g: p.color.g, b: p.color.b, a: p.opacity ?? 1 }
      }
      const lh = typeof t.lineHeight === 'object' && 'value' in t.lineHeight ? (t.lineHeight as { value: number; unit: string }) : null
      const ls = typeof t.letterSpacing === 'object' && 'value' in t.letterSpacing ? (t.letterSpacing as { value: number; unit: string }) : null
      layers.push({ ...base, type: 'TEXT', text: t.characters,
        fontFamily: fn.family, fontStyle: fn.style, fontSize: fs, textColor: color,
        textAlign: t.textAlignHorizontal, lineHeight: lh, letterSpacing: ls }); continue
    }

    if (child.type === 'RECTANGLE') {
      const r = child as RectangleNode
      if (Array.isArray(r.fills)) {
        const solid = r.fills.find(f => f.type === 'SOLID' && f.visible !== false) as SolidPaint | undefined
        if (solid) {
          const cr = typeof r.cornerRadius === 'number' ? r.cornerRadius : 0
          layers.push({ ...base, type: 'RECT',
            fill: { r: solid.color.r, g: solid.color.g, b: solid.color.b, a: solid.opacity ?? 1 },
            cornerRadius: cr }); continue
        }
        // Gradient — export data, rasterize; v0.3 will generate live Background node
        const gradient = r.fills.find(f => f.type.startsWith('GRADIENT') && f.visible !== false) as GradientPaint | undefined
        if (gradient) {
          layers.push({ ...base, type: 'GRADIENT_RECT', gradientType: gradient.type,
            stops: gradient.gradientStops.map(s => ({ position: s.position, color: s.color })) })
        }
      }
    }

    try {
      const bytes = await child.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } })
      let bin = ''
      const u8 = new Uint8Array(bytes)
      for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
      const b64 = btoa(bin)
      const last = layers.length > 0 ? (layers[layers.length - 1] as { type: string }) : null
      if (last && last.type === 'GRADIENT_RECT') {
        layers[layers.length - 1] = { ...base, type: 'PNG', pngBase64: b64, note: 'gradient — v0.3 generates live node' }
      } else {
        layers.push({ ...base, type: 'PNG', pngBase64: b64 })
      }
    } catch (_e) {
      figma.notify('Skipped: ' + child.name, { error: true })
    }
  }

  root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
  figma.notify(`${layers.length} layers — generating output`)
  figma.ui.postMessage({ type: 'generate', layers, fps, compW, compH, frameCount,
    animDuration: duration, compName: root.name, outputFormat: msg.outputFormat ?? 'both' })
}
