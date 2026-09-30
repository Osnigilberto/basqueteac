'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { ChevronLeft, Lock, X, Trophy } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import BottomNav from '@/components/BottomNav/BottomNav'
import TrainingRunner from '@/components/TrainingRunner/TrainingRunner'
import TrainingSetup from '@/components/TrainingSetup/TrainingSetup'
import { DRILL_TYPES, unlockAudio } from '@/lib/biomechanics'
import {
  CHALLENGE_CATEGORIES,
  TOTAL_STARS,
  TIER_NAMES,
  TIER_COLORS,
  challengesOf,
  computeProgress,
  getChallenge,
  formatTier,
  formatValue,
  isUnlocked,
  nextChallengeOf,
} from '@/lib/challenges'
import { cachedChallengeBest, loadChallengeBest } from '@/lib/trainingStore'
import styles from './page.module.css'

function Stars({ count, size = 14 }) {
  return (
    <span className={styles.stars} style={{ fontSize: size }} aria-label={`${count} de 3 estrelas`}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ color: i < count ? TIER_COLORS[i] : undefined }}>
          ★
        </span>
      ))}
    </span>
  )
}

// Link direto (ex.: "Treino do dia" no Início): ?cat=<fundamento>&c=<desafio>
function linkedChallenge() {
  if (typeof window === 'undefined') return null
  return getChallenge(new URLSearchParams(window.location.search).get('c'))
}

function initialCategory() {
  if (typeof window === 'undefined') return CHALLENGE_CATEGORIES[0].id
  const cat = new URLSearchParams(window.location.search).get('cat')
  return linkedChallenge()?.category || (CHALLENGE_CATEGORIES.some((c) => c.id === cat) ? cat : CHALLENGE_CATEGORIES[0].id)
}

