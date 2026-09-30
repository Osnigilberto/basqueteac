'use client'

import { useState } from 'react'
import { capitalize } from '@/lib/format'

/** true se `date` cai no mês (ou ano, na temporada) de `viewDate` */
export function isInPeriod(date, period, viewDate) {
  if (period === 'month') {
    return date.getMonth() === viewDate.getMonth() && date.getFullYear() === viewDate.getFullYear()
  }
  return date.getFullYear() === viewDate.getFullYear()
}

/**
 * Período Mensal/Temporada navegável com ◀ ▶ — usado no Início, Stats e
 * PlayerModal. Os dados são sempre filtrados em memória com `inPeriod`.
 */
export function usePeriod(initial = 'month') {
  const [period, setPeriod] = useState(initial) // 'month' | 'season'
  const [viewDate, setViewDate] = useState(() => new Date())

  function changePeriod(next) {
    setPeriod(next)
    setViewDate(new Date()) // volta pro período atual ao trocar de modo
  }

  function shift(step) {
    setViewDate((prev) => {
      const d = new Date(prev)
      if (period === 'month') d.setMonth(d.getMonth() + step)
      else d.setFullYear(d.getFullYear() + step)
      return d
    })
  }

  const now = new Date()
  const isAtPresent = isInPeriod(now, period, viewDate)
  const label =
    period === 'month'
      ? capitalize(viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))
      : `${viewDate.getFullYear()}`

  return {
    period,
    viewDate,
    label,
    isAtPresent,
    changePeriod,
    goPrev: () => shift(-1),
    goNext: () => shift(1),
    /** Filtra por um Timestamp do Firestore */
    inPeriod: (timestamp) => isInPeriod(timestamp.toDate(), period, viewDate),
  }
}
