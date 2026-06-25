    //src/app/game/[id]/page.jsx
    
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
    import { ArrowLeft, MapPin, CalendarDays, Play, Square, RotateCcw, X } from 'lucide-react'
    import { db } from '@/lib/firebase'
    import { useAuth } from '@/hooks/useAuth'
    import styles from './page.module.css'

    const STATUS_LABELS = {
    scheduled: 'Agendado',
    live: 'Em andamento',
    finished: 'Finalizado',
    }

    // Estatísticas além de pontos — todas incrementam de 1 em 1
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

    export default function GamePage() {
    const { id: gameId } = useParams()
    const router = useRouter()
    const { user, loading } = useAuth()

    const [game, setGame] = useState(null)
    const [loadingGame, setLoadingGame] = useState(true)
    const [stats, setStats] = useState([])
    const [playersMap, setPlayersMap] = useState({})

    // uid do jogador selecionado pra abrir a gaveta de lançar estatística
    const [selectedUid, setSelectedUid] = useState(null)

    // ===== Timer de posse — local neste dispositivo, não sincronizado =====
    const [timerDuration, setTimerDuration] = useState(24)
    const [customInput, setCustomInput] = useState('')
    const [timeLeft, setTimeLeft] = useState(24)
    const [timerRunning, setTimerRunning] = useState(false)
    const intervalRef = useRef(null)
    const buzzedRef = useRef(false)
    const buzzerAudioRef = useRef(null)
    const whistleAudioRef = useRef(null)

    // Protege a rota
    useEffect(() => {
        if (!loading && !user) router.push('/')
    }, [loading, user, router])

    // Pré-carrega os sons (buzzer e apito) assim que a página abre
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

    // Escuta o documento do jogo em tempo real (placar, status)
    useEffect(() => {
        if (!gameId) return
        const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
        if (snap.exists()) setGame({ id: snap.id, ...snap.data() })
        setLoadingGame(false)
        })
        return unsub
    }, [gameId])

    // Escuta as estatísticas de todos os jogadores em tempo real
    useEffect(() => {
        if (!gameId) return
        const unsub = onSnapshot(collection(db, 'games', gameId, 'stats'), (snap) => {
        setStats(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
        })
        return unsub
    }, [gameId])

    // Busca nome/foto de cada jogador do jogo. Só refaz se o elenco mudar
    // (não a cada ponto marcado) — por isso a chave é a lista de uids, não o objeto `game`.
    const rosterKey = game ? [...game.teamA.players, ...game.teamB.players].sort().join(',') : ''

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

    // Roda o cronômetro enquanto estiver ativo
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

    // Marca pontos: atualiza o placar do time E o total do jogador juntos,
    // num batch (ou os dois salvam, ou nenhum salva)
    async function addPoints(uid, team, value) {
        const batch = writeBatch(db)
        batch.update(doc(db, 'games', gameId), {
        [`team${team}.score`]: increment(value),
        updatedAt: serverTimestamp(),
        })
        batch.update(doc(db, 'games', gameId, 'stats', uid), {
        points: increment(value),
        })
        await batch.commit()
    }

    // Marca rebote / assistência / toco / roubo (não afeta o placar)
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

    // Junta estatística + dados do jogador, por time, ordenado por pontos
    function getTeamRows(team) {
        return stats
        .filter((s) => s.team === team)
        .map((s) => ({ ...s, player: playersMap[s.uid] || {} }))
        .sort((a, b) => b.points - a.points)
    }

    if (loading || !user || loadingGame) return null

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

    return (
        <main className={styles.page}>
        <header className={styles.header}>
            <button className={styles.backButton} onClick={() => router.push('/dashboard')}>
            <ArrowLeft size={18} />
            </button>
            <span className={`${styles.statusBadge} ${styles[`status${game.status}`]}`}>
            {STATUS_LABELS[game.status]}
            </span>
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

        <p className={styles.gameInfo}>
            <CalendarDays size={14} /> {formatGameDate(game.date)}
        </p>
        <p className={styles.gameInfo}>
            <MapPin size={14} /> {game.location}
        </p>

        {isScheduled && (
            <button className={styles.startButton} onClick={startGame}>
            <Play size={16} />
            Iniciar jogo
            </button>
        )}

        {isLive && (
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
                {timerRunning ? 'Contando...' : timeLeft === 0 ? 'Zerou' : timeLeft === timerDuration ? 'Pronto' : 'Pausado — bola fora ou falta'}
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
            editable={isLive}
            onSelect={setSelectedUid}
            styles={styles}
        />

        <TeamSection
            title={game.teamB.name}
            rows={getTeamRows('B')}
            editable={isLive}
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
                <span className={styles.drawerLabel}>PTS — {selectedStat.points}</span>
                <div className={styles.drawerButtons}>
                    <button
                    className={styles.minusButton}
                    disabled={selectedStat.points === 0}
                    onClick={() => addPoints(selectedUid, selectedStat.team, -1)}
                    >
                    −1
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

    // Lista de jogadores de um time, com totais em colunas — estilo box score
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