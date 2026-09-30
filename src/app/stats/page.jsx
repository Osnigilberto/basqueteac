'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TrendingUp, Trophy, ChevronRight, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePeriod } from '@/hooks/usePeriod'
import { formatShortDate } from '@/lib/format'
import { fetchGroupData, playerGameLog, computeAverages, computeRankings, computePeriodMvp } from '@/lib/gameStats'
import BottomNav from '@/components/BottomNav/BottomNav'
import PlayerModal from '@/components/PlayerModal/PlayerModal'
import PeriodPicker from '@/components/PeriodPicker/PeriodPicker'
import RankingBoard from '@/components/RankingBoard/RankingBoard'
import PlayersList from '@/components/PlayersList/PlayersList'
import styles from './page.module.css'

const TABS = ['me', 'ranking', 'atletas']

// A aba pode vir no link (ex.: "Ranking completo" do Início → /stats?tab=ranking)
function initialTab() {
  if (typeof window === 'undefined') return 'me'
  const tab = new URLSearchParams(window.location.search).get('tab')
  return TABS.includes(tab) ? tab : 'me'
}

function signed(value, digits = 0) {
  const n = digits ? value.toFixed(digits) : value
  return value > 0 ? `+${n}` : `${n}`
}

export default function StatsPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const period = usePeriod()

  const [tab, setTab] = useState(initialTab)
  const [group, setGroup] = useState(null)
  const [selectedPlayerUid, setSelectedPlayerUid] = useState(null)

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [loading, user, router])

  // Jogos do grupo (em cache, compartilhado com Início e Perfil).
  // A navegação por mês/temporada é feita em memória, sem leituras extras.
  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        setGroup(await fetchGroupData())
      } catch (error) {
        console.error('[stats → fetchGroupData]', error)
        setGroup({ games: [], profiles: {} })
      }
    }
    load()
  }, [user])

  const { inPeriod } = period
  const data = useMemo(() => {
    if (!group || !user) return null
    const games = group.games.filter((g) => inPeriod(g.date))
    const log = playerGameLog(games, user.uid)
    return {
      log,
      averages: computeAverages(log),
      rankings: computeRankings(games, group.profiles),
      mvp: computePeriodMvp(games, group.profiles),
    }
    // inPeriod muda junto com period/viewDate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, user, period.period, period.viewDate])

  if (loading || !user) return null

  const isMonth = period.period === 'month'
  const now = new Date()
  // MVP da temporada só é revelado em 12/12 (regra do grupo); o do mês aparece sempre
  const showMvp = data?.mvp.length > 0 && (isMonth || (now.getMonth() === 11 && now.getDate() === 12))

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          Basquete<span className={styles.logoAccent}>AC</span>
        </div>
      </header>

      <div className={styles.content}>
        <h1 className={styles.title}>Estatísticas</h1>

        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'me'}
            className={`${styles.tab} ${tab === 'me' ? styles.tabActive : ''}`}
            onClick={() => setTab('me')}
          >
            <TrendingUp size={15} /> Eu
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ranking'}
            className={`${styles.tab} ${tab === 'ranking' ? styles.tabActive : ''}`}
            onClick={() => setTab('ranking')}
          >
            <Trophy size={15} /> Ranking
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'atletas'}
            className={`${styles.tab} ${tab === 'atletas' ? styles.tabActive : ''}`}
            onClick={() => setTab('atletas')}
          >
            <Users size={15} /> Atletas
          </button>
        </div>

        {/* A lista de atletas não depende de período */}
        {tab !== 'atletas' && <PeriodPicker period={period} />}

        {tab === 'atletas' ? (
          <PlayersList profiles={group?.profiles} onSelect={setSelectedPlayerUid} />
        ) : tab === 'me' ? (
          <section className={styles.statsCard}>
            <div className={styles.listHeader}>
              <TrendingUp size={14} />
              MÉDIAS {isMonth ? 'DO MÊS' : 'DA TEMPORADA'}
            </div>

            {!data ? (
              <p className={styles.emptyText}>Carregando...</p>
            ) : data.averages ? (
              <>
                <p className={styles.statsGamesPlayed}>
                  {data.averages.games} {data.averages.games === 1 ? 'jogo' : 'jogos'} · {data.averages.wins}{' '}
                  {data.averages.wins === 1 ? 'vitória' : 'vitórias'}
                  {data.averages.mvps > 0 && ` · ${data.averages.mvps} MVP`} · médias por jogo
                </p>

                <div className={styles.statsGrid}>
                  <Average value={data.averages.points.toFixed(1)} label="PPG" />
                  <Average value={data.averages.rebounds.toFixed(1)} label="RPG" />
                  <Average value={data.averages.assists.toFixed(1)} label="APG" />
                  <Average value={data.averages.blocks.toFixed(1)} label="BPG" />
                  <Average value={data.averages.steals.toFixed(1)} label="SPG" />
                  <Average
                    value={signed(data.averages.plusMinus, 1)}
                    label="+/-"
                    tone={data.averages.plusMinus > 0 ? 'positive' : data.averages.plusMinus < 0 ? 'negative' : null}
                  />
                </div>

                <div className={styles.gameLog}>
                  {data.log.map((g) => (
                    <Link key={g.gameId} href={`/game/${g.gameId}`} className={styles.gameLogRow}>
                      <div className={styles.gameLogInfo}>
                        <span className={styles.gameLogDate}>
                          {formatShortDate(g.date)}
                          <span className={g.won ? styles.resultWin : styles.resultLoss}>{g.won ? 'V' : 'D'}</span>
                          {g.isMvp && <span className={styles.mvpTag}>MVP</span>}
                        </span>
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
                          className={g.plusMinus > 0 ? styles.statsPositive : g.plusMinus < 0 ? styles.statsNegative : ''}
                        >
                          {signed(g.plusMinus)}
                          <small>+/-</small>
                        </span>
                        <ChevronRight size={16} className={styles.gameLogChevron} />
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.emptyText}>
                {isMonth ? 'Nenhum jogo seu neste mês.' : 'Nenhum jogo seu nesta temporada.'}
              </p>
            )}
          </section>
        ) : (
          <section className={styles.statsCard}>
            <div className={styles.listHeader}>
              <Trophy size={14} />
              RANKING GERAL {isMonth ? 'DO MÊS' : 'DA TEMPORADA'}
            </div>

            {!data ? (
              <p className={styles.emptyText}>Carregando...</p>
            ) : (
              <>
                {showMvp && (
                  <p className={styles.mvpBanner}>
                    🏅 MVP {isMonth ? 'do mês' : 'da temporada'}: {data.mvp.map((p) => p.name).join(' e ')} (
                    {data.mvp[0].count} {data.mvp[0].count === 1 ? 'vez' : 'vezes'})
                  </p>
                )}
                <RankingBoard rankings={data.rankings} onSelect={setSelectedPlayerUid} />
              </>
            )}
          </section>
        )}
      </div>

      <BottomNav />

      {selectedPlayerUid && <PlayerModal uid={selectedPlayerUid} onClose={() => setSelectedPlayerUid(null)} />}
    </main>
  )
}

function Average({ value, label, tone }) {
  return (
    <div className={styles.statsItem}>
      <span
        className={`${styles.statsValue} ${
          tone === 'positive' ? styles.statsPositive : tone === 'negative' ? styles.statsNegative : ''
        }`}
      >
        {value}
      </span>
      <span className={styles.statsLabel}>{label}</span>
    </div>
  )
}
