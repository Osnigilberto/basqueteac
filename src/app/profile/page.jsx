'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { doc, getDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { Pencil, Moon, Sun, LogOut, ChevronRight, Medal, TrendingUp, Target, Settings } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { auth, db } from '@/lib/firebase'
import { POSITION_LABELS, calculateAge, displayName } from '@/lib/format'
import { fetchGroupData, playerGameLog, computeAverages } from '@/lib/gameStats'
import { SHOT_ZONES, formatShotLine, shotPct } from '@/lib/biomechanics'
import { TOTAL_STARS, computeProgress } from '@/lib/challenges'
import {
  cachedTrainingStats,
  loadTrainingSessions,
  cachedChallengeBest,
  loadChallengeBest,
} from '@/lib/trainingStore'
import BottomNav from '@/components/BottomNav/BottomNav'
import AchievementBadges from '@/components/AchievementBadges/AchievementBadges'
import styles from './page.module.css'

/**
 * Central do atleta: cartão do jogador, números da carreira, treinos,
 * conquistas e configurações num só lugar. A edição fica em /profile/edit.
 */
export default function ProfilePage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [theme, applyTheme] = useTheme()

  const [profile, setProfile] = useState(null)
  const [career, setCareer] = useState(undefined) // undefined = carregando, null = sem jogos
  const [training, setTraining] = useState(null)
  const [challengeBest, setChallengeBest] = useState({})

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [loading, user, router])

  useEffect(() => {
    if (!user) return
    async function load() {
      setTraining(cachedTrainingStats(user.uid))
      setChallengeBest(cachedChallengeBest(user.uid))

      getDoc(doc(db, 'users', user.uid))
        .then((snap) => setProfile(snap.exists() ? snap.data() : {}))
        .catch((err) => console.error('[profile → perfil]', err))

      fetchGroupData()
        .then(({ games }) => setCareer(computeAverages(playerGameLog(games, user.uid))))
        .catch((err) => {
          console.error('[profile → carreira]', err)
          setCareer(null)
        })

      loadTrainingSessions(user.uid).then((history) => history && setTraining(history.stats))
      setChallengeBest(await loadChallengeBest(user.uid))
    }
    load()
  }, [user])

  if (loading || !user) return null

  const name = displayName(profile) === 'Jogador' ? user.displayName || 'Jogador' : displayName(profile)
  const fullName = profile?.nickname ? profile?.name : null
  const photo = profile?.photoURL || user.photoURL
  const age = calculateAge(profile?.birthDate)
  const meta = [
    age != null && `${age} anos`,
    profile?.height && `${(profile.height / 100).toFixed(2).replace('.', ',')} m`,
    profile?.weight && `${profile.weight} kg`,
    profile?.city,
  ].filter(Boolean)

  const stars = computeProgress(challengeBest).totalStars
  const zoneLines = SHOT_ZONES.filter((z) => training?.zones?.[z.id]?.attempts > 0)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          Basquete<span className={styles.logoAccent}>AC</span>
        </div>
      </header>

      <div className={styles.content}>
        {/* CARTÃO DO JOGADOR */}
        <section className={styles.playerCard}>
          <div className={styles.playerTop}>
            {photo ? (
              <Image src={photo} alt={name} width={76} height={76} className={styles.avatar} />
            ) : (
              <span className={styles.avatarFallback}>{name.charAt(0)}</span>
            )}
            <div className={styles.playerNames}>
              <h1>{name}</h1>
              {fullName && <span className={styles.fullName}>{fullName}</span>}
              {meta.length > 0 && <span className={styles.meta}>{meta.join(' · ')}</span>}
            </div>
          </div>

          {profile?.positions?.length > 0 && (
            <div className={styles.positions}>
              {profile.positions.map((p) => (
                <span key={p} className={styles.positionChip}>
                  {POSITION_LABELS[p] || p} <small>{p}</small>
                </span>
              ))}
            </div>
          )}

          <Link href="/profile/edit" className={styles.editButton}>
            <Pencil size={14} /> Editar perfil
          </Link>
        </section>

        {/* CARREIRA */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <TrendingUp size={14} /> CARREIRA
            <Link href="/stats" className={styles.cardLink}>
              Ver stats <ChevronRight size={14} />
            </Link>
          </div>
          {career === undefined ? (
            <p className={styles.emptyText}>Carregando...</p>
          ) : career === null ? (
            <p className={styles.emptyText}>Você ainda não tem jogos finalizados.</p>
          ) : (
            <div className={styles.numbers}>
              <Stat value={career.games} label="Jogos" />
              <Stat value={career.wins} label="Vitórias" />
              <Stat value={career.mvps} label="MVPs" />
              <Stat value={career.points.toFixed(1)} label="PPG" accent />
              <Stat value={career.rebounds.toFixed(1)} label="RPG" accent />
              <Stat value={career.assists.toFixed(1)} label="APG" accent />
            </div>
          )}
        </section>

        {/* TREINOS */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <Target size={14} /> TREINOS
            <Link href="/training" className={styles.cardLink}>
              Treinar <ChevronRight size={14} />
            </Link>
          </div>
          <div className={styles.numbers}>
            <Stat value={training?.count || 0} label="Treinos" />
            <Stat value={training?.reps || 0} label="Repetições" />
            <Stat value={`${stars}/${TOTAL_STARS}`} label="★ Desafios" />
          </div>
          {zoneLines.length > 0 && (
            <div className={styles.zoneLines}>
              {zoneLines.map((z) => {
                const { makes, attempts } = training.zones[z.id]
                return (
                  <span key={z.id} className={styles.zoneLine}>
                    <b>{z.id}</b> {formatShotLine(makes, attempts)} <em>{shotPct(makes, attempts)}%</em>
                  </span>
                )
              })}
            </div>
          )}
        </section>

        {/* CONQUISTAS */}
        <section className={styles.card} id="conquistas">
          <div className={styles.cardHeader}>
            <Medal size={14} /> CONQUISTAS
          </div>
          <AchievementBadges uid={user.uid} />
        </section>

        {/* CONFIGURAÇÕES */}
        <section className={styles.card} id="configuracoes">
          <div className={styles.cardHeader}>
            <Settings size={14} /> CONFIGURAÇÕES
          </div>

          <span className={styles.settingLabel}>Aparência</span>
          <div className={styles.themeOptions}>
            <button
              type="button"
              className={`${styles.themeButton} ${theme === 'dark' ? styles.themeButtonActive : ''}`}
              onClick={() => applyTheme('dark')}
            >
              <Moon size={16} /> Escuro
            </button>
            <button
              type="button"
              className={`${styles.themeButton} ${theme === 'light' ? styles.themeButtonActive : ''}`}
              onClick={() => applyTheme('light')}
            >
              <Sun size={16} /> Claro
            </button>
          </div>

          <span className={styles.settingLabel}>Conta</span>
          <span className={styles.accountEmail}>{user.email}</span>
          <button type="button" className={styles.signOutButton} onClick={() => signOut(auth)}>
            <LogOut size={16} /> Sair
          </button>
        </section>
      </div>

      <BottomNav />
    </main>
  )
}

function Stat({ value, label, accent }) {
  return (
    <div className={styles.number}>
      <span className={`${styles.numberValue} ${accent ? styles.numberAccent : ''}`}>{value}</span>
      <span className={styles.numberLabel}>{label}</span>
    </div>
  )
}
