'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import Image from 'next/image'
import {
  CalendarDays,
  MapPin,
  ArrowRight,
  Trophy,
  HelpCircle,
  TrendingUp,
  Plus,
  Target,
  Flame,
  History,
  ChevronRight,
} from 'lucide-react'
import RulesModal from '@/components/RulesModal/RulesModal'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase'
import { capitalize, formatGameDate, formatShortDate } from '@/lib/format'
import { isInPeriod } from '@/hooks/usePeriod'
import {
  RANKING_CATEGORIES,
  fetchGroupData,
  playerGameLog,
  computeAverages,
  computeRankings,
  computePeriodMvp,
  latestActiveMonth,
} from '@/lib/gameStats'
import { SHOT_ZONES, formatShotLine } from '@/lib/biomechanics'
import { TIER_COLORS, getCategory, suggestChallenge } from '@/lib/challenges'
import {
  cachedTrainingStats,
  loadTrainingSessions,
  cachedChallengeBest,
  loadChallengeBest,
  trainingStreak,
} from '@/lib/trainingStore'
import BottomNav from '@/components/BottomNav/BottomNav'
import PlayerModal from '@/components/PlayerModal/PlayerModal'
import RankingBoard from '@/components/RankingBoard/RankingBoard'
import styles from './page.module.css'

// No Início o ranking é só um resumo; o completo fica em Stats
const HOME_CATEGORIES = RANKING_CATEGORIES.filter((c) => ['points', 'rebounds', 'assists'].includes(c.key))

const SHORTCUTS = [
  { href: '/game/new', label: 'Criar jogo', icon: Plus },
  { href: '/training', label: 'Treinar', icon: Target },
  { href: '/training/challenges', label: 'Desafios', icon: Trophy },
]

function monthName(date) {
  return capitalize(date.toLocaleDateString('pt-BR', { month: 'long' }))
}

