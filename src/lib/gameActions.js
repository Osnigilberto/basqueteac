// src/lib/gameActions.js
// Ações de marcação do jogo ao vivo e o inverso de cada uma, para o
// "Desfazer última ação". Tipos:
//   { kind: 'points', uid, team, value }  +1/+2/+3 (ou −1); +3 também conta cesta de 3
//   { kind: 'undoThree', uid, team }      −3 corrigindo a cesta de 3
//   { kind: 'stat', uid, field, value }   rebote, assistência, toco, roubo (±1)

export const UNDO_LIMIT = 20

export const STAT_LABELS = {
  rebounds: 'REB',
  assists: 'AST',
  blocks: 'BLO',
  steals: 'ROU',
}

/** Ação que desfaz `action` */
export function inverseAction(action) {
  switch (action.kind) {
    case 'points':
      return action.value === 3
        ? { kind: 'undoThree', uid: action.uid, team: action.team }
        : { ...action, value: -action.value }
    case 'undoThree':
      return { kind: 'points', uid: action.uid, team: action.team, value: 3 }
    case 'stat':
      return { ...action, value: -action.value }
    default:
      throw new Error(`Ação desconhecida: ${action.kind}`)
  }
}

/** Texto curto da ação: "+2", "−3", "+1 REB" */
export function describeAction(action) {
  const sign = (v) => (v > 0 ? `+${v}` : `−${Math.abs(v)}`)
  if (action.kind === 'undoThree') return '−3'
  if (action.kind === 'points') return sign(action.value)
  return `${sign(action.value)} ${STAT_LABELS[action.field] || action.field}`
}

/** Empilha uma ação mantendo só as últimas UNDO_LIMIT */
export function pushAction(stack, action) {
  return [...stack, action].slice(-UNDO_LIMIT)
}

/**
 * Sorteia os times de forma equilibrada (mesma quantidade em cada lado, ±1).
 * Com `ratings` (ex.: PPG da temporada) usa "snake draft" — A, B, B, A, A... —
 * alternando os melhores entre os times; sem ratings, é só aleatório.
 * `random` pode ser fixado nos testes. Retorna { A: [uids], B: [uids] }.
 */
export function drawTeams(uids, ratings = {}, random = Math.random) {
  const pool = [...uids]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  const hasRatings = pool.some((uid) => (ratings[uid] || 0) > 0)
  // sort é estável: empates mantêm a ordem embaralhada
  if (hasRatings) pool.sort((a, b) => (ratings[b] || 0) - (ratings[a] || 0))

  const [first, second] = random() < 0.5 ? ['A', 'B'] : ['B', 'A']
  const teams = { A: [], B: [] }
  pool.forEach((uid, i) => {
    // snake: 0→1º, 1→2º, 2→2º, 3→1º, 4→1º, 5→2º...
    const pick = hasRatings ? (i % 4 === 0 || i % 4 === 3 ? first : second) : i % 2 === 0 ? first : second
    teams[pick].push(uid)
  })
  return teams
}
