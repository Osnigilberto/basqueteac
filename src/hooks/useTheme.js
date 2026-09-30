'use client'

import { useState } from 'react'

const STORAGE_KEY = 'basqueteac-theme'

/**
 * Tema claro/escuro. O script do layout já aplicou o tema no <html> antes
 * de pintar; aqui só sincronizamos o estado (sem preferência salva, segue
 * o sistema — mesma lógica do script).
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) return stored
    } catch (e) {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  function applyTheme(value) {
    setTheme(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', value)
  }

  return [theme, applyTheme]
}
