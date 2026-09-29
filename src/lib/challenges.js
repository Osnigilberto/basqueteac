// src/lib/challenges.js
// Desafios solo, organizados por fundamento. Cada desafio tem metas
// bronze/prata/ouro (1–3 estrelas) e, dentro de cada fundamento, o próximo
// desafio só abre depois de tirar pelo menos bronze no anterior (trilha).

export const TIER_NAMES = ['Bronze', 'Prata', 'Ouro']
export const TIER_COLORS = ['#CD7F32', '#C0C7D0', '#FFC53D']

/** Fundamentos (abas). `id` é também o drillId usado na sessão. */
export const CHALLENGE_CATEGORIES = [
  { id: 'handles', title: 'Handles', icon: '🔥' },
  { id: 'three_pointer', title: '3 Pontos', icon: '🎯' },
  { id: 'mid_range', title: 'Mid-Range', icon: '⚡' },
  { id: 'free_throw', title: 'Lance Livre', icon: '🎖️' },
  { id: 'layup', title: 'Bandeja', icon: '🏃' },
]

/**
 * Métricas que um desafio pode medir, lidas do resumo de summarizeSession().
 * Tempos em ms; `direction` diz se valor maior ou menor é melhor.
 */
const METRICS = {
  hits: { get: (s) => s.totalReps, unit: 'alvos', direction: 'higher' },
  shots: { get: (s) => s.totalReps, unit: 'arremessos', direction: 'higher' },
  avgReaction: { get: (s) => s.avgReaction, unit: 's', direction: 'lower' },
  avgReleaseTime: { get: (s) => s.avgReleaseTime, unit: 's', direction: 'lower' },
  elbowIdealPct: { get: (s) => s.consistencyScore, unit: '%', direction: 'higher' },
  releaseIdealPct: { get: (s) => s.releaseIdealPct, unit: '%', direction: 'higher' },
  legIdealPct: { get: (s) => s.legIdealPct, unit: '%', direction: 'higher' },
  cleanStreak: { get: (s) => s.cleanStreak, unit: 'seguidos', direction: 'higher' },
  makes: { get: (s) => s.makes, unit: 'cestas', direction: 'higher' },
  avgJump: { get: (s) => s.avgJump, unit: 'cm', direction: 'higher' },
}

/**
 * rules (lidas pela TrainingSession):
 *  reps          meta de repetições (encerra ao atingir)
 *  timeLimitMs   contagem regressiva; encerra ao zerar
 *  endOnMiss     alvos: deixou um alvo expirar, acabou
 *  hand: 'off'   alvos: só a mão não dominante conta
 *  endOnBadShot  arremesso: mecânica fora do ideal, acabou
 * minReps: repetições mínimas para o resultado valer estrelas
 *
 * A ordem dentro de cada categoria é a ordem da trilha.
 */
