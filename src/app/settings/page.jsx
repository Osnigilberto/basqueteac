    'use client'

    import { useEffect, useState } from 'react'
    import { useRouter } from 'next/navigation'
    import { signOut } from 'firebase/auth'
    import { ArrowLeft, Moon, Sun, LogOut } from 'lucide-react'
    import { useAuth } from '@/hooks/useAuth'
    import { auth } from '@/lib/firebase'
    import styles from './page.module.css'

    export default function SettingsPage() {
    const router = useRouter()
    const { user, loading } = useAuth()
    
    // Lê a preferência salva já na inicialização (o script no layout já
    // aplicou no <html>, aqui só sincronizamos o estado pra marcar o
    // botão certo como ativo). Sem preferência salva, segue o sistema —
    // mesma lógica do script no layout, pra bater com o que já está na tela.
    const [theme, setTheme] = useState(() => {
        if (typeof window === 'undefined') return 'dark'
        const stored = localStorage.getItem('basqueteac-theme')
        if (stored) return stored
        const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
        return systemPrefersDark ? 'dark' : 'light'
    })

    // Protege a rota
    useEffect(() => {
        if (!loading && !user) router.push('/')
    }, [loading, user, router])

    function applyTheme(value) {
        setTheme(value)
        localStorage.setItem('basqueteac-theme', value)
        document.documentElement.setAttribute('data-theme', value)
    }

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
            <h1 className={styles.title}>Configurações</h1>

            <section className={styles.section}>
            <span className={styles.sectionLabel}>Aparência</span>
            <div className={styles.themeOptions}>
                <button
                className={`${styles.themeButton} ${theme === 'dark' ? styles.themeButtonActive : ''}`}
                onClick={() => applyTheme('dark')}
                >
                <Moon size={18} />
                Escuro
                </button>
                <button
                className={`${styles.themeButton} ${theme === 'light' ? styles.themeButtonActive : ''}`}
                onClick={() => applyTheme('light')}
                >
                <Sun size={18} />
                Claro
                </button>
            </div>
            </section>

            <section className={styles.section}>
            <span className={styles.sectionLabel}>Conta</span>
            <div className={styles.accountRow}>
                <span className={styles.accountEmail}>{user.email}</span>
            </div>
            <button className={styles.signOutButton} onClick={() => signOut(auth)}>
                <LogOut size={16} />
                Sair
            </button>
            </section>

            <p className={styles.footerNote}>BasqueteAC</p>
        </div>
        </main>
    )
    }