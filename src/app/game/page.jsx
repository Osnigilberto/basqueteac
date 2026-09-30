'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore'
import { CalendarDays, ArrowRight, History, Plus, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase'
import { formatShortDate } from '@/lib/format'
import BottomNav from '@/components/BottomNav/BottomNav'
import styles from './page.module.css'

const PAGE_SIZE = 10

function toGames(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

function playedIn(game, uid) {
  return game.teamA.players.includes(uid) || game.teamB.players.includes(uid)
}

export default function GamesPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  const [liveGames, setLiveGames] = useState([])
  const [upcomingGames, setUpcomingGames] = useState([])
  const [finishedGames, setFinishedGames] = useState([])
  const [lastFinished, setLastFinished] = useState(null) // cursor da paginação
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingGames, setLoadingGames] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [loading, user, router])

  useEffect(() => {
    if (!user) return

    async function fetchGames() {
      try {
        const [liveSnap, upcomingSnap, finishedSnap] = await Promise.all([
          getDocs(query(collection(db, 'games'), where('status', '==', 'live'))),
          getDocs(query(collection(db, 'games'), where('status', '==', 'scheduled'), orderBy('date', 'asc'), limit(10))),
          getDocs(
            query(collection(db, 'games'), where('status', '==', 'finished'), orderBy('date', 'desc'), limit(PAGE_SIZE))
          ),
        ])
        setLiveGames(toGames(liveSnap))
        setUpcomingGames(toGames(upcomingSnap))
        setFinishedGames(toGames(finishedSnap))
        setLastFinished(finishedSnap.docs[finishedSnap.docs.length - 1] || null)
        setHasMore(finishedSnap.docs.length === PAGE_SIZE)
      } catch (error) {
        console.error('[fetchGames]', error)
      } finally {
        setLoadingGames(false)
      }
    }

    fetchGames()
  }, [user])

  // Próxima página do histórico, continuando do último jogo carregado
  async function loadMore() {
    if (!lastFinished) return
    setLoadingMore(true)
    try {
      const snap = await getDocs(
        query(
          collection(db, 'games'),
          where('status', '==', 'finished'),
          orderBy('date', 'desc'),
          startAfter(lastFinished),
          limit(PAGE_SIZE)
        )
      )
      setFinishedGames((prev) => [...prev, ...toGames(snap)])
      setLastFinished(snap.docs[snap.docs.length - 1] || null)
      setHasMore(snap.docs.length === PAGE_SIZE)
    } catch (error) {
      console.error('[loadMore]', error)
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading || !user) return null

  const open = (id) => router.push(`/game/${id}`)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          Basquete<span className={styles.logoAccent}>AC</span>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Jogos</h1>
          <button className={styles.createButton} onClick={() => router.push('/game/new')}>
            <Plus size={16} />
            Criar jogo
          </button>
        </div>

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
                  <GameCard key={g.id} game={g} uid={user.uid} onOpen={open} live />
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
                upcomingGames.map((g) => <GameCard key={g.id} game={g} uid={user.uid} onOpen={open} scheduled />)
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
                <>
                  {finishedGames.map((g) => (
                    <GameCard key={g.id} game={g} uid={user.uid} onOpen={open} />
                  ))}
                  {hasMore && (
                    <button type="button" className={styles.moreButton} onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? <Loader2 size={16} className={styles.spin} /> : null}
                      {loadingMore ? 'Carregando...' : 'Ver mais jogos'}
                    </button>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>

      <BottomNav />
    </main>
  )
}

/** Card de jogo: data/local, os dois times e placar (vencedor em destaque) */
function GameCard({ game, uid, onOpen, live = false, scheduled = false }) {
  const { teamA, teamB } = game
  const winner = !live && !scheduled ? (teamA.score > teamB.score ? 'A' : teamB.score > teamA.score ? 'B' : null) : null
  const mine = playedIn(game, uid)

  return (
    <button className={styles.gameCard} onClick={() => onOpen(game.id)}>
      <div className={styles.gameMeta}>
        <span>{formatShortDate(game.date)}</span>
        {game.location && <span className={styles.gameLocation}>· {game.location}</span>}
        {mine && <span className={styles.mineBadge}>{scheduled ? 'Você vai jogar' : 'Você jogou'}</span>}
      </div>

      <div className={styles.gameTeams}>
        <TeamLine team={teamA} isWinner={winner === 'A'} dimmed={!!winner && winner !== 'A'} scheduled={scheduled} />
        <TeamLine team={teamB} isWinner={winner === 'B'} dimmed={!!winner && winner !== 'B'} scheduled={scheduled} />
      </div>

      <ArrowRight size={16} className={styles.listRowArrow} />
    </button>
  )
}

function TeamLine({ team, isWinner, dimmed, scheduled }) {
  return (
    <div className={`${styles.teamLine} ${isWinner ? styles.teamWinner : ''} ${dimmed ? styles.teamDimmed : ''}`}>
      <span className={styles.teamName}>{team.name}</span>
      <span className={styles.teamScore}>
        {scheduled ? `${team.players.length} jog.` : team.score}
      </span>
    </div>
  )
}
