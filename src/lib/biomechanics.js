// src/lib/biomechanics.js

/**
 * Catálogo das 5 Modalidades Especializadas de Treino do Coach Carter
 *
 * mode:   'shooting' usa o rastreador de arremesso (Shot Science)
 *         'targets'  usa o jogo de alvos em realidade aumentada (drible)
 * zone:   zona da linha de arremessos (3PT, 2PT ou LL); sem zona, o atleta escolhe
 * camera: câmera sugerida para o drill (o usuário pode trocar)
 */
export const DRILL_TYPES = {
  free_shooting: {
    id: 'free_shooting',
    mode: 'shooting',
    camera: 'environment',
    title: 'Arremesso Livre',
    shortTitle: 'Livre',
    badge: 'Any Spot',
    color: '#14B8A6',
    description: 'Arremesse de onde quiser, no seu ritmo. A IA mede cada bola, não importa a distância.',
    targetTip: 'Varie as posições à vontade, mas repita sempre a mesma mecânica: dip, set point e extensão completa.',
    measures: ['Tempo de soltura', 'Ângulo de soltura', 'Cotovelo'],
    defaultReps: 20,
    presetReps: [10, 20, 30],
    quotes: {
      high: '“Não importa de onde, a mecânica foi a mesma em cada bola. É isso que transforma treino em cesta no jogo!”',
      mid: '“Boa sessão! Agora busque repetir o mesmo movimento em todas as posições, a consistência vem daí.”',
      low: '“Cada posição pedia um arremesso diferente e você mudou a mecânica. Volte ao básico: pernas, set point e extensão!”',
    },
  },
  three_pointer: {
    id: 'three_pointer',
    mode: 'shooting',
    zone: '3PT',
    camera: 'environment',
    title: 'Arremesso de 3 Pontos',
    shortTitle: '3 Pontos',
    badge: 'Long Range',
    color: '#D94315',
    description: 'Foco na transferência de energia das pernas (The Dip) e arco alto de parábola.',
    targetTip: 'Flexione os joelhos (~100°) e empurre a bola para cima criando uma parábola alta.',
    measures: ['Tempo de soltura', 'Ângulo das pernas', 'Salto'],
    defaultReps: 15,
    presetReps: [10, 15, 25],
    quotes: {
      high: '“A bola de 3 pontos não se arremessa apenas com os braços, se arremessa com a força que sobe do chão. Esse arco alto foi cirúrgico!”',
      mid: '“Bom esforço! Mas preste atenção: flexione um pouco mais os joelhos antes de subir para a bola não perder força no final.”',
      low: '“Sem pernas, o arremesso de 3 é só um tiro no escuro. Agache, concentre o impulso e suba em um só movimento!”',
    },
  },
  mid_range: {
    id: 'mid_range',
    mode: 'shooting',
    zone: '2PT',
    camera: 'environment',
    title: 'Mid-Range (Meia Distância)',
    shortTitle: 'Mid-Range',
    badge: 'Quick Release',
    color: '#F59E0B',
    description: 'Subida rápida e soltura no ponto mais alto para fugir de tocos na zona pintada.',
    targetTip: 'Mantenha o cotovelo apontado para o aro e solte a bola no ápice do salto com agilidade.',
    measures: ['Tempo de soltura', 'Ângulo de soltura', 'Salto'],
    defaultReps: 15,
    presetReps: [10, 15, 20],
    quotes: {
      high: '“A meia distância é a marca dos mestres da quadra. Subida rápida, ponto alto de soltura e zero chances para o toco!”',
      mid: '“Mantenha a compostura na parada. Não apresse a soltura antes de atingir o topo do salto.”',
      low: '“Equilíbrio é tudo na meia distância. Plante os pés, suba vertical e estenda o braço com firmeza!”',
    },
  },
  layup: {
    id: 'layup',
    mode: 'shooting',
    zone: '2PT',
    camera: 'environment',
    title: 'Bandeja & Passada',
    shortTitle: 'Bandeja',
    badge: 'Passada 1-2',
    color: '#34C759',
    description: 'Sincronia de passadas, elevação do joelho guia e mão suave no aro.',
    targetTip: 'Dê as duas passadas e eleve bem o joelho correspondente ao braço da bandeja.',
    measures: ['Salto', 'Ângulo de soltura', 'Cotovelo'],
    defaultReps: 10,
    presetReps: [10, 16, 20],
    quotes: {
      high: '“Bandeja impecável! Joelho alto para proteger a bola da marcação e toque suave de vidro. Dois pontos fáceis!”',
      mid: '“Atenção ao joelho guia: eleve mais a perna no segundo tempo para ganhar impulsão vertical!”',
      low: '“Uma bandeja perdida pode custar um campeonato. Concentre-se nas duas passadas e coloque a bola suave na tabela!”',
    },
  },
  handles: {
    id: 'handles',
    mode: 'targets',
    camera: 'user',
    title: 'Handles & Drible',
    shortTitle: 'Handles',
    badge: 'Alvos AR',
    color: '#3B82F6',
    description: 'Alvos aparecem na tela: drible com uma mão e acerte-os com a outra o mais rápido possível.',
    targetTip: 'Base baixa, cabeça erguida e olhos na tela. Toque os alvos com a mão livre sem parar o drible.',
    measures: ['Alvos', 'Tempo de reação', 'Ritmo'],
    defaultReps: 30,
    presetReps: [20, 30, 50],
    quotes: {
      high: '“Controle de bola de elite! Postura baixa, cabeça erguida e visão periférica total da quadra. Você manda no jogo!”',
      mid: '“Bom ritmo de drible! Mas cuidado: não deixe seu olhar cair para o chão. Olhos na quadra!”',
      low: '“Quem olha para a bola não vê o companheiro livre. Abaixe a base, flexione os joelhos e sinta a bola na ponta dos dedos!”',
    },
  },
  free_throw: {
    id: 'free_throw',
    mode: 'shooting',
    zone: 'LL',
    camera: 'environment',
    title: 'Lance Livre',
    shortTitle: 'Lance Livre',
    badge: 'Mecânica Pura',
    color: '#8B5CF6',
    description: 'Rotina idêntica, equilíbrio estático e consistência milimétrica do cotovelo.',
    targetTip: 'Pés plantados na linha, respiração profunda e a mesma mecânica exata a cada arremesso.',
    measures: ['Cotovelo', 'Tempo de soltura', 'Ângulo das pernas'],
    defaultReps: 10,
    presetReps: [10, 20, 30],
    quotes: {
      high: '“O lance livre é foco mental e disciplina pura. Silêncio na mente e repetição no corpo. Nota 10!”',
      mid: '“Mantenha a rotina idêntica a cada bola. Respire antes de soltar e mantenha a mão na cesta.”',
      low: '“Sem desculpas na linha do lance livre: ninguém está te marcando. Volte à base e confie na sua repetição!”',
    },
  },
}

