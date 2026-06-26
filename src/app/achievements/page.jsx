    'use client'

    import { useEffect } from 'react'
    import { useRouter } from 'next/navigation'
    import { ArrowLeft, Medal } from 'lucide-react'
    import { useAuth } from '@/hooks/useAuth'
    import AchievementBadges from '@/components/AchievementBadges/AchievementBadges'
    import styles from './page.module.css'

    export default function AchievementsPage() {
    const router = useRouter()
    const { user, loading } = useAuth()

    useEffect(() => {
        if (!loading && !user) router.push('/')
    }, [loading, user, router])

    if (loading || !user) return null

    return (
        <main className={styles.page}>
        <header className={styles.header}>
            <button className={styles.backButton} onClick={() => router.back()}>
            <ArrowLeft size={18} />
            </button>
            <div className={styles.logo}>
            Basquete<span className={styles.logoAccent}>AC</span>
            </div>
        </header>

        <div className={styles.content}>
            <h1 className={styles.title}>
            <Medal size={22} />
            Minhas conquistas
            </h1>

            <section className={styles.card}>
            <AchievementBadges uid={user.uid} />
            </section>
        </div>
        </main>
    )
    }