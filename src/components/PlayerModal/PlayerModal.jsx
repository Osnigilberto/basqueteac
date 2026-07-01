    'use client'

    import { useEffect, useMemo, useState } from 'react'
    import Image from 'next/image'
    import { collection, collectionGroup, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
    import { X, TrendingUp, ArrowLeftRight, Medal, ChevronLeft, ChevronRight } from 'lucide-react'
    import { db } from '@/lib/firebase'
    import { useAuth } from '@/hooks/useAuth'
    import AchievementBadges from '@/components/AchievementBadges/AchievementBadges'
    import styles from './PlayerModal.module.css'

    const POSITION_LABELS = {
    PG: 'Armador',
    SG: 'Ala-Armador',
    SF: 'Ala',
    PF: 'Ala-Pivô',
    C: 'Pivô',
    }

    function calculateAge(birthDateStr) {
    if (!birthDateStr) return null
    const birthDate = new Date(birthDateStr)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const hasNotHadBirthdayThisYear =
        today.getMonth() < birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
    if (hasNotHadBirthdayThisYear) age -= 1
    return age
    }

    function formatShortDate(timestamp) {
    const date = timestamp.toDate()
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${dateStr} · ${timeStr}`
    }

    function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1)
    }

    export default function PlayerModal({ uid, onClose }) {
    const { user: currentUser } = useAuth()

    const [profile, setProfile] = useState(null)
    const [loadingProfile, setLoadingProfile] = useState(true)
    const [gameLog, setGameLog] = useState([])
    const [loadingStats, setLoadingStats] = useState(true)
    const [period, setPeriod] = useState('month') // 'month' | 'season'
    const [viewDate, setViewDate] = useState(() => new Date())

    const [headToHead, setHeadToHead] = useState(null)
    const [loadingH2H, setLoadingH2H] = useState(true)

    useEffect(() => {
        if (!uid) return

        async function loadProfile() {
        try {
            const snap = await getDoc(doc(db, 'users', uid))
            setProfile(snap.exists() ? snap.data() : null)
        } catch (error) {
            console.error('[PlayerModal → loadProfile]', error)
        } finally {
            setLoadingProfile(false)
        }
        }

        loadProfile()
    }, [uid])

    // Busca uma vez só todo o histórico do jogador (já vem com a data do jogo).
    // A navegação por mês/temporada é feita em memória depois, sem leituras extras.
    useEffect(() => {
        if (!uid) return

        async function fetchGameLog() {
        try {
            const statsQuery = query(collectionGroup(db, 'stats'), where('uid', '==', uid))
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
                console.error('[PlayerModal → getDoc do jogo]', innerError)
                return null
                }
            })
            )

            const validEntries = entries.filter(Boolean).sort((a, b) => b.date.toMillis() - a.date.toMillis())
            setGameLog(validEntries)
        } catch (error) {
            console.error('[PlayerModal → query principal]', error)
        } finally {
            setLoadingStats(false)
        }
        }

        fetchGameLog()
    }, [uid])

    useEffect(() => {
        async function fetchHeadToHead() {
        if (!uid || !currentUser || uid === currentUser.uid) {
            setLoadingH2H(false)
            return
        }

        try {
            const gamesSnap = await getDocs(query(collection(db, 'games'), where('status', '==', 'finished')))

            const matches = []
            gamesSnap.docs.forEach((gameDoc) => {
            const game = gameDoc.data()
            const meInA = game.teamA.players.includes(currentUser.uid)
            const meInB = game.teamB.players.includes(currentUser.uid)
            const themInA = game.teamA.players.includes(uid)
            const themInB = game.teamB.players.includes(uid)

            const opposed = (meInA && themInB) || (meInB && themInA)
            if (!opposed) return

            const myScore = meInA ? game.teamA.score : game.teamB.score
            const theirScore = meInA ? game.teamB.score : game.teamA.score

            matches.push({
                gameId: gameDoc.id,
                date: game.date,
                myScore,
                theirScore,
                won: myScore > theirScore,
            })
            })

            matches.sort((a, b) => b.date.toMillis() - a.date.toMillis())

            setHeadToHead({
            winsMe: matches.filter((m) => m.won).length,
            winsThem: matches.filter((m) => !m.won).length,
            matches,
            })
        } catch (error) {
            console.error('[PlayerModal → headToHead]', error)
        } finally {
            setLoadingH2H(false)
        }
        }

        fetchHeadToHead()
    }, [uid, currentUser])

    useEffect(() => {
        function handleEscape(event) {
        if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [onClose])

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

    // Filtra o histórico já carregado pelo mês/ano selecionado — sem novas queries.
    const filteredLog = useMemo(() => {
        return gameLog.filter((g) => {
        const d = g.date.toDate()
        if (period === 'month') {
            return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear()
        }
        return d.getFullYear() === viewDate.getFullYear()
        })
    }, [gameLog, period, viewDate])

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

    const displayName = profile?.nickname || profile?.name || 'Jogador'
    const showHeadToHead = currentUser && uid !== currentUser.uid

    return (
        <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeButton} onClick={onClose} aria-label="Fechar">
            <X size={18} />
            </button>

            {loadingProfile ? (
            <p className={styles.emptyText}>Carregando...</p>
            ) : !profile ? (
            <p className={styles.emptyText}>Jogador não encontrado.</p>
            ) : (
            <>
                <div className={styles.profileRow}>
                {profile.photoURL && (
                    <Image
                    src={profile.photoURL}
                    alt={displayName}
                    width={56}
                    height={56}
                    className={styles.avatar}
                    />
                )}
                <div className={styles.profileInfo}>
                    <h2 className={styles.title}>{displayName}</h2>
                    {profile.city && <p className={styles.city}>{profile.city}</p>}
                    {(() => {
                    const age = calculateAge(profile.birthDate)
                    const details = [
                        age !== null ? `${age} anos` : null,
                        profile.height ? `${profile.height} cm` : null,
                        profile.weight ? `${profile.weight} kg` : null,
                    ].filter(Boolean)
                    return details.length > 0 ? (
                        <p className={styles.city}>{details.join(' · ')}</p>
                    ) : null
                    })()}
                    {profile.positions?.length > 0 && (
                    <div className={styles.positions}>
                        {profile.positions.map((p) => (
                        <span key={p} className={styles.positionPill}>
                            {POSITION_LABELS[p] || p}
                        </span>
                        ))}
                    </div>
                    )}
                </div>
                </div>

                <div className={styles.listHeader}>
                <TrendingUp size={14} />
                MÉDIAS {period === 'month' ? 'DO MÊS' : 'DA TEMPORADA'}
                </div>

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
                            <span>{g.points}<small>PTS</small></span>
                            <span>{g.rebounds}<small>REB</small></span>
                            <span>{g.assists}<small>AST</small></span>
                            <span>{g.blocks}<small>BLO</small></span>
                            <span>{g.steals}<small>ROU</small></span>
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
                    {period === 'month'
                    ? 'Nenhum jogo neste mês.'
                    : 'Nenhum jogo nesta temporada.'}
                </p>
                )}

                {showHeadToHead && (
                <>
                    <div className={styles.listHeader}>
                    <ArrowLeftRight size={14} />
                    CONFRONTO DIRETO
                    </div>

                    {loadingH2H ? (
                    <p className={styles.emptyText}>Carregando...</p>
                    ) : !headToHead || headToHead.matches.length === 0 ? (
                    <p className={styles.emptyText}>Vocês ainda não jogaram um contra o outro.</p>
                    ) : (
                    <>
                        <p className={styles.h2hScore}>
                        Você {headToHead.winsMe} x {headToHead.winsThem} {displayName}
                        </p>
                        <div className={styles.gameLog}>
                        {headToHead.matches.map((m) => (
                            <div key={m.gameId} className={styles.gameLogRow}>
                            <span className={styles.gameLogDate}>{formatShortDate(m.date)}</span>
                            <span className={m.won ? styles.statsPositive : styles.statsNegative}>
                                {m.myScore} - {m.theirScore} {m.won ? '(vitória sua)' : '(derrota sua)'}
                            </span>
                            </div>
                        ))}
                        </div>
                    </>
                    )}
                </>
                )}

                <div className={styles.listHeader}>
                <Medal size={14} />
                CONQUISTAS
                </div>
                <AchievementBadges uid={uid} />
            </>
            )}
        </div>
        </div>
    )
    }