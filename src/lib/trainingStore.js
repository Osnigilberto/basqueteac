// src/lib/trainingStore.js
// Persistência dos treinos e recordes de desafios: cache local primeiro
// (resposta imediata e funciona mesmo sem permissão no Firestore) e
// Firestore como fonte compartilhada entre aparelhos.

import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getChallenge, mergeBest } from '@/lib/challenges'
import { DRILL_TYPES } from '@/lib/biomechanics'

const HISTORY_LIMIT = 10
const DAYS_LIMIT = 60

function historyKey(uid) {
  return `basqueteac_trainings_${uid}`
}

function statsKey(uid) {
  return `basqueteac_training_stats_${uid}`
}

function challengesKey(uid) {
  return `basqueteac_challenges_${uid}`
}

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch (e) {
    return fallback
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {}
}

/* ===== TREINOS ===== */

/** Zona de um treino salvo (treinos antigos não guardavam: vem do drill) */
export function sessionZone(session) {
  return session.zone || DRILL_TYPES[session.drillId]?.zone || null
}

/** 'AAAA-MM-DD' no fuso local */
export function dayKey(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function mergeDays(a = [], b = []) {
  return Array.from(new Set([...a, ...b]))
    .sort()
    .reverse()
    .slice(0, DAYS_LIMIT)
}

/**
 * Dias seguidos com treino terminando hoje — ou ontem, para a sequência
 * não "quebrar" antes de a pessoa treinar no dia.
 */
export function trainingStreak(days = [], today = new Date()) {
  const set = new Set(days)
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (set.has(dayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/**
 * Números acumulados de uma lista de treinos:
 * { count, reps, scoreSum, zones: { '3PT': { makes, attempts }, ... }, days: ['AAAA-MM-DD', ...] }
 */
export function summarizeHistory(sessions) {
  const stats = { count: 0, reps: 0, scoreSum: 0, zones: {}, days: [] }
  const days = []
  sessions.forEach((s) => {
    if (s.createdAt?.seconds) days.push(dayKey(new Date(s.createdAt.seconds * 1000)))
    stats.count += 1
    stats.reps += s.totalReps || 0
    stats.scoreSum += s.consistencyScore || 0
    const zone = sessionZone(s)
    if (zone && s.attempts > 0) {
      const z = (stats.zones[zone] ||= { makes: 0, attempts: 0 })
      z.makes += s.makes || 0
      z.attempts += s.attempts
    }
  })
  stats.days = mergeDays(days)
  return stats
}

function addStats(a, b) {
  const zones = { ...a.zones }
  Object.entries(b.zones).forEach(([k, z]) => {
    const prev = zones[k] || { makes: 0, attempts: 0 }
    zones[k] = { makes: prev.makes + z.makes, attempts: prev.attempts + z.attempts }
  })
  return {
    count: a.count + b.count,
    reps: a.reps + b.reps,
    scoreSum: a.scoreSum + b.scoreSum,
    zones,
    days: mergeDays(a.days, b.days),
  }
}

export function cachedTrainingSessions(uid) {
  return readLocal(historyKey(uid), [])
}

export function cachedTrainingStats(uid) {
  return readLocal(statsKey(uid), null) || summarizeHistory(cachedTrainingSessions(uid))
}

/**
 * Treinos do Firestore: os últimos (histórico) e o acumulado de todos
 * (ordenados em memória para evitar índice composto). null se não houver.
 */
export async function loadTrainingSessions(uid) {
  try {
    const snap = await getDocs(query(collection(db, 'training_sessions'), where('uid', '==', uid)))
    if (snap.empty) return null
    const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    sessions.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    const recent = sessions.slice(0, HISTORY_LIMIT)
    const stats = summarizeHistory(sessions)
    writeLocal(historyKey(uid), recent)
    writeLocal(statsKey(uid), stats)
    return { recent, stats }
  } catch (err) {
    console.warn('[loadTrainingSessions]', err?.message)
    return null
  }
}

/** Salva um treino; devolve { recent, stats } locais atualizados */
export async function saveTrainingSession(uid, record) {
  const recent = [
    { id: 'session-' + Date.now(), ...record, createdAt: { seconds: Math.floor(Date.now() / 1000) } },
    ...cachedTrainingSessions(uid),
  ].slice(0, HISTORY_LIMIT)
  const stats = addStats(
    cachedTrainingStats(uid),
    summarizeHistory([{ ...record, createdAt: { seconds: Math.floor(Date.now() / 1000) } }])
  )
  writeLocal(historyKey(uid), recent)
  writeLocal(statsKey(uid), stats)

  try {
    await addDoc(collection(db, 'training_sessions'), { uid, ...record, createdAt: serverTimestamp() })
  } catch (err) {
    console.warn('[saveTrainingSession - Firestore permissions]', err?.message)
  }
  return { recent, stats }
}

/* ===== DESAFIOS ===== */

export function cachedChallengeBest(uid) {
  return readLocal(challengesKey(uid), {})
}

/** Recordes do Firestore mesclados com os locais (o que só existe no aparelho não se perde) */
export async function loadChallengeBest(uid) {
  let best = cachedChallengeBest(uid)
  try {
    const snap = await getDocs(query(collection(db, 'challenge_results'), where('uid', '==', uid)))
    snap.docs.forEach((d) => {
      const r = d.data()
      const challenge = getChallenge(r.challengeId)
      if (challenge) best = mergeBest(best, challenge, r)
    })
    writeLocal(challengesKey(uid), best)
  } catch (err) {
    console.warn('[loadChallengeBest]', err?.message)
  }
  return best
}

/** Salva um resultado de desafio; devolve os recordes atualizados */
export async function saveChallengeResult(uid, challenge, { value, stars }) {
  const best = mergeBest(cachedChallengeBest(uid), challenge, { value, stars })
  writeLocal(challengesKey(uid), best)

  try {
    await addDoc(collection(db, 'challenge_results'), {
      uid,
      challengeId: challenge.id,
      value,
      stars,
      createdAt: serverTimestamp(),
    })
  } catch (err) {
    console.warn('[saveChallengeResult - Firestore permissions]', err?.message)
  }
  return best
}
