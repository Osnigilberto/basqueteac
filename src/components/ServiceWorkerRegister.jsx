    'use client'

    import { useEffect } from 'react'

    export default function ServiceWorkerRegister() {
    useEffect(() => {
        // Só registra em produção — em desenvolvimento, o service worker pode
        // cachear arquivos antigos e bagunçar o Hot Reload do Next.js
        if (process.env.NODE_ENV !== 'production') return

        if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch((error) => {
            console.error('[ServiceWorker] Falha ao registrar:', error)
        })
        }
    }, [])

    return null
    }