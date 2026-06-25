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

    export default function NewGame() {
    const router = useRouter()
    const { user, loading } = useAuth()

    const [date, setDate] = useState('')
    const [time, setTime] = useState('16:00')
    const [location, setLocation] = useState('Ginásio Municipal')

    // null = sem limite ("Livre")
    const [targetScore, setTargetScore] = useState(null)
    const [customTarget, setCustomTarget] = useState('')

    // Lista de jogadores cadastrados no app (qualquer um que já logou)
    const [players, setPlayers] = useState([])
    const [loadingPlayers, setLoadingPlayers] = useState(true)

    // Mapa { uid: 'A' | 'B' } — jogador sem entrada aqui não entra no jogo
    const [assignments, setAssignments] = useState({})
    const [saving, setSaving] = useState(false)

    // Protege a rota
    useEffect(() => {
        if (!loading && !user) router.push('/')
    }, [loading, user, router])

    // Busca todos os jogadores cadastrados, ordenados por nome
    useEffect(() => {
        async function loadPlayers() {
        const snap = await getDocs(query(collection(db, 'users'), orderBy('name')))
        setPlayers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
        setLoadingPlayers(false)
        }
        loadPlayers()
    }, [])

    function setTeam(uid, team) {
        setAssignments((prev) => {
        // Clicar no time que já está selecionado remove o jogador do jogo
        if (prev[uid] === team) {
            const next = { ...prev }
            delete next[uid]
            return next
        }
        return { ...prev, [uid]: team }
        })
    }

    function commitCustomTarget() {
        const value = parseInt(customTarget, 10)
        if (value > 0) {
        setTargetScore(value)
        }
        setCustomTarget('')
    }

    const teamACount = Object.values(assignments).filter((t) => t === 'A').length
    const teamBCount = Object.values(assignments).filter((t) => t === 'B').length
    const totalPlayers = teamACount + teamBCount

    const canSubmit = date && time && location && totalPlayers > 0 && !saving

    async function handleSubmit(event) {
        event.preventDefault()
        if (!canSubmit) return

        setSaving(true)

        const gameDateTime = Timestamp.fromDate(new Date(`${date}T${time}`))
        const teamAPlayers = Object.entries(assignments).filter(([, t]) => t === 'A').map(([uid]) => uid)
        const teamBPlayers = Object.entries(assignments).filter(([, t]) => t === 'B').map(([uid]) => uid)

        // Cria o jogo + os documentos de stats (zerados) de cada jogador,
        // tudo numa única transação em lote (ou todos salvam, ou nenhum salva)
        const batch = writeBatch(db)
        const gameRef = doc(collection(db, 'games'))

        batch.set(gameRef, {
        date: gameDateTime,
        location,
        status: 'scheduled',
        targetScore, // null = sem limite; pode ser editado depois, durante o jogo
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        teamA: { name: 'Time Branco', score: 0, players: teamAPlayers },
        teamB: { name: 'Time Preto', score: 0, players: teamBPlayers },
        })

        teamAPlayers.forEach((uid) => {
        batch.set(doc(db, 'games', gameRef.id, 'stats', uid), {
            uid,
            team: 'A',
            points: 0,
            rebounds: 0,
            assists: 0,
            blocks: 0,
            steals: 0,
        })
        })

        teamBPlayers.forEach((uid) => {
        batch.set(doc(db, 'games', gameRef.id, 'stats', uid), {
            uid,
            team: 'B',
            points: 0,
            rebounds: 0,
            assists: 0,
            blocks: 0,
            steals: 0,
        })
        })

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

            <div className={styles.field}>
                <div className={styles.playersHeader}>
                <span className={styles.label}>Jogadores</span>
                <span className={styles.teamCounts}>
                    <span className={styles.countA}>Branco {teamACount}</span>
                    ·
                    <span className={styles.countB}>Preto {teamBCount}</span>
                </span>
                </div>

                {loadingPlayers ? (
                <p className={styles.emptyText}>Carregando jogadores...</p>
                ) : players.length === 0 ? (
                <p className={styles.emptyText}>Nenhum jogador cadastrado ainda.</p>
                ) : (
                <div className={styles.playerList}>
                    {players.map((player) => (
                    <div key={player.uid} className={styles.playerRow}>
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
                        <span className={styles.playerName}>
                            {player.nickname || player.name || 'Jogador'}
                        </span>
                        </div>

                        <div className={styles.teamToggle}>
                        <button
                            type="button"
                            className={`${styles.teamButton} ${assignments[player.uid] === 'A' ? styles.teamButtonActiveA : ''}`}
                            onClick={() => setTeam(player.uid, 'A')}
                        >
                            Branco
                        </button>
                        <button
                            type="button"
                            className={`${styles.teamButton} ${assignments[player.uid] === 'B' ? styles.teamButtonActiveB : ''}`}
                            onClick={() => setTeam(player.uid, 'B')}
                        >
                            Preto
                        </button>
                        </div>
                    </div>
                    ))}
                </div>
                )}
            </div>

            <button className={styles.submitButton} type="submit" disabled={!canSubmit}>
                {saving && <Loader2 size={16} className={styles.spin} />}
                {saving ? 'Criando...' : 'Criar jogo'}
            </button>
            </form>
        </div>
        </main>
    )
    }