export const CHALLENGES = [
  // ===== HANDLES =====
  {
    id: 'first_targets',
    category: 'handles',
    icon: '🎯',
    title: 'Primeiros Alvos',
    description: 'Acerte o máximo de alvos que conseguir em 60 segundos, driblando sem parar.',
    rules: { timeLimitMs: 60000 },
    metric: 'hits',
    tiers: [15, 25, 35],
  },
  {
    id: 'reaction',
    category: 'handles',
    icon: '⚡',
    title: 'Reação',
    description: '20 alvos. Quanto mais rápido você chegar em cada um, melhor a sua média.',
    rules: { reps: 20 },
    minReps: 20,
    metric: 'avgReaction',
    tiers: [1200, 1000, 800],
  },
  {
    id: 'perfect_sequence',
    category: 'handles',
    icon: '🔗',
    title: 'Sequência Perfeita',
    description: 'Alvos seguidos sem deixar nenhum escapar. Perdeu um, acabou.',
    rules: { endOnMiss: true },
    metric: 'hits',
    tiers: [10, 20, 30],
  },
  {
    id: 'weak_hand',
    category: 'handles',
    icon: '🤚',
    title: 'Mão Fraca',
    description: '45 segundos em que só a sua mão não dominante acerta os alvos.',
    rules: { timeLimitMs: 45000, hand: 'off' },
    metric: 'hits',
    tiers: [10, 18, 25],
  },
  {
    id: 'blitz_30',
    category: 'handles',
    icon: '💥',
    title: 'Blitz 30s',
    description: 'Só 30 segundos. Todos os alvos que der, sem respirar.',
    rules: { timeLimitMs: 30000 },
    metric: 'hits',
    tiers: [15, 22, 28],
  },
  {
    id: 'lightning',
    category: 'handles',
    icon: '🌩️',
    title: 'Relâmpago',
    description: '20 alvos com reação de elite. A média precisa ficar abaixo de 1 segundo.',
    rules: { reps: 20 },
    minReps: 20,
    metric: 'avgReaction',
    tiers: [900, 750, 600],
  },

  // ===== 3 PONTOS =====
  {
    id: 'use_legs',
    category: 'three_pointer',
    icon: '🦵',
    title: 'Pernas de 3',
    description: '10 bolas de 3. Conta quantas tiveram a flexão de joelhos ideal no dip — a força vem do chão.',
    rules: { reps: 10 },
    minReps: 10,
    metric: 'legIdealPct',
    tiers: [50, 70, 90],
  },
  {
    id: 'high_arc',
    category: 'three_pointer',
    icon: '🌈',
    title: 'Arco de 3',
    description: '10 bolas de 3. Conta quantas saíram com o braço bem inclinado para cima.',
    rules: { reps: 10 },
    minReps: 10,
    metric: 'releaseIdealPct',
    tiers: [50, 70, 90],
  },
  {
    id: 'three_rhythm',
    category: 'three_pointer',
    icon: '⏱️',
    title: 'Ritmo de 3',
    description: '10 bolas de 3 com soltura fluida: do dip à soltura num só movimento.',
    rules: { reps: 10 },
    minReps: 10,
    metric: 'avgReleaseTime',
    tiers: [900, 800, 700],
  },
  {
    id: 'hot_three',
    category: 'three_pointer',
    icon: '🌧️',
    title: 'Chuva de 3',
    description: '10 bolas de 3 valendo cesta. No final, toque nas que caíram.',
    rules: { reps: 10 },
    minReps: 10,
    metric: 'makes',
    tiers: [3, 5, 7],
  },

  // ===== MID-RANGE =====
  {
    id: 'shot_rhythm',
    category: 'mid_range',
    icon: '⏱️',
    title: 'Soltura Rápida',
    description: '10 arremessos de meia distância com soltura rápida para fugir do toco.',
    rules: { reps: 10 },
    minReps: 10,
    metric: 'avgReleaseTime',
    tiers: [800, 700, 600],
  },
  {
    id: 'elbow_90',
    category: 'mid_range',
    icon: '📐',
    title: 'Cotovelo 90°',
    description: '10 arremessos. Conta quantos chegaram ao set point com o cotovelo perto de 90°.',
    rules: { reps: 10 },
    minReps: 10,
    metric: 'elbowIdealPct',
    tiers: [50, 70, 90],
  },
  {
    id: 'machine',
    category: 'mid_range',
    icon: '🤖',
    title: 'Máquina',
    description: 'Arremessos seguidos com cotovelo e arco ideais. Errou a mecânica, acabou.',
    rules: { endOnBadShot: true, reps: 20 },
    metric: 'cleanStreak',
    tiers: [5, 8, 12],
  },
  {
    id: 'mid_hot',
    category: 'mid_range',
    icon: '🔥',
    title: 'Zona Quente',
    description: '10 arremessos de meia distância valendo cesta. No final, toque nos que caíram.',
    rules: { reps: 10 },
    minReps: 10,
    metric: 'makes',
    tiers: [4, 6, 8],
  },

  // ===== LANCE LIVRE =====
  {
    id: 'ft_routine',
    category: 'free_throw',
    icon: '🧘',
    title: 'Rotina',
    description: '10 lances livres com o cotovelo no mesmo lugar em todos. Repetição é tudo.',
    rules: { reps: 10 },
    minReps: 10,
    metric: 'elbowIdealPct',
    tiers: [60, 80, 100],
  },
  {
    id: 'ft_clean',
    category: 'free_throw',
    icon: '🎖️',
    title: 'Mecânica Pura',
    description: 'Lances livres seguidos com cotovelo e arco ideais. Errou a mecânica, acabou.',
    rules: { endOnBadShot: true, reps: 15 },
    metric: 'cleanStreak',
    tiers: [5, 8, 10],
  },
  {
    id: 'ft_makes',
    category: 'free_throw',
    icon: '🧊',
    title: 'Linha Fria',
    description: '10 lances livres valendo cesta. No final, toque nos que caíram.',
    rules: { reps: 10 },
    minReps: 10,
    metric: 'makes',
    tiers: [6, 8, 10],
  },

  // ===== BANDEJA =====
  {
    id: 'layup_jump',
    category: 'layup',
    icon: '🚀',
    title: 'Subida',
    description: '10 bandejas subindo o máximo que der. Vale a média do salto (estimado pela câmera).',
    rules: { reps: 10 },
    minReps: 10,
    metric: 'avgJump',
    tiers: [20, 30, 40],
  },
  {
    id: 'layup_tempo',
    category: 'layup',
    icon: '🔁',
    title: 'Ritmo de Bandeja',
    description: 'Bandeja, pega o rebote, volta e repete. Quantas cabem em 60 segundos?',
    rules: { timeLimitMs: 60000 },
    metric: 'shots',
    tiers: [6, 9, 12],
  },
  {
    id: 'layup_makes',
    category: 'layup',
    icon: '🏀',
    title: 'Bandeja Certa',
    description: '10 bandejas valendo cesta. No final, toque nas que caíram.',
    rules: { reps: 10 },
    minReps: 10,
    metric: 'makes',
    tiers: [6, 8, 10],
  },
]

