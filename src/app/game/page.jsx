    'use client'

    import { useEffect, useState } from 'react'
    import { useRouter } from 'next/navigation'
    import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    where,
    } from 'firebase/firestore'
    import { CalendarDays, ArrowRight, History, Plus } from 'lucide-react'
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

    export default function GamesPage() {
    const router = useRouter()
    const { user, loading } = useAuth()

    const [liveGames, setLiveGames] = useState([])
    const [upcomingGames, setUpcomingGames] = useState([])
    const [finishedGames, setFinishedGames] = useState([])
    const [loadingGames, setLoadingGames] = useState(true)

    useEffect(() => {
        if (!loading && !user) router.push('/')
    }, [loading, user, router])

    useEffect(() => {
        if (!user) return

        async function fetchGames() {
        try {
            const liveQuery = query(collection(db, 'games'), where('status', '==', 'live'))
            const liveSnap = await getDocs(liveQuery)
            setLiveGames(liveSnap.docs.map((d) => ({ id: d.id, ...d.data() })))

            const upcomingQuery = query(
            collection(db, 'games'),
            where('status', '==', 'scheduled'),
            orderBy('date', 'asc'),
            limit(10)
            )
            const upcomingSnap = await getDocs(upcomingQuery)
            setUpcomingGames(upcomingSnap.docs.map((d) => ({ id: d.id, ...d.data() })))

            const finishedQuery = query(
            collection(db, 'games'),
            where('status', '==', 'finished'),
            orderBy('date', 'desc'),
            limit(10)
            )
            const finishedSnap = await getDocs(finishedQuery)
            setFinishedGames(finishedSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
        } catch (error) {
            console.error('[fetchGames]', error)
        } finally {
            setLoadingGames(false)
        }
        }

        fetchGames()
    }, [user])

    if (loading || !user) return null

    return (
        <main className={styles.page}>
        <header className={styles.header}>
            <div className={styles.logo}>
            Basquete<span className={styles.logoAccent}>AC</span>
            </div>
        </header>

        <div className={styles.content}>
            <h1 className={styles.title}>Jogos</h1>
            <button className={styles.createButton} onClick={() => router.push('/game/new')}>
            <Plus size={16} />
            Criar jogo
            </button>

            {loadingGames ? (
            <p className={styles.emptyText}>Carregando...</p>
            ) : (
            <>
                {liveGames.length > 0 && (
                <section className={styles.listSection}>
                    <div className={styles.listHeader}>
                    <span className={styles.liveDot} />
                    EM ANDAMENTO
                    </div>
                    {liveGames.map((g) => (
                    <button key={g.id} className={styles.listRow} onClick={() => router.push(`/game/${g.id}`)}>
                        <div className={styles.listRowInfo}>
                        <span className={styles.listRowResult}>
                            {g.teamA.name} {g.teamA.score} — {g.teamB.score} {g.teamB.name}
                        </span>
                        <span className={styles.listRowLocation}>{g.location}</span>
                        </div>
                        <ArrowRight size={16} className={styles.listRowArrow} />
                    </button>
                    ))}
                </section>
                )}

                <section className={styles.listSection}>
                <div className={styles.listHeader}>
                    <CalendarDays size={14} />
                    AGENDADOS
                </div>
                {upcomingGames.length === 0 ? (
                    <p className={styles.emptyText}>Nenhum jogo agendado.</p>
                ) : (
                    upcomingGames.map((g) => (
                    <button key={g.id} className={styles.listRow} onClick={() => router.push(`/game/${g.id}`)}>
                        <div className={styles.listRowInfo}>
                        <span className={styles.listRowDate}>{formatShortDate(g.date)}</span>
                        <span className={styles.listRowLocation}>{g.location}</span>
                        </div>
                        <ArrowRight size={16} className={styles.listRowArrow} />
                    </button>
                    ))
                )}
                </section>

                <section className={styles.listSection}>
                <div className={styles.listHeader}>
                    <History size={14} />
                    HISTÓRICO
                </div>
                {finishedGames.length === 0 ? (
                    <p className={styles.emptyText}>Nenhum jogo finalizado ainda.</p>
                ) : (
                    finishedGames.map((g) => (
                    <button key={g.id} className={styles.listRow} onClick={() => router.push(`/game/${g.id}`)}>
                        <div className={styles.listRowInfo}>
                        <span className={styles.listRowDate}>{formatShortDate(g.date)}</span>
                        <span className={styles.listRowResult}>
                            {g.teamA.name} {g.teamA.score} — {g.teamB.score} {g.teamB.name}
                        </span>
                        </div>
                        <ArrowRight size={16} className={styles.listRowArrow} />
                    </button>
                    ))
                )}
                </section>
            </>
            )}
        </div>

        <BottomNav />
        </main>
    )
    }