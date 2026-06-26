    'use client'

    import { useEffect, useState } from 'react'
    import { useRouter } from 'next/navigation'
    import Image from 'next/image'
    import {
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    writeBatch,
    } from 'firebase/firestore'
    import { ArrowLeft, Loader2 } from 'lucide-react'
    import { useAuth } from '@/hooks/useAuth'
    import { db } from '@/lib/firebase'
    import styles from './page.module.css'

    const TARGET_PRESETS = [10, 15, 21, 30]

    function getPlayerLabel(player) {
    return player?.nickname || player?.name || 'Jogador'
    }

    export default function NewGame() {
    const router = useRouter()
    const { user, loading } = useAuth()

    const [date, setDate] = useState('')
    const [time, setTime] = useState('16:00')
    const [location, setLocation] = useState('Ginásio Municipal')

    const [gameType, setGameType] = useState('teams')

    const [targetScore, setTargetScore] = useState(null)
    const [customTarget, setCustomTarget] = useState('')

    const [players, setPlayers] = useState([])
    const [loadingPlayers, setLoadingPlayers] = useState(true)

    const [roster, setRoster] = useState({})

    const [duelPlayer1, setDuelPlayer1] = useState('')
    const [duelPlayer2, setDuelPlayer2] = useState('')

    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!loading && !user) router.push('/')
    }, [loading, user, router])

    useEffect(() => {
        async function loadPlayers() {
        const snap = await getDocs(query(collection(db, 'users'), orderBy('name')))
        setPlayers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
        setLoadingPlayers(false)
        }
        loadPlayers()
    }, [])

    function toggleRoster(uid) {
        setRoster((prev) => ({ ...prev, [uid]: !prev[uid] }))
    }

    function commitCustomTarget() {
        const value = parseInt(customTarget, 10)
        if (value > 0) {
        setTargetScore(value)
        }
        setCustomTarget('')
    }

    const rosterArray = Object.entries(roster).filter(([, checked]) => checked).map(([uid]) => uid)

    const canSubmit =
        date &&
        time &&
        location &&
        !saving &&
        (gameType === '1v1'
        ? duelPlayer1 && duelPlayer2 && duelPlayer1 !== duelPlayer2
        : rosterArray.length > 0)

    async function handleSubmit(event) {
        event.preventDefault()
        if (!canSubmit) return

        setSaving(true)

        const gameDateTime = Timestamp.fromDate(new Date(`${date}T${time}`))
        const batch = writeBatch(db)
        const gameRef = doc(collection(db, 'games'))

        if (gameType === '1v1') {
        const player1 = players.find((p) => p.uid === duelPlayer1)
        const player2 = players.find((p) => p.uid === duelPlayer2)

        batch.set(gameRef, {
            date: gameDateTime,
            location,
            status: 'scheduled',
            gameType: '1v1',
            targetScore,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            teamA: { name: getPlayerLabel(player1), score: 0, players: [duelPlayer1] },
            teamB: { name: getPlayerLabel(player2), score: 0, players: [duelPlayer2] },
        })

        batch.set(doc(db, 'games', gameRef.id, 'stats', duelPlayer1), {
            uid: duelPlayer1,
            team: 'A',
            points: 0,
            rebounds: 0,
            assists: 0,
            blocks: 0,
            steals: 0,
        })
        batch.set(doc(db, 'games', gameRef.id, 'stats', duelPlayer2), {
            uid: duelPlayer2,
            team: 'B',
            points: 0,
            rebounds: 0,
            assists: 0,
            blocks: 0,
            steals: 0,
        })
        } else {
        batch.set(gameRef, {
            date: gameDateTime,
            location,
            status: 'scheduled',
            gameType: 'teams',
            targetScore,
            roster: rosterArray,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            teamA: { name: 'Time Branco', score: 0, players: [] },
            teamB: { name: 'Time Preto', score: 0, players: [] },
        })
        }

        await batch.commit()

        router.push('/dashboard')
    }

    if (loading || !user) return null

    return (
        <main className={styles.page}>
        <header className={styles.header}>
            <button className={styles.backButton} onClick={() => router.push('/dashboard')}>
            <ArrowLeft size={18} />
            </button>
            <div className={styles.logo}>
            Basquete<span className={styles.logoAccent}>AC</span>
            </div>
        </header>

        <div className={styles.content}>
            <h1 className={styles.title}>Criar jogo</h1>

            <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
                <span className={styles.label}>Tipo de jogo</span>
                <div className={styles.typeToggle}>
                <button
                    type="button"
                    className={`${styles.typeButton} ${gameType === 'teams' ? styles.typeButtonActive : ''}`}
                    onClick={() => setGameType('teams')}
                >
                    Time x Time
                </button>
                <button
                    type="button"
                    className={`${styles.typeButton} ${gameType === '1v1' ? styles.typeButtonActive : ''}`}
                    onClick={() => setGameType('1v1')}
                >
                    1x1
                </button>
                </div>
            </div>

            <div className={styles.row}>
                <label className={styles.field}>
                <span className={styles.label}>Data</span>
                <input
                    className={styles.input}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                />
                </label>

                <label className={styles.field}>
                <span className={styles.label}>Horário</span>
                <input
                    className={styles.input}
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                />
                </label>
            </div>

            <label className={styles.field}>
                <span className={styles.label}>Local</span>
                <input
                className={styles.input}
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ginásio Municipal"
                required
                />
            </label>

            <div className={styles.field}>
                <span className={styles.label}>Pontos para vencer</span>
                <div className={styles.targetOptions}>
                {TARGET_PRESETS.map((value) => (
                    <button
                    key={value}
                    type="button"
                    className={`${styles.targetButton} ${targetScore === value ? styles.targetButtonActive : ''}`}
                    onClick={() => {
                        setTargetScore(value)
                        setCustomTarget('')
                    }}
                    >
                    {value}
                    </button>
                ))}
                <button
                    type="button"
                    className={`${styles.targetButton} ${targetScore === null ? styles.targetButtonActive : ''}`}
                    onClick={() => {
                    setTargetScore(null)
                    setCustomTarget('')
                    }}
                >
                    Livre
                </button>
                <input
                    type="number"
                    min={1}
                    className={styles.targetInput}
                    placeholder="Outro"
                    value={customTarget}
                    onChange={(e) => setCustomTarget(e.target.value)}
                    onBlur={commitCustomTarget}
                    onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault()
                        commitCustomTarget()
                    }
                    }}
                />
                </div>
                <p className={styles.targetHint}>
                Pode mudar isso a qualquer momento, mesmo com o jogo já rolando.
                </p>
            </div>

            {gameType === '1v1' ? (
                <div className={styles.row}>
                <label className={styles.field}>
                    <span className={styles.label}>Jogador 1</span>
                    <select
                    className={styles.input}
                    value={duelPlayer1}
                    onChange={(e) => setDuelPlayer1(e.target.value)}
                    >
                    <option value="">Selecionar...</option>
                    {players
                        .filter((p) => p.uid !== duelPlayer2)
                        .map((p) => (
                        <option key={p.uid} value={p.uid}>
                            {getPlayerLabel(p)}
                        </option>
                        ))}
                    </select>
                </label>

                <label className={styles.field}>
                    <span className={styles.label}>Jogador 2</span>
                    <select
                    className={styles.input}
                    value={duelPlayer2}
                    onChange={(e) => setDuelPlayer2(e.target.value)}
                    >
                    <option value="">Selecionar...</option>
                    {players
                        .filter((p) => p.uid !== duelPlayer1)
                        .map((p) => (
                        <option key={p.uid} value={p.uid}>
                            {getPlayerLabel(p)}
                        </option>
                        ))}
                    </select>
                </label>
                </div>
            ) : (
                <div className={styles.field}>
                <div className={styles.playersHeader}>
                    <span className={styles.label}>Quem vai jogar?</span>
                    <span className={styles.teamCounts}>{rosterArray.length} confirmado(s)</span>
                </div>

                {loadingPlayers ? (
                    <p className={styles.emptyText}>Carregando jogadores...</p>
                ) : players.length === 0 ? (
                    <p className={styles.emptyText}>Nenhum jogador cadastrado ainda.</p>
                ) : (
                    <div className={styles.playerList}>
                    {players.map((player) => (
                        <button
                        key={player.uid}
                        type="button"
                        className={`${styles.rosterRow} ${roster[player.uid] ? styles.rosterRowActive : ''}`}
                        onClick={() => toggleRoster(player.uid)}
                        >
                        <div className={styles.playerInfo}>
                            {player.photoURL && (
                            <Image
                                src={player.photoURL}
                                alt={player.name}
                                width={32}
                                height={32}
                                className={styles.playerAvatar}
                            />
                            )}
                            <span className={styles.playerName}>{getPlayerLabel(player)}</span>
                        </div>
                        <span className={styles.rosterCheck}>{roster[player.uid] ? '✓' : ''}</span>
                        </button>
                    ))}
                    </div>
                )}

                <p className={styles.targetHint}>
                    Os times são definidos na hora do jogo — sem time pré-escolhido aqui.
                </p>
                </div>
            )}

            <button className={styles.submitButton} type="submit" disabled={!canSubmit}>
                {saving && <Loader2 size={16} className={styles.spin} />}
                {saving ? 'Criando...' : 'Criar jogo'}
            </button>
            </form>
        </div>
        </main>
    )
    }