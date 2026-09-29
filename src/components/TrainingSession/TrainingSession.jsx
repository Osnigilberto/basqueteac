'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X, Check, Timer } from 'lucide-react'
import {
  LANDMARK_INDEXES,
  createShotTracker,
  createTargetGame,
  evaluateElbowAngle,
  evaluateKneeAngle,
  evaluateReleaseTime,
  evaluateLegAngle,
  evaluateReleaseAngle,
  playSuccessBeep,
  playWarningBeep,
  playCountdownBeep,
} from '@/lib/biomechanics'
import { drawSkeleton, drawAngle, drawTarget, drawBurst } from '@/lib/poseOverlay'
import styles from './TrainingSession.module.css'

const READY_HOLD_MS = 800
const SKIP_AFTER_MS = 5000

function formatClock(ms) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function requiredLandmarks(drill, hand) {
  if (drill.mode === 'targets') return [11, 12, 23, 24]
  const i = LANDMARK_INDEXES[hand]
  return [i.shoulder, i.elbow, i.wrist, i.hip, i.knee, i.ankle]
}

/**
 * Sessão de treino ao vivo em tela cheia: câmera + MediaPipe Pose + HUD.
 * Etapas: loading -> positioning (enquadrar o corpo) -> countdown -> active
 */
export default function TrainingSession({ drill, dominantHand, targetReps, cameraFacing, onFinish, onCancel }) {
  const mirrored = cameraFacing === 'user'
  const isTargets = drill.mode === 'targets'

  const [stage, setStage] = useState('loading')
  const [error, setError] = useState(null)
  const [bodyOk, setBodyOk] = useState(false)
  const [canSkip, setCanSkip] = useState(false)
  const [count, setCount] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [live, setLive] = useState({ elbow: null, knee: null, phase: 'IDLE' })
  const [shots, setShots] = useState([])
  const [hits, setHits] = useState([])
  const [misses, setMisses] = useState(0)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const stageRef = useRef('loading')
  const shotsRef = useRef([])
  const hitsRef = useRef([])
  const missesRef = useRef(0)
  const burstsRef = useRef([])
  const startAtRef = useRef(0)
  const readySinceRef = useRef(null)
  const bodyOkRef = useRef(false)
  const lastLiveRef = useRef(0)
  const finishedRef = useRef(false)
  const timeoutsRef = useRef([])
  const trackerRef = useRef(null)
  const gameRef = useRef(null)
  const onFinishRef = useRef(onFinish)

  function goTo(next) {
    stageRef.current = next
    setStage(next)
  }

  function later(fn, ms) {
    timeoutsRef.current.push(setTimeout(fn, ms))
  }

  function startCountdown() {
    if (stageRef.current !== 'positioning') return
    goTo('countdown')
    ;[3, 2, 1, 0].forEach((n, i) => {
      later(() => {
        setCount(n)
        playCountdownBeep(n === 0)
      }, i * 800)
    })
    later(() => {
      trackerRef.current = createShotTracker({ hand: dominantHand })
      gameRef.current = createTargetGame()
      startAtRef.current = performance.now()
      goTo('active')
    }, 3 * 800 + 500)
  }

  function finish() {
    if (finishedRef.current) return
    finishedRef.current = true
    const durationMs = startAtRef.current ? Math.round(performance.now() - startAtRef.current) : 0
    onFinishRef.current({
      shots: shotsRef.current,
      hits: hitsRef.current,
      misses: missesRef.current,
      durationMs,
    })
  }

  function tagLastShot(made) {
    const list = shotsRef.current
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].made == null) {
        const next = [...list]
        next[i] = { ...list[i], made }
        shotsRef.current = next
        setShots(next)
        if (made) playSuccessBeep()
        return
      }
    }
  }

  // Processa cada quadro vindo do MediaPipe
  function handleResults(results) {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || finishedRef.current) return

    const w = video.videoWidth || 640
    const h = video.videoHeight || 480
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, w, h)

    const t = performance.now()
    const aspect = w / h
    const lm = results.poseLandmarks
    const stage = stageRef.current

    if (stage === 'positioning') {
      const ok = !!lm && requiredLandmarks(drill, dominantHand).every((i) => lm[i] && lm[i].visibility > 0.6)
      if (ok !== bodyOkRef.current) {
        bodyOkRef.current = ok
        setBodyOk(ok)
      }
      if (lm) drawSkeleton(ctx, lm, w, h, { color: ok ? '#34C759' : '#F4541B' })
      if (!ok) readySinceRef.current = null
      else if (readySinceRef.current == null) readySinceRef.current = t
      else if (t - readySinceRef.current > READY_HOLD_MS) startCountdown()
      return
    }

    if (!lm) return

    if (stage !== 'active') {
      drawSkeleton(ctx, lm, w, h)
      return
    }

    if (isTargets) {
      drawSkeleton(ctx, lm, w, h, { highlight: [[11, 13], [13, 15], [12, 14], [14, 16]], color: '#3B82F6' })
      const r = gameRef.current.update(lm, t, aspect)
      if (r.target) drawTarget(ctx, r.target, t, w, h)
      if (r.hit) {
        hitsRef.current = [...hitsRef.current, r.hit]
        burstsRef.current.push(r.hit)
        setHits(hitsRef.current)
        playSuccessBeep()
        if (targetReps !== 'free' && hitsRef.current.length >= targetReps) later(finish, 500)
      }
      if (r.miss) {
        missesRef.current += 1
        setMisses(missesRef.current)
        playWarningBeep()
      }
      burstsRef.current = burstsRef.current.filter((b) => drawBurst(ctx, b, t, w, h, mirrored))
      return
    }

    // Arremesso
    const idx = LANDMARK_INDEXES[dominantHand]
    const r = trackerRef.current.update(lm, t, aspect)
    const armColor = r.elbow != null ? evaluateElbowAngle(r.elbow).color : '#F4541B'
    const legColor = r.knee != null ? evaluateKneeAngle(r.knee).color : '#F4541B'

    drawSkeleton(ctx, lm, w, h, {
      highlight: [[idx.shoulder, idx.elbow], [idx.elbow, idx.wrist]],
      color: armColor,
    })
    if (r.elbow != null) {
      drawAngle(ctx, lm[idx.shoulder], lm[idx.elbow], lm[idx.wrist], r.elbow, w, h, armColor, mirrored)
    }
    if (r.knee != null) {
      drawAngle(ctx, lm[idx.hip], lm[idx.knee], lm[idx.ankle], r.knee, w, h, legColor, mirrored)
    }

    if (r.released) {
      shotsRef.current = [...shotsRef.current, r.released]
      setShots(shotsRef.current)
      playSuccessBeep()
      if (targetReps !== 'free' && shotsRef.current.length >= targetReps) later(finish, 700)
    }
    if (r.completed) {
      shotsRef.current = shotsRef.current.map((s) => (s.id === r.completed.id ? { ...s, jump: r.completed.jump } : s))
      setShots(shotsRef.current)
    }

    if (t - lastLiveRef.current > 100 || r.phase !== live.phase) {
      lastLiveRef.current = t
      setLive({ elbow: r.elbow, knee: r.knee, phase: r.phase })
    }
  }

  // O MediaPipe guarda um único callback; ele sempre chama a versão mais recente
  const handleResultsRef = useRef(null)
  useLayoutEffect(() => {
    handleResultsRef.current = handleResults
    onFinishRef.current = onFinish
  })

  // Câmera + MediaPipe
  useEffect(() => {
    let cancelled = false
    let stream = null
    let pose = null
    let raf = 0

    async function start() {
      if (!window.Pose) {
        setError('O modelo de IA ainda está carregando. Tente novamente em instantes.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch (err) {
        if (cancelled) return
        console.error('[TrainingSession] câmera', err)
        setError('Permissão de câmera negada ou dispositivo não suportado.')
        return
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      const video = videoRef.current
      video.srcObject = stream
      await video.play().catch(() => {})

      pose = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      })
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
      pose.onResults((res) => handleResultsRef.current(res))

      let first = true
      const tick = async () => {
        if (cancelled) return
        if (video.readyState >= 2) {
          try {
            await pose.send({ image: video })
            if (first && !cancelled) {
              first = false
              goTo('positioning')
              later(() => setCanSkip(true), SKIP_AFTER_MS)
            }
          } catch (err) {
            console.warn('[TrainingSession] pose.send', err)
          }
        }
        if (!cancelled) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    start()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current = []
      if (stream) stream.getTracks().forEach((t) => t.stop())
      if (pose) Promise.resolve(pose.close()).catch(() => {})
    }
    // A sessão é montada com configurações fixas; só roda uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cronômetro
  useEffect(() => {
    if (stage !== 'active') return
    const id = setInterval(() => setElapsed(performance.now() - startAtRef.current), 250)
    return () => clearInterval(id)
  }, [stage])

  const reps = isTargets ? hits.length : shots.length
  const lastShot = shots[shots.length - 1]
  const tagged = shots.filter((s) => s.made != null)
  const makes = tagged.filter((s) => s.made).length
  const lastHit = hits[hits.length - 1]
  const avgReaction = hits.length ? Math.round(hits.reduce((a, h) => a + h.reaction, 0) / hits.length) : null

  const phaseLabel =
    live.phase === 'SET_POINT' ? 'SET POINT' : live.phase === 'RELEASE' ? 'SOLTURA!' : 'PRONTO'

  return (
    <div className={styles.wrapper}>
      <div className={styles.stage}>
        <video
          ref={videoRef}
          playsInline
          muted
          className={`${styles.media} ${mirrored ? styles.mirrored : ''}`}
        />
        <canvas ref={canvasRef} className={`${styles.media} ${mirrored ? styles.mirrored : ''}`} />
      </div>

      {/* Barra superior */}
      <header className={styles.topBar}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Sair do treino"
          onClick={() => (reps > 0 ? finish() : onCancel())}
        >
          <X size={20} />
        </button>
        <div className={styles.topTitle}>
          <span className={styles.liveDot} />
          {drill.shortTitle}
        </div>
        <div className={styles.clock}>
          <Timer size={14} />
          {formatClock(stage === 'active' ? elapsed : 0)}
        </div>
      </header>

      {/* Placar */}
      {stage === 'active' && (
        <div className={styles.scoreboard}>
          <div className={styles.scoreLabel}>{isTargets ? 'Alvos' : 'Arremessos'}</div>
          <div className={styles.scoreValue}>
            {String(reps).padStart(2, '0')}
            {targetReps !== 'free' && <span className={styles.scoreTotal}>/{targetReps}</span>}
          </div>
          {!isTargets && tagged.length > 0 && (
            <div className={styles.scoreSub}>
              {makes}/{tagged.length} cestas · {Math.round((makes / tagged.length) * 100)}%
            </div>
          )}
          {isTargets && misses > 0 && <div className={styles.scoreSub}>{misses} perdidos</div>}
        </div>
      )}

      {stage === 'active' && !isTargets && (
        <div
          className={styles.phasePill}
          data-phase={live.phase}
        >
          {phaseLabel}
        </div>
      )}

      {/* Flash a cada arremesso */}
      {lastShot && stage === 'active' && (
        <div
          key={lastShot.id}
          className={styles.shotFlash}
          style={{ '--flash-color': evaluateElbowAngle(lastShot.elbowAngle).color }}
        >
          <span>Arremesso</span>
          {lastShot.id}
        </div>
      )}

      {/* Enquadramento */}
      {(stage === 'loading' || stage === 'positioning') && !error && (
        <div className={styles.overlay}>
          <svg className={`${styles.silhouette} ${bodyOk ? styles.silhouetteOk : ''}`} viewBox="0 0 100 220" aria-hidden="true">
            <circle cx="50" cy="22" r="14" />
            <path d="M28 46 h44 l8 70 h-10 l-6-46 v140 h-12 l-2-80 l-2 80 h-12 v-140 l-6 46 h-10 z" />
          </svg>
          <div className={styles.overlayTitle}>
            {stage === 'loading' ? 'Ligando a IA…' : bodyOk ? 'Perfeito, segure!' : 'Entre no quadro'}
          </div>
          <p className={styles.overlayText}>
            {stage === 'loading'
              ? 'Carregando câmera e modelo de pose.'
              : isTargets
              ? 'Fique de frente para a câmera, com tronco e quadril visíveis.'
              : 'Afaste-se até o corpo inteiro aparecer, da cabeça aos pés.'}
          </p>
          {stage === 'positioning' && canSkip && !bodyOk && (
            <button type="button" className={styles.ghostBtn} onClick={startCountdown}>
              Começar mesmo assim
            </button>
          )}
        </div>
      )}

      {stage === 'countdown' && (
        <div className={styles.overlay}>
          <div key={count} className={styles.countdown}>
            {count > 0 ? count : 'VAI!'}
          </div>
        </div>
      )}

      {error && (
        <div className={styles.overlay}>
          <div className={styles.overlayTitle}>Ops!</div>
          <p className={styles.overlayText}>{error}</p>
          <button type="button" className={styles.ghostBtn} onClick={onCancel}>
            Voltar
          </button>
        </div>
      )}

      {/* HUD inferior */}
      {stage === 'active' && (
        <div className={styles.bottom}>
          {isTargets ? (
            <div className={styles.metrics}>
              <Metric label="Última" value={lastHit ? (lastHit.reaction / 1000).toFixed(2) : '--'} unit="s" color="#3B82F6" />
              <Metric label="Reação média" value={avgReaction ? (avgReaction / 1000).toFixed(2) : '--'} unit="s" color="#3B82F6" />
              <Metric
                label="Ritmo"
                value={elapsed > 1000 ? Math.round((hits.length / elapsed) * 60000) : '--'}
                unit="/min"
                color="#3B82F6"
              />
            </div>
          ) : (
            <>
              <div className={styles.metrics}>
                <Metric
                  label="Soltura"
                  value={lastShot?.releaseTime != null ? (lastShot.releaseTime / 1000).toFixed(2) : '--'}
                  unit="s"
                  color={evaluateReleaseTime(lastShot?.releaseTime).color}
                />
                <Metric
                  label="Pernas"
                  value={lastShot?.legAngle ?? '--'}
                  unit="°"
                  color={evaluateLegAngle(lastShot?.legAngle).color}
                />
                <Metric
                  label="Arco"
                  value={lastShot?.releaseAngle ?? '--'}
                  unit="°"
                  color={evaluateReleaseAngle(lastShot?.releaseAngle).color}
                />
                <Metric label="Salto" value={lastShot?.jump ?? '--'} unit="cm" color="#8E8E93" />
              </div>
              <div className={styles.tagRow}>
                <button
                  type="button"
                  className={`${styles.tagBtn} ${styles.tagMiss}`}
                  onClick={() => tagLastShot(false)}
                  disabled={!shots.some((s) => s.made == null)}
                >
                  <X size={18} /> Errou
                </button>
                <button
                  type="button"
                  className={`${styles.tagBtn} ${styles.tagMake}`}
                  onClick={() => tagLastShot(true)}
                  disabled={!shots.some((s) => s.made == null)}
                >
                  <Check size={18} /> Cesta
                </button>
              </div>
            </>
          )}
          <button type="button" className={styles.finishBtn} onClick={finish}>
            Finalizar treino
          </button>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, unit, color }) {
  return (
    <div className={styles.metric} style={{ '--metric-color': color }}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>
        {value}
        {value !== '--' && <small>{unit}</small>}
      </span>
    </div>
  )
}
