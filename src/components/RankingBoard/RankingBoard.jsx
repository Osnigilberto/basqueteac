'use client'

import Image from 'next/image'
import { RANKING_CATEGORIES } from '@/lib/gameStats'
import styles from './RankingBoard.module.css'

/**
 * Listas de ranking por categoria (resultado de computeRankings).
 * `categories` permite mostrar só algumas (ex.: no Início).
 */
export default function RankingBoard({ rankings, categories = RANKING_CATEGORIES, onSelect }) {
  return (
    <div className={styles.grid}>
      {categories.map((cat) => (
        <div key={cat.key} className={styles.category}>
          <span className={styles.categoryLabel}>{cat.label}</span>

          {rankings[cat.key].length === 0 ? (
            <p className={styles.empty}>Sem dados nesse período.</p>
          ) : (
            rankings[cat.key].map((p) => (
              <button key={p.uid} type="button" className={styles.row} onClick={() => onSelect?.(p.uid)}>
                <span className={`${styles.position} ${p.rank === 1 ? styles.first : ''}`}>{p.rank}</span>
                {p.photoURL ? (
                  <Image src={p.photoURL} alt={p.name} width={24} height={24} className={styles.avatar} />
                ) : (
                  <span className={styles.avatarFallback}>{p.name.charAt(0)}</span>
                )}
                <span className={styles.name}>{p.name}</span>
                <span className={styles.value}>{p.value}</span>
              </button>
            ))
          )}
        </div>
      ))}
    </div>
  )
}