export default function ChallengesPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  const [category, setCategory] = useState(initialCategory)
  const [best, setBest] = useState({})
  const [selected, setSelected] = useState(linkedChallenge)
  const [dominantHand, setDominantHand] = useState('right')
  const [cameraFacing, setCameraFacing] = useState(() => DRILL_TYPES[initialCategory()].camera)
  const [aiReady, setAiReady] = useState(false)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/')
  }, [loading, user, router])

  useEffect(() => {
    if (!user) return
    async function load() {
      setBest(cachedChallengeBest(user.uid))
      setBest(await loadChallengeBest(user.uid))
    }
    load()
  }, [user])

  const progress = computeProgress(best)
  const list = challengesOf(category)
  const next = nextChallengeOf(category, best)
  const catProgress = progress.byCategory[category]
  const drill = selected ? DRILL_TYPES[selected.category] : DRILL_TYPES[category]

  function openChallenge(challenge) {
    if (!isUnlocked(challenge, best)) return
    setSelected(challenge)
    setCameraFacing(DRILL_TYPES[challenge.category].camera)
  }

  function start() {
    unlockAudio()
    setRunning(true)
  }

  // Espera o login (evita piscar a tela e diferenças de hidratação com os parâmetros da URL)
  if (loading || !user) return null

  return (
    <main className={styles.page}>
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"
        strategy="afterInteractive"
        onReady={() => setAiReady(true)}
      />

      <header className={styles.header}>
        <Link href="/training" className={styles.back} aria-label="Voltar para Treinos">
          <ChevronLeft size={22} />
        </Link>
        <h1>Desafios</h1>
        <span className={styles.totalStars}>
          ★ {progress.totalStars}
          <small>/{TOTAL_STARS}</small>
        </span>
      </header>

      {/* ABAS DE FUNDAMENTO */}
      <nav className={styles.tabs} aria-label="Fundamentos">
        {CHALLENGE_CATEGORIES.map((cat) => {
          const p = progress.byCategory[cat.id]
          return (
            <button
              key={cat.id}
              type="button"
              style={{ '--cat-color': DRILL_TYPES[cat.id].color }}
              className={`${styles.tab} ${category === cat.id ? styles.tabActive : ''}`}
              onClick={(e) => {
                setCategory(cat.id)
                e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
              }}
              aria-pressed={category === cat.id}
            >
              <span className={styles.tabIcon}>{cat.icon}</span>
              <span className={styles.tabTitle}>{cat.title}</span>
              <span className={styles.tabStars}>
                ★ {p.stars}/{p.total}
              </span>
            </button>
          )
        })}
      </nav>

      <div className={styles.content} style={{ '--cat-color': DRILL_TYPES[category].color }}>
        <div className={styles.catHead}>
          <p>{DRILL_TYPES[category].description}</p>
          <div className={styles.catBar}>
            <div style={{ width: `${Math.round((catProgress.stars / catProgress.total) * 100)}%` }} />
          </div>
          <span className={styles.catHint}>
            {next
              ? `Próximo: ${next.title}. Tire bronze para liberar o seguinte.`
              : 'Ouro em tudo neste fundamento. Lenda!'}
          </span>
        </div>

        {/* TRILHA */}
        <ol className={styles.trail}>
          {list.map((c, i) => {
            const unlocked = isUnlocked(c, best)
            const b = best[c.id]
            const isNext = next?.id === c.id
            return (
              <li key={c.id} className={styles.trailItem}>
                <button
                  type="button"
                  disabled={!unlocked}
                  className={`${styles.step} ${isNext ? styles.stepNext : ''}`}
                  onClick={() => openChallenge(c)}
                >
                  <span className={styles.stepNode}>{unlocked ? c.icon : <Lock size={16} />}</span>
                  <span className={styles.stepBody}>
                    <span className={styles.stepLevel}>
                      Nível {i + 1}
                      {isNext && <em>Próximo</em>}
                    </span>
                    <span className={styles.stepTitle}>{c.title}</span>
                    <span className={styles.stepMeta}>
                      {unlocked
                        ? b?.value != null
                          ? `Recorde ${formatValue(c, b.value)}`
                          : 'Ainda não tentado'
                        : 'Tire bronze no anterior'}
                    </span>
                  </span>
                  <Stars count={b?.stars || 0} size={16} />
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      {/* PAINEL DO DESAFIO */}
      {selected && !running && (
        <div className={styles.sheetBackdrop} onClick={() => setSelected(null)}>
          <section
            className={styles.sheet}
            style={{ '--drill-color': drill.color }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={selected.title}
          >
            <button type="button" className={styles.sheetClose} onClick={() => setSelected(null)} aria-label="Fechar">
              <X size={18} />
            </button>

            <div className={styles.sheetHead}>
              <span className={styles.sheetEyebrow}>
                <Trophy size={12} /> {drill.shortTitle} · Nível {list.findIndex((c) => c.id === selected.id) + 1}
              </span>
              <h2>
                {selected.icon} {selected.title}
              </h2>
              <p>{selected.description}</p>
            </div>

            <div className={styles.tierRow}>
              {selected.tiers.map((t, i) => {
                const done = (best[selected.id]?.stars || 0) > i
                return (
                  <div
                    key={TIER_NAMES[i]}
                    className={`${styles.tierBox} ${done ? styles.tierDone : ''}`}
                    style={{ '--tier-color': TIER_COLORS[i] }}
                  >
                    <span>
                      {done ? '✓ ' : ''}
                      {TIER_NAMES[i]}
                    </span>
                    {formatTier(selected, t)}
                  </div>
                )
              })}
            </div>

            <div className={styles.recordLine}>
              {best[selected.id]?.value != null ? (
                <>
                  Seu recorde: <strong>{formatValue(selected, best[selected.id].value)}</strong>
                  <Stars count={best[selected.id].stars} />
                </>
              ) : (
                'Você ainda não completou este desafio.'
              )}
            </div>

            <TrainingSetup
              drill={drill}
              cameraFacing={cameraFacing}
              onCameraChange={setCameraFacing}
              dominantHand={dominantHand}
              onHandChange={setDominantHand}
              showHand={drill.mode === 'shooting' || selected.rules.hand === 'off'}
              handLabel={drill.mode === 'shooting' ? 'Mão de arremesso' : 'Mão dominante (a outra acerta os alvos)'}
              showReps={false}
              aiReady={aiReady}
              startLabel="Aceitar desafio"
              onStart={start}
            />
          </section>
        </div>
      )}

      {running && selected && (
        <TrainingRunner
          user={user}
          drill={drill}
          challenge={selected}
          challengeBest={best}
          dominantHand={dominantHand}
          targetReps={selected.rules.reps ?? 'free'}
          cameraFacing={cameraFacing}
          zone={drill.zone || null}
          onSaved={(u) => u.best && setBest(u.best)}
          onClose={() => {
            setRunning(false)
            setSelected(null)
          }}
        />
      )}

      <BottomNav />
    </main>
  )
}
