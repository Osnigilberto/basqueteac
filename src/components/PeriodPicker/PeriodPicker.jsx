'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './PeriodPicker.module.css'

/**
 * Seletor Mensal/Temporada com navegação ◀ ▶.
 * Recebe o objeto retornado por usePeriod().
 */
export default function PeriodPicker({ period, compact = false }) {
  return (
    <div className={`${styles.wrapper} ${compact ? styles.compact : ''}`}>
      <div className={styles.toggle}>
        <button
          type="button"
          className={`${styles.toggleButton} ${period.period === 'month' ? styles.toggleButtonActive : ''}`}
          onClick={() => period.changePeriod('month')}
        >
          Mensal
        </button>
        <button
          type="button"
          className={`${styles.toggleButton} ${period.period === 'season' ? styles.toggleButtonActive : ''}`}
          onClick={() => period.changePeriod('season')}
        >
          Temporada
        </button>
      </div>

      <div className={styles.nav}>
        <button type="button" className={styles.navButton} onClick={period.goPrev} aria-label="Período anterior">
          <ChevronLeft size={18} />
        </button>
        <span className={styles.navLabel}>{period.label}</span>
        <button
          type="button"
          className={styles.navButton}
          onClick={period.goNext}
          disabled={period.isAtPresent}
          aria-label="Próximo período"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
