'use client'

import { useEffect, useState } from 'react'
import * as GiIcons from 'react-icons/gi'
import { X } from 'lucide-react'
import { fetchPlayerAchievementData, computeAchievements } from '@/lib/achievements'
import styles from './AchievementBadges.module.css'

export default function AchievementBadges({ uid }) {
  const [badges, setBadges] = useState(null)
  const [loadingBadges, setLoadingBadges] = useState(true)
  const [selectedBadge, setSelectedBadge] = useState(null)

  useEffect(() => {
    if (!uid) return

    async function load() {
      try {
        const data = await fetchPlayerAchievementData(uid)
        setBadges(computeAchievements(data))
      } catch (error) {
        console.error('[AchievementBadges]', error)
      } finally {
        setLoadingBadges(false)
      }
    }

    load()
  }, [uid])

  // Fecha o popup com a tecla Esc
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') setSelectedBadge(null)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  if (loadingBadges) return <p className={styles.emptyText}>Carregando conquistas...</p>
  if (!badges) return null

  const earnedCount = badges.filter((b) => b.earned).length
  const SelectedIcon = selectedBadge ? GiIcons[selectedBadge.icon] : null

  return (
    <div>
      <p className={styles.summary}>
        {earnedCount} de {badges.length} conquistas desbloqueadas
      </p>

      <div className={styles.grid}>
        {badges.map((badge) => {
          const Icon = GiIcons[badge.icon]
          return (
            <button
              key={badge.id}
              type="button"
              className={`${styles.badge} ${badge.earned ? styles.badgeEarned : styles.badgeLocked}`}
              onClick={() => setSelectedBadge(badge)}
            >
              {Icon && <Icon size={26} />}
              <span className={styles.badgeLabel}>{badge.label}</span>
            </button>
          )
        })}
      </div>

      {selectedBadge && (
        <div className={styles.overlay} onClick={() => setSelectedBadge(null)}>
          <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.closeButton}
              onClick={() => setSelectedBadge(null)}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            <div
              className={`${styles.popupIcon} ${
                selectedBadge.earned ? styles.popupIconEarned : styles.popupIconLocked
              }`}
            >
              {SelectedIcon && <SelectedIcon size={48} />}
            </div>

            <h3 className={styles.popupTitle}>{selectedBadge.label}</h3>

            <span
              className={`${styles.popupStatus} ${
                selectedBadge.earned ? styles.statusEarned : styles.statusLocked
              }`}
            >
              {selectedBadge.earned ? 'Desbloqueada' : 'Bloqueada'}
            </span>

            <p className={styles.popupDescription}>{selectedBadge.description}</p>
          </div>
        </div>
      )}
    </div>
  )
}