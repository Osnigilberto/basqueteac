    'use client'

    import { useEffect, useState } from 'react'
    import Image from 'next/image'
    import { collectionGroup, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
    import { X, TrendingUp } from 'lucide-react'
    import { db } from '@/lib/firebase'
    import styles from './PlayerModal.module.css'

    const POSITION_LABELS = {
    PG: 'Armador',
    SG: 'Ala-Armador',
    SF: 'Ala',
    PF: 'Ala-Pivô',
    C: 'Pivô',
    }

    // Calcula idade a partir da data de nascimento (string 'YYYY-MM-DD')
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

    // Converte centímetros (como guardamos no Firestore) pra metro com vírgula: 185 → "1,85 m"
    function formatHeight(heightCm) {
    if (!heightCm) return null
    const meters = (heightCm / 100).toFixed(2).replace('.', ',')
    return `${meters} cm`
    }


    function formatShortDate(timestamp) {
    const date = timestamp.toDate()
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${dateStr} · ${timeStr}`
    }

    export default function PlayerModal({ uid, onClose }) {
    const [profile, setProfile] = useState(null)
    const [loadingProfile, setLoadingProfile] = useState(true)
    const [gameLog, setGameLog] = useState([])
    const [loadingStats, setLoadingStats] = useState(true)

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

    // Fecha com a tecla Esc
    useEffect(() => {
        function handleEscape(event) {
        if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [onClose])

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

    const displayName = profile?.nickname || profile?.name || 'Jogador'

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
                        formatHeight(profile.height),
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
                MÉDIAS DA TEMPORADA
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
                            <span>{g.points}<small>PTS</small></span>
                            <span>{g.rebounds}<small>REB</small></span>
                            <span>{g.assists}<small>AST</small></span>
                            <span>{g.blocks}<small>BLO</small></span>
                            <span>{g.steals}<small>ROU</small></span>
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
                <p className={styles.emptyText}>Nenhuma estatística registrada ainda.</p>
                )}
            </>
            )}
        </div>
        </div>
    )
    }