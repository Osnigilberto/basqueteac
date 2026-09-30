'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore'
import { ArrowLeft, Loader2, Search, CalendarDays, Settings2, Shirt, Users, Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase'
import { displayName, nextHalfHour, toDateInput } from '@/lib/format'
import { fetchGroupData, invalidateGroupData } from '@/lib/gameStats'
import styles from './page.module.css'

const TARGET_PRESETS = [10, 15, 21, 30]
const DEFAULT_LOCATION = 'Ginásio Municipal'
const TEAM_PRESETS = [
  ['Time Branco', 'Time Preto'],
  ['Time Verde', 'Time Amarelo'],
  ['Time Azul', 'Time Vermelho'],
]

const EMPTY_STATS = { points: 0, rebounds: 0, assists: 0, blocks: 0, steals: 0 }

function Avatar({ player, size = 32 }) {
  const name = displayName(player)
  return player?.photoURL ? (
    <Image src={player.photoURL} alt={name} width={size} height={size} className={styles.playerAvatar} />
  ) : (
    <span className={styles.avatarFallback} style={{ width: size, height: size }}>
      {name.charAt(0)}
    </span>
  )
}

/** Hoje e amanhã no formato do <input type="date"> */
function todayAndTomorrow() {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return { today: toDateInput(now), tomorrow: toDateInput(next) }
}

/** "hoje 19:30", "amanhã 08:00" ou "12/10 19:30" */
function whenLabel(date, time, { today, tomorrow }) {
  if (!date) return ''
  const day = date === today ? 'hoje' : date === tomorrow ? 'amanhã' : date.split('-').reverse().slice(0, 2).join('/')
  return `${day} ${time}`
}

export default function NewGame() {
  const router = useRouter()
  const { user, loading } = useAuth()

  const [defaults] = useState(() => nextHalfHour())
  const [days] = useState(todayAndTomorrow)
  const [date, setDate] = useState(defaults.date)
  const [time, setTime] = useState(defaults.time)
  const [location, setLocation] = useState(DEFAULT_LOCATION)
  const [recentLocations, setRecentLocations] = useState([])

  const [gameType, setGameType] = useState('teams')
  const [targetScore, setTargetScore] = useState(null)
  const [customTarget, setCustomTarget] = useState('')

  const [profiles, setProfiles] = useState(null)
  const [search, setSearch] = useState('')
  const [teamAName, setTeamAName] = useState('Time Branco')
  const [teamBName, setTeamBName] = useState('Time Preto')
  const [roster, setRoster] = useState({})
  const [duelPlayer1, setDuelPlayer1] = useState('')
  const [duelPlayer2, setDuelPlayer2] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [loading, user, router])

  // Jogadores (perfis em cache, os mesmos do Stats) e locais usados recentemente
  useEffect(() => {
    if (!user) return
    async function load() {
      fetchGroupData()
        .then(({ profiles }) => setProfiles(profiles))
        .catch((error) => {
          console.error('[NewGame → jogadores]', error)
          setProfiles({})
        })
      try {
        const snap = await getDocs(query(collection(db, 'games'), orderBy('date', 'desc'), limit(20)))
        const places = snap.docs.map((d) => d.data().location).filter(Boolean)
        setRecentLocations(Array.from(new Set([DEFAULT_LOCATION, ...places])).slice(0, 4))
      } catch (error) {
        console.error('[NewGame → locais]', error)
      }
    }
    load()
  }, [user])

  const players = useMemo(
    () =>
      Object.entries(profiles || {})
        .map(([uid, p]) => ({ uid, ...p }))
        .sort((a, b) => displayName(a).localeCompare(displayName(b), 'pt-BR')),
    [profiles]
  )

  const visiblePlayers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return players
    return players.filter((p) => `${displayName(p)} ${p.name || ''}`.toLowerCase().includes(term))
  }, [players, search])

  const rosterArray = Object.keys(roster).filter((uid) => roster[uid])

  function toggleRoster(uid) {
    setRoster((prev) => ({ ...prev, [uid]: !prev[uid] }))
  }

  function setAll(checked) {
    setRoster((prev) => ({ ...prev, ...Object.fromEntries(visiblePlayers.map((p) => [p.uid, checked])) }))
  }

  function commitCustomTarget() {
    const value = parseInt(customTarget, 10)
    if (value > 0) setTargetScore(value)
    setCustomTarget('')
  }

  // O que falta para poder criar (mostrado na barra do rodapé)
  const missing = !date || !time
    ? 'Escolha a data e o horário'
    : !location.trim()
    ? 'Informe o local'
    : gameType === '1v1'
    ? !duelPlayer1 || !duelPlayer2
      ? 'Escolha os dois jogadores'
      : null
    : !teamAName.trim() || !teamBName.trim()
    ? 'Dê nome às duas equipes'
    : rosterArray.length < 2
    ? 'Escolha pelo menos 2 jogadores'
    : null

  async function handleSubmit(event) {
    event.preventDefault()
    if (missing || saving) return
    setSaving(true)

    try {
      const gameDateTime = Timestamp.fromDate(new Date(`${date}T${time}`))
      const batch = writeBatch(db)
      const gameRef = doc(collection(db, 'games'))
      const base = {
        date: gameDateTime,
        location: location.trim(),
        status: 'scheduled',
        targetScore,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      if (gameType === '1v1') {
        batch.set(gameRef, {
          ...base,
          gameType: '1v1',
          teamA: { name: displayName(profiles[duelPlayer1]), score: 0, players: [duelPlayer1] },
          teamB: { name: displayName(profiles[duelPlayer2]), score: 0, players: [duelPlayer2] },
        })
        batch.set(doc(db, 'games', gameRef.id, 'stats', duelPlayer1), { uid: duelPlayer1, team: 'A', ...EMPTY_STATS })
        batch.set(doc(db, 'games', gameRef.id, 'stats', duelPlayer2), { uid: duelPlayer2, team: 'B', ...EMPTY_STATS })
      } else {
        batch.set(gameRef, {
          ...base,
          gameType: 'teams',
          roster: rosterArray,
          teamA: { name: teamAName.trim(), score: 0, players: [] },
          teamB: { name: teamBName.trim(), score: 0, players: [] },
        })
      }

      await batch.commit()
      invalidateGroupData()
      router.push(`/game/${gameRef.id}`)
    } catch (error) {
      console.error('[NewGame → criar]', error)
      alert('Não foi possível criar o jogo. Tente de novo.')
      setSaving(false)
    }
  }

  if (loading || !user) return null

  const { today, tomorrow } = days

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => router.back()} aria-label="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div className={styles.logo}>
          Basquete<span className={styles.logoAccent}>AC</span>
        </div>
      </header>

      <form className={styles.content} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Criar jogo</h1>

        {/* QUANDO E ONDE */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <CalendarDays size={14} /> QUANDO E ONDE
          </div>

          <div className={styles.chips}>
            <button
              type="button"
              className={`${styles.chip} ${date === today ? styles.chipActive : ''}`}
              onClick={() => setDate(today)}
            >
              Hoje
            </button>
            <button
              type="button"
              className={`${styles.chip} ${date === tomorrow ? styles.chipActive : ''}`}
              onClick={() => setDate(tomorrow)}
            >
              Amanhã
            </button>
          </div>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Data</span>
              <input className={styles.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Horário</span>
              <input className={styles.input} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Local</span>
            <input
              className={styles.input}
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={DEFAULT_LOCATION}
            />
          </label>
          {recentLocations.length > 1 && (
            <div className={styles.chips}>
              {recentLocations.map((place) => (
                <button
                  key={place}
                  type="button"
                  className={`${styles.chip} ${location === place ? styles.chipActive : ''}`}
                  onClick={() => setLocation(place)}
                >
                  {place}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* FORMATO */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <Settings2 size={14} /> FORMATO
          </div>

          <div className={styles.segmented}>
            <button
              type="button"
              className={gameType === 'teams' ? styles.segActive : ''}
              onClick={() => setGameType('teams')}
            >
              Time x Time
            </button>
            <button type="button" className={gameType === '1v1' ? styles.segActive : ''} onClick={() => setGameType('1v1')}>
              1×1
            </button>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Pontos para vencer</span>
            <div className={styles.chips}>
              {TARGET_PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.chip} ${targetScore === value ? styles.chipActive : ''}`}
                  onClick={() => setTargetScore(value)}
                >
                  {value}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.chip} ${targetScore === null ? styles.chipActive : ''}`}
                onClick={() => setTargetScore(null)}
              >
                Livre
              </button>
              {targetScore !== null && !TARGET_PRESETS.includes(targetScore) && (
                <span className={`${styles.chip} ${styles.chipActive}`}>{targetScore}</span>
              )}
              <input
                type="number"
                min={1}
                className={styles.chipInput}
                placeholder="Outro"
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value)}
                onBlur={commitCustomTarget}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitCustomTarget()
                  }
                }}
              />
            </div>
            <p className={styles.hint}>Pode mudar isso a qualquer momento, mesmo com o jogo já rolando.</p>
          </div>
        </section>

        {gameType === 'teams' ? (
          <>
            {/* TIMES */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <Shirt size={14} /> TIMES
              </div>
              <div className={styles.teamsGrid}>
                <label className={styles.field}>
                  <span className={styles.teamBadgeA}>Equipe 1</span>
                  <input
                    className={styles.input}
                    type="text"
                    value={teamAName}
                    onChange={(e) => setTeamAName(e.target.value)}
                    placeholder="Ex: Time Branco, Lakers..."
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.teamBadgeB}>Equipe 2</span>
                  <input
                    className={styles.input}
                    type="text"
                    value={teamBName}
                    onChange={(e) => setTeamBName(e.target.value)}
                    placeholder="Ex: Time Preto, Celtics..."
                  />
                </label>
              </div>
              <div className={styles.chips}>
                {TEAM_PRESETS.map(([a, b]) => (
                  <button
                    key={a}
                    type="button"
                    className={`${styles.chip} ${teamAName === a && teamBName === b ? styles.chipActive : ''}`}
                    onClick={() => {
                      setTeamAName(a)
                      setTeamBName(b)
                    }}
                  >
                    {a.replace('Time ', '')} x {b.replace('Time ', '')}
                  </button>
                ))}
              </div>
            </section>

            {/* QUEM VAI JOGAR */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <Users size={14} /> QUEM VAI JOGAR
                <span className={styles.headerCount}>{rosterArray.length} confirmados</span>
              </div>

              <div className={styles.searchRow}>
                <div className={styles.searchBox}>
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Buscar jogador..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button type="button" className={styles.smallButton} onClick={() => setAll(true)}>
                  Todos
                </button>
                <button type="button" className={styles.smallButton} onClick={() => setAll(false)}>
                  Limpar
                </button>
              </div>

              {!profiles ? (
                <p className={styles.emptyText}>Carregando jogadores...</p>
              ) : visiblePlayers.length === 0 ? (
                <p className={styles.emptyText}>Nenhum jogador encontrado.</p>
              ) : (
                <div className={styles.playerGrid}>
                  {visiblePlayers.map((player) => (
                    <button
                      key={player.uid}
                      type="button"
                      className={`${styles.playerChip} ${roster[player.uid] ? styles.playerChipActive : ''}`}
                      onClick={() => toggleRoster(player.uid)}
                      aria-pressed={!!roster[player.uid]}
                    >
                      <Avatar player={player} />
                      <span className={styles.playerName}>{displayName(player)}</span>
                      {roster[player.uid] && <Check size={16} className={styles.playerCheck} />}
                    </button>
                  ))}
                </div>
              )}
              <p className={styles.hint}>Os times são montados (ou sorteados) na tela do jogo, antes de começar.</p>
            </section>
          </>
        ) : (
          /* 1×1 */
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <Users size={14} /> DUELO 1×1
            </div>
            {!profiles ? (
              <p className={styles.emptyText}>Carregando jogadores...</p>
            ) : (
              <div className={styles.duelGrid}>
                {[
                  ['Jogador 1', duelPlayer1, setDuelPlayer1, duelPlayer2, styles.teamBadgeA],
                  ['Jogador 2', duelPlayer2, setDuelPlayer2, duelPlayer1, styles.teamBadgeB],
                ].map(([label, value, setValue, other, badge]) => (
                  <div key={label} className={styles.field}>
                    <span className={badge}>{label}</span>
                    <div className={styles.duelList}>
                      {players
                        .filter((p) => p.uid !== other)
                        .map((p) => (
                          <button
                            key={p.uid}
                            type="button"
                            className={`${styles.playerChip} ${value === p.uid ? styles.playerChipActive : ''}`}
                            onClick={() => setValue(value === p.uid ? '' : p.uid)}
                          >
                            <Avatar player={p} size={28} />
                            <span className={styles.playerName}>{displayName(p)}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* BARRA FIXA */}
        <div className={styles.submitBar}>
          <span className={`${styles.submitSummary} ${missing ? styles.submitMissing : ''}`}>
            {missing ||
              (gameType === '1v1'
                ? `${displayName(profiles?.[duelPlayer1])} x ${displayName(profiles?.[duelPlayer2])} · ${whenLabel(date, time, days)}`
                : `${rosterArray.length} confirmados · ${whenLabel(date, time, days)}`)}
          </span>
          <button className={styles.submitButton} type="submit" disabled={!!missing || saving}>
            {saving && <Loader2 size={16} className={styles.spin} />}
            {saving ? 'Criando...' : 'Criar jogo'}
          </button>
        </div>
      </form>
    </main>
  )
}