/**
 * Calcula o ângulo em graus formado por três pontos 2D (A -> B -> C),
 * tendo B como o vértice.
 * Ex: A (Ombro), B (Cotovelo), C (Pulso).
 */
export function calculateAngle(a, b, c) {
  if (!a || !b || !c) return 0
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let angle = Math.abs((radians * 180.0) / Math.PI)
  if (angle > 180.0) {
    angle = 360.0 - angle
  }
  return Math.round(angle)
}

/**
 * Índices anatômicos do modelo Google MediaPipe Pose (BlazePose):
 */
export const LANDMARK_INDEXES = {
  right: {
    nose: 0,
    shoulder: 12,
    elbow: 14,
    wrist: 16,
    hip: 24,
    knee: 26,
    ankle: 28,
  },
  left: {
    nose: 0,
    shoulder: 11,
    elbow: 13,
    wrist: 15,
    hip: 23,
    knee: 25,
    ankle: 27,
  },
}

const GREEN = '#34C759'
const AMBER = '#F59E0B'
const RED = '#FF3B30'

/**
 * Avalia a qualidade do ângulo do cotovelo no ponto de preparação (Set Point).
 */
export function evaluateElbowAngle(angle) {
  if (angle >= 80 && angle <= 105) {
    return { status: 'ideal', label: 'Excelente (~90°)', color: GREEN }
  }
  if (angle < 80) {
    return { status: 'closed', label: 'Muito fechado', color: AMBER }
  }
  return { status: 'open', label: 'Muito aberto', color: RED }
}

