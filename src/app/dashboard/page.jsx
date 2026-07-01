    'use client'

    import { useEffect, useMemo, useRef, useState } from 'react'
    import { useRouter } from 'next/navigation'
    import { signOut } from 'firebase/auth'
    import {
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where,
    } from 'firebase/firestore'
    import Image from 'next/image'
    import {
    CalendarDays,
    Settings,
    LogOut,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    MapPin,
    ArrowRight,
    Trophy,
    Medal,
    HelpCircle,
    } from 'lucide-react'
    import RulesModal from '@/components/RulesModal/RulesModal'
    import { useAuth } from '@/hooks/useAuth'
    import { auth, db } from '@/lib/firebase'
    import BottomNav from '@/components/BottomNav/BottomNav'
    import PlayerModal from '@/components/PlayerModal/PlayerModal'
    import styles from './page.module.css'

    const RANKING_CATEGORIES = [
    { key: 'points', label: 'PONTOS' },
    { key: 'rebounds', label: 'REBOTES' },
    { key: 'assists', label: 'ASSISTÊNCIAS' },
    { key: 'blocks', label: 'TOCOS' },
    { key: 'steals', label: 'ROUBOS' },
    ]

    function formatGameDate(timestamp) {
    const date = timestamp.toDate()
    const dateStr = date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
    })
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${dateStr} · ${timeStr}`
    }

    function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1)
    }

    // Mesma fórmula do MVP de partida usada em game/[id]/page.jsx
    function gameTotal(s) {
    return (s.points || 0) + (s.rebounds || 0) + (s.assists || 0) + (s.blocks || 0) + (s.steals || 0)
    }

    export default function Dashboard() {
    const router = useRouter()
    const { user, loading } = useAuth()

    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef(null)

    const [profilePhoto, setProfilePhoto] = useState(null)

    const [nextGame, setNextGame] = useState(null)
    const [loadingNextGame, setLoadingNextGame] = useState(true)

    // Todos os jogos finalizados agrupados, com a data e as stats de cada jogador
    // naquele jogo — usado pra calcular tanto os totais do período quanto o MVP.
    const [finishedGames, setFinishedGames] = useState([])
    const [profileMap, setProfileMap] = useState({})
    const [loadingRankings, setLoadingRankings] = useState(true)

    const [period, setPeriod] = useState('month') // 'month' | 'season'
    const [viewDate, setViewDate] = useState(() => new Date())

    const [selectedPlayerUid, setSelectedPlayerUid] = useState(null)
    const [showRules, setShowRules] = useState(false)

    // Protege a rota
    useEffect(() => {
        if (!loading && !user) {
        router.push('/')
        }
    }, [loading, user, router])

    // Cria o documento de perfil na primeira vez; nas vezes seguintes
    // nunca sobrescreve o que foi editado em /profile
    useEffect(() => {
        if (!user) return

        async function seedProfile() {
        try {
            const ref = doc(db, 'users', user.uid)
            const snap = await getDoc(ref)

            if (!snap.exists()) {
            await setDoc(ref, {
                name: user.displayName ?? '',
                nickname: '',
                city: '',
                positions: [],
                photoURL: user.photoURL ?? '',
                email: user.email ?? '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            })
            setProfilePhoto(user.photoURL ?? '')
            } else {
            const data = snap.data()
            setProfilePhoto(data.photoURL || user.photoURL || '')

            await setDoc(
                ref,
                { email: user.email ?? '', updatedAt: serverTimestamp() },
                { merge: true }
            )
            }
        } catch (error) {
            console.error('[seedProfile]', error)
        }
        }

        seedProfile()
    }, [user])

    // Jogo a destacar no card principal: live agora, senão o próximo agendado
    useEffect(() => {
        if (!user) return

        async function fetchHighlightGame() {
        try {
            const liveQuery = query(collection(db, 'games'), where('status', '==', 'live'), limit(1))
            const liveSnap = await getDocs(liveQuery)

            if (!liveSnap.empty) {
            const gameDoc = liveSnap.docs[0]
            setNextGame({ id: gameDoc.id, ...gameDoc.data() })
            setLoadingNextGame(false)
            return
            }

            const scheduledQuery = query(
            collection(db, 'games'),
            where('status', '==', 'scheduled'),
            orderBy('date', 'asc'),
            limit(1)
            )
            const scheduledSnap = await getDocs(scheduledQuery)

            if (!scheduledSnap.empty) {
            const gameDoc = scheduledSnap.docs[0]
            setNextGame({ id: gameDoc.id, ...gameDoc.data() })
            }
        } catch (error) {
            console.error('[fetchHighlightGame]', error)
        } finally {
            setLoadingNextGame(false)
        }
        }

        fetchHighlightGame()
    }, [user])

    // Busca todo o histórico de stats uma vez só, agrupado por jogo.
    // A filtragem por mês/temporada acontece depois, em memória.
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
            setLoadingRankings(false)
        }
        }

        fetchAllStats()
    }, [user])

    // Fecha o dropdown ao clicar fora ou apertar Esc
    useEffect(() => {
        function handleClickOutside(event) {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
            setMenuOpen(false)
        }
        }
        function handleEscape(event) {
        if (event.key === 'Escape') setMenuOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)
        return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleEscape)
        }
    }, [])

    function changePeriod(next) {
        setPeriod(next)
        setViewDate(new Date())
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

    // Jogos do período selecionado — filtrado em memória, sem novas queries.
    const gamesInPeriod = useMemo(() => {
        return finishedGames.filter((g) => {
        const d = g.date.toDate()
        if (period === 'month') {
            return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear()
        }
        return d.getFullYear() === viewDate.getFullYear()
        })
    }, [finishedGames, period, viewDate])

    // Ranking por categoria: soma os totais de cada jogador nos jogos do período
    const rankings = useMemo(() => {
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

        function topThree(field) {
        return uids
            .map((uid) => ({
            uid,
            name: profileMap[uid]?.nickname || profileMap[uid]?.name || 'Jogador',
            photoURL: profileMap[uid]?.photoURL || null,
            value: totalsByUser[uid][field],
            }))
            .filter((p) => p.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 3)
        }

        return {
        points: topThree('points'),
        rebounds: topThree('rebounds'),
        assists: topThree('assists'),
        blocks: topThree('blocks'),
        steals: topThree('steals'),
        }
    }, [gamesInPeriod, profileMap])

    // MVP do período: conta quantas vezes cada jogador foi MVP de uma partida
    // (mesma fórmula do MVP por jogo), dentro dos jogos do período selecionado.
    const periodMvp = useMemo(() => {
        const mvpCount = {}

        gamesInPeriod.forEach((game) => {
        if (game.players.length === 0) return
        const withTotal = game.players.map((p) => ({ uid: p.uid, total: gameTotal(p) }))
        const maxTotal = Math.max(...withTotal.map((p) => p.total))
        if (maxTotal === 0) return
        withTotal
            .filter((p) => p.total === maxTotal)
            .forEach((p) => {
            mvpCount[p.uid] = (mvpCount[p.uid] || 0) + 1
            })
        })

        const uids = Object.keys(mvpCount)
        if (uids.length === 0) return []

        const maxCount = Math.max(...uids.map((uid) => mvpCount[uid]))
        return uids
        .filter((uid) => mvpCount[uid] === maxCount)
        .map((uid) => ({
            uid,
            name: profileMap[uid]?.nickname || profileMap[uid]?.name || 'Jogador',
            count: maxCount,
        }))
    }, [gamesInPeriod, profileMap])

    if (loading || !user) return null

    const firstName = user.displayName?.split(' ')[0] ?? 'jogador'
    const isLive = nextGame?.status === 'live'

    return (
        <main className={styles.page}>
        <header className={styles.header}>
            <div className={styles.logo}>
            Basquete<span className={styles.logoAccent}>AC</span>
            </div>

            <div className={styles.headerActions}>
            <button
                className={styles.helpButton}
                onClick={() => setShowRules(true)}
                aria-label="Regras do jogo"
            >
                <HelpCircle size={20} />
            </button>

            <div className={styles.userMenu} ref={menuRef}>
                <button
                className={styles.userMenuTrigger}
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                >
                {profilePhoto && (
                    <Image
                    src={profilePhoto}
                    alt={user.displayName}
                    width={32}
                    height={32}
                    className={styles.avatar}
                    />
                )}
                <ChevronDown
                    size={16}
                    className={styles.chevron}
                    style={{ transform: menuOpen ? 'rotate(180deg)' : 'none' }}
                />
                </button>

                {menuOpen && (
                <div className={styles.dropdown} role="menu">
                    <div className={styles.dropdownHeader}>
                    <span className={styles.dropdownName}>{user.displayName}</span>
                    <span className={styles.dropdownEmail}>{user.email}</span>
                    </div>

                    <div className={styles.dropdownDivider} />

                    <button
                    className={styles.dropdownItem}
                    role="menuitem"
                    onClick={() => {
                        setMenuOpen(false)
                        router.push('/achievements')
                    }}
                    >
                    <Medal size={16} />
                    Conquistas
                    </button>

                    <button
                    className={styles.dropdownItem}
                    role="menuitem"
                    onClick={() => {
                        setMenuOpen(false)
                        router.push('/settings')
                    }}
                    >
                    <Settings size={16} />
                    Configurações
                    </button>

                    <div className={styles.dropdownDivider} />

                    <button
                    className={styles.dropdownItemDanger}
                    role="menuitem"
                    onClick={() => signOut(auth)}
                    >
                    <LogOut size={16} />
                    Sair
                    </button>
                </div>
                )}
            </div>
            </div>
        </header>

        <div className={styles.content}>
            <section className={styles.greeting}>
            <h1>Olá, {firstName}</h1>
            <p>Pronto pra próximo jogo?</p>
            </section>

            <section className={styles.nextGame}>
            <div className={styles.nextGameHeader}>
                {isLive ? (
                <>
                    <span className={styles.liveDot} />
                    EM ANDAMENTO
                </>
                ) : (
                <>
                    <CalendarDays size={14} />
                    PRÓXIMO JOGO
                </>
                )}
            </div>

            {loadingNextGame ? (
                <p className={styles.emptyText}>Carregando...</p>
            ) : nextGame ? (
                <>
                {!isLive && <p className={styles.nextGameDate}>{formatGameDate(nextGame.date)}</p>}
                <p className={styles.nextGameLocation}>
                    <MapPin size={14} />
                    {nextGame.location}
                </p>

                <div className={styles.nextGameTeams}>
                    <span className={styles.teamPillA}>
                    {nextGame.teamA.name}
                    {isLive ? ` · ${nextGame.teamA.score} pts` : ` · ${nextGame.teamA.players.length} jog.`}
                    </span>
                    <span className={styles.teamPillB}>
                    {nextGame.teamB.name}
                    {isLive ? ` · ${nextGame.teamB.score} pts` : ` · ${nextGame.teamB.players.length} jog.`}
                    </span>
                </div>

                <button
                    className={styles.viewGameButton}
                    onClick={() => router.push(`/game/${nextGame.id}`)}
                >
                    {isLive ? 'Continuar jogo' : 'Ver jogo'}
                    <ArrowRight size={16} />
                </button>
                </>
            ) : (
                <p className={styles.emptyText}>Nenhum jogo agendado ainda.</p>
            )}
            </section>

            <section className={styles.rankingCard}>
            <div className={styles.nextGameHeader}>
                <Trophy size={14} />
                RANKING DO GRUPO
            </div>

            <div className={styles.periodToggle}>
                <button
                type="button"
                className={`${styles.periodButton} ${period === 'month' ? styles.periodButtonActive : ''}`}
                onClick={() => changePeriod('month')}
                >
                Mês
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

            {loadingRankings ? (
                <p className={styles.emptyText}>Carregando...</p>
            ) : (
                <>
                {periodMvp.length > 0 &&
                    (period === 'month' || (now.getMonth() === 11 && now.getDate() === 12)) && (
                    <p className={styles.mvpBanner}>
                        🏅 MVP {period === 'month' ? 'do mês' : 'da temporada'}:{' '}
                        {periodMvp.map((p) => p.name).join(' e ')} ({periodMvp[0].count}{' '}
                        {periodMvp[0].count === 1 ? 'vez' : 'vezes'})
                    </p>
                    )}

                <div className={styles.rankingGrid}>
                    {RANKING_CATEGORIES.map((cat) => (
                    <div key={cat.key} className={styles.rankingCategory}>
                        <span className={styles.rankingCategoryLabel}>{cat.label}</span>

                        {rankings[cat.key].length === 0 ? (
                        <p className={styles.rankingEmpty}>Sem dados nesse período.</p>
                        ) : (
                        rankings[cat.key].map((p, index) => (
                            <button
                            key={p.uid}
                            className={styles.rankingRow}
                            onClick={() => setSelectedPlayerUid(p.uid)}
                            >
                            <span
                                className={`${styles.rankingPosition} ${index === 0 ? styles.rankingFirst : ''}`}
                            >
                                {index + 1}
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
                </>
            )}
            </section>
        </div>

        <BottomNav />

        {selectedPlayerUid && (
            <PlayerModal uid={selectedPlayerUid} onClose={() => setSelectedPlayerUid(null)} />
        )}

        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        </main>
    )
    }