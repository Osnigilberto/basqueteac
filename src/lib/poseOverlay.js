// src/lib/poseOverlay.js
// Desenho do HUD sobre o vídeo (esqueleto, ângulos e alvos AR).
// O canvas é espelhado via CSS junto com o vídeo na câmera frontal,
// então textos são desenhados "desespelhados" para continuarem legíveis.

const BONES = [
  [11, 12], [11, 23], [12, 24], [23, 24], // tronco
  [11, 13], [13, 15], [12, 14], [14, 16], // braços
  [23, 25], [25, 27], [24, 26], [26, 28], // pernas
  [27, 31], [28, 32], // pés
]

const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

const VISIBLE = 0.5

function visible(p) {
  return p && (p.visibility == null || p.visibility > VISIBLE)
}

/**
 * Esqueleto completo em branco translúcido; os segmentos em `highlight`
 * (lista de pares de índices) ganham a cor `color` e brilho.
 */
export function drawSkeleton(ctx, lm, w, h, { highlight = [], color = '#F4541B' } = {}) {
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`)
  const hl = new Set(highlight.map(([a, b]) => key(a, b)))

  ctx.save()
  ctx.lineCap = 'round'

  for (const [a, b] of BONES) {
    const pa = lm[a]
    const pb = lm[b]
    if (!visible(pa) || !visible(pb)) continue
    const isHl = hl.has(key(a, b))
    ctx.strokeStyle = isHl ? color : 'rgba(255,255,255,0.55)'
    ctx.lineWidth = isHl ? 7 : 3
    ctx.shadowColor = isHl ? color : 'transparent'
    ctx.shadowBlur = isHl ? 16 : 0
    ctx.beginPath()
    ctx.moveTo(pa.x * w, pa.y * h)
    ctx.lineTo(pb.x * w, pb.y * h)
    ctx.stroke()
  }

  ctx.shadowBlur = 0
  for (const i of JOINTS) {
    const p = lm[i]
    if (!visible(p)) continue
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Arco do ângulo no vértice B (A -> B -> C) com rótulo em graus */
export function drawAngle(ctx, a, b, c, angle, w, h, color, mirrored) {
  if (!visible(a) || !visible(b) || !visible(c)) return
  const bx = b.x * w
  const by = b.y * h
  const a1 = Math.atan2(a.y * h - by, a.x * w - bx)
  const a2 = Math.atan2(c.y * h - by, c.x * w - bx)
  let diff = a2 - a1
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2

  ctx.save()
  ctx.fillStyle = color + '40'
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.arc(bx, by, 28, a1, a1 + diff, diff < 0)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()

  drawTag(ctx, `${angle}°`, bx + (mirrored ? -38 : 38), by - 18, color, mirrored)
}

/** Pílula de texto (desespelhada quando necessário) */
export function drawTag(ctx, text, x, y, color, mirrored) {
  ctx.save()
  ctx.translate(x, y)
  if (mirrored) ctx.scale(-1, 1)
  ctx.font = '800 20px "Barlow Condensed", system-ui, sans-serif'
  const tw = ctx.measureText(text).width
  const pw = tw + 16
  const ph = 28
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  roundRect(ctx, -pw / 2, -ph / 2, pw, ph, 14)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 1)
  ctx.restore()
}

/** Alvo AR pulsante com anel de tempo restante */
export function drawTarget(ctx, target, t, w, h, timeoutMs = 4000) {
  const x = target.x * w
  const y = target.y * h
  const r = target.r * h
  const age = t - target.bornAt
  const pulse = 1 + Math.sin(age / 120) * 0.06
  const pop = Math.min(1, age / 160)
  const R = r * pulse * pop

  ctx.save()
  ctx.shadowColor = '#F4541B'
  ctx.shadowBlur = 24

  ctx.fillStyle = 'rgba(244,84,27,0.28)'
  ctx.beginPath()
  ctx.arc(x, y, R, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#F4541B'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(x, y, R, 0, Math.PI * 2)
  ctx.stroke()

  ctx.shadowBlur = 0
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(x, y, R * 0.28, 0, Math.PI * 2)
  ctx.fill()

  // Anel de tempo restante
  const left = Math.max(0, 1 - age / timeoutMs)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, R + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left)
  ctx.stroke()
  ctx.restore()
}

/** Explosão curta quando um alvo é acertado */
export function drawBurst(ctx, burst, t, w, h, mirrored) {
  const age = t - burst.at
  if (age > 450) return false
  const k = age / 450
  const x = burst.x * w
  const y = burst.y * h
  const r = burst.r * h

  ctx.save()
  ctx.globalAlpha = 1 - k
  ctx.strokeStyle = '#34C759'
  ctx.lineWidth = 6 * (1 - k) + 1
  ctx.beginPath()
  ctx.arc(x, y, r * (1 + k * 1.4), 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = 1 - k
  drawTag(ctx, `${(burst.reaction / 1000).toFixed(2)}s`, x, y - r - 24 - k * 30, '#34C759', mirrored)
  ctx.restore()
  return true
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
