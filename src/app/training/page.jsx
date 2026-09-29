'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import {
  Flame,
  Camera,
  X,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Award,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase'
import BottomNav from '@/components/BottomNav/BottomNav'
import {
  calculateAngle,
  evaluateElbowAngle,
  LANDMARK_INDEXES,
  DRILL_TYPES,
  playSuccessBeep,
  playWarningBeep,
} from '@/lib/biomechanics'
import styles from './page.module.css'

export default function TrainingPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  // Configurações do treino
  const [selectedDrill, setSelectedDrill] = useState('three_pointer')
  const [dominantHand, setDominantHand] = useState('right')
  const [targetReps, setTargetReps] = useState(15)
  const [cameraFacing, setCameraFacing] = useState('user')

  const activeDrill = DRILL_TYPES[selectedDrill] || DRILL_TYPES.three_pointer

  function handleSelectDrill(drillId) {
    setSelectedDrill(drillId)
    const d = DRILL_TYPES[drillId]
    if (d) {
      setTargetReps(d.defaultReps)
    }
  }

  // Estado da sessão ao vivo
  const [inSession, setInSession] = useState(false)
  const [scriptsLoaded, setScriptsLoaded] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [repsCount, setRepsCount] = useState(0)
  const [currentAngle, setCurrentAngle] = useState(0)
  const [motionPhase, setMotionPhase] = useState('IDLE') // IDLE | SET_POINT | RELEASE
  const [recordedShots, setRecordedShots] = useState([])
  const [sessionFinished, setSessionFinished] = useState(false)
  const [savingSession, setSavingSession] = useState(false)

  // Histórico
  const [pastSessions, setPastSessions] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const poseRef = useRef(null)
  const cameraHelperRef = useRef(null)
  const lastStateRef = useRef('IDLE')
  const lastAngleRef = useRef(0)
  const cooldownRef = useRef(false)

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [loading, user, router])

  // Carrega histórico de treinos do usuário
  useEffect(() => {
    if (!user) return
    async function loadPastSessions() {
      // 1. Tenta carregar do cache local para resposta imediata
      try {
        const local = localStorage.getItem(`basqueteac_trainings_${user.uid}`)
        if (local) {
          setPastSessions(JSON.parse(local))
        }
      } catch (e) {
        // ignore
      }

      // 2. Busca do Firestore (ordenando em memória para evitar exigência de índice composto)
      try {
        const q = query(
          collection(db, 'training_sessions'),
          where('uid', '==', user.uid)
        )
        const snap = await getDocs(q)
        if (!snap.empty) {
          const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          sessions.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0
            const timeB = b.createdAt?.seconds || 0
            return timeB - timeA
          })
          const topSessions = sessions.slice(0, 10)
          setPastSessions(topSessions)
          try {
            localStorage.setItem(`basqueteac_trainings_${user.uid}`, JSON.stringify(topSessions))
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

  // Processamento de cada quadro do MediaPipe
  const onPoseResults = useCallback((results) => {
    if (!canvasRef.current || !videoRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const video = videoRef.current

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!results.poseLandmarks) {
      return
    }

    const landmarks = results.poseLandmarks
    const idx = LANDMARK_INDEXES[dominantHand]

    const shoulder = landmarks[idx.shoulder]
    const elbow = landmarks[idx.elbow]
    const wrist = landmarks[idx.wrist]

    // Só processa se os pontos principais do braço estiverem visíveis
    if (shoulder && elbow && wrist && elbow.visibility > 0.5 && wrist.visibility > 0.5) {
      const angle = calculateAngle(shoulder, elbow, wrist)
      setCurrentAngle(angle)
      lastAngleRef.current = angle

      const evaluation = evaluateElbowAngle(angle)

      // Coordenadas na tela
      const ex = elbow.x * canvas.width
      const ey = elbow.y * canvas.height
      const sx = shoulder.x * canvas.width
      const sy = shoulder.y * canvas.height
      const wx = wrist.x * canvas.width
      const wy = wrist.y * canvas.height

      // Desenha o braço
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.strokeStyle = evaluation.color

      // Linha Ombro -> Cotovelo
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()

      // Linha Cotovelo -> Pulso
      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(wx, wy)
      ctx.stroke()

      // Círculo no cotovelo com o ângulo
      ctx.fillStyle = evaluation.color
      ctx.beginPath()
      ctx.arc(ex, ey, 10, 0, 2 * Math.PI)
      ctx.fill()

      // Rótulo numérico no cotovelo
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 22px sans-serif'
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 4
      ctx.strokeText(`${angle}°`, ex + 15, ey - 10)
      ctx.fillText(`${angle}°`, ex + 15, ey - 10)

      // Máquina de estados do arremesso
      // 1. Ponto de Preparação (Set Point): Cotovelo em ângulo agudo/médio e pulso perto ou acima da cabeça
      if (angle >= 70 && angle <= 115 && wrist.y < shoulder.y + 0.1) {
        if (lastStateRef.current !== 'SET_POINT' && !cooldownRef.current) {
          lastStateRef.current = 'SET_POINT'
          setMotionPhase('SET_POINT')
        }
      }

      // 2. Extensão / Soltura (Release): Braço estendido (>145°) após ter passado pela preparação
      if (lastStateRef.current === 'SET_POINT' && angle >= 145 && wrist.y < shoulder.y) {
        lastStateRef.current = 'RELEASE'
        setMotionPhase('RELEASE')
        cooldownRef.current = true

        playSuccessBeep()

        const shotData = {
          angle: lastAngleRef.current,
          quality: evaluation.status,
          timestamp: Date.now(),
        }

        setRecordedShots((prev) => {
          const next = [...prev, shotData]
          const newCount = next.length
          setRepsCount(newCount)

          // Verifica se bateu a meta
          if (targetReps !== 'free' && newCount >= targetReps) {
            setTimeout(() => {
              setSessionFinished(true)
            }, 500)
          }

          return next
        })

        // Cooldown de 1.2 segundos para evitar contagens duplicadas no mesmo lance
        setTimeout(() => {
          lastStateRef.current = 'IDLE'
          setMotionPhase('IDLE')
          cooldownRef.current = false
        }, 1200)
      }
    }
  }, [dominantHand, targetReps])

  // Inicia a câmera e o MediaPipe
  async function startSession() {
    setCameraError(null)
    setRepsCount(0)
    setCurrentAngle(0)
    setRecordedShots([])
    setSessionFinished(false)
    lastStateRef.current = 'IDLE'
    cooldownRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
      streamRef.current = stream
      setInSession(true)

      setTimeout(() => {
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        videoRef.current.play()

        if (window.Pose && window.Camera) {
          const pose = new window.Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
          })

          pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          })

          pose.onResults(onPoseResults)
          poseRef.current = pose

          const cameraHelper = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (poseRef.current && videoRef.current) {
                await poseRef.current.send({ image: videoRef.current })
              }
            },
            width: 640,
            height: 480,
          })
          cameraHelper.start()
          cameraHelperRef.current = cameraHelper
        }
      }, 300)
    } catch (err) {
      console.error('[startSession]', err)
      setCameraError('Permissão de câmera negada ou dispositivo não suportado.')
    }
  }

  function stopSession() {
    if (cameraHelperRef.current) {
      try {
        cameraHelperRef.current.stop()
      } catch (e) {
        console.warn(e)
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setInSession(false)
  }

  // Finaliza e salva o treino no Firestore
  async function saveSessionToFirebase() {
    if (!user || recordedShots.length === 0) {
      setSessionFinished(false)
      stopSession()
      return
    }

    setSavingSession(true)
    const idealShots = recordedShots.filter((s) => s.quality === 'ideal').length
    const consistencyScore = Math.round((idealShots / recordedShots.length) * 100)

    const sessionData = {
      id: 'session-' + Date.now(),
      drillId: selectedDrill,
      drillTitle: activeDrill.title,
      drillBadge: activeDrill.badge,
      dominantHand,
      totalReps: recordedShots.length,
      idealReps: idealShots,
      consistencyScore,
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
    }

    // Salva localmente primeiro (funciona mesmo se a permissão do Firestore estiver pendente)
    try {
      const current = JSON.parse(localStorage.getItem(`basqueteac_trainings_${user.uid}`) || '[]')
      const updated = [sessionData, ...current]
      localStorage.setItem(`basqueteac_trainings_${user.uid}`, JSON.stringify(updated.slice(0, 10)))
      setPastSessions(updated.slice(0, 10))
    } catch (e) {}

    // Salva no Firestore
    try {
      await addDoc(collection(db, 'training_sessions'), {
        uid: user.uid,
        drillId: selectedDrill,
        drillTitle: activeDrill.title,
        drillBadge: activeDrill.badge,
        dominantHand,
        totalReps: recordedShots.length,
        idealReps: idealShots,
        consistencyScore,
        createdAt: serverTimestamp(),
      })
    } catch (err) {
      console.warn('[saveSessionToFirebase - Firestore permissions]', err?.message)
    } finally {
      setSavingSession(false)
      setSessionFinished(false)
      stopSession()
    }
  }

  const currentEval = evaluateElbowAngle(currentAngle)
  const idealShotsCount = recordedShots.filter((s) => s.quality === 'ideal').length
  const consistencyScore =
    recordedShots.length > 0 ? Math.round((idealShotsCount / recordedShots.length) * 100) : 0

  return (
    <main className={styles.page}>
      {/* Scripts oficiais do MediaPipe Pose via CDN */}
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
        strategy="lazyOnload"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"
        strategy="lazyOnload"
        onLoad={() => setScriptsLoaded(true)}
      />

      {/* Header padrão */}
      <header className={styles.header}>
        <div className={styles.logo}>
          Basquete<span className={styles.logoAccent}>AC</span>
          <span className={styles.badgeBeta}>LAB IA</span>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>Treino de Arremesso</h1>
          <p className={styles.subtitle}>
            Calibre a biomecânica do seu arremesso em tempo real usando a câmera do celular.
          </p>
        </div>

        {cameraError && (
          <div className={styles.tipsCard} style={{ borderColor: 'var(--color-danger)' }}>
            <div className={styles.tipRow}>
              <AlertTriangle size={16} color="var(--color-danger)" />
              <span style={{ color: 'var(--color-danger)' }}>{cameraError}</span>
            </div>
          </div>
        )}

        {/* Catálogo de Modalidades de Treino */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <Flame size={20} color="var(--color-primary)" />
            Escolha o Treino do Dia
          </div>
          <div className={styles.drillsGrid}>
            {Object.values(DRILL_TYPES).map((drill) => {
              const isSelected = selectedDrill === drill.id
              return (
                <button
                  key={drill.id}
                  type="button"
                  className={`${styles.drillCard} ${isSelected ? styles.drillCardActive : ''}`}
                  onClick={() => handleSelectDrill(drill.id)}
                >
                  <div className={styles.drillCardHeader}>
                    <span className={styles.drillTitle}>{drill.title}</span>
                    <span className={styles.drillBadge} style={{ background: drill.color }}>
                      {drill.badge}
                    </span>
                  </div>
                  <p className={styles.drillDescription}>{drill.description}</p>
                  <div className={styles.drillMeta}>
                    <span>Série padrão: {drill.defaultReps} repetições</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Card de Configuração da Sessão */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: activeDrill.color,
                display: 'inline-block',
              }}
            />
            Configurar: {activeDrill.shortTitle}
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Mão dominante</span>
            <div className={styles.toggleGroup}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${dominantHand === 'right' ? styles.toggleBtnActive : ''}`}
                onClick={() => setDominantHand('right')}
              >
                Destro (Direita)
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${dominantHand === 'left' ? styles.toggleBtnActive : ''}`}
                onClick={() => setDominantHand('left')}
              >
                Canhoto (Esquerda)
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Meta da série</span>
            <div className={styles.toggleGroup}>
              {activeDrill.presetReps.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`${styles.toggleBtn} ${targetReps === r ? styles.toggleBtnActive : ''}`}
                  onClick={() => setTargetReps(r)}
                >
                  {r} repetições
                </button>
              ))}
              <button
                type="button"
                className={`${styles.toggleBtn} ${targetReps === 'free' ? styles.toggleBtnActive : ''}`}
                onClick={() => setTargetReps('free')}
              >
                Livre
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Câmera</span>
            <div className={styles.toggleGroup}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${cameraFacing === 'user' ? styles.toggleBtnActive : ''}`}
                onClick={() => setCameraFacing('user')}
              >
                Frontal (Selfie)
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${cameraFacing === 'environment' ? styles.toggleBtnActive : ''}`}
                onClick={() => setCameraFacing('environment')}
              >
                Traseira
              </button>
            </div>
          </div>

          <button type="button" className={styles.startBtn} onClick={startSession}>
            <Camera size={20} />
            Iniciar Treino de {activeDrill.shortTitle}
          </button>
        </section>

        {/* Card de Dicas de Posição Específicas do Treino */}
        <div className={styles.tipsCard}>
          <div className={styles.tipRow}>
            <Info size={16} color="var(--color-primary)" />
            <span>
              <strong>Orientação do Coach Carter:</strong> {activeDrill.targetTip}
            </span>
          </div>
        </div>

        {/* Histórico Recente */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <TrendingUp size={20} color="var(--color-primary)" />
            Últimos Treinos
          </div>
          {loadingHistory ? (
            <p className={styles.subtitle}>Carregando histórico...</p>
          ) : pastSessions.length === 0 ? (
            <p className={styles.subtitle}>Nenhum treino gravado ainda. Seja o primeiro a calibrar!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pastSessions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    background: 'var(--color-bg)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '14px' }}>{s.totalReps} arremessos</strong>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Mão: {s.dominantHand === 'right' ? 'Destro' : 'Canhoto'} ·{' '}
                      {s.idealReps || 0} arremessos perfeitos
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: '800',
                      color: s.consistencyScore >= 80 ? 'var(--color-success)' : 'var(--color-primary)',
                    }}
                  >
                    {s.consistencyScore}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* TELA DE CÂMERA AO VIVO (HUD) */}
      {inSession && (
        <div className={styles.liveWrapper}>
          <header className={styles.liveHeader}>
            <div className={styles.liveHeaderTitle}>
              <Flame size={18} color="#D94315" />
              <span>TREINO IA AO VIVO</span>
            </div>
            <button
              type="button"
              className={styles.liveCloseBtn}
              onClick={() => {
                if (repsCount > 0) setSessionFinished(true)
                else stopSession()
              }}
            >
              <X size={20} />
            </button>
          </header>

          <div className={styles.videoContainer}>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`${styles.videoElement} ${cameraFacing === 'environment' ? styles.videoElementBack : ''}`}
            />
            <canvas ref={canvasRef} className={styles.canvasOverlay} />
          </div>

          <div className={styles.hudControls}>
            <div className={styles.hudMetrics}>
              <div className={styles.hudCard}>
                <span className={styles.hudLabel}>ARREMESSOS</span>
                <span className={styles.hudValue}>
                  {repsCount} {targetReps !== 'free' ? `/ ${targetReps}` : ''}
                </span>
                <span className={styles.hudStatus} style={{ background: 'rgba(255,255,255,0.2)' }}>
                  {motionPhase === 'SET_POINT'
                    ? '⚡ Subindo...'
                    : motionPhase === 'RELEASE'
                    ? '🎯 Soltura!'
                    : 'Aguardando...'}
                </span>
              </div>

              <div className={styles.hudCard}>
                <span className={styles.hudLabel}>ÂNGULO COTOVELO</span>
                <span className={styles.hudValue}>{currentAngle > 0 ? `${currentAngle}°` : '--'}</span>
                <span
                  className={styles.hudStatus}
                  style={{ background: currentEval.color, color: '#fff' }}
                >
                  {currentAngle > 0 ? currentEval.label : 'Detectando...'}
                </span>
              </div>
            </div>

            <button
              type="button"
              className={styles.finishSessionBtn}
              onClick={() => setSessionFinished(true)}
            >
              Finalizar Treino
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE RESUMO PÓS-TREINO */}
      {sessionFinished && (
        <div className={styles.summaryOverlay}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>
              <Award size={32} />
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Treino Concluído!</h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Excelente esforço em quadra! Veja os seus números da sessão:
            </p>

            <div className={styles.summaryStats}>
              <div className={styles.summaryStatBox}>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-text)' }}>
                  {recordedShots.length}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Arremessos
                </div>
              </div>
              <div className={styles.summaryStatBox}>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: '800',
                    color: consistencyScore >= 80 ? 'var(--color-success)' : 'var(--color-primary)',
                  }}
                >
                  {consistencyScore}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Consistência
                </div>
              </div>
            </div>

            <div className={styles.summaryFeedback}>
              <strong>Coach Carter:</strong>{' '}
              {consistencyScore >= 80
                ? activeDrill.quotes.high
                : consistencyScore >= 55
                ? activeDrill.quotes.mid
                : activeDrill.quotes.low}
            </div>

            <button
              type="button"
              className={styles.summaryDoneBtn}
              onClick={saveSessionToFirebase}
              disabled={savingSession}
            >
              {savingSession ? 'Salvando...' : 'Salvar no Histórico'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  )
}