/**
 * Avalia a postura dos joelhos / agachamento para treinos de impulsão e drible.
 */
export function evaluateKneeAngle(angle) {
  if (angle >= 90 && angle <= 130) {
    return { status: 'ideal', label: 'Boa base atlética', color: GREEN }
  }
  if (angle > 150) {
    return { status: 'standing', label: 'Muito em pé', color: RED }
  }
  return { status: 'deep', label: 'Muito agachado', color: AMBER }
}

/**
 * Tempo de soltura: do ponto mais baixo da bola (dip) até a soltura.
 * Referência de elite fica em torno de 0,5 s.
 */
export function evaluateReleaseTime(ms) {
  if (ms == null) return { status: 'unknown', label: '--', color: '#8E8E93' }
  if (ms <= 550) return { status: 'ideal', label: 'Rápida', color: GREEN }
  if (ms <= 800) return { status: 'ok', label: 'Média', color: AMBER }
  return { status: 'slow', label: 'Lenta', color: RED }
}

/**
 * Ângulo das pernas: flexão máxima dos joelhos durante o dip.
 */
export function evaluateLegAngle(angle) {
  if (angle == null) return { status: 'unknown', label: '--', color: '#8E8E93' }
  if (angle >= 95 && angle <= 135) return { status: 'ideal', label: 'Boa flexão', color: GREEN }
  if (angle < 95) return { status: 'deep', label: 'Muito agachado', color: AMBER }
  return { status: 'shallow', label: 'Pouca flexão', color: RED }
}

/**
 * Ângulo de soltura: inclinação do braço (ombro -> pulso) acima da horizontal.
 */
export function evaluateReleaseAngle(angle) {
  if (angle == null) return { status: 'unknown', label: '--', color: '#8E8E93' }
  if (angle >= 55 && angle <= 80) return { status: 'ideal', label: 'Arco alto', color: GREEN }
  if (angle < 55) return { status: 'flat', label: 'Arco baixo', color: RED }
  return { status: 'vertical', label: 'Muito vertical', color: AMBER }
}

/* ==========================================================
   SHOT SCIENCE — rastreador de arremesso quadro a quadro
   ========================================================== */

const VISIBLE = 0.5
// Comprimento médio do tronco (ombro -> quadril) de um adulto, usado como
// régua para converter o deslocamento do quadril em centímetros de salto.
const TORSO_CM = 50

function isVisible(p, min = VISIBLE) {
  return p && (p.visibility == null || p.visibility > min)
}

/**
 * Cria um rastreador de arremessos. A cada quadro, chame
 * `update(landmarks, timestampMs, aspect)` onde aspect = largura / altura do vídeo.
 *
 * Retorna { phase, elbow, knee, released, completed }:
 *  - released:  arremesso detectado neste quadro (conta imediatamente)
 *  - completed: mesmo arremesso, ~450 ms depois, com o salto já calculado
 */
