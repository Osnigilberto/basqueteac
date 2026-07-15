    'use client'

    import { useEffect, useMemo, useState } from 'react'
    import { useRouter } from 'next/navigation'
    import { collectionGroup, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
    import { TrendingUp, ChevronLeft, ChevronRight, Trophy } from 'lucide-react'
    import { useAuth } from '@/hooks/useAuth'
    import { db } from '@/lib/firebase'
    import BottomNav from '@/components/BottomNav/BottomNav'
    import PlayerModal from '@/components/PlayerModal/PlayerModal'
    import Image from 'next/image'
    import styles from './page.module.css'

    const RANKING_CATEGORIES = [
    { key: 'points', label: 'PONTOS' },
    { key: 'rebounds', label: 'REBOTES' },
    { key: 'assists', label: 'ASSISTÊNCIAS' },
    { key: 'blocks', label: 'TOCOS' },
    { key: 'steals', label: 'ROUBOS' },
    ]

    function formatShortDate(timestamp) {
    const date = timestamp.toDate()
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${dateStr} · ${timeStr}`
    }

    function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1)
    }

    export default function StatsPage() {
    const router = useRouter()
    const { user, loading } = useAuth()

    const [gameLog, setGameLog] = useState([])
    const [loadingStats, setLoadingStats] = useState(true)
    const [period, setPeriod] = useState('month') // 'month' | 'season'
    const [viewDate, setViewDate] = useState(() => new Date())

    // Ranking geral do grupo — todos os jogadores, todas as categorias.
    const [finishedGames, setFinishedGames] = useState([])
    const [profileMap, setProfileMap] = useState({})
    const [loadingGeneralRanking, setLoadingGeneralRanking] = useState(true)
    const [selectedPlayerUid, setSelectedPlayerUid] = useState(null)

    useEffect(() => {
        if (!loading && !user) router.push('/')
    }, [loading, user, router])

    // Busca uma vez só todo o histórico do jogador (já vem com a data do jogo).
    // A navegação por mês/temporada é feita em memória depois, sem leituras extras.
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

    // Busca o histórico de TODOS os jogadores, agrupado por jogo — usado
    // pro ranking geral abaixo. Mesma ideia do dashboard.
    useEffect(() => {
        if (!user) return

        async function fetchAllStats() {
        try {
            const statsSnap = await getDocs(collectionGroup(db, 'stats'))
            const gamesByIdCache = {}
            const gamesMap = {}

            await Promise.all(
            statsSnap.docs.map(async (statDoc) => {
                try {
                const gameRef = statDoc.ref.parent.parent
                const gameId = gameRef.id

                if (!gamesByIdCache[gameId]) {
                    gamesByIdCache[gameId] = await getDoc(gameRef)
                }
                const gameSnap = gamesByIdCache[gameId]
                if (!gameSnap.exists() || gameSnap.data().status !== 'finished') return

                const data = statDoc.data()
                const uid = data.uid
                if (!uid) return

                if (!gamesMap[gameId]) {
                    gamesMap[gameId] = { date: gameSnap.data().date, players: [] }
                }
                gamesMap[gameId].players.push({
                    uid,
                    points: data.points || 0,
                    rebounds: data.rebounds || 0,
                    assists: data.assists || 0,
                    blocks: data.blocks || 0,
                    steals: data.steals || 0,
                })
                } catch (innerError) {
                console.error('[fetchAllStats → getDoc do jogo]', innerError)
                }
            })
            )

            const games = Object.values(gamesMap)
            setFinishedGames(games)

            const uids = Array.from(new Set(games.flatMap((g) => g.players.map((p) => p.uid))))
            const profiles = await Promise.all(
            uids.map(async (uid) => {
                const snap = await getDoc(doc(db, 'users', uid))
                return [uid, snap.exists() ? snap.data() : {}]
            })
            )
            setProfileMap(Object.fromEntries(profiles))
        } catch (error) {
            console.error('[fetchAllStats → query principal]', error)
        } finally {
            setLoadingGeneralRanking(false)
        }
        }

        fetchAllStats()
    }, [user])

    function changePeriod(next) {
        setPeriod(next)
        setViewDate(new Date()) // volta pro período atual ao trocar de modo
    }

    function goPrev() {
        setViewDate((prev) => {
        const d = new Date(prev)
        if (period === 'month') d.setMonth(d.getMonth() - 1)
        else d.setFullYear(d.getFullYear() - 1)
        return d
        })
    }

    function goNext() {
        setViewDate((prev) => {
        const d = new Date(prev)
        if (period === 'month') d.setMonth(d.getMonth() + 1)
        else d.setFullYear(d.getFullYear() + 1)
        return d
        })
    }

    const now = new Date()
    const isAtPresent =
        period === 'month'
        ? viewDate.getMonth() === now.getMonth() && viewDate.getFullYear() === now.getFullYear()
        : viewDate.getFullYear() === now.getFullYear()

    const periodLabel =
        period === 'month'
        ? capitalize(viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))
        : `${viewDate.getFullYear()}`

    // Filtra o histórico do jogador logado pelo mês/ano selecionado — sem novas queries.
    const filteredLog = useMemo(() => {
        return gameLog.filter((g) => {
        const d = g.date.toDate()
        if (period === 'month') {
            return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear()
        }
        return d.getFullYear() === viewDate.getFullYear()
        })
    }, [gameLog, period, viewDate])

    // Jogos do período selecionado, pro ranking geral — mesmo período do card pessoal.
    const gamesInPeriod = useMemo(() => {
        return finishedGames.filter((g) => {
        const d = g.date.toDate()
        if (period === 'month') {
            return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear()
        }
        return d.getFullYear() === viewDate.getFullYear()
        })
    }, [finishedGames, period, viewDate])

    // Ranking geral: TODOS os jogadores, sem cortar em top 5 — mesma lógica
    // de posição com empate (dense ranking) usada no dashboard.
    const generalRanking = useMemo(() => {
        const totalsByUser = {}

        gamesInPeriod.forEach((game) => {
        game.players.forEach((p) => {
            if (!totalsByUser[p.uid]) {
            totalsByUser[p.uid] = { points: 0, rebounds: 0, assists: 0, blocks: 0, steals: 0 }
            }
            totalsByUser[p.uid].points += p.points
            totalsByUser[p.uid].rebounds += p.rebounds
            totalsByUser[p.uid].assists += p.assists
            totalsByUser[p.uid].blocks += p.blocks
            totalsByUser[p.uid].steals += p.steals
        })
        })

        const uids = Object.keys(totalsByUser)

        function fullList(field) {
        const sorted = uids
            .map((uid) => ({
            uid,
            name: profileMap[uid]?.nickname || profileMap[uid]?.name || 'Jogador',
            photoURL: profileMap[uid]?.photoURL || null,
            value: totalsByUser[uid][field],
            }))
            .filter((p) => p.value > 0)
            .sort((a, b) => b.value - a.value)

        const ranked = []
        sorted.forEach((p, i) => {
            const rank = i === 0 ? 1 : sorted[i - 1].value === p.value ? ranked[i - 1].rank : ranked[i - 1].rank + 1
            ranked.push({ ...p, rank })
        })

        return ranked
        }

        return {
        points: fullList('points'),
        rebounds: fullList('rebounds'),
        assists: fullList('assists'),
        blocks: fullList('blocks'),
        steals: fullList('steals'),
        }
    }, [gamesInPeriod, profileMap])

    if (loading || !user) return null

    const gamesPlayed = filteredLog.length
    const averages =
        gamesPlayed > 0
        ? {
            points: filteredLog.reduce((s, g) => s + g.points, 0) / gamesPlayed,
            rebounds: filteredLog.reduce((s, g) => s + g.rebounds, 0) / gamesPlayed,
            assists: filteredLog.reduce((s, g) => s + g.assists, 0) / gamesPlayed,
            blocks: filteredLog.reduce((s, g) => s + g.blocks, 0) / gamesPlayed,
            steals: filteredLog.reduce((s, g) => s + g.steals, 0) / gamesPlayed,
            plusMinus: filteredLog.reduce((s, g) => s + g.plusMinus, 0) / gamesPlayed,
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

            <div className={styles.periodToggle}>
            <button
                type="button"
                className={`${styles.periodButton} ${period === 'month' ? styles.periodButtonActive : ''}`}
                onClick={() => changePeriod('month')}
            >
                Mensal
            </button>
            <button
                type="button"
                className={`${styles.periodButton} ${period === 'season' ? styles.periodButtonActive : ''}`}
                onClick={() => changePeriod('season')}
            >
                Temporada
            </button>
            </div>

            <div className={styles.periodNav}>
            <button
                type="button"
                className={styles.periodNavButton}
                onClick={goPrev}
                aria-label="Período anterior"
            >
                <ChevronLeft size={18} />
            </button>
            <span className={styles.periodNavLabel}>{periodLabel}</span>
            <button
                type="button"
                className={styles.periodNavButton}
                onClick={goNext}
                disabled={isAtPresent}
                aria-label="Próximo período"
            >
                <ChevronRight size={18} />
            </button>
            </div>

            <section className={styles.statsCard}>
            <div className={styles.listHeader}>
                <TrendingUp size={14} />
                MÉDIAS {period === 'month' ? 'DO MÊS' : 'DA TEMPORADA'}
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
                    {filteredLog.map((g) => (
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
                            g.plusMinus > 0 ? styles.statsPositive : g.plusMinus < 0 ? styles.statsNegative : ''
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
                <p className={styles.emptyText}>
                {period === 'month' ? 'Nenhum jogo seu neste mês.' : 'Nenhum jogo seu nesta temporada.'}
                </p>
            )}
            </section>

            <section className={styles.statsCard}>
            <div className={styles.listHeader}>
                <Trophy size={14} />
                RANKING GERAL {period === 'month' ? 'DO MÊS' : 'DA TEMPORADA'}
            </div>

            {loadingGeneralRanking ? (
                <p className={styles.emptyText}>Carregando...</p>
            ) : (
                <div className={styles.rankingGrid}>
                {RANKING_CATEGORIES.map((cat) => (
                    <div key={cat.key} className={styles.rankingCategory}>
                    <span className={styles.rankingCategoryLabel}>{cat.label}</span>

                    {generalRanking[cat.key].length === 0 ? (
                        <p className={styles.rankingEmpty}>Sem dados nesse período.</p>
                    ) : (
                        generalRanking[cat.key].map((p) => (
                        <button
                            key={p.uid}
                            className={styles.rankingRow}
                            onClick={() => setSelectedPlayerUid(p.uid)}
                        >
                            <span
                            className={`${styles.rankingPosition} ${p.rank === 1 ? styles.rankingFirst : ''}`}
                            >
                            {p.rank}
                            </span>
                            {p.photoURL && (
                            <Image
                                src={p.photoURL}
                                alt={p.name}
                                width={24}
                                height={24}
                                className={styles.rankingAvatar}
                            />
                            )}
                            <span className={styles.rankingName}>{p.name}</span>
                            <span className={styles.rankingValue}>{p.value}</span>
                        </button>
                        ))
                    )}
                    </div>
                ))}
                </div>
            )}
            </section>
        </div>

        <BottomNav />

        {selectedPlayerUid && (
            <PlayerModal uid={selectedPlayerUid} onClose={() => setSelectedPlayerUid(null)} />
        )}
        </main>
    )
    }