'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { Flame, Play, Smartphone, Loader2, History } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase'
import BottomNav from '@/components/BottomNav/BottomNav'
import TrainingSession from '@/components/TrainingSession/TrainingSession'
import TrainingSummary from '@/components/TrainingSummary/TrainingSummary'
import { DRILL_TYPES, summarizeSession, unlockAudio } from '@/lib/biomechanics'
import styles from './page.module.css'

const DRILL_EMOJIS = {
  free_shooting: '🏀',
  three_pointer: '🎯',
  mid_range: '⚡',
  layup: '🏃',
  handles: '🔥',
  free_throw: '🎖️',
}

const SETUP_TIPS = {
  user: 'Câmera frontal: apoie o celular de pé no chão ou numa garrafa, a uns 2 metros, virado para você.',
  environment: 'Câmera traseira: use um tripé ou apoio a 4–6 metros, de lado para o arremessador, com o corpo inteiro no quadro.',
}

function historyKey(uid) {
  return `basqueteac_trainings_${uid}`
}

function formatDate(seconds) {
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function TrainingPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  // Configurações do treino
  const [selectedDrill, setSelectedDrill] = useState('free_shooting')
  const [dominantHand, setDominantHand] = useState('right')
  const [targetReps, setTargetReps] = useState(DRILL_TYPES.free_shooting.defaultReps)
  const [cameraFacing, setCameraFacing] = useState('environment')
  const [aiReady, setAiReady] = useState(false)

  // lobby | session | summary
  const [view, setView] = useState('lobby')
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)

  // Histórico
  const [pastSessions, setPastSessions] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const activeDrill = DRILL_TYPES[selectedDrill] || DRILL_TYPES.free_shooting

  function handleSelectDrill(drillId) {
    const d = DRILL_TYPES[drillId]
    if (!d) return
    setSelectedDrill(drillId)
    setTargetReps(d.defaultReps)
    setCameraFacing(d.camera)
  }

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [loading, user, router])

  // Carrega histórico de treinos do usuário
  useEffect(() => {
    if (!user) return
    async function loadPastSessions() {
      // 1. Cache local para resposta imediata
      try {
        const local = localStorage.getItem(historyKey(user.uid))
        if (local) setPastSessions(JSON.parse(local))
      } catch (e) {
        // ignore
      }

      // 2. Firestore (ordenando em memória para evitar exigência de índice composto)
      try {
        const q = query(collection(db, 'training_sessions'), where('uid', '==', user.uid))
        const snap = await getDocs(q)
        if (!snap.empty) {
          const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          sessions.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
          const topSessions = sessions.slice(0, 10)
          setPastSessions(topSessions)
          try {
            localStorage.setItem(historyKey(user.uid), JSON.stringify(topSessions))
          } catch (e) {}
        }
      } catch (err) {
        console.warn('[loadPastSessions]', err?.message)
      } finally {
        setLoadingHistory(false)
      }
    }
    loadPastSessions()
  }, [user])

  function startSession() {
    unlockAudio()
    setResult(null)
    setView('session')
  }

  function handleSessionFinish(raw) {
    setResult({ raw, summary: summarizeSession(activeDrill, raw) })
    setView('summary')
  }

  // Salva o treino localmente e no Firestore
  async function saveSession() {
    if (!user || !result) return
    setSaving(true)

    const record = {
      drillId: selectedDrill,
      drillTitle: activeDrill.title,
      drillBadge: activeDrill.badge,
      dominantHand,
      ...result.summary,
    }

    try {
      const current = JSON.parse(localStorage.getItem(historyKey(user.uid)) || '[]')
      const updated = [
        { id: 'session-' + Date.now(), ...record, createdAt: { seconds: Math.floor(Date.now() / 1000) } },
        ...current,
      ].slice(0, 10)
      localStorage.setItem(historyKey(user.uid), JSON.stringify(updated))
      setPastSessions(updated)
    } catch (e) {}

    try {
      await addDoc(collection(db, 'training_sessions'), {
        uid: user.uid,
        ...record,
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn('[saveSession - Firestore permissions]', err?.message)
    } finally {
      setSaving(false)
      setView('lobby')
    }
  }

  // Números agregados do histórico
  const totalReps = pastSessions.reduce((a, s) => a + (s.totalReps || 0), 0)
  const avgScore = pastSessions.length
    ? Math.round(pastSessions.reduce((a, s) => a + (s.consistencyScore || 0), 0) / pastSessions.length)
    : null

  return (
    <main className={styles.page}>
      {/* MediaPipe Pose via CDN */}
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"
        strategy="afterInteractive"
        onReady={() => setAiReady(true)}
      />

      {/* HERO */}
      <section className={styles.hero}>
        <svg className={styles.court} viewBox="0 0 400 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <path d="M20 260 V120 A180 180 0 0 1 380 120 V260" />
          <rect x="140" y="140" width="120" height="120" />
          <circle cx="200" cy="140" r="40" />
          <circle cx="200" cy="232" r="9" />
        </svg>
        <div className={styles.heroInner}>
          <div className={styles.eyebrow}>
            <Flame size={14} /> Lab IA · Coach Carter
          </div>
          <h1 className={styles.heroTitle}>
            Cada arremesso
            <br />
            <span>conta.</span>
          </h1>
          <p className={styles.heroText}>
            Só você, a bola e a câmera do celular. A IA acompanha seu corpo, conta suas repetições e mede sua mecânica em
            tempo real.
          </p>

          <div className={styles.heroStats}>
            <div>
              <strong>{pastSessions.length}</strong>
              <span>Treinos</span>
            </div>
            <div>
              <strong>{totalReps}</strong>
              <span>Repetições</span>
            </div>
            <div>
              <strong>{avgScore != null ? `${avgScore}%` : '--'}</strong>
              <span>Consistência</span>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.content}>
        {/* WORKOUTS */}
        <div className={styles.sectionHead}>
          <h2>Treinos</h2>
          <span>{Object.keys(DRILL_TYPES).length} drills</span>
        </div>
        <div className={styles.carousel}>
          {Object.values(DRILL_TYPES).map((drill) => (
            <button
              key={drill.id}
              type="button"
              style={{ '--drill-color': drill.color }}
              className={`${styles.drillCard} ${selectedDrill === drill.id ? styles.drillCardActive : ''}`}
              onClick={() => handleSelectDrill(drill.id)}
              aria-pressed={selectedDrill === drill.id}
            >
              <span className={styles.drillEmoji}>{DRILL_EMOJIS[drill.id] || '🏀'}</span>
              <span className={styles.drillBadge}>{drill.badge}</span>
              <span className={styles.drillTitle}>{drill.shortTitle}</span>
              <span className={styles.drillMeasures}>{drill.measures.join(' · ')}</span>
            </button>
          ))}
        </div>

        {/* DETALHE + CONFIGURAÇÃO */}
        <section className={styles.panel} style={{ '--drill-color': activeDrill.color }}>
          <div className={styles.panelHead}>
            <h3>{activeDrill.title}</h3>
            <p>{activeDrill.description}</p>
          </div>

          <div className={styles.setupTip}>
            <Smartphone size={18} />
            <span>{SETUP_TIPS[cameraFacing]}</span>
          </div>

          {activeDrill.mode === 'shooting' && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Mão de arremesso</span>
              <div className={styles.segmented}>
                <button
                  type="button"
                  className={dominantHand === 'right' ? styles.segActive : ''}
                  onClick={() => setDominantHand('right')}
                >
                  Direita
                </button>
                <button
                  type="button"
                  className={dominantHand === 'left' ? styles.segActive : ''}
                  onClick={() => setDominantHand('left')}
                >
                  Esquerda
                </button>
              </div>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.fieldLabel}>{activeDrill.mode === 'targets' ? 'Alvos' : 'Meta de arremessos'}</span>
            <div className={styles.segmented}>
              {activeDrill.presetReps.map((r) => (
                <button key={r} type="button" className={targetReps === r ? styles.segActive : ''} onClick={() => setTargetReps(r)}>
                  {r}
                </button>
              ))}
              <button
                type="button"
                className={targetReps === 'free' ? styles.segActive : ''}
                onClick={() => setTargetReps('free')}
              >
                Livre
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Câmera</span>
            <div className={styles.segmented}>
              <button
                type="button"
                className={cameraFacing === 'user' ? styles.segActive : ''}
                onClick={() => setCameraFacing('user')}
              >
                Frontal
              </button>
              <button
                type="button"
                className={cameraFacing === 'environment' ? styles.segActive : ''}
                onClick={() => setCameraFacing('environment')}
              >
                Traseira
              </button>
            </div>
          </div>

          <div className={styles.coachTip}>
            <strong>Coach Carter</strong>
            {activeDrill.targetTip}
          </div>

          <button type="button" className={styles.startBtn} onClick={startSession} disabled={!aiReady}>
            {aiReady ? (
              <>
                <Play size={20} fill="currentColor" /> Começar
              </>
            ) : (
              <>
                <Loader2 size={20} className={styles.spin} /> Carregando IA…
              </>
            )}
          </button>
        </section>

        {/* HISTÓRICO */}
        <div className={styles.sectionHead}>
          <h2>Histórico</h2>
          <History size={18} />
        </div>
        {loadingHistory && pastSessions.length === 0 ? (
          <p className={styles.empty}>Carregando histórico…</p>
        ) : pastSessions.length === 0 ? (
          <p className={styles.empty}>Nenhum treino gravado ainda. Seja o primeiro a calibrar!</p>
        ) : (
          <div className={styles.historyList}>
            {pastSessions.map((s) => {
              const drill = DRILL_TYPES[s.drillId]
              const detail =
                s.mode === 'targets'
                  ? s.avgReaction != null
                    ? `Reação ${(s.avgReaction / 1000).toFixed(2)}s`
                    : null
                  : [
                      s.avgReleaseTime != null && `Soltura ${(s.avgReleaseTime / 1000).toFixed(2)}s`,
                      s.attempts > 0 && `${s.makes}/${s.attempts} cestas`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || `${s.idealReps || 0} perfeitos`
              return (
                <div key={s.id} className={styles.historyItem} style={{ '--drill-color': drill?.color || '#F4541B' }}>
                  <span className={styles.historyEmoji}>{DRILL_EMOJIS[s.drillId] || '🏀'}</span>
                  <div className={styles.historyInfo}>
                    <span className={styles.historyTitle}>
                      {s.totalReps} {s.mode === 'targets' ? 'alvos' : 'arremessos'} · {drill?.shortTitle || s.drillTitle || 'Treino'}
                    </span>
                    <span className={styles.historySub}>
                      {formatDate(s.createdAt?.seconds)}
                      {detail ? ` · ${detail}` : ''}
                    </span>
                  </div>
                  <span
                    className={styles.historyScore}
                    style={{ color: s.consistencyScore >= 80 ? '#34C759' : '#F4541B' }}
                  >
                    {s.consistencyScore}%
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {view === 'session' && (
        <TrainingSession
          drill={activeDrill}
          dominantHand={dominantHand}
          targetReps={targetReps}
          cameraFacing={cameraFacing}
          onFinish={handleSessionFinish}
          onCancel={() => setView('lobby')}
        />
      )}

      {view === 'summary' && result && (
        <TrainingSummary
          drill={activeDrill}
          summary={result.summary}
          shots={result.raw.shots}
          hits={result.raw.hits}
          saving={saving}
          onSave={saveSession}
          onDiscard={() => setView('lobby')}
        />
      )}

      <BottomNav />
    </main>
  )
}