export function createShotTracker({ hand = 'right' } = {}) {
  const idx = LANDMARK_INDEXES[hand] || LANDMARK_INDEXES.right
  let phase = 'IDLE' // IDLE | SET_POINT | RELEASE
  let buffer = []
  let setPointElbow = null
  let setPointAt = 0
  let cooldownUntil = 0
  let pending = null
  let baselineHipY = null
  let shotCounter = 0

  function update(lm, t, aspect = 4 / 3) {
    const result = { phase, elbow: null, knee: null, released: null, completed: null }
    if (!lm) return result

    // Corrige a proporção: x e y normalizados têm escalas diferentes
    const P = (i) => (lm[i] ? { x: lm[i].x * aspect, y: lm[i].y, visibility: lm[i].visibility } : null)
    const shoulder = P(idx.shoulder)
    const elbow = P(idx.elbow)
    const wrist = P(idx.wrist)
    const hip = P(idx.hip)
    const knee = P(idx.knee)
    const ankle = P(idx.ankle)

    if (!isVisible(shoulder) || !isVisible(elbow) || !isVisible(wrist)) return result

    const elbowAngle = calculateAngle(shoulder, elbow, wrist)
    const hasLeg = isVisible(hip) && isVisible(knee) && isVisible(ankle)
    const kneeAngle = hasLeg ? calculateAngle(hip, knee, ankle) : null
    const hipY = isVisible(hip) ? hip.y : null
    const torso = isVisible(hip) ? Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y) : null

    result.elbow = elbowAngle
    result.knee = kneeAngle

    buffer.push({ t, wristY: wrist.y, knee: kneeAngle, hipY })
    while (buffer.length && t - buffer[0].t > 2000) buffer.shift()

    // Linha de base do quadril: só atualiza parado e em pé
    if (phase === 'IDLE' && hipY != null && (kneeAngle == null || kneeAngle >= 160)) {
      baselineHipY = baselineHipY == null ? hipY : baselineHipY * 0.9 + hipY * 0.1
    }

    // Depois da soltura, acompanha o quadril para achar o topo do salto
    if (pending) {
      if (hipY != null && (pending.minHipY == null || hipY < pending.minHipY)) pending.minHipY = hipY
      if (torso && !pending.torso) pending.torso = torso
      if (t >= pending.finalizeAt) {
        const { minHipY, torso: tl, finalizeAt, ...shot } = pending
        let jump = null
        if (baselineHipY != null && minHipY != null && tl) {
          const cm = ((baselineHipY - minHipY) / tl) * TORSO_CM
          jump = cm < 3 ? 0 : Math.min(120, Math.round(cm))
        }
        result.completed = { ...shot, jump }
        pending = null
      }
    }

    if (phase === 'RELEASE') {
      if (t >= cooldownUntil) phase = 'IDLE'
      result.phase = phase
      return result
    }

    const armUp = wrist.y < shoulder.y + 0.1

    // 1. Set point: cotovelo flexionado com a bola perto/acima da cabeça
    if (elbowAngle >= 70 && elbowAngle <= 115 && armUp) {
      if (phase === 'IDLE') {
        phase = 'SET_POINT'
        setPointAt = t
        setPointElbow = elbowAngle
      } else if (phase === 'SET_POINT') {
        setPointElbow = Math.min(setPointElbow, elbowAngle)
      }
    }

    // Segurou a bola parado demais: volta ao início
    if (phase === 'SET_POINT' && t - setPointAt > 2500) {
      phase = 'IDLE'
      setPointElbow = null
    }

    // 2. Soltura: braço estendido acima do ombro depois do set point
    if (phase === 'SET_POINT' && elbowAngle >= 145 && wrist.y < shoulder.y) {
      const windowFrames = buffer.filter((f) => t - f.t <= 1500)

      // Dip = quadro em que o pulso esteve mais baixo (maior y) antes da soltura
      let dip = windowFrames[0]
      for (const f of windowFrames) if (f.wristY > dip.wristY) dip = f
      const releaseTime = dip ? Math.max(150, Math.min(1500, Math.round(t - dip.t))) : null

      const knees = windowFrames.map((f) => f.knee).filter((k) => k != null)
      const legAngle = knees.length ? Math.min(...knees) : null

      const dx = Math.abs(wrist.x - shoulder.x)
      const dy = shoulder.y - wrist.y
      const releaseAngle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI)

      const shot = {
        id: ++shotCounter,
        t,
        elbowAngle: setPointElbow,
        releaseTime,
        legAngle,
        releaseAngle,
        quality: evaluateElbowAngle(setPointElbow).status,
        made: null,
        jump: null,
      }

      pending = { ...shot, minHipY: hipY, torso, finalizeAt: t + 450 }
      result.released = shot

      phase = 'RELEASE'
      cooldownUntil = t + 900
      setPointElbow = null
    }

    result.phase = phase
    return result
  }

  return { update }
}

