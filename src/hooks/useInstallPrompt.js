    'use client'

    import { useEffect, useState } from 'react'

    export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null)
    const [installed, setInstalled] = useState(false)

    useEffect(() => {
        function handleBeforeInstall(event) {
        // Impede o banner automático do navegador — guardamos o evento
        // pra disparar nós mesmos, no momento que quisermos (clique no botão)
        event.preventDefault()
        setDeferredPrompt(event)
        }

        function handleInstalled() {
        setInstalled(true)
        setDeferredPrompt(null)
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstall)
        window.addEventListener('appinstalled', handleInstalled)
        return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
        window.removeEventListener('appinstalled', handleInstalled)
        }
    }, [])

    async function promptInstall() {
        if (!deferredPrompt) return
        deferredPrompt.prompt()
        const choice = await deferredPrompt.userChoice
        if (choice.outcome === 'accepted') setInstalled(true)
        setDeferredPrompt(null)
    }

    // Só mostra o botão se o navegador realmente sinalizou que o app
    // pode ser instalado (isso nunca acontece no Safari/iOS — é
    // limitação da Apple, não bug nosso)
    return { canInstall: !!deferredPrompt && !installed, promptInstall }
    }