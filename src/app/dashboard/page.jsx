    'use client'

    import { useEffect, useRef, useState } from 'react'
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
    MapPin,
    ArrowRight,
    Trophy,
    } from 'lucide-react'
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

    export default function Dashboard() {
    const router = useRouter()
    const { user, loading } = useAuth()

    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef(null)

    const [profilePhoto, setProfilePhoto] = useState(null)

    const [nextGame, setNextGame] = useState(null)
    const [loadingNextGame, setLoadingNextGame] = useState(true)

    // Top 3 de cada categoria, somando o total de todos os jogos finalizados
    const [rankings, setRankings] = useState({
        points: [],
        rebounds: [],
        assists: [],
        blocks: [],
        steals: [],
    })
    const [loadingRankings, setLoadingRankings] = useState(true)
    const [selectedPlayerUid, setSelectedPlayerUid] = useState(null)

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

    // Ranking do grupo: soma os totais de todo mundo em todos os jogos
    // finalizados, e pega o top 3 de cada categoria
    useEffect(() => {
        if (!user) return

        async function fetchRankings() {
        try {
            const statsSnap = await getDocs(collectionGroup(db, 'stats'))
            const totalsByUser = {}

            await Promise.all(
            statsSnap.docs.map(async (statDoc) => {
                try {
                const gameRef = statDoc.ref.parent.parent
                const gameSnap = await getDoc(gameRef)
                if (!gameSnap.exists() || gameSnap.data().status !== 'finished') return

                const data = statDoc.data()
                const uid = data.uid
                if (!uid) return

                if (!totalsByUser[uid]) {
                    totalsByUser[uid] = { points: 0, rebounds: 0, assists: 0, blocks: 0, steals: 0 }
                }
                totalsByUser[uid].points += data.points || 0
                totalsByUser[uid].rebounds += data.rebounds || 0
                totalsByUser[uid].assists += data.assists || 0
                totalsByUser[uid].blocks += data.blocks || 0
                totalsByUser[uid].steals += data.steals || 0
                } catch (innerError) {
                console.error('[fetchRankings → getDoc do jogo]', innerError)
                }
            })
            )

            const uids = Object.keys(totalsByUser)
            const profiles = await Promise.all(
            uids.map(async (uid) => {
                const snap = await getDoc(doc(db, 'users', uid))
                return [uid, snap.exists() ? snap.data() : {}]
            })
            )
            const profileMap = Object.fromEntries(profiles)

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

            setRankings({
            points: topThree('points'),
            rebounds: topThree('rebounds'),
            assists: topThree('assists'),
            blocks: topThree('blocks'),
            steals: topThree('steals'),
            })
        } catch (error) {
            console.error('[fetchRankings → query principal]', error)
        } finally {
            setLoadingRankings(false)
        }
        }

        fetchRankings()
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

    if (loading || !user) return null

    const firstName = user.displayName?.split(' ')[0] ?? 'jogador'
    const isLive = nextGame?.status === 'live'
    const isPastDue = !isLive && nextGame?.status === 'scheduled' && nextGame.date.toDate() < new Date()

    return (
        <main className={styles.page}>
        <header className={styles.header}>
            <div className={styles.logo}>
            Basquete<span className={styles.logoAccent}>AC</span>
            </div>

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
                {!isLive && (
                    <p className={styles.nextGameDate}>
                    {formatGameDate(nextGame.date)}
                    {isPastDue && <span className={styles.overdueBadge}>Atrasado</span>}
                    </p>
                )}
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

            {loadingRankings ? (
                <p className={styles.emptyText}>Carregando...</p>
            ) : (
                <div className={styles.rankingGrid}>
                {RANKING_CATEGORIES.map((cat) => (
                    <div key={cat.key} className={styles.rankingCategory}>
                    <span className={styles.rankingCategoryLabel}>{cat.label}</span>

                    {rankings[cat.key].length === 0 ? (
                        <p className={styles.rankingEmpty}>Sem dados ainda.</p>
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