/* ==========================================================
   ALVOS EM REALIDADE AUMENTADA (drible)
   ========================================================== */

const TARGET_RADIUS = 0.075 // em unidades de altura do vídeo
const TARGET_TIMEOUT = 4000

/**
 * Jogo de alvos: um alvo por vez aparece ao alcance das mãos do atleta;
 * acertar com qualquer pulso conta o tempo de reação.
 */
export const HAND_LANDMARKS = {
  left: [15, 19],
  right: [16, 20],
  both: [15, 16, 19, 20],
}

/** Mão oposta à dominante — usada nos desafios de mão fraca */
export function offHand(hand) {
  return hand === 'left' ? 'right' : 'left'
}

export function createTargetGame({ hands = HAND_LANDMARKS.both } = {}) {
  let target = null
  let lastEventAt = 0
  let side = Math.random() < 0.5 ? -1 : 1
  let counter = 0

  function spawn(lm, t, aspect) {
    const ls = lm[11]
    const rs = lm[12]
    const lh = lm[23]
    const rh = lm[24]
    if (!isVisible(ls) || !isVisible(rs)) return null
    const cx = (ls.x + rs.x) / 2
    const shoulderW = Math.max(0.08, Math.abs(ls.x - rs.x))
    const top = Math.min(ls.y, rs.y) - 0.05
    const bottom = isVisible(lh, 0.3) && isVisible(rh, 0.3) ? Math.max(lh.y, rh.y) + 0.05 : top + 0.35

    side = -side
    const offset = shoulderW * (0.9 + Math.random() * 0.8)
    const x = Math.min(0.92, Math.max(0.08, cx + side * offset))
    const y = Math.min(0.9, Math.max(0.1, top + Math.random() * (bottom - top)))
    return { id: ++counter, x, y, r: TARGET_RADIUS, bornAt: t, aspect }
  }

  function update(lm, t, aspect = 4 / 3) {
    const result = { target, hit: null, miss: null }
    if (!lm) return result

    if (!target) {
      if (t - lastEventAt < 300) return result
      target = spawn(lm, t, aspect)
      result.target = target
      return result
    }

    for (const i of hands) {
      const p = lm[i]
      if (!isVisible(p)) continue
      const d = Math.hypot((p.x - target.x) * aspect, p.y - target.y)
      if (d < target.r) {
        result.hit = { ...target, reaction: Math.round(t - target.bornAt), at: t }
        target = null
        lastEventAt = t
        result.target = null
        return result
      }
    }

    if (t - target.bornAt > TARGET_TIMEOUT) {
      result.miss = { ...target, at: t }
      target = null
      lastEventAt = t
    }

    result.target = target
    return result
  }

  return { update }
}

/* ==========================================================
   RESUMO DA SESSÃO
   ========================================================== */

function avg(values) {
  const v = values.filter((x) => x != null)
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}

function pctIdeal(shots, pick, evaluate) {
  if (!shots.length) return 0
  const ideal = shots.filter((s) => pick(s) != null && evaluate(pick(s)).status === 'ideal').length
  return Math.round((ideal / shots.length) * 100)
}