export default function Dashboard() {
  const router = useRouter()
  const { user, loading } = useAuth()

  const [profilePhoto, setProfilePhoto] = useState(null)
  const [nextGame, setNextGame] = useState(null)
  const [loadingNextGame, setLoadingNextGame] = useState(true)
  const [group, setGroup] = useState(null)
  const [training, setTraining] = useState(null)
  const [challengeBest, setChallengeBest] = useState({})
  const [selectedPlayerUid, setSelectedPlayerUid] = useState(null)
  const [showRules, setShowRules] = useState(false)

  // Protege a rota
  useEffect(() => {
    if (!loading && !user) router.push('/')
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
          await setDoc(ref, { email: user.email ?? '', updatedAt: serverTimestamp() }, { merge: true })
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
        const liveSnap = await getDocs(query(collection(db, 'games'), where('status', '==', 'live'), limit(1)))
        if (!liveSnap.empty) {
          const gameDoc = liveSnap.docs[0]
          setNextGame({ id: gameDoc.id, ...gameDoc.data() })
          return
        }

        const scheduledSnap = await getDocs(
          query(collection(db, 'games'), where('status', '==', 'scheduled'), orderBy('date', 'asc'), limit(1))
        )
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

  // Jogos do grupo (em cache, compartilhado com Stats e Perfil), treinos e desafios
  useEffect(() => {
    if (!user) return
    async function load() {
      setTraining(cachedTrainingStats(user.uid))
      setChallengeBest(cachedChallengeBest(user.uid))
      loadChallengeBest(user.uid).then(setChallengeBest)
      loadTrainingSessions(user.uid).then((history) => history && setTraining(history.stats))
      try {
        setGroup(await fetchGroupData())
      } catch (error) {
        console.error('[dashboard → fetchGroupData]', error)
        setGroup({ games: [], profiles: {} })
      }
    }
    load()
  }, [user])

  const home = useMemo(() => {
    if (!group || !user) return null
    const now = new Date()
    const log = playerGameLog(group.games, user.uid)

    // Ranking inteligente: mês atual, ou o último mês que teve jogos
    const active = latestActiveMonth(group.games, now)
    const rankingGames = group.games.filter((g) => isInPeriod(g.date.toDate(), 'month', active.date))

    return {
      lastGame: log[0] || null,
      mine: computeAverages(log.filter((g) => isInPeriod(g.date.toDate(), 'month', now))),
      ranking: {
        label: monthName(active.date),
        isCurrent: active.isCurrent,
        rankings: computeRankings(rankingGames, group.profiles, { limit: 3 }),
        mvp: computePeriodMvp(rankingGames, group.profiles),
      },
    }
  }, [group, user])

  if (loading || !user) return null

  const firstName = user.displayName?.split(' ')[0] ?? 'jogador'
  const isLive = nextGame?.status === 'live'
  const zoneLines = SHOT_ZONES.filter((z) => training?.zones?.[z.id]?.attempts > 0)
  const suggestion = suggestChallenge(challengeBest)
  const streak = trainingStreak(training?.days)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          Basquete<span className={styles.logoAccent}>AC</span>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.helpButton} onClick={() => setShowRules(true)} aria-label="Regras do jogo">
            <HelpCircle size={20} />
          </button>
          <Link href="/profile" className={styles.avatarLink} aria-label="Meu perfil">
            {profilePhoto ? (
              <Image src={profilePhoto} alt={user.displayName || ''} width={32} height={32} className={styles.avatar} />
            ) : (
              <span className={styles.avatarFallback}>{firstName.charAt(0)}</span>
            )}
          </Link>
        </div>
      </header>

      <div className={styles.content}>
        <section className={styles.greeting}>
          <h1>Olá, {firstName}</h1>
          <p>Pronto pro próximo jogo?</p>
        </section>

        {/* ATALHOS */}
        <nav className={styles.shortcuts} aria-label="Atalhos">
          {SHORTCUTS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={styles.shortcut}>
              <span className={styles.shortcutIcon}>
                <Icon size={20} />
              </span>
              {label}
            </Link>
          ))}
        </nav>

        {/* PRÓXIMO JOGO / AO VIVO */}
        {loadingNextGame ? null : nextGame ? (
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

            <button className={styles.viewGameButton} onClick={() => router.push(`/game/${nextGame.id}`)}>
              {isLive ? 'Continuar jogo' : 'Ver jogo'}
              <ArrowRight size={16} />
            </button>
          </section>
        ) : (
          <p className={styles.noGameLine}>
            <CalendarDays size={14} /> Nenhum jogo agendado ainda.
          </p>
        )}

        {/* SEU ÚLTIMO JOGO */}
        {home?.lastGame && (
          <Link href={`/game/${home.lastGame.gameId}`} className={`${styles.nextGame} ${styles.cardLink}`}>
            <div className={styles.nextGameHeader}>
              <History size={14} />
              SEU ÚLTIMO JOGO
              <span className={styles.headerMeta}>{formatShortDate(home.lastGame.date)}</span>
            </div>
            <div className={styles.lastGameScore}>
              <span className={home.lastGame.won ? styles.resultWin : styles.resultLoss}>
                {home.lastGame.won ? 'Vitória' : 'Derrota'}
              </span>
              <strong>
                {home.lastGame.ownTeamName} {home.lastGame.ownScore} × {home.lastGame.oppScore}{' '}
                {home.lastGame.oppTeamName}
              </strong>
            </div>
            <div className={styles.lastGameLine}>
              <span>
                <b>{home.lastGame.points}</b> PTS
              </span>
              <span>
                <b>{home.lastGame.rebounds}</b> REB
              </span>
              <span>
                <b>{home.lastGame.assists}</b> AST
              </span>
              {home.lastGame.isMvp && <span className={styles.mvpStar}>★ MVP</span>}
              <ChevronRight size={16} className={styles.cardChevron} />
            </div>
          </Link>
        )}

        {/* TREINO DO DIA */}
        <section className={styles.nextGame}>
          <div className={styles.nextGameHeader}>
            <Target size={14} />
            TREINO DO DIA
            <span className={`${styles.streak} ${streak > 0 ? styles.streakOn : ''}`}>
              <Flame size={14} />
              {streak === 0 ? 'sem sequência' : streak === 1 ? '1 dia' : `${streak} dias seguidos`}
            </span>
          </div>

          {suggestion ? (
            <Link
              href={`/training/challenges?cat=${suggestion.challenge.category}&c=${suggestion.challenge.id}`}
              className={styles.dailyChallenge}
            >
              <span className={styles.dailyIcon}>{suggestion.challenge.icon}</span>
              <span className={styles.dailyText}>
                <strong>{suggestion.challenge.title}</strong>
                <span>
                  {getCategory(suggestion.challenge.category)?.title} · falta{' '}
                  <b style={{ color: TIER_COLORS[suggestion.stars] }}>{suggestion.nextTier.toLowerCase()}</b>
                </span>
              </span>
              <span className={styles.dailyStars}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ color: i < suggestion.stars ? TIER_COLORS[i] : undefined }}>
                    ★
                  </span>
                ))}
              </span>
            </Link>
          ) : (
            <p className={styles.emptyText}>Ouro em todos os desafios. Lenda! 🏆</p>
          )}

          {streak === 0 && <p className={styles.dailyHint}>Treine hoje para começar uma sequência.</p>}
          {zoneLines.length > 0 && (
            <p className={styles.trainingLine}>
              Treinos:{' '}
              {zoneLines
                .map((z) => `${z.id} ${formatShotLine(training.zones[z.id].makes, training.zones[z.id].attempts)}`)
                .join(' · ')}
            </p>
          )}
        </section>

        {/* SEU MÊS — só quando houver jogos seus no mês */}
        {home?.mine && (
          <section className={styles.nextGame}>
            <div className={styles.nextGameHeader}>
              <TrendingUp size={14} />
              SEU MÊS · {monthName(new Date()).toUpperCase()}
            </div>
            <div className={styles.monthNumbers}>
              <MonthStat value={home.mine.games} label="Jogos" />
              <MonthStat value={home.mine.points.toFixed(1)} label="PPG" />
              <MonthStat value={home.mine.rebounds.toFixed(1)} label="RPG" />
              <MonthStat value={home.mine.assists.toFixed(1)} label="APG" />
            </div>
          </section>
        )}

        {/* RANKING (mês atual ou o último com jogos) */}
        <section className={styles.rankingCard}>
          <div className={styles.nextGameHeader}>
            <Trophy size={14} />
            RANKING {home ? `DE ${home.ranking.label.toUpperCase()}` : 'DO MÊS'}
            <Link href="/stats?tab=ranking" className={styles.headerLink}>
              Completo <ArrowRight size={14} />
            </Link>
          </div>

          {!home ? (
            <p className={styles.emptyText}>Carregando...</p>
          ) : (
            <>
              {!home.ranking.isCurrent && (
                <p className={styles.rankingNote}>Último mês com jogos — ainda não teve jogo este mês.</p>
              )}
              {home.ranking.mvp.length > 0 && (
                <p className={styles.mvpBanner}>
                  🏅 MVP de {home.ranking.label}: {home.ranking.mvp.map((p) => p.name).join(' e ')} (
                  {home.ranking.mvp[0].count} {home.ranking.mvp[0].count === 1 ? 'vez' : 'vezes'})
                </p>
              )}
              <RankingBoard
                rankings={home.ranking.rankings}
                categories={HOME_CATEGORIES}
                onSelect={setSelectedPlayerUid}
              />
            </>
          )}
        </section>
      </div>

      <BottomNav />

      {selectedPlayerUid && <PlayerModal uid={selectedPlayerUid} onClose={() => setSelectedPlayerUid(null)} />}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </main>
  )
}

function MonthStat({ value, label }) {
  return (
    <div className={styles.monthStat}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}
