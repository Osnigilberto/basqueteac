'use client'

import { Award } from 'lucide-react'
import {
  evaluateElbowAngle,
  evaluateReleaseTime,
  evaluateLegAngle,
  evaluateReleaseAngle,
} from '@/lib/biomechanics'
import styles from './TrainingSummary.module.css'

function formatDuration(ms) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s`
}

/**
 * Tela de resultados no estilo "Shot Science": números grandes, médias da
 * sessão avaliadas por cor e um gráfico por repetição.
 */
export default function TrainingSummary({ drill, summary, shots, hits, saving, onSave, onDiscard }) {
  const isTargets = summary.mode === 'targets'
  const score = summary.consistencyScore
  const quote = score >= 80 ? drill.quotes.high : score >= 55 ? drill.quotes.mid : drill.quotes.low

  const bars = isTargets
    ? hits.map((h, i) => ({ key: i, value: h.reaction, color: '#3B82F6', label: (h.reaction / 1000).toFixed(1) }))
    : shots.map((s) => ({
        key: s.id,
        value: s.releaseTime || 0,
        color: evaluateElbowAngle(s.elbowAngle).color,
        mark: s.made == null ? null : s.made ? '✓' : '✗',
      }))
  const maxBar = Math.max(1, ...bars.map((b) => b.value))

  const tiles = isTargets
    ? [
        { label: 'Reação média', value: summary.avgReaction != null ? (summary.avgReaction / 1000).toFixed(2) : '--', unit: 's' },
        { label: 'Melhor reação', value: summary.bestReaction != null ? (summary.bestReaction / 1000).toFixed(2) : '--', unit: 's' },
        { label: 'Perdidos', value: summary.misses, unit: '' },
        {
          label: 'Ritmo',
          value: summary.durationMs > 1000 ? Math.round((summary.totalReps / summary.durationMs) * 60000) : '--',
          unit: '/min',
        },
      ]
    : [
        {
          label: 'Tempo de soltura',
          value: summary.avgReleaseTime != null ? (summary.avgReleaseTime / 1000).toFixed(2) : '--',
          unit: 's',
          ev: evaluateReleaseTime(summary.avgReleaseTime),
        },
        { label: 'Ângulo das pernas', value: summary.avgLegAngle ?? '--', unit: '°', ev: evaluateLegAngle(summary.avgLegAngle) },
        {
          label: 'Ângulo de soltura',
          value: summary.avgReleaseAngle ?? '--',
          unit: '°',
          ev: evaluateReleaseAngle(summary.avgReleaseAngle),
        },
        {
          label: 'Cotovelo (set point)',
          value: summary.avgElbowAngle ?? '--',
          unit: '°',
          ev: summary.avgElbowAngle != null ? evaluateElbowAngle(summary.avgElbowAngle) : null,
        },
        { label: 'Maior salto', value: summary.maxJump ?? '--', unit: 'cm', hint: 'estimado' },
      ]

  return (
    <div className={styles.wrapper} style={{ '--drill-color': drill.color }}>
      <div className={styles.inner}>
        <div className={styles.eyebrow}>
          <Award size={16} /> Treino concluído
        </div>
        <h2 className={styles.title}>{drill.title}</h2>
        <div className={styles.meta}>{formatDuration(summary.durationMs)} de treino</div>

        <div className={styles.hero}>
          <div className={styles.heroStat}>
            <span className={styles.heroValue}>{summary.totalReps}</span>
            <span className={styles.heroLabel}>{isTargets ? 'Alvos' : 'Arremessos'}</span>
          </div>
          <div className={styles.heroStat}>
            <span className={styles.heroValue} style={{ color: score >= 80 ? '#34C759' : '#F4541B' }}>
              {score}
              <small>%</small>
            </span>
            <span className={styles.heroLabel}>{isTargets ? 'Precisão' : 'Consistência'}</span>
          </div>
          {!isTargets && summary.attempts > 0 && (
            <div className={styles.heroStat}>
              <span className={styles.heroValue}>
                {Math.round((summary.makes / summary.attempts) * 100)}
                <small>%</small>
              </span>
              <span className={styles.heroLabel}>
                Aproveit. {summary.makes}/{summary.attempts}
              </span>
            </div>
          )}
        </div>

        <div className={styles.sectionTitle}>{isTargets ? 'Desempenho' : 'Shot Science'}</div>
        <div className={styles.tiles}>
          {tiles.map((t) => (
            <div key={t.label} className={styles.tile} style={{ '--tile-color': t.ev?.color || 'rgba(255,255,255,0.2)' }}>
              <span className={styles.tileLabel}>{t.label}</span>
              <span className={styles.tileValue}>
                {t.value}
                {t.value !== '--' && <small>{t.unit}</small>}
              </span>
              {(t.ev || t.hint) && (
                <span className={styles.tileEval} style={{ color: t.ev?.color }}>
                  {t.ev && t.value !== '--' ? t.ev.label : t.hint}
                </span>
              )}
            </div>
          ))}
        </div>

        {bars.length > 0 && (
          <>
            <div className={styles.sectionTitle}>
              {isTargets ? 'Tempo de reação por alvo' : 'Tempo de soltura por arremesso'}
            </div>
            <div className={styles.chart}>
              {bars.map((b) => (
                <div key={b.key} className={styles.barCol}>
                  <span className={styles.barMark}>{b.mark}</span>
                  <div
                    className={styles.bar}
                    style={{ height: `${Math.max(6, (b.value / maxBar) * 100)}%`, background: b.color }}
                  />
                </div>
              ))}
            </div>
            {!isTargets && (
              <div className={styles.legend}>
                <span><i style={{ background: '#34C759' }} /> Cotovelo ideal</span>
                <span><i style={{ background: '#F59E0B' }} /> Fechado</span>
                <span><i style={{ background: '#FF3B30' }} /> Aberto</span>
              </div>
            )}
          </>
        )}

        <blockquote className={styles.quote}>
          <strong>Coach Carter</strong>
          {quote}
        </blockquote>

        <div className={styles.actions}>
          <button type="button" className={styles.discardBtn} onClick={onDiscard} disabled={saving}>
            Descartar
          </button>
          <button type="button" className={styles.saveBtn} onClick={onSave} disabled={saving || summary.totalReps === 0}>
            {saving ? 'Salvando…' : 'Salvar treino'}
          </button>
        </div>
      </div>
    </div>
  )
}
