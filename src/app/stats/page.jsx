    'use client'

    import { useEffect, useState } from 'react'
    import { useRouter } from 'next/navigation'
    import { collectionGroup, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
    import { TrendingUp } from 'lucide-react'
    import { useAuth } from '@/hooks/useAuth'
    import { db } from '@/lib/firebase'
    import BottomNav from '@/components/BottomNav/BottomNav'
    import styles from './page.module.css'

    function formatShortDate(timestamp) {
    const date = timestamp.toDate()
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${dateStr} · ${timeStr}`
    }

    export default function StatsPage() {
    const router = useRouter()
    const { user, loading } = useAuth()

    const [gameLog, setGameLog] = useState([])
    const [loadingStats, setLoadingStats] = useState(true)

    useEffect(() => {
        if (!loading && !user) router.push('/')
    }, [loading, user, router])

    useEffect(() => {
        if (!user) return

        async function fetchGameLog() {
        try {
            const statsQuery = query(collectionGroup(db, 'stats'), where('uid', '==', user.uid))
            const snap = await getDocs(statsQuery)

            const entries = await Promise.all(
            snap.docs.map(async (statDoc) => {
                try {
                const gameRef = statDoc.ref.parent.parent
                const gameSnap = await getDoc(gameRef)

                if (!gameSnap.exists() || gameSnap.data().status !== 'finished') return null

                const game = gameSnap.data()
                const data = statDoc.data()
                const isTeamA = data.team === 'A'
                const ownTeam = isTeamA ? game.teamA : game.teamB
                const oppTeam = isTeamA ? game.teamB : game.teamA

                return {
                    gameId: gameRef.id,
                    date: game.date,
                    ownTeamName: ownTeam.name,
                    oppTeamName: oppTeam.name,
                    points: data.points || 0,
                    rebounds: data.rebounds || 0,
                    assists: data.assists || 0,
                    blocks: data.blocks || 0,
                    steals: data.steals || 0,
                    plusMinus: ownTeam.score - oppTeam.score,
                }
                } catch (innerError) {
                console.error('[fetchGameLog → getDoc do jogo]', innerError)
                return null
                }
            })
            )

            const validEntries = entries.filter(Boolean).sort((a, b) => b.date.toMillis() - a.date.toMillis())
            setGameLog(validEntries)
        } catch (error) {
            console.error('[fetchGameLog → query principal]', error)
        } finally {
            setLoadingStats(false)
        }
        }

        fetchGameLog()
    }, [user])

    if (loading || !user) return null

    const gamesPlayed = gameLog.length
    const averages =
        gamesPlayed > 0
        ? {
            points: gameLog.reduce((s, g) => s + g.points, 0) / gamesPlayed,
            rebounds: gameLog.reduce((s, g) => s + g.rebounds, 0) / gamesPlayed,
            assists: gameLog.reduce((s, g) => s + g.assists, 0) / gamesPlayed,
            blocks: gameLog.reduce((s, g) => s + g.blocks, 0) / gamesPlayed,
            steals: gameLog.reduce((s, g) => s + g.steals, 0) / gamesPlayed,
            plusMinus: gameLog.reduce((s, g) => s + g.plusMinus, 0) / gamesPlayed,
            }
        : null

    return (
        <main className={styles.page}>
        <header className={styles.header}>
            <div className={styles.logo}>
            Basquete<span className={styles.logoAccent}>AC</span>
            </div>
        </header>

        <div className={styles.content}>
            <h1 className={styles.title}>Estatísticas</h1>

            <section className={styles.statsCard}>
            <div className={styles.listHeader}>
                <TrendingUp size={14} />
                MÉDIAS GERAIS
            </div>

            {loadingStats ? (
                <p className={styles.emptyText}>Carregando...</p>
            ) : averages ? (
                <>
                <p className={styles.statsGamesPlayed}>
                    {gamesPlayed} {gamesPlayed === 1 ? 'jogo' : 'jogos'} · médias por jogo
                </p>

                <div className={styles.statsGrid}>
                    <div className={styles.statsItem}>
                    <span className={styles.statsValue}>{averages.points.toFixed(1)}</span>
                    <span className={styles.statsLabel}>PPG</span>
                    </div>
                    <div className={styles.statsItem}>
                    <span className={styles.statsValue}>{averages.rebounds.toFixed(1)}</span>
                    <span className={styles.statsLabel}>RPG</span>
                    </div>
                    <div className={styles.statsItem}>
                    <span className={styles.statsValue}>{averages.assists.toFixed(1)}</span>
                    <span className={styles.statsLabel}>APG</span>
                    </div>
                    <div className={styles.statsItem}>
                    <span className={styles.statsValue}>{averages.blocks.toFixed(1)}</span>
                    <span className={styles.statsLabel}>BPG</span>
                    </div>
                    <div className={styles.statsItem}>
                    <span className={styles.statsValue}>{averages.steals.toFixed(1)}</span>
                    <span className={styles.statsLabel}>SPG</span>
                    </div>
                    <div className={styles.statsItem}>
                    <span
                        className={`${styles.statsValue} ${
                        averages.plusMinus > 0
                            ? styles.statsPositive
                            : averages.plusMinus < 0
                            ? styles.statsNegative
                            : ''
                        }`}
                    >
                        {averages.plusMinus > 0 ? '+' : ''}
                        {averages.plusMinus.toFixed(1)}
                    </span>
                    <span className={styles.statsLabel}>+/-</span>
                    </div>
                </div>

                <div className={styles.gameLog}>
                    {gameLog.map((g) => (
                    <div key={g.gameId} className={styles.gameLogRow}>
                        <div className={styles.gameLogInfo}>
                        <span className={styles.gameLogDate}>{formatShortDate(g.date)}</span>
                        <span className={styles.gameLogOpponent}>
                            {g.ownTeamName} vs {g.oppTeamName}
                        </span>
                        </div>
                        <div className={styles.gameLogStats}>
                        <span>
                            {g.points}
                            <small>PTS</small>
                        </span>
                        <span>
                            {g.rebounds}
                            <small>REB</small>
                        </span>
                        <span>
                            {g.assists}
                            <small>AST</small>
                        </span>
                        <span>
                            {g.blocks}
                            <small>BLO</small>
                        </span>
                        <span>
                            {g.steals}
                            <small>ROU</small>
                        </span>
                        <span
                            className={
                            g.plusMinus > 0
                                ? styles.statsPositive
                                : g.plusMinus < 0
                                ? styles.statsNegative
                                : ''
                            }
                        >
                            {g.plusMinus > 0 ? '+' : ''}
                            {g.plusMinus}
                            <small>+/-</small>
                        </span>
                        </div>
                    </div>
                    ))}
                </div>
                </>
            ) : (
                <p className={styles.emptyText}>Você ainda não tem estatísticas registradas.</p>
            )}
            </section>
        </div>

        <BottomNav />
        </main>
    )
    }