// src/lib/gameStats.js
// Dados do grupo (jogos finalizados + stats + perfis) e os cálculos em cima
// deles: médias, ranking, MVP. Antes cada tela buscava tudo por conta
// própria com uma leitura por jogo/jogador; aqui são 3 consultas, com cache
// em memória compartilhado entre as telas durante a sessão.

import { collection, collectionGroup, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { displayName } from '@/lib/format'

export const STAT_KEYS = ['points', 'rebounds', 'assists', 'blocks', 'steals']

export const RANKING_CATEGORIES = [
  { key: 'points', label: 'PONTOS' },
  { key: 'rebounds', label: 'REBOTES' },
  { key: 'assists', label: 'ASSISTÊNCIAS' },
  { key: 'blocks', label: 'TOCOS' },
  { key: 'steals', label: 'ROUBOS' },
]

const CACHE_TTL_MS = 2 * 60 * 1000
let cache = null // { at, promise }

/** Soma usada no MVP de cada jogo (mesma fórmula de sempre) */
export function gameTotal(s) {
  return STAT_KEYS.reduce((acc, k) => acc + (s[k] || 0), 0)
}

/**
 * Jogos finalizados, cada um com os jogadores e suas stats, e o mapa de
 * perfis. Resultado em cache por alguns minutos; `force` ignora o cache.
 * { games: [{ id, date, teamA, teamB, players: [{ uid, team, points, ... }] }], profiles: { uid: {...} } }
 */
export function fetchGroupData({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.promise

  const promise = (async () => {
    const [gamesSnap, statsSnap, usersSnap] = await Promise.all([
      getDocs(query(collection(db, 'games'), where('status', '==', 'finished'))),
      getDocs(collectionGroup(db, 'stats')),
      getDocs(collection(db, 'users')),
    ])

    const gamesById = {}
    gamesSnap.docs.forEach((d) => {
      gamesById[d.id] = { id: d.id, ...d.data(), players: [] }
    })

    statsSnap.docs.forEach((d) => {
      const game = gamesById[d.ref.parent.parent.id]
      const data = d.data()
      if (!game || !data.uid) return
      game.players.push({
        uid: data.uid,
        team: data.team,
        points: data.points || 0,
        rebounds: data.rebounds || 0,
        assists: data.assists || 0,
        blocks: data.blocks || 0,
        steals: data.steals || 0,
        threePointers: data.threePointers || 0,
      })
    })

    const profiles = Object.fromEntries(usersSnap.docs.map((d) => [d.id, d.data()]))
    const games = Object.values(gamesById).sort((a, b) => b.date.toMillis() - a.date.toMillis())
    return { games, profiles }
  })()

  cache = { at: Date.now(), promise }
  promise.catch(() => {
    cache = null
  })
  return promise
}

/** Invalida o cache (ex.: ao encerrar um jogo) */
export function invalidateGroupData() {
  cache = null
}

/** MVP de um jogo: quem teve a maior soma. { uids, total } ou null */
export function gameMvp(players) {
  if (!players.length) return null
  const max = Math.max(...players.map(gameTotal))
  if (max === 0) return null
  return { uids: players.filter((p) => gameTotal(p) === max).map((p) => p.uid), total: max }
}

/**
 * Histórico de um jogador, do mais recente ao mais antigo:
 * [{ gameId, date, ownTeamName, oppTeamName, points, ..., plusMinus, won, isMvp }]
 */
export function playerGameLog(games, uid) {
  const log = []
  games.forEach((game) => {
    const me = game.players.find((p) => p.uid === uid)
    if (!me) return
    const own = me.team === 'A' ? game.teamA : game.teamB
    const opp = me.team === 'A' ? game.teamB : game.teamA
    const mvp = gameMvp(game.players)
    log.push({
      gameId: game.id,
      date: game.date,
      team: me.team,
      ownTeamName: own.name,
      oppTeamName: opp.name,
      ...Object.fromEntries(STAT_KEYS.map((k) => [k, me[k]])),
      threePointers: me.threePointers,
      ownScore: own.score,
      oppScore: opp.score,
      plusMinus: own.score - opp.score,
      won: own.score > opp.score,
      isMvp: !!mvp?.uids.includes(uid),
    })
  })
  return log
}

/** Médias por jogo de um histórico (null se vazio) */
export function computeAverages(log) {
  if (!log.length) return null
  const avg = (k) => log.reduce((s, g) => s + g[k], 0) / log.length
  return {
    games: log.length,
    ...Object.fromEntries(STAT_KEYS.map((k) => [k, avg(k)])),
    plusMinus: avg('plusMinus'),
    wins: log.filter((g) => g.won).length,
    mvps: log.filter((g) => g.isMvp).length,
  }
}

/**
 * Ranking por categoria somando os jogos informados. Ranking "denso":
 * empate divide a posição e o próximo valor só incrementa (1, 2, 2, 3).
 * `limit` corta a lista (ex.: top 3 no Início).
 */
export function computeRankings(games, profiles, { limit } = {}) {
  const totals = {}
  games.forEach((game) =>
    game.players.forEach((p) => {
      totals[p.uid] ||= Object.fromEntries(STAT_KEYS.map((k) => [k, 0]))
      STAT_KEYS.forEach((k) => {
        totals[p.uid][k] += p[k]
      })
    })
  )

  function listFor(field) {
    const sorted = Object.keys(totals)
      .map((uid) => ({
        uid,
        name: displayName(profiles[uid]),
        photoURL: profiles[uid]?.photoURL || null,
        value: totals[uid][field],
      }))
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value)

    const ranked = []
    sorted.forEach((p, i) => {
      const rank = i === 0 ? 1 : sorted[i - 1].value === p.value ? ranked[i - 1].rank : ranked[i - 1].rank + 1
      ranked.push({ ...p, rank })
    })
    return limit ? ranked.slice(0, limit) : ranked
  }

  return Object.fromEntries(STAT_KEYS.map((k) => [k, listFor(k)]))
}

/** Quem foi MVP mais vezes nos jogos informados: [{ uid, name, count }] */
export function computePeriodMvp(games, profiles) {
  const count = {}
  games.forEach((game) => {
    gameMvp(game.players)?.uids.forEach((uid) => {
      count[uid] = (count[uid] || 0) + 1
    })
  })
  const uids = Object.keys(count)
  if (!uids.length) return []
  const max = Math.max(...uids.map((u) => count[u]))
  return uids.filter((u) => count[u] === max).map((uid) => ({ uid, name: displayName(profiles[uid]), count: max }))
}

/** Vitórias de `uid` contra cada adversário: { adversárioUid: vitórias } */
export function headToHeadWins(games, uid) {
  const tally = {}
  games.forEach((game) => {
    const me = game.players.find((p) => p.uid === uid)
    if (!me) return
    const own = me.team === 'A' ? game.teamA : game.teamB
    const opp = me.team === 'A' ? game.teamB : game.teamA
    if (own.score <= opp.score) return
    game.players
      .filter((p) => p.team !== me.team)
      .forEach((p) => {
        tally[p.uid] = (tally[p.uid] || 0) + 1
      })
  })
  return tally
}

/**
 * Mês a mostrar no ranking do Início: o atual se tiver jogos; senão o mês
 * do jogo mais recente. { date, isCurrent }
 */
export function latestActiveMonth(games, now = new Date()) {
  const sameMonth = (d) => d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  if (!games.length || games.some((g) => sameMonth(g.date.toDate()))) return { date: now, isCurrent: true }
  const latest = games.reduce((a, g) => (g.date.toMillis() > a.date.toMillis() ? g : a)).date.toDate()
  return { date: latest, isCurrent: false }
}
