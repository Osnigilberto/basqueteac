'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  updateDoc,
  writeBatch,
  increment,
  serverTimestamp,
} from 'firebase/firestore'
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  Play,
  Square,
  RotateCcw,
  X,
  Target,
  Pencil,
  Share2,
  Check,
  Users,
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import styles from './page.module.css'

const STATUS_LABELS = {
  scheduled: 'Agendado',
  live: 'Em andamento',
  finished: 'Finalizado',
}

const TARGET_PRESETS = [10, 15, 21, 30]

const STAT_FIELDS = [
  { key: 'rebounds', label: 'REB' },
  { key: 'assists', label: 'AST' },
  { key: 'blocks', label: 'BLO' },
  { key: 'steals', label: 'ROU' },
]

function formatGameDate(timestamp) {
  const date = timestamp.toDate()
  const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} · ${timeStr}`
}

function calculateMvp(game, statsList) {
  if (game.status !== 'finished' || statsList.length === 0) return null

  const withTotal = statsList.map((s) => ({
    ...s,
    total: (s.points || 0) + (s.rebounds || 0) + (s.assists || 0) + (s.blocks || 0) + (s.steals || 0),
  }))

  const maxTotal = Math.max(...withTotal.map((s) => s.total))
  if (maxTotal === 0) return null

  return { winners: withTotal.filter((s) => s.total === maxTotal), total: maxTotal }
}

export default function GamePage() {
  const { id: gameId } = useParams()
  const router = useRouter()
  const { user, loading } = useAuth()

  const [game, setGame] = useState(null)
  const [loadingGame, setLoadingGame] = useState(true)
  const [stats, setStats] = useState([])
  const [playersMap, setPlayersMap] = useState({})
  const [copied, setCopied] = useState(false)

  const [selectedUid, setSelectedUid] = useState(null)

  // "Definir times" — só usado em jogos "Time x Time" antes dos times existirem
  const [setupAssignments, setSetupAssignments] = useState({})

  // ===== Timer de posse — local neste dispositivo, não sincronizado =====
  const [timerDuration, setTimerDuration] = useState(24)
  const [customInput, setCustomInput] = useState('')
  const [timeLeft, setTimeLeft] = useState(24)
  const [timerRunning, setTimerRunning] = useState(false)
  const intervalRef = useRef(null)
  const buzzedRef = useRef(false)
  const buzzerAudioRef = useRef(null)
  const whistleAudioRef = useRef(null)

  const [editingTarget, setEditingTarget] = useState(false)
  const [customTargetInput, setCustomTargetInput] = useState('')

  useEffect(() => {
    buzzerAudioRef.current = new Audio('/sounds/buzzer.mp3')
    buzzerAudioRef.current.volume = 0.8

    whistleAudioRef.current = new Audio('/sounds/whistle.mp3')
    whistleAudioRef.current.volume = 0.8
  }, [])

  function playBuzzer() {
    const audio = buzzerAudioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.play().catch((error) => console.error('[playBuzzer]', error))
  }

  function playWhistle() {
    const audio = whistleAudioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.play().catch((error) => console.error('[playWhistle]', error))
  }

  useEffect(() => {
    if (!gameId) return
    const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() })
      setLoadingGame(false)
    })
    return unsub
  }, [gameId])

  useEffect(() => {
    if (!gameId) return
    const unsub = onSnapshot(collection(db, 'games', gameId, 'stats'), (snap) => {
      setStats(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
    })
    return unsub
  }, [gameId])

  const rosterKey = game
    ? Array.from(new Set([...(game.roster || []), ...game.teamA.players, ...game.teamB.players]))
        .sort()
        .join(',')
    : ''

  useEffect(() => {
    if (!rosterKey) return

    async function loadPlayers() {
      const uids = rosterKey.split(',')
      const entries = await Promise.all(
        uids.map(async (uid) => {
          const snap = await getDoc(doc(db, 'users', uid))
          return [uid, snap.exists() ? snap.data() : {}]
        })
      )
      setPlayersMap(Object.fromEntries(entries))
    }

    loadPlayers()
  }, [rosterKey])

  useEffect(() => {
    if (!timerRunning) return

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          setTimerRunning(false)
          if (!buzzedRef.current) {
            playBuzzer()
            buzzedRef.current = true
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [timerRunning])

  function startTimer() {
    if (timeLeft === 0) setTimeLeft(timerDuration)
    buzzedRef.current = false
    setTimerRunning(true)
    playWhistle()
  }

  function pauseTimer() {
    setTimerRunning(false)
    playWhistle()
  }

  function resetTimer(duration = timerDuration) {
    setTimerRunning(false)
    buzzedRef.current = false
    setTimeLeft(duration)
  }

  function changeDuration(duration) {
    setTimerDuration(duration)
    resetTimer(duration)
  }

  function commitCustomDuration() {
    const value = parseInt(customInput, 10)
    if (value > 0 && value <= 60) {
      changeDuration(value)
    }
    setCustomInput('')
  }

  // Marca pontos: atualiza o placar do time E o total do jogador juntos.
  // Se for cesta de 3, conta separadamente também (usado pras medalhas)
  async function addPoints(uid, team, value) {
    const batch = writeBatch(db)
    batch.update(doc(db, 'games', gameId), {
      [`team${team}.score`]: increment(value),
      updatedAt: serverTimestamp(),
    })

    const statsUpdate = { points: increment(value) }
    if (value === 3) {
      statsUpdate.threePointers = increment(1)
    }

    batch.update(doc(db, 'games', gameId, 'stats', uid), statsUpdate)
    await batch.commit()
  }

  // Desfaz especificamente uma cesta de 3 — diferente do "−1" genérico,
  // esse aqui corrige o placar E o contador de cestas de 3 juntos
  async function undoThreePointer(uid, team) {
    const batch = writeBatch(db)
    batch.update(doc(db, 'games', gameId), {
      [`team${team}.score`]: increment(-3),
      updatedAt: serverTimestamp(),
    })
    batch.update(doc(db, 'games', gameId, 'stats', uid), {
      points: increment(-3),
      threePointers: increment(-1),
    })
    await batch.commit()
  }

  async function addStat(uid, field, value) {
    await updateDoc(doc(db, 'games', gameId, 'stats', uid), {
      [field]: increment(value),
    })
  }

  async function startGame() {
    await updateDoc(doc(db, 'games', gameId), { status: 'live', updatedAt: serverTimestamp() })
  }

  async function finishGame() {
    setSelectedUid(null)
    await updateDoc(doc(db, 'games', gameId), { status: 'finished', updatedAt: serverTimestamp() })
  }

  async function updateTargetScore(value) {
    await updateDoc(doc(db, 'games', gameId), { targetScore: value, updatedAt: serverTimestamp() })
    setEditingTarget(false)
    setCustomTargetInput('')
  }

  function setSetupTeam(uid, team) {
    setSetupAssignments((prev) => {
      if (prev[uid] === team) {
        const next = { ...prev }
        delete next[uid]
        return next
      }
      return { ...prev, [uid]: team }
    })
  }

  async function confirmTeams() {
    const teamAPlayers = Object.entries(setupAssignments).filter(([, t]) => t === 'A').map(([uid]) => uid)
    const teamBPlayers = Object.entries(setupAssignments).filter(([, t]) => t === 'B').map(([uid]) => uid)

    const batch = writeBatch(db)
    batch.update(doc(db, 'games', gameId), {
      'teamA.players': teamAPlayers,
      'teamB.players': teamBPlayers,
      updatedAt: serverTimestamp(),
    })

    teamAPlayers.forEach((uid) => {
      batch.set(doc(db, 'games', gameId, 'stats', uid), {
        uid,
        team: 'A',
        points: 0,
        rebounds: 0,
        assists: 0,
        blocks: 0,
        steals: 0,
        threePointers: 0,
      })
    })

    teamBPlayers.forEach((uid) => {
      batch.set(doc(db, 'games', gameId, 'stats', uid), {
        uid,
        team: 'B',
        points: 0,
        rebounds: 0,
        assists: 0,
        blocks: 0,
        steals: 0,
        threePointers: 0,
      })
    })

    await batch.commit()
  }

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: 'BasqueteAC', text: 'Confere o jogo:', url })
      } catch {
        // Pessoa cancelou o compartilhamento — não é erro de verdade
      }
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function getTeamRows(team) {
    return stats
      .filter((s) => s.team === team)
      .map((s) => ({ ...s, player: playersMap[s.uid] || {} }))
      .sort((a, b) => b.points - a.points)
  }

  if (loading || loadingGame) return null

  if (!game) {
    return (
      <main className={styles.page}>
        <p className={styles.emptyState}>Jogo não encontrado.</p>
      </main>
    )
  }

  const isLive = game.status === 'live'
  const isScheduled = game.status === 'scheduled'
  const selectedStat = stats.find((s) => s.uid === selectedUid)
  const selectedPlayer = selectedUid ? playersMap[selectedUid] : null

  const targetScore = game.targetScore ?? null
  const targetReachedTeam = targetScore
    ? game.teamA.score >= targetScore
      ? game.teamA.name
      : game.teamB.score >= targetScore
      ? game.teamB.name
      : null
    : null

  const mvp = calculateMvp(game, stats)

  const needsTeamSetup =
    game.gameType === 'teams' && game.teamA.players.length === 0 && game.teamB.players.length === 0

  const rosterMembers = (game.roster || []).map((uid) => ({ uid, player: playersMap[uid] || {} }))
  const setupTeamACount = Object.values(setupAssignments).filter((t) => t === 'A').length
  const setupTeamBCount = Object.values(setupAssignments).filter((t) => t === 'B').length
  const canConfirmTeams = setupTeamACount > 0 && setupTeamBCount > 0

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          className={styles.backButton}
          onClick={() => (user ? router.back() : router.push('/'))}
        >
          <ArrowLeft size={18} />
        </button>
        <span className={`${styles.statusBadge} ${styles[`status${game.status}`]}`}>
          {STATUS_LABELS[game.status]}
        </span>
        <button className={styles.shareButton} onClick={handleShare} aria-label="Compartilhar jogo">
          {copied ? <Check size={18} /> : <Share2 size={18} />}
        </button>
      </header>

      <section className={styles.scoreBanner}>
        <div className={styles.scoreTeam}>
          <span className={styles.scoreTeamName}>{game.teamA.name}</span>
          <span className={styles.scoreValue}>{game.teamA.score}</span>
        </div>
        <span className={styles.scoreDivider}>-</span>
        <div className={styles.scoreTeam}>
          <span className={styles.scoreTeamName}>{game.teamB.name}</span>
          <span className={styles.scoreValuePreto}>{game.teamB.score}</span>
        </div>
      </section>

      {targetReachedTeam && (
        <p className={styles.targetReached}>
          🏆 {targetReachedTeam} atingiu {targetScore} pontos!
        </p>
      )}

      {mvp && (
        <p className={styles.mvpBanner}>
          🏅 MVP da partida:{' '}
          {mvp.winners
            .map((w) => playersMap[w.uid]?.nickname || playersMap[w.uid]?.name || 'Jogador')
            .join(' e ')}{' '}
          ({mvp.total} na soma geral)
        </p>
      )}

      <p className={styles.gameInfo}>
        <CalendarDays size={14} /> {formatGameDate(game.date)}
      </p>
      <p className={styles.gameInfo}>
        <MapPin size={14} /> {game.location}
      </p>

      <div className={styles.targetRow}>
        {!user ? (
          <span className={styles.targetDisplay}>
            <Target size={14} />
            {targetScore ? `Alvo: ${targetScore} pontos` : 'Sem limite de pontos'}
          </span>
        ) : !editingTarget ? (
          <button className={styles.targetDisplay} onClick={() => setEditingTarget(true)}>
            <Target size={14} />
            {targetScore ? `Alvo: ${targetScore} pontos` : 'Sem limite de pontos'}
            <Pencil size={12} />
          </button>
        ) : (
          <div className={styles.targetEditor}>
            {TARGET_PRESETS.map((value) => (
              <button key={value} className={styles.targetButton} onClick={() => updateTargetScore(value)}>
                {value}
              </button>
            ))}
            <button className={styles.targetButton} onClick={() => updateTargetScore(null)}>
              Livre
            </button>
            <input
              type="number"
              min={1}
              className={styles.targetInput}
              placeholder="Outro"
              value={customTargetInput}
              onChange={(e) => setCustomTargetInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const value = parseInt(customTargetInput, 10)
                  if (value > 0) updateTargetScore(value)
                }
              }}
            />
            <button
              type="button"
              className={styles.targetCancel}
              onClick={() => {
                setEditingTarget(false)
                setCustomTargetInput('')
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {isScheduled && user && needsTeamSetup && (
        <section className={styles.setupCard}>
          <div className={styles.setupHeader}>
            <Users size={14} />
            DEFINIR TIMES
          </div>
          <p className={styles.setupHint}>
            Branco {setupTeamACount} · Preto {setupTeamBCount}
          </p>

          <div className={styles.setupList}>
            {rosterMembers.map(({ uid, player }) => (
              <div key={uid} className={styles.setupRow}>
                <div className={styles.playerInfo}>
                  {player.photoURL && (
                    <Image
                      src={player.photoURL}
                      alt={player.name || ''}
                      width={32}
                      height={32}
                      className={styles.playerAvatar}
                    />
                  )}
                  <span className={styles.playerName}>
                    {player.nickname || player.name || 'Jogador'}
                  </span>
                </div>

                <div className={styles.setupToggle}>
                  <button
                    type="button"
                    className={`${styles.setupTeamButton} ${
                      setupAssignments[uid] === 'A' ? styles.setupTeamButtonActiveA : ''
                    }`}
                    onClick={() => setSetupTeam(uid, 'A')}
                  >
                    Branco
                  </button>
                  <button
                    type="button"
                    className={`${styles.setupTeamButton} ${
                      setupAssignments[uid] === 'B' ? styles.setupTeamButtonActiveB : ''
                    }`}
                    onClick={() => setSetupTeam(uid, 'B')}
                  >
                    Preto
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button className={styles.confirmTeamsButton} disabled={!canConfirmTeams} onClick={confirmTeams}>
            Confirmar times
          </button>
        </section>
      )}

      {isScheduled && user && !needsTeamSetup && (
        <button className={styles.startButton} onClick={startGame}>
          <Play size={16} />
          Iniciar jogo
        </button>
      )}

      {isLive && user && (
        <>
          <div className={styles.timerCard}>
            <div className={styles.timerDurations}>
              {[14, 24, 30].map((d) => (
                <button
                  key={d}
                  className={`${styles.durationButton} ${timerDuration === d ? styles.durationButtonActive : ''}`}
                  onClick={() => changeDuration(d)}
                >
                  {d}s
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={60}
                className={styles.durationInput}
                placeholder="Outro"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onBlur={commitCustomDuration}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitCustomDuration()
                  }
                }}
              />
            </div>

            <span className={`${styles.timerValue} ${timeLeft <= 5 ? styles.timerValueDanger : ''}`}>
              {timeLeft}
            </span>

            <p className={styles.timerStatus}>
              {timerRunning
                ? 'Contando...'
                : timeLeft === 0
                ? 'Zerou'
                : timeLeft === timerDuration
                ? 'Pronto'
                : 'Pausado — bola fora ou falta'}
            </p>

            <div className={styles.timerControls}>
              {!timerRunning ? (
                <button className={styles.timerButtonLabeled} onClick={startTimer}>
                  <Play size={20} />
                  <span>{timeLeft === timerDuration || timeLeft === 0 ? 'Iniciar' : 'Continuar'}</span>
                </button>
              ) : (
                <button className={styles.timerButtonLabeled} onClick={pauseTimer}>
                  <Square size={20} />
                  <span>Pausar</span>
                </button>
              )}
              <button className={styles.timerButtonLabeled} onClick={() => resetTimer()}>
                <RotateCcw size={20} />
                <span>Reiniciar</span>
              </button>
            </div>
          </div>

          <button className={styles.finishButton} onClick={finishGame}>
            Encerrar jogo
          </button>
        </>
      )}

      <TeamSection
        title={game.teamA.name}
        rows={getTeamRows('A')}
        editable={isLive && !!user}
        onSelect={setSelectedUid}
        styles={styles}
      />

      <TeamSection
        title={game.teamB.name}
        rows={getTeamRows('B')}
        editable={isLive && !!user}
        onSelect={setSelectedUid}
        accent
        styles={styles}
      />

      {selectedStat && (
        <div className={styles.drawerOverlay} onClick={() => setSelectedUid(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <span className={styles.drawerName}>
                {selectedPlayer?.nickname || selectedPlayer?.name || 'Jogador'}
              </span>
              <button className={styles.drawerClose} onClick={() => setSelectedUid(null)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.drawerRow}>
              <span className={styles.drawerLabel}>
                PTS — {selectedStat.points} ({selectedStat.threePointers || 0} de 3)
              </span>
              <div className={styles.drawerButtons}>
                <button
                  className={styles.minusButton}
                  disabled={selectedStat.points === 0}
                  onClick={() => addPoints(selectedUid, selectedStat.team, -1)}
                >
                  −1
                </button>
                <button
                  className={styles.minusButton}
                  disabled={!selectedStat.threePointers}
                  onClick={() => undoThreePointer(selectedUid, selectedStat.team)}
                  title="Desfaz uma cesta de 3"
                >
                  −3
                </button>
                <button className={styles.plusButton} onClick={() => addPoints(selectedUid, selectedStat.team, 1)}>
                  +1
                </button>
                <button className={styles.plusButton} onClick={() => addPoints(selectedUid, selectedStat.team, 2)}>
                  +2
                </button>
                <button className={styles.plusButton} onClick={() => addPoints(selectedUid, selectedStat.team, 3)}>
                  +3
                </button>
              </div>
            </div>

            {STAT_FIELDS.map((field) => (
              <div className={styles.drawerRow} key={field.key}>
                <span className={styles.drawerLabel}>
                  {field.label} — {selectedStat[field.key]}
                </span>
                <div className={styles.drawerButtons}>
                  <button
                    className={styles.minusButton}
                    disabled={selectedStat[field.key] === 0}
                    onClick={() => addStat(selectedUid, field.key, -1)}
                  >
                    −1
                  </button>
                  <button className={styles.plusButton} onClick={() => addStat(selectedUid, field.key, 1)}>
                    +1
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

function TeamSection({ title, rows, editable, onSelect, accent, styles }) {
  return (
    <section className={styles.teamSection}>
      <h2 className={`${styles.teamTitle} ${accent ? styles.teamTitleAccent : ''}`}>{title}</h2>

      <div className={styles.statsHeader}>
        <span className={styles.statsHeaderName}>Jogador</span>
        <span>PTS</span>
        <span>REB</span>
        <span>AST</span>
        <span>BLO</span>
        <span>ROU</span>
      </div>

      {rows.length === 0 ? (
        <p className={styles.emptyState}>Nenhum jogador.</p>
      ) : (
        rows.map((row) => (
          <button
            key={row.uid}
            className={styles.playerRow}
            onClick={() => editable && onSelect(row.uid)}
            disabled={!editable}
          >
            <span className={styles.playerInfo}>
              {row.player.photoURL && (
                <Image
                  src={row.player.photoURL}
                  alt={row.player.name || ''}
                  width={28}
                  height={28}
                  className={styles.playerAvatar}
                />
              )}
              <span className={styles.playerName}>
                {row.player.nickname || row.player.name || 'Jogador'}
              </span>
            </span>
            <span className={styles.statValuePrimary}>{row.points}</span>
            <span>{row.rebounds}</span>
            <span>{row.assists}</span>
            <span>{row.blocks}</span>
            <span>{row.steals}</span>
          </button>
        ))
      )}
    </section>
  )
}