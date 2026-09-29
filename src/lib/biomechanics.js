// src/lib/biomechanics.js

/**
 * Catálogo das 5 Modalidades Especializadas de Treino do Coach Carter
 */
export const DRILL_TYPES = {
  three_pointer: {
    id: 'three_pointer',
    title: 'Arremesso de 3 Pontos',
    shortTitle: '3 Pontos',
    badge: 'Long Range',
    color: '#D94315',
    description: 'Foco na transferência de energia das pernas (The Dip) e arco alto de parábola.',
    targetTip: 'Flexione os joelhos (~100°) e empurre a bola para cima criando uma parábola alta.',
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
    title: 'Mid-Range (Meia Distância)',
    shortTitle: 'Mid-Range',
    badge: 'Quick Release',
    color: '#F59E0B',
    description: 'Subida rápida e soltura no ponto mais alto para fugir de tocos na zona pintada.',
    targetTip: 'Mantenha o cotovelo apontado para o aro e solte a bola no ápice do salto com agilidade.',
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
    title: 'Bandeja & Passada',
    shortTitle: 'Bandeja',
    badge: 'Passada 1-2',
    color: '#34C759',
    description: 'Sincronia de passadas, elevação do joelho guia e mão suave no aro.',
    targetTip: 'Dê as duas passadas e eleve bem o joelho correspondente ao braço da bandeja.',
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
    title: 'Handles & Drible',
    shortTitle: 'Handles',
    badge: 'Controle de Bola',
    color: '#3B82F6',
    description: 'Postura atlética baixa, trocas de direção e cabeça erguida sem olhar para a bola.',
    targetTip: 'Flexione os joelhos, mantenha o peito aberto e os olhos voltados para a frente da quadra.',
    defaultReps: 30,
    presetReps: [20, 30, 50],
    isTimed: true,
    quotes: {
      high: '“Controle de bola de elite! Postura baixa, cabeça erguida e visão periférica total da quadra. Você manda no jogo!”',
      mid: '“Bom ritmo de drible! Mas cuidado: não deixe seu olhar cair para o chão. Olhos na quadra!”',
      low: '“Quem olha para a bola não vê o companheiro livre. Abaixe a base, flexione os joelhos e sinta a bola na ponta dos dedos!”',
    },
  },
  free_throw: {
    id: 'free_throw',
    title: 'Lance Livre',
    shortTitle: 'Lance Livre',
    badge: 'Mecânica Pura',
    color: '#8B5CF6',
    description: 'Rotina idêntica, equilíbrio estático e consistência milimétrica do cotovelo.',
    targetTip: 'Pés plantados na linha, respiração profunda e a mesma mecânica exata a cada arremesso.',
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

/**
 * Avalia a qualidade do ângulo do cotovelo no ponto de preparação (Set Point).
 */
export function evaluateElbowAngle(angle) {
  if (angle >= 80 && angle <= 105) {
    return { status: 'ideal', label: 'Excelente (~90°)', color: '#34C759' }
  }
  if (angle < 80) {
    return { status: 'closed', label: 'Muito fechado', color: '#F59E0B' }
  }
  return { status: 'open', label: 'Muito aberto', color: '#FF3B30' }
}

/**
 * Avalia a postura dos joelhos / agachamento para treinos de impulsão e drible.
 */
export function evaluateKneeAngle(angle) {
  if (angle >= 90 && angle <= 130) {
    return { status: 'ideal', label: 'Boa base atlética', color: '#34C759' }
  }
  if (angle > 150) {
    return { status: 'standing', label: 'Muito em pé', color: '#FF3B30' }
  }
  return { status: 'deep', label: 'Muito agachado', color: '#F59E0B' }
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

export function playSuccessBeep() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    const now = ctx.currentTime
    osc.frequency.setValueAtTime(587.33, now) // D5
    osc.frequency.setValueAtTime(880, now + 0.09) // A5

    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.3)
  } catch (err) {
    console.warn('[playSuccessBeep]', err)
  }
}

export function playWarningBeep() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    const now = ctx.currentTime
    osc.frequency.setValueAtTime(329.63, now) // E4
    osc.frequency.setValueAtTime(261.63, now + 0.12) // C4

    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.25)
  } catch (err) {
    console.warn('[playWarningBeep]', err)
  }
}
