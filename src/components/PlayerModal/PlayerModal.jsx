    'use client'

    import { useEffect, useMemo, useState } from 'react'
    import Image from 'next/image'
    import { X, TrendingUp, ArrowLeftRight, Medal } from 'lucide-react'
    import { useAuth } from '@/hooks/useAuth'
    import { usePeriod } from '@/hooks/usePeriod'
    import { POSITION_LABELS, calculateAge, formatShortDate } from '@/lib/format'
    import { fetchGroupData, playerGameLog, computeAverages } from '@/lib/gameStats'
    import AchievementBadges from '@/components/AchievementBadges/AchievementBadges'
    import PeriodPicker from '@/components/PeriodPicker/PeriodPicker'
    import styles from './PlayerModal.module.css'

    // Confrontos diretos (times opostos) entre o usuário logado e `uid`
    function headToHeadMatches(games, myUid, uid) {
    const matches = []
    games.forEach((game) => {
        const meInA = game.teamA.players.includes(myUid)
        const meInB = game.teamB.players.includes(myUid)
        const themInA = game.teamA.players.includes(uid)
        const themInB = game.teamB.players.includes(uid)
        if (!((meInA && themInB) || (meInB && themInA))) return
        const myScore = meInA ? game.teamA.score : game.teamB.score
        const theirScore = meInA ? game.teamB.score : game.teamA.score
        matches.push({ gameId: game.id, date: game.date, myScore, theirScore, won: myScore > theirScore })
    })
    return {
        winsMe: matches.filter((m) => m.won).length,
        winsThem: matches.filter((m) => !m.won).length,
        matches,
    }
    }

    export default function PlayerModal({ uid, onClose }) {
    const { user: currentUser } = useAuth()
    const period = usePeriod()

    // Dados do grupo em cache (os mesmos do Início/Stats): perfis, histórico e confrontos
    const [group, setGroup] = useState(null)

    useEffect(() => {
        if (!uid) return
        let active = true
        fetchGroupData()
        .then((data) => active && setGroup(data))
        .catch((error) => {
            console.error('[PlayerModal → fetchGroupData]', error)
            if (active) setGroup({ games: [], profiles: {} })
        })
        return () => {
        active = false
        }
    }, [uid])

    useEffect(() => {
        function handleEscape(event) {
        if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [onClose])

    const loadingProfile = !group
    const loadingStats = !group
    const loadingH2H = !group
    const profile = group ? group.profiles[uid] || null : null
    const gameLog = useMemo(() => (group ? playerGameLog(group.games, uid) : []), [group, uid])
    const headToHead = useMemo(
        () => (group && currentUser && uid !== currentUser.uid ? headToHeadMatches(group.games, currentUser.uid, uid) : null),
        [group, currentUser, uid]
    )

    // Filtra o histórico já carregado pelo mês/ano selecionado — sem novas queries.
    const { inPeriod } = period
    const filteredLog = useMemo(
        () => gameLog.filter((g) => inPeriod(g.date)),
        // inPeriod muda junto com period/viewDate
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [gameLog, period.period, period.viewDate]
    )
    const averages = computeAverages(filteredLog)
    const gamesPlayed = filteredLog.length

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
                MÉDIAS {period.period === 'month' ? 'DO MÊS' : 'DA TEMPORADA'}
                </div>

                <PeriodPicker period={period} />

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
                    {period.period === 'month'
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