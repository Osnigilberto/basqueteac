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
  Undo2,
  SlidersHorizontal,
  ChevronDown,
  Pause,
  Dices,
  Flag,
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { formatGameDate, displayName } from '@/lib/format'
import { gameMvp, invalidateGroupData, fetchGroupData, playerGameLog, computeAverages } from '@/lib/gameStats'
import { inverseAction, describeAction, pushAction, drawTeams } from '@/lib/gameActions'
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

  // Pilha de ações marcadas NESTE aparelho, para "Desfazer última ação"
  const [undoStack, setUndoStack] = useState([])
  const [undoing, setUndoing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [showDurations, setShowDurations] = useState(false)
  const [balanceByPpg, setBalanceByPpg] = useState(true)
  const [drawing, setDrawing] = useState(false)

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

  const [editingTeams, setEditingTeams] = useState(false)
  const [teamANameInput, setTeamANameInput] = useState('')
  const [teamBNameInput, setTeamBNameInput] = useState('')

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
  async function addPoints(uid, team, value, { record = true } = {}) {
    if (record) setUndoStack((prev) => pushAction(prev, { kind: 'points', uid, team, value }))
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
  async function undoThreePointer(uid, team, { record = true } = {}) {
    if (record) setUndoStack((prev) => pushAction(prev, { kind: 'undoThree', uid, team }))
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

  async function addStat(uid, field, value, { record = true } = {}) {
    if (record) setUndoStack((prev) => pushAction(prev, { kind: 'stat', uid, field, value }))
    await updateDoc(doc(db, 'games', gameId, 'stats', uid), {
      [field]: increment(value),
    })
  }

  // Aplica o inverso da última ação marcada neste aparelho
  async function undoLastAction() {
    const last = undoStack[undoStack.length - 1]
    if (!last || undoing) return
    setUndoing(true)
    setUndoStack((prev) => prev.slice(0, -1))
    const inv = inverseAction(last)
    try {
      if (inv.kind === 'points') await addPoints(inv.uid, inv.team, inv.value, { record: false })
      else if (inv.kind === 'undoThree') await undoThreePointer(inv.uid, inv.team, { record: false })
      else await addStat(inv.uid, inv.field, inv.value, { record: false })
    } catch (error) {
      console.error('[undoLastAction]', error)
    } finally {
      setUndoing(false)
    }
  }

  async function startGame() {
    await updateDoc(doc(db, 'games', gameId), { status: 'live', updatedAt: serverTimestamp() })
  }

  async function finishGame() {
    setConfirmFinish(false)
    setSelectedUid(null)
    setUndoStack([])
    await updateDoc(doc(db, 'games', gameId), { status: 'finished', updatedAt: serverTimestamp() })
    // Rankings/Stats/Perfil passam a considerar este jogo
    invalidateGroupData()
  }

  async function updateTargetScore(value) {
    await updateDoc(doc(db, 'games', gameId), { targetScore: value, updatedAt: serverTimestamp() })
    setEditingTarget(false)
    setCustomTargetInput('')
  }

  async function handleSaveTeams(e) {
    if (e) e.preventDefault()
    const a = teamANameInput.trim() || game?.teamA?.name || 'Time A'
    const b = teamBNameInput.trim() || game?.teamB?.name || 'Time B'
    try {
      await updateDoc(doc(db, 'games', gameId), {
        'teamA.name': a,
        'teamB.name': b,
        updatedAt: serverTimestamp(),
      })
      setEditingTeams(false)
    } catch (err) {
      console.error('[handleSaveTeams]', err)
    }
  }

  // Toque no jogador: sem time → A → B → sem time
  function cycleSetup(uid) {
    setSetupAssignments((prev) => {
      const next = { ...prev }
      if (!prev[uid]) next[uid] = 'A'
      else if (prev[uid] === 'A') next[uid] = 'B'
      else delete next[uid]
      return next
    })
  }

  // Sorteia os times; com "equilibrar", usa o PPG da temporada (snake draft)
  async function drawSetupTeams() {
    setDrawing(true)
    const roster = game.roster || []
    const ratings = {}
    if (balanceByPpg) {
      try {
        const { games } = await fetchGroupData()
        const year = new Date().getFullYear()
        const season = games.filter((g) => g.date.toDate().getFullYear() === year)
        roster.forEach((uid) => {
          ratings[uid] = computeAverages(playerGameLog(season, uid))?.points || 0
        })
      } catch (error) {
        console.error('[drawSetupTeams → PPG]', error)
      }
    }
    const { A, B } = drawTeams(roster, ratings)
    setSetupAssignments(Object.fromEntries([...A.map((u) => [u, 'A']), ...B.map((u) => [u, 'B'])]))
    setDrawing(false)
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

  const isFinished = game.status === 'finished'
  const mvp = isFinished ? gameMvp(stats.map((s) => ({ ...s, points: s.points || 0 }))) : null
  const winnerTeam = isFinished
    ? game.teamA.score > game.teamB.score
      ? 'A'
      : game.teamB.score > game.teamA.score
      ? 'B'
      : null
    : null
  const lastAction = undoStack[undoStack.length - 1]
  const nameOf = (uid) => displayName(playersMap[uid])

  const needsTeamSetup =
    game.gameType === 'teams' && game.teamA.players.length === 0 && game.teamB.players.length === 0

  const rosterMembers = (game.roster || []).map((uid) => ({ uid, player: playersMap[uid] || {} }))
  const setupTeamACount = Object.values(setupAssignments).filter((t) => t === 'A').length
  const setupTeamBCount = Object.values(setupAssignments).filter((t) => t === 'B').length
  const canConfirmTeams = setupTeamACount > 0 && setupTeamBCount > 0

  const unassigned = rosterMembers.filter(({ uid }) => !setupAssignments[uid])
  const assignedTo = (team) => rosterMembers.filter(({ uid }) => setupAssignments[uid] === team)
  const progress = (score) => (targetScore ? Math.min(100, Math.round((score / targetScore) * 100)) : 0)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          className={styles.backButton}
          onClick={() => (user ? router.back() : router.push('/'))}
          aria-label="Voltar"
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

      {/* PLACAR (fixo no topo durante o jogo) */}
      <section className={`${styles.scoreBanner} ${isLive ? styles.scoreBannerSticky : ''}`}>
        <div className={styles.scoreInner}>
          {['A', 'B'].map((team, i) => {
            const t = team === 'A' ? game.teamA : game.teamB
            return (
              <div key={team} className={styles.scoreSide}>
                {i === 1 && <span className={styles.scoreDivider}>×</span>}
                <div
                  className={`${styles.scoreTeam} ${winnerTeam && winnerTeam !== team ? styles.scoreTeamLoser : ''}`}
                >
                  <span className={styles.scoreTeamName}>
                    {winnerTeam === team && '🏆 '}
                    {t.name}
                  </span>
                  <span className={team === 'A' ? styles.scoreValue : styles.scoreValuePreto}>{t.score}</span>
                  {targetScore && !isFinished && (
                    <span className={styles.progressTrack} aria-label={`${t.score} de ${targetScore}`}>
                      <span
                        className={`${styles.progressBar} ${team === 'B' ? styles.progressBarB : ''}`}
                        style={{ width: `${progress(t.score)}%` }}
                      />
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {targetScore && !isFinished && <span className={styles.targetMini}>Alvo: {targetScore} pontos</span>}
      </section>

      <div className={styles.inner}>
        {isLive && user && lastAction && (
          <div className={styles.undoBar}>
            <button type="button" className={styles.undoButton} onClick={undoLastAction} disabled={undoing}>
              <Undo2 size={16} />
              Desfazer: {describeAction(lastAction)} {nameOf(lastAction.uid)}
            </button>
          </div>
        )}

        {/* Alvo atingido: oferece encerrar */}
        {targetReachedTeam && isLive && (
          <div className={styles.targetReachedCard}>
            <span>
              🏆 <b>{targetReachedTeam}</b> atingiu {targetScore} pontos!
            </span>
            {user && (
              <button type="button" className={styles.targetFinishButton} onClick={() => setConfirmFinish(true)}>
                <Flag size={14} /> Encerrar jogo
              </button>
            )}
          </div>
        )}

        {mvp && (
          <p className={styles.mvpBanner}>
            🏅 MVP da partida: {mvp.uids.map(nameOf).join(' e ')} ({mvp.total} na soma geral)
          </p>
        )}

        <div className={styles.infoRow}>
          <span className={styles.gameInfo}>
            <CalendarDays size={14} /> {formatGameDate(game.date)}
          </span>
          <span className={styles.gameInfo}>
            <MapPin size={14} /> {game.location}
          </span>
          {!targetScore && (
            <span className={styles.gameInfo}>
              <Target size={14} /> Sem limite de pontos
            </span>
          )}
        </div>

        {/* AJUSTES (nomes e alvo) */}
        {user && (
          <section className={styles.settingsCard}>
            <button
              type="button"
              className={styles.settingsToggle}
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
            >
              <SlidersHorizontal size={14} />
              Ajustes do jogo
              <ChevronDown
                size={16}
                className={`${styles.settingsChevron} ${showSettings ? styles.settingsChevronOpen : ''}`}
              />
            </button>
            {showSettings && (
              <div className={styles.settingsBody}>
                <div className={styles.editTeamsContainer}>
                  {!editingTeams ? (
                    <button
                      type="button"
                      className={styles.editTeamsBtn}
                      onClick={() => {
                        setTeamANameInput(game.teamA.name || 'Time Branco')
                        setTeamBNameInput(game.teamB.name || 'Time Preto')
                        setEditingTeams(true)
                      }}
                    >
                      <Pencil size={12} />
                      Editar nomes das equipes
                    </button>
                  ) : (
                    <form className={styles.editTeamsForm} onSubmit={handleSaveTeams}>
                      <input
                        type="text"
                        className={styles.editTeamField}
                        value={teamANameInput}
                        onChange={(e) => setTeamANameInput(e.target.value)}
                        placeholder="Equipe 1"
                        required
                      />
                      <span className={styles.editTeamsDivider}>x</span>
                      <input
                        type="text"
                        className={styles.editTeamField}
                        value={teamBNameInput}
                        onChange={(e) => setTeamBNameInput(e.target.value)}
                        placeholder="Equipe 2"
                        required
                      />
                      <button type="submit" className={styles.editTeamsSaveBtn} title="Salvar">
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.editTeamsCancelBtn}
                        onClick={() => setEditingTeams(false)}
                        title="Cancelar"
                      >
                        <X size={14} />
                      </button>
                    </form>
                  )}
                </div>

                <div className={styles.targetRow}>
                  {!editingTarget ? (
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
              </div>
            )}
          </section>
        )}

        {/* MONTAR OS TIMES */}
        {isScheduled && user && needsTeamSetup && (
          <section className={styles.setupCard}>
            <div className={styles.setupHeader}>
              <Users size={14} />
              MONTAR OS TIMES
              <span className={styles.setupCount}>{rosterMembers.length} confirmados</span>
            </div>

            <div className={styles.drawRow}>
              <button type="button" className={styles.drawButton} onClick={drawSetupTeams} disabled={drawing}>
                <Dices size={16} /> {drawing ? 'Sorteando...' : 'Sortear times'}
              </button>
              <label className={styles.balanceToggle}>
                <input type="checkbox" checked={balanceByPpg} onChange={(e) => setBalanceByPpg(e.target.checked)} />
                Equilibrar pelo PPG
              </label>
            </div>

            <div className={styles.setupColumns}>
              {['A', 'B'].map((team) => (
                <div key={team} className={`${styles.setupColumn} ${team === 'B' ? styles.setupColumnB : ''}`}>
                  <span className={styles.setupColumnTitle}>
                    {team === 'A' ? game.teamA.name : game.teamB.name} · {assignedTo(team).length}
                  </span>
                  {assignedTo(team).map(({ uid, player }) => (
                    <SetupChip key={uid} player={player} team={team} onClick={() => cycleSetup(uid)} styles={styles} />
                  ))}
                  {assignedTo(team).length === 0 && <span className={styles.setupEmpty}>Ninguém ainda</span>}
                </div>
              ))}
            </div>

            {unassigned.length > 0 && (
              <>
                <span className={styles.setupColumnTitle}>Sem time · {unassigned.length}</span>
                <div className={styles.unassignedList}>
                  {unassigned.map(({ uid, player }) => (
                    <SetupChip key={uid} player={player} onClick={() => cycleSetup(uid)} styles={styles} />
                  ))}
                </div>
              </>
            )}

            <p className={styles.setupHint}>Toque num jogador para trocar: sem time → {game.teamA.name} → {game.teamB.name}.</p>

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

        {/* CRONÔMETRO DE POSSE (compacto) */}
        {isLive && user && (
          <div className={styles.timerCard}>
            <div className={styles.timerMain}>
              <span className={`${styles.timerValue} ${timeLeft <= 5 ? styles.timerValueDanger : ''}`}>{timeLeft}</span>
              <div className={styles.timerInfo}>
                <span className={styles.timerStatus}>
                  {timerRunning
                    ? 'Contando...'
                    : timeLeft === 0
                    ? 'Zerou'
                    : timeLeft === timerDuration
                    ? 'Pronto'
                    : 'Pausado'}
                </span>
                <button type="button" className={styles.durationToggle} onClick={() => setShowDurations((v) => !v)}>
                  Posse de {timerDuration}s <ChevronDown size={12} />
                </button>
              </div>
              <div className={styles.timerControls}>
                {!timerRunning ? (
                  <button
                    className={`${styles.timerIconButton} ${styles.timerPrimary}`}
                    onClick={startTimer}
                    aria-label={timeLeft === timerDuration || timeLeft === 0 ? 'Iniciar' : 'Continuar'}
                  >
                    <Play size={20} />
                  </button>
                ) : (
                  <button className={`${styles.timerIconButton} ${styles.timerPrimary}`} onClick={pauseTimer} aria-label="Pausar">
                    <Pause size={20} />
                  </button>
                )}
                <button className={styles.timerIconButton} onClick={() => resetTimer()} aria-label="Reiniciar">
                  <RotateCcw size={18} />
                </button>
              </div>
            </div>

            {showDurations && (
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
            )}
          </div>
        )}

        {/* TABELAS (escondidas enquanto os times não foram montados) */}
        {!needsTeamSetup && (
          <>
            {isLive && user && <p className={styles.tapHint}>Toque num jogador para marcar pontos e estatísticas.</p>}
            <TeamSection
              title={game.teamA.name}
              rows={getTeamRows('A')}
              editable={isLive && !!user}
              onSelect={setSelectedUid}
              mvpUids={mvp?.uids || []}
              styles={styles}
            />
            <TeamSection
              title={game.teamB.name}
              rows={getTeamRows('B')}
              editable={isLive && !!user}
              onSelect={setSelectedUid}
              mvpUids={mvp?.uids || []}
              accent
              styles={styles}
            />
          </>
        )}

        {isLive && user && (
          <button className={styles.finishButton} onClick={() => setConfirmFinish(true)}>
            <Flag size={16} /> Encerrar jogo
          </button>
        )}
      </div>

      {/* PAINEL DO JOGADOR */}
      {selectedStat && (
        <div className={styles.drawerOverlay} onClick={() => setSelectedUid(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <span className={styles.drawerName}>
                {displayName(selectedPlayer)}
                <small>
                  {selectedStat.points} pts · {selectedStat.threePointers || 0} de 3
                </small>
              </span>
              <button className={styles.drawerClose} onClick={() => setSelectedUid(null)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            {/* Troca de jogador sem fechar o painel */}
            <div className={styles.playerChips}>
              {['A', 'B'].map((team) =>
                getTeamRows(team).map((row) => (
                  <button
                    key={row.uid}
                    type="button"
                    className={`${styles.playerChip} ${team === 'B' ? styles.playerChipB : ''} ${
                      row.uid === selectedUid ? styles.playerChipActive : ''
                    }`}
                    onClick={() => setSelectedUid(row.uid)}
                  >
                    {displayName(row.player)} <small>{row.points}</small>
                  </button>
                ))
              )}
            </div>

            {/* Pontos: botões grandes */}
            <div className={styles.pointButtons}>
              {[1, 2, 3].map((v) => (
                <button key={v} className={styles.pointButton} onClick={() => addPoints(selectedUid, selectedStat.team, v)}>
                  +{v}
                </button>
              ))}
            </div>
            <div className={styles.pointFixes}>
              <span>Corrigir:</span>
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
            </div>

            {/* Estatísticas: grade 2×2 */}
            <div className={styles.statGrid}>
              {STAT_FIELDS.map((field) => (
                <div className={styles.statCell} key={field.key}>
                  <span className={styles.statCellLabel}>
                    {field.label} <b>{selectedStat[field.key]}</b>
                  </span>
                  <div className={styles.statCellButtons}>
                    <button
                      className={styles.minusButton}
                      disabled={selectedStat[field.key] === 0}
                      onClick={() => addStat(selectedUid, field.key, -1)}
                      aria-label={`${field.label} −1`}
                    >
                      −
                    </button>
                    <button
                      className={styles.plusButton}
                      onClick={() => addStat(selectedUid, field.key, 1)}
                      aria-label={`${field.label} +1`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {lastAction && (
              <button type="button" className={styles.drawerUndo} onClick={undoLastAction} disabled={undoing}>
                <Undo2 size={14} /> Desfazer: {describeAction(lastAction)} {nameOf(lastAction.uid)}
              </button>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMAR ENCERRAMENTO */}
      {confirmFinish && (
        <div className={styles.drawerOverlay} onClick={() => setConfirmFinish(false)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()} role="alertdialog">
            <h3>Encerrar o jogo?</h3>
            <p>
              {game.teamA.name} <b>{game.teamA.score}</b> × <b>{game.teamB.score}</b> {game.teamB.name}
            </p>
            <span className={styles.confirmHint}>
              O placar e as estatísticas ficam salvos e entram no ranking. Não dá para voltar ao jogo depois.
            </span>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmCancel} onClick={() => setConfirmFinish(false)}>
                Continuar jogando
              </button>
              <button type="button" className={styles.confirmFinish} onClick={finishGame}>
                Encerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function SetupChip({ player, team, onClick, styles }) {
  const name = displayName(player)
  return (
    <button
      type="button"
      className={`${styles.setupChip} ${team === 'A' ? styles.setupChipA : team === 'B' ? styles.setupChipB : ''}`}
      onClick={onClick}
    >
      {player.photoURL ? (
        <Image src={player.photoURL} alt={name} width={28} height={28} className={styles.playerAvatar} />
      ) : (
        <span className={styles.avatarFallback}>{name.charAt(0)}</span>
      )}
      <span className={styles.playerName}>{name}</span>
    </button>
  )
}


function TeamSection({ title, rows, editable, onSelect, accent, mvpUids = [], styles }) {
  const total = (key) => rows.reduce((acc, r) => acc + (r[key] || 0), 0)
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
              {mvpUids.includes(row.uid) && (
                <span className={styles.mvpTag} title="MVP da partida" aria-label="MVP da partida">
                  ★
                </span>
              )}
            </span>
            <span className={styles.statValuePrimary}>{row.points}</span>
            <span>{row.rebounds}</span>
            <span>{row.assists}</span>
            <span>{row.blocks}</span>
            <span>{row.steals}</span>
          </button>
        ))
      )}

      {rows.length > 1 && (
        <div className={styles.totalRow}>
          <span className={styles.statsHeaderName}>Total</span>
          <span className={styles.statValuePrimary}>{total('points')}</span>
          <span>{total('rebounds')}</span>
          <span>{total('assists')}</span>
          <span>{total('blocks')}</span>
          <span>{total('steals')}</span>
        </div>
      )}
    </section>
  )
}