/** Arremesso com mecânica limpa: cotovelo no set point e arco de soltura ideais */
export function isCleanShot(shot) {
  return (
    shot.elbowAngle != null &&
    evaluateElbowAngle(shot.elbowAngle).status === 'ideal' &&
    shot.releaseAngle != null &&
    evaluateReleaseAngle(shot.releaseAngle).status === 'ideal'
  )
}

export function summarizeSession(drill, { shots = [], hits = [], misses = 0, durationMs = 0 }) {
  if (drill.mode === 'targets') {
    const reactions = hits.map((h) => h.reaction)
    const total = hits.length + misses
    return {
      mode: 'targets',
      totalReps: hits.length,
      misses,
      avgReaction: avg(reactions),
      bestReaction: reactions.length ? Math.min(...reactions) : null,
      durationMs,
      consistencyScore: total ? Math.round((hits.length / total) * 100) : 0,
    }
  }

  const ideal = shots.filter((s) => s.elbowAngle != null && evaluateElbowAngle(s.elbowAngle).status === 'ideal').length
  // Basta marcar um arremesso para a série valer: os não marcados contam como erro
  const marked = shots.some((s) => s.made != null)
  const jumps = shots.map((s) => s.jump).filter((j) => j != null)
  // arremessos com mecânica limpa seguidos, a partir do primeiro
  const firstBad = shots.findIndex((s) => !isCleanShot(s))
  return {
    mode: 'shooting',
    totalReps: shots.length,
    idealReps: ideal,
    consistencyScore: shots.length ? Math.round((ideal / shots.length) * 100) : 0,
    makes: shots.filter((s) => s.made).length,
    attempts: marked ? shots.length : 0,
    avgReleaseTime: avg(shots.map((s) => s.releaseTime)),
    avgLegAngle: avg(shots.map((s) => s.legAngle)),
    avgReleaseAngle: avg(shots.map((s) => s.releaseAngle)),
    avgElbowAngle: avg(shots.map((s) => s.elbowAngle)),
    maxJump: jumps.length ? Math.max(...jumps) : null,
    avgJump: avg(jumps),
    releaseIdealPct: pctIdeal(shots, (s) => s.releaseAngle, evaluateReleaseAngle),
    legIdealPct: pctIdeal(shots, (s) => s.legAngle, evaluateLegAngle),
    cleanStreak: firstBad === -1 ? shots.length : firstBad,
    durationMs,
  }
}

/**
 * Sintetizador simples de áudio via Web Audio API para feedback sonoro em quadra
 */
let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (AudioContext) audioCtx = new AudioContext()
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

function playTone(type, steps, volume, duration) {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    const now = ctx.currentTime
    steps.forEach(([freq, at]) => osc.frequency.setValueAtTime(freq, now + at))

    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + duration)
  } catch (err) {
    console.warn('[playTone]', err)
  }
}

export function playSuccessBeep() {
  playTone('sine', [[587.33, 0], [880, 0.09]], 0.2, 0.3) // D5 -> A5
}

export function playWarningBeep() {
  playTone('triangle', [[329.63, 0], [261.63, 0.12]], 0.15, 0.25) // E4 -> C4
}

export function playCountdownBeep(final = false) {
  playTone('square', [[final ? 1046.5 : 523.25, 0]], 0.08, final ? 0.35 : 0.15) // C6 / C5
}

/** Destrava o áudio no gesto do usuário (iOS exige) */
export function unlockAudio() {
  getAudioContext()
}

/* ==========================================================
   ZONAS DE ARREMESSO (linha estilo box score: 3PT 7-10)
   ========================================================== */

export const SHOT_ZONES = [
  { id: '3PT', label: '3 pontos' },
  { id: '2PT', label: '2 pontos' },
  { id: 'LL', label: 'Lance livre' },
]

/** "7-10" */
export function formatShotLine(makes, attempts) {
  return `${makes}-${attempts}`
}

export function shotPct(makes, attempts) {
  return attempts ? Math.round((makes / attempts) * 100) : 0
}
