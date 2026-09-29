'use client'

import { useState } from 'react'
import TrainingSession from '@/components/TrainingSession/TrainingSession'
import TrainingSummary from '@/components/TrainingSummary/TrainingSummary'
import { summarizeSession } from '@/lib/biomechanics'
import { scoreChallenge, isBetter, newlyUnlocked } from '@/lib/challenges'
import { saveTrainingSession, saveChallengeResult } from '@/lib/trainingStore'

/**
 * Fluxo completo de um treino (ou desafio): sessão ao vivo -> resultados -> salvar.
 * Usado tanto na aba Treinos quanto na página de Desafios.
 */
export default function TrainingRunner({
  user,
  drill,
  challenge = null,
  challengeBest = {},
  dominantHand,
  targetReps,
  cameraFacing,
  zone = null,
  onSaved,
  onClose,
}) {
  const [stage, setStage] = useState('session')
  const [runKey, setRunKey] = useState(0)
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)

  // Resumo + pontuação do desafio; recalculado quando o atleta marca as cestas
  function buildResult(raw) {
    const summary = summarizeSession(drill, raw)
    let challengeResult = null

    if (challenge) {
      const score = scoreChallenge(challenge, summary)
      const previousBest = challengeBest[challenge.id] || null
      challengeResult = {
        challenge,
        ...score,
        previousBest,
        isRecord: !score.incomplete && isBetter(challenge, score.value, previousBest?.value),
        unlocked: score.incomplete ? null : newlyUnlocked(challenge, challengeBest, score.stars),
      }
    }

    return { raw, summary, challengeResult }
  }

  function handleFinish(raw) {
    setResult(buildResult(raw))
    setStage('summary')
  }

  // Toque na tela de resultado: não marcado -> cesta -> errou -> cesta...
  function toggleShot(id) {
    setResult((prev) =>
      buildResult({
        ...prev.raw,
        shots: prev.raw.shots.map((s) => (s.id === id ? { ...s, made: !s.made } : s)),
      })
    )
  }

  async function save({ retry = false } = {}) {
    if (!user || !result) return
    setSaving(true)

    const updates = {}
    const cr = result.challengeResult
    if (cr && !cr.incomplete) {
      updates.best = await saveChallengeResult(user.uid, cr.challenge, cr)
    }

    if (result.summary.totalReps > 0) {
      updates.history = await saveTrainingSession(user.uid, {
        drillId: drill.id,
        drillTitle: drill.title,
        drillBadge: drill.badge,
        dominantHand,
        ...(zone && { zone }),
        ...(cr && {
          challengeId: cr.challenge.id,
          challengeTitle: cr.challenge.title,
          challengeStars: cr.stars,
        }),
        ...result.summary,
      })
    }

    onSaved?.(updates)
    setSaving(false)

    if (retry) {
      setResult(null)
      setRunKey((k) => k + 1)
      setStage('session')
    } else {
      onClose()
    }
  }

  if (stage === 'session') {
    return (
      <TrainingSession
        key={runKey}
        drill={drill}
        dominantHand={dominantHand}
        targetReps={targetReps}
        cameraFacing={cameraFacing}
        challenge={challenge}
        zone={zone}
        onFinish={handleFinish}
        onCancel={onClose}
      />
    )
  }

  return (
    <TrainingSummary
      drill={drill}
      summary={result.summary}
      shots={result.raw.shots}
      hits={result.raw.hits}
      saving={saving}
      challengeResult={result.challengeResult}
      zone={zone}
      onToggleShot={toggleShot}
      onSave={() => save()}
      onRetry={() => save({ retry: true })}
      onDiscard={onClose}
    />
  )
}
