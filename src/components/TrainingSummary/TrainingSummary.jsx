'use client'

import { Award } from 'lucide-react'
import {
  evaluateElbowAngle,
  evaluateReleaseTime,
  evaluateLegAngle,
  evaluateReleaseAngle,
  formatShotLine,
  shotPct,
} from '@/lib/biomechanics'
import { formatValue, formatTier, TIER_NAMES, TIER_COLORS } from '@/lib/challenges'
import styles from './TrainingSummary.module.css'

function formatDuration(ms) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s`
}

/**
 * Tela de resultados no estilo "Shot Science": números grandes, médias da
 * sessão avaliadas por cor e um gráfico por repetição.
 */
export default function TrainingSummary({
  drill,
  summary,
  shots,
  hits,
  saving,
  challengeResult = null,
  zone = null,
  onToggleShot,
  onSave,
  onDiscard,
  onRetry,
}) {
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
          <Award size={16} /> {challengeResult ? 'Desafio concluído' : 'Treino concluído'}
        </div>
        <h2 className={styles.title}>{challengeResult ? challengeResult.challenge.title : drill.title}</h2>
        <div className={styles.meta}>{formatDuration(summary.durationMs)} de treino</div>

        {challengeResult && <ChallengeBanner result={challengeResult} />}

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
                {formatShotLine(summary.makes, summary.attempts)}
              </span>
              <span className={styles.heroLabel}>
                {zone || 'Cestas'} · {shotPct(summary.makes, summary.attempts)}%
              </span>
            </div>
          )}
        </div>

        {!isTargets && shots.length > 0 && onToggleShot && (
          <>
            <div className={styles.sectionTitle}>Cestas{zone ? ` · ${zone}` : ''}</div>
            <p className={styles.markHint}>
              Toque nos arremessos que caíram. Os que não forem marcados contam como erro.
            </p>
            <div className={styles.shotGrid}>
              {shots.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.shotChip} ${s.made ? styles.shotMade : s.made === false ? styles.shotMiss : ''}`}
                  onClick={() => onToggleShot(s.id)}
                  aria-pressed={!!s.made}
                  aria-label={`Arremesso ${i + 1}: ${s.made ? 'cesta' : 'erro'}`}
                >
                  {s.made ? '✓' : i + 1}
                </button>
              ))}
            </div>
          </>
        )}

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
          {challengeResult ? (
            <button type="button" className={styles.discardBtn} onClick={onRetry} disabled={saving}>
              Tentar de novo
            </button>
          ) : (
            <button type="button" className={styles.discardBtn} onClick={onDiscard} disabled={saving}>
              Descartar
            </button>
          )}
          <button type="button" className={styles.saveBtn} onClick={onSave} disabled={saving || summary.totalReps === 0}>
            {saving ? 'Salvando…' : 'Salvar treino'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChallengeBanner({ result }) {
  const { challenge, value, stars, incomplete, isRecord, unlocked } = result
  return (
    <div className={styles.challenge}>
      <div className={styles.bigStars}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={i < stars ? styles.starOn : ''}
            style={{ '--star-color': TIER_COLORS[i], animationDelay: `${0.25 + i * 0.3}s` }}
          >
            ★
          </span>
        ))}
      </div>

      <div className={styles.challengeValue}>{formatValue(challenge, value)}</div>

      {incomplete ? (
        <p className={styles.challengeNote}>
          Desafio incompleto: faltaram repetições para valer estrelas. Tente de novo até o fim!
        </p>
      ) : (
        <div className={styles.tierRow}>
          {challenge.tiers.map((t, i) => (
            <div
              key={TIER_NAMES[i]}
              className={`${styles.tierBox} ${i < stars ? styles.tierDone : ''}`}
              style={{ '--star-color': TIER_COLORS[i] }}
            >
              <span>{TIER_NAMES[i]}</span>
              {formatTier(challenge, t)}
            </div>
          ))}
        </div>
      )}

      <div className={styles.badges}>
        {isRecord && <span className={styles.badgeRecord}>Novo recorde!</span>}
        {unlocked && <span className={styles.badgeLevel}>Liberou: {unlocked.title}!</span>}
      </div>
    </div>
  )
}
