'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Search } from 'lucide-react'
import { POSITION_LABELS, displayName } from '@/lib/format'
import styles from './PlayersList.module.css'

/**
 * Lista de atletas do app com busca por nome/apelido (antiga página
 * /players, agora uma aba do Stats). Recebe o mapa de perfis já carregado
 * por fetchGroupData — sem consulta extra.
 */
export default function PlayersList({ profiles, onSelect }) {
  const [search, setSearch] = useState('')

  const players = useMemo(
    () =>
      Object.entries(profiles || {})
        .map(([uid, p]) => ({ uid, ...p }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')),
    [profiles]
  )

  // Filtro local pelo nome/apelido
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return players
    return players.filter((p) => displayName(p).toLowerCase().includes(term) || (p.name || '').toLowerCase().includes(term))
  }, [players, search])

  return (
    <>
      <div className={styles.searchBox}>
        <Search size={16} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Buscar jogador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!profiles ? (
        <p className={styles.emptyText}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className={styles.emptyText}>Nenhum jogador encontrado.</p>
      ) : (
        <div className={styles.playerList}>
          {filtered.map((player) => (
            <button key={player.uid} className={styles.playerRow} onClick={() => onSelect(player.uid)}>
              {player.photoURL && (
                <Image
                  src={player.photoURL}
                  alt={player.name || ''}
                  width={40}
                  height={40}
                  className={styles.playerAvatar}
                />
              )}
              <div className={styles.playerInfo}>
                <span className={styles.playerName}>{displayName(player)}</span>
                {player.city && <span className={styles.playerCity}>{player.city}</span>}
              </div>
              {player.positions?.length > 0 && (
                <span className={styles.playerPosition}>
                  {POSITION_LABELS[player.positions[0]] || player.positions[0]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
