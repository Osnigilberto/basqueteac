'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, Target, TrendingUp, UserRound } from 'lucide-react'
import styles from './BottomNav.module.css'

const TABS = [
  { href: '/dashboard', label: 'Início', icon: Home },
  { href: '/game', label: 'Jogos', icon: CalendarDays },
  { href: '/training', label: 'Treinos', icon: Target },
  { href: '/stats', label: 'Stats', icon: TrendingUp },
  { href: '/profile', label: 'Perfil', icon: UserRound },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav}>
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link key={href} href={href} className={`${styles.tab} ${active ? styles.tabActive : ''}`}>
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}