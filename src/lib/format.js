// src/lib/format.js
// Formatação e constantes compartilhadas entre as telas

export const POSITIONS = [
  {
    id: 'PG',
    label: 'Armador',
    description: 'Organiza o ataque, fica com a bola na mão na maior parte do tempo e inicia as jogadas.',
  },
  {
    id: 'SG',
    label: 'Ala-Armador',
    description: 'Versátil pela quadra, costuma ser bom arremessador e também ajuda a armar jogadas.',
  },
  {
    id: 'SF',
    label: 'Ala',
    description: 'Equilíbrio entre ataque e defesa, joga tanto por dentro quanto por fora.',
  },
  {
    id: 'PF',
    label: 'Ala-Pivô',
    description: 'Joga mais próximo da cesta, disputa rebotes e ajuda no garrafão.',
  },
  {
    id: 'C',
    label: 'Pivô',
    description: 'Fica perto da cesta, disputa rebotes e ajuda a proteger o garrafão dos arremessos adversários.',
  },
]

export const POSITION_LABELS = Object.fromEntries(POSITIONS.map((p) => [p.id, p.label]))

export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** "12/03 · 19:30" */
export function formatShortDate(timestamp) {
  const date = timestamp.toDate()
  const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} · ${timeStr}`
}

/** "sexta-feira, 12 de março · 19:30" */
export function formatGameDate(timestamp) {
  const date = timestamp.toDate()
  const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} · ${timeStr}`
}

/** Idade a partir da data de nascimento ('YYYY-MM-DD') */
export function calculateAge(birthDateStr) {
  if (!birthDateStr) return null
  const birthDate = new Date(birthDateStr)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const hasNotHadBirthdayThisYear =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  if (hasNotHadBirthdayThisYear) age -= 1
  return age
}

/** Nome de exibição de um perfil: apelido, nome ou "Jogador" */
export function displayName(profile) {
  return profile?.nickname || profile?.name || 'Jogador'
}

/** 'AAAA-MM-DD' no fuso local (valor de <input type="date">) */
export function toDateInput(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Próxima meia hora cheia a partir de `date`: { date: 'AAAA-MM-DD', time: 'HH:MM' } */
export function nextHalfHour(date = new Date()) {
  const d = new Date(date)
  d.setSeconds(0, 0)
  const m = d.getMinutes()
  if (m > 0) d.setMinutes(m <= 30 ? 30 : 60) // 60 passa para a próxima hora
  const pad = (n) => String(n).padStart(2, '0')
  return { date: toDateInput(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}