export const TOTAL_STARS = CHALLENGES.length * 3

export function getChallenge(id) {
  return CHALLENGES.find((c) => c.id === id) || null
}

export function getCategory(id) {
  return CHALLENGE_CATEGORIES.find((c) => c.id === id) || null
}

export function challengesOf(categoryId) {
  return CHALLENGES.filter((c) => c.category === categoryId)
}

export function metricOf(challenge) {
  return METRICS[challenge.metric]
}

/** Valor formatado para exibição (tempos em segundos) */
export function formatValue(challenge, value) {
  if (value == null) return '--'
  const { unit } = metricOf(challenge)
  if (unit === 's') return `${(value / 1000).toFixed(2)}s`
  if (unit === '%') return `${value}%`
  if (unit === 'cm') return `${value}cm`
  return String(value)
}

/** Texto curto da meta: "≥ 25 alvos", "≤ 0.80s" */
export function formatTier(challenge, tier) {
  const { unit, direction } = metricOf(challenge)
  const sign = direction === 'higher' ? '≥' : '≤'
  if (unit === 's') return `${sign} ${(tier / 1000).toFixed(2)}s`
  if (unit === '%' || unit === 'cm') return `${sign} ${tier}${unit}`
  return `${sign} ${tier} ${unit}`
}

export function starsFor(challenge, value) {
  if (value == null) return 0
  const { direction } = metricOf(challenge)
  return challenge.tiers.filter((t) => (direction === 'higher' ? value >= t : value <= t)).length
}

/** true se `a` é um resultado melhor que `b` */
export function isBetter(challenge, a, b) {
  if (a == null) return false
  if (b == null) return true
  return metricOf(challenge).direction === 'higher' ? a > b : a < b
}

/**
 * Pontua uma sessão de desafio a partir do resumo de summarizeSession().
 * Abaixo de `minReps` o resultado não vale estrelas (incomplete).
 */
export function scoreChallenge(challenge, summary) {
  const value = metricOf(challenge).get(summary) ?? null
  const incomplete = challenge.minReps != null && (summary.totalReps || 0) < challenge.minReps
  return {
    value: incomplete ? null : value,
    stars: incomplete ? 0 : starsFor(challenge, value),
    incomplete,
  }
}

/** Trilha: o primeiro de cada fundamento é livre; os demais pedem bronze no anterior */
export function isUnlocked(challenge, bestById = {}) {
  const list = challengesOf(challenge.category)
  const i = list.findIndex((c) => c.id === challenge.id)
  return i <= 0 || (bestById[list[i - 1].id]?.stars || 0) >= 1
}

/** Próximo desafio a fazer num fundamento: o primeiro liberado sem as 3 estrelas */
export function nextChallengeOf(categoryId, bestById = {}) {
  return challengesOf(categoryId).find((c) => isUnlocked(c, bestById) && (bestById[c.id]?.stars || 0) < 3) || null
}

/**
 * Progresso a partir dos recordes { [challengeId]: { value, stars } }
 */
export function computeProgress(bestById = {}) {
  const starsOf = (list) => list.reduce((acc, c) => acc + (bestById[c.id]?.stars || 0), 0)
  const byCategory = {}
  CHALLENGE_CATEGORIES.forEach((cat) => {
    const list = challengesOf(cat.id)
    byCategory[cat.id] = { stars: starsOf(list), total: list.length * 3 }
  })
  return { totalStars: starsOf(CHALLENGES), byCategory }
}

/** Desafio que passa a ficar liberado se `challenge` ganhar `stars` agora */
export function newlyUnlocked(challenge, bestById, stars) {
  const list = challengesOf(challenge.category)
  const next = list[list.findIndex((c) => c.id === challenge.id) + 1]
  if (!next || isUnlocked(next, bestById) || stars < 1) return null
  return next
}

/** Mescla um novo resultado nos recordes, mantendo o melhor valor e o máximo de estrelas */
export function mergeBest(bestById, challenge, { value, stars }) {
  const prev = bestById[challenge.id]
  const better = isBetter(challenge, value, prev?.value)
  return {
    ...bestById,
    [challenge.id]: {
      value: better ? value : prev?.value ?? null,
      stars: Math.max(stars, prev?.stars || 0),
    },
  }
}
