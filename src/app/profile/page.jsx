    'use client'

    import { useEffect, useRef, useState } from 'react'
    import { useRouter } from 'next/navigation'
    import Image from 'next/image'
    import Script from 'next/script'
    import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
    import { ArrowLeft, CheckCircle2, HelpCircle, Loader2 } from 'lucide-react'
    import { useAuth } from '@/hooks/useAuth'
    import { db } from '@/lib/firebase'
    import BottomNav from '@/components/BottomNav/BottomNav'
    import styles from './page.module.css'

    // Posições de basquete com sigla (padrão internacional) e descrição
    // pra quem não conhece o termo (mostrada no botão "?" de cada linha)
    const POSITIONS = [
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

    // Calcula idade a partir da data de nascimento (string 'YYYY-MM-DD')
    function calculateAge(birthDateStr) {
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

    export default function Profile() {
    const router = useRouter()
    const { user, loading } = useAuth()

    // Estado do formulário
    const [form, setForm] = useState({
        name: '',
        nickname: '',
        city: '',
        birthDate: '',
        height: '',
        weight: '',
        positions: [],
        photoURL: '',
    })
    const [loadingProfile, setLoadingProfile] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // Controla qual tooltip de posição está aberto (só um por vez)
    const [infoOpen, setInfoOpen] = useState(null)
    const positionsRef = useRef(null)

    // Protege a rota: sem usuário logado, volta pra landing
    useEffect(() => {
        if (!loading && !user) router.push('/')
    }, [loading, user, router])

    // Carrega os dados salvos do Firestore pra preencher o formulário
    useEffect(() => {
        if (!user) return

        async function loadProfile() {
        const ref = doc(db, 'users', user.uid)
        const snap = await getDoc(ref)

        if (snap.exists()) {
            const data = snap.data()
            setForm({
            name: data.name ?? user.displayName ?? '',
            nickname: data.nickname ?? '',
            city: data.city ?? '',
            birthDate: data.birthDate ?? '',
            height: data.height ?? '',
            weight: data.weight ?? '',
            positions: data.positions ?? [],
            photoURL: data.photoURL || user.photoURL || '',
            })
        } else {
            setForm((prev) => ({
            ...prev,
            name: user.displayName ?? '',
            photoURL: user.photoURL ?? '',
            }))
        }
        setLoadingProfile(false)
        }

        loadProfile()
    }, [user])

    // Fecha o tooltip de posição ao clicar fora da área de posições
    useEffect(() => {
        function handleClickOutside(event) {
        if (positionsRef.current && !positionsRef.current.contains(event.target)) {
            setInfoOpen(null)
        }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Marca/desmarca uma posição no array de posições selecionadas
    function togglePosition(id) {
        setForm((prev) => ({
        ...prev,
        positions: prev.positions.includes(id)
            ? prev.positions.filter((p) => p !== id)
            : [...prev.positions, id],
        }))
    }

    // Salva a foto direto no Firestore assim que o upload termina —
    // não espera o botão "Salvar perfil", pra não perder o upload se
    // a pessoa sair da página antes de salvar o resto do formulário
    async function savePhoto(url) {
        setForm((prev) => ({ ...prev, photoURL: url }))
        const ref = doc(db, 'users', user.uid)
        await setDoc(ref, { photoURL: url, updatedAt: serverTimestamp() }, { merge: true })
    }

    // Abre o widget de upload do Cloudinary (script carregado via <Script> abaixo)
    function openCloudinaryWidget() {
        if (!window.cloudinary) return

        const widget = window.cloudinary.createUploadWidget(
        {
            cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
            uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
            cropping: true,
            croppingAspectRatio: 1,
            showSkipCropButton: false,
            multiple: false,
            sources: ['local', 'camera'],
            maxFileSize: 5_000_000,
            language: 'pt',
        },
        (error, result) => {
            if (!error && result.event === 'success') {
            savePhoto(result.info.secure_url)
            }
        }
        )

        widget.open()
    }

    // Salva todos os campos do formulário no Firestore
    async function handleSave(event) {
        event.preventDefault()
        setSaving(true)

        const ref = doc(db, 'users', user.uid)
        await setDoc(
        ref,
        {
            name: form.name,
            nickname: form.nickname,
            city: form.city,
            birthDate: form.birthDate,
            height: form.height ? Number(form.height) : null,
            weight: form.weight ? Number(form.weight) : null,
            positions: form.positions,
            updatedAt: serverTimestamp(),
        },
        { merge: true }
        )

        setSaving(false)
        setSaved(true)

        // Mostra o toast por um instante antes de voltar pro dashboard
        setTimeout(() => {
        router.push('/dashboard')
        }, 1200)
    }

    // Evita "flash" de conteúdo antes de confirmar login + carregar dados
    if (loading || !user || loadingProfile) return null

    const age = calculateAge(form.birthDate)

    return (
        <main className={styles.page}>
        {/* Script do widget de upload do Cloudinary, carregado sob demanda */}
        <Script src="https://upload-widget.cloudinary.com/global/all.js" strategy="lazyOnload" />

        <header className={styles.header}>
            <button className={styles.backButton} onClick={() => router.push('/dashboard')}>
            <ArrowLeft size={18} />
            </button>
            <div className={styles.logo}>
            Basquete<span className={styles.logoAccent}>AC</span>
            </div>
        </header>

        <div className={styles.content}>
            <h1 className={styles.title}>Meu perfil</h1>

            <div className={styles.avatarRow}>
            {form.photoURL && (
                <Image
                src={form.photoURL}
                alt={form.name || user.displayName}
                width={72}
                height={72}
                className={styles.avatar}
                />
            )}
            <div className={styles.avatarActions}>
                <button type="button" className={styles.changePhotoButton} onClick={openCloudinaryWidget}>
                Alterar foto
                </button>
                <p className={styles.avatarHint}>JPG ou PNG, recortado em quadrado.</p>
            </div>
            </div>

            <form className={styles.form} onSubmit={handleSave}>
            <label className={styles.field}>
                <span className={styles.label}>Nome completo</span>
                <input
                className={styles.input}
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Seu nome completo"
                />
            </label>

            <label className={styles.field}>
                <span className={styles.label}>Apelido</span>
                <input
                className={styles.input}
                type="text"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                placeholder="Como te chamam na quadra"
                />
            </label>

            <label className={styles.field}>
                <span className={styles.label}>Cidade</span>
                <input
                className={styles.input}
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Sua cidade"
                />
            </label>

            <label className={styles.field}>
                <span className={styles.label}>Data de nascimento</span>
                <input
                className={styles.input}
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                />
                {age !== null && <p className={styles.fieldHint}>{age} anos</p>}
            </label>

            <div className={styles.row}>
                <label className={styles.field}>
                <span className={styles.label}>Altura (cm)</span>
                <input
                    className={styles.input}
                    type="number"
                    min={100}
                    max={250}
                    value={form.height}
                    onChange={(e) => setForm({ ...form, height: e.target.value })}
                    placeholder="178"
                />
                </label>

                <label className={styles.field}>
                <span className={styles.label}>Peso (kg)</span>
                <input
                    className={styles.input}
                    type="number"
                    min={30}
                    max={200}
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    placeholder="75"
                />
                </label>
            </div>

            <div className={styles.field}>
                <span className={styles.label}>Posições</span>
                <div className={styles.checkboxGrid} ref={positionsRef}>
                {POSITIONS.map((position) => (
                    <div key={position.id} className={styles.checkboxOption}>
                    <label className={styles.checkboxLabel}>
                        <input
                        type="checkbox"
                        checked={form.positions.includes(position.id)}
                        onChange={() => togglePosition(position.id)}
                        />
                        {position.label} <span className={styles.positionAbbr}>({position.id})</span>
                    </label>

                    <button
                        type="button"
                        className={styles.infoButton}
                        aria-label={`O que faz ${position.label}`}
                        onClick={() => setInfoOpen(infoOpen === position.id ? null : position.id)}
                    >
                        <HelpCircle size={16} />
                    </button>

                    {infoOpen === position.id && (
                        <div className={styles.infoTooltip} role="tooltip">
                        {position.description}
                        </div>
                    )}
                    </div>
                ))}
                </div>
            </div>

            <button className={styles.saveButton} type="submit" disabled={saving || saved}>
                {saving && <Loader2 size={16} className={styles.spin} />}
                {saving ? 'Salvando...' : 'Salvar perfil'}
            </button>
            </form>
        </div>

        {saved && (
            <div className={styles.toast} role="status">
            <CheckCircle2 size={18} />
            Perfil salvo!
            </div>
        )}

        <BottomNav />
        </main>
    )
    }