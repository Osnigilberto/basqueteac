'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { Flame, History, Trophy, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import BottomNav from '@/components/BottomNav/BottomNav'
import TrainingRunner from '@/components/TrainingRunner/TrainingRunner'
import TrainingSetup from '@/components/TrainingSetup/TrainingSetup'
import { DRILL_TYPES, SHOT_ZONES, unlockAudio, formatShotLine, shotPct } from '@/lib/biomechanics'
import { CHALLENGE_CATEGORIES, TOTAL_STARS, computeProgress } from '@/lib/challenges'
import {
  cachedTrainingSessions,
  cachedTrainingStats,
  loadTrainingSessions,
  sessionZone,
  cachedChallengeBest,
  loadChallengeBest,
} from '@/lib/trainingStore'
import styles from './page.module.css'

const DRILL_EMOJIS = {
  free_shooting: '🏀',
  three_pointer: '🎯',
  mid_range: '⚡',
  layup: '🏃',
  handles: '🔥',
  free_throw: '🎖️',
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
  const [running, setRunning] = useState(false)
  // Zona escolhida no Arremesso Livre (os outros drills têm zona fixa)
  const [freeZone, setFreeZone] = useState('2PT')

  // Histórico e desafios
  const [pastSessions, setPastSessions] = useState([])
  const [stats, setStats] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [challengeBest, setChallengeBest] = useState({})

  const activeDrill = DRILL_TYPES[selectedDrill] || DRILL_TYPES.free_shooting
  const activeZone = activeDrill.mode === 'shooting' ? activeDrill.zone || freeZone : null

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

  // Carrega histórico e recordes: cache local primeiro, depois Firestore
  useEffect(() => {
    if (!user) return
    async function load() {
      setPastSessions(cachedTrainingSessions(user.uid))
      setStats(cachedTrainingStats(user.uid))
      setChallengeBest(cachedChallengeBest(user.uid))
      loadChallengeBest(user.uid).then(setChallengeBest)
      const history = await loadTrainingSessions(user.uid)
      if (history) {
        setPastSessions(history.recent)
        setStats(history.stats)
      }
      setLoadingHistory(false)
    }
    load()
  }, [user])

  function startSession() {
    unlockAudio()
    setRunning(true)
  }

  // Números acumulados de todos os treinos
  const avgScore = stats?.count ? Math.round(stats.scoreSum / stats.count) : null
  const zoneLines = SHOT_ZONES.filter((z) => stats?.zones[z.id]?.attempts > 0).map((z) => ({
    ...z,
    ...stats.zones[z.id],
  }))
  const progress = computeProgress(challengeBest)

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
              <strong>{stats?.count || 0}</strong>
              <span>Treinos</span>
            </div>
            <div>
              <strong>{stats?.reps || 0}</strong>
              <span>Repetições</span>
            </div>
            <div>
              <strong>{avgScore != null ? `${avgScore}%` : '--'}</strong>
              <span>Consistência</span>
            </div>
          </div>

          {/* Linha estilo box score: 3PT 7-10 · 2PT 4-5 · LL 8-10 */}
          <div className={styles.boxScore}>
            {zoneLines.length > 0 ? (
              zoneLines.map((z) => (
                <div key={z.id} className={styles.zoneLine}>
                  <span>{z.id}</span>
                  <strong>{formatShotLine(z.makes, z.attempts)}</strong>
                  <em>{shotPct(z.makes, z.attempts)}%</em>
                </div>
              ))
            ) : (
              <p className={styles.boxScoreHint}>
                Marque suas cestas no fim de cada treino para ver seu aproveitamento: 3PT, 2PT e lance livre.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className={styles.content}>
        {/* ENTRADA DOS DESAFIOS */}
        <Link href="/training/challenges" className={styles.challengesEntry}>
          <span className={styles.entryIcon}>
            <Trophy size={26} />
          </span>
          <span className={styles.entryText}>
            <strong>Desafios</strong>
            <span>
              {CHALLENGE_CATEGORIES.length} fundamentos · metas bronze, prata e ouro
            </span>
          </span>
          <span className={styles.entryStars}>
            ★ {progress.totalStars}
            <small>/{TOTAL_STARS}</small>
          </span>
          <ChevronRight size={20} className={styles.entryChevron} />
        </Link>

        {/* WORKOUTS */}
        <div className={styles.sectionHead}>
          <h2>Treino livre</h2>
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

          <TrainingSetup
            drill={activeDrill}
            cameraFacing={cameraFacing}
            onCameraChange={setCameraFacing}
            dominantHand={dominantHand}
            onHandChange={setDominantHand}
            showHand={activeDrill.mode === 'shooting'}
            targetReps={targetReps}
            onRepsChange={setTargetReps}
            zone={freeZone}
            onZoneChange={activeDrill.mode === 'shooting' && !activeDrill.zone ? setFreeZone : undefined}
            aiReady={aiReady}
            onStart={startSession}
          />
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
                      s.attempts > 0 &&
                        `${sessionZone(s) || 'Cestas'} ${formatShotLine(s.makes, s.attempts)}`,
                      s.avgReleaseTime != null && `Soltura ${(s.avgReleaseTime / 1000).toFixed(2)}s`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || `${s.idealReps || 0} perfeitos`
              return (
                <div key={s.id} className={styles.historyItem} style={{ '--drill-color': drill?.color || '#F4541B' }}>
                  <span className={styles.historyEmoji}>{DRILL_EMOJIS[s.drillId] || '🏀'}</span>
                  <div className={styles.historyInfo}>
                    <span className={styles.historyTitle}>
                      {s.challengeTitle ? `🏆 ${s.challengeTitle} · ` : ''}
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

      {running && (
        <TrainingRunner
          user={user}
          drill={activeDrill}
          dominantHand={dominantHand}
          targetReps={targetReps}
          cameraFacing={cameraFacing}
          zone={activeZone}
          onSaved={({ history }) => {
            if (!history) return
            setPastSessions(history.recent)
            setStats(history.stats)
          }}
          onClose={() => setRunning(false)}
        />
      )}

      <BottomNav />
    </main>
  )
}
