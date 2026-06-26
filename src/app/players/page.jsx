    'use client'

    import { useEffect, useMemo, useState } from 'react'
    import { useRouter } from 'next/navigation'
    import Image from 'next/image'
    import { collection, getDocs, orderBy, query } from 'firebase/firestore'
    import { Search } from 'lucide-react'
    import { useAuth } from '@/hooks/useAuth'
    import { db } from '@/lib/firebase'
    import BottomNav from '@/components/BottomNav/BottomNav'
    import PlayerModal from '@/components/PlayerModal/PlayerModal'
    import styles from './page.module.css'

    const POSITION_LABELS = {
    PG: 'Armador',
    SG: 'Ala-Armador',
    SF: 'Ala',
    PF: 'Ala-Pivô',
    C: 'Pivô',
    }

    export default function PlayersPage() {
    const router = useRouter()
    const { user, loading } = useAuth()

    const [players, setPlayers] = useState([])
    const [loadingPlayers, setLoadingPlayers] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedPlayerUid, setSelectedPlayerUid] = useState(null)

    useEffect(() => {
        if (!loading && !user) router.push('/')
    }, [loading, user, router])

    // Busca todos os jogadores cadastrados no app, ordenados por nome
    useEffect(() => {
        if (!user) return

        async function fetchPlayers() {
        try {
            const snap = await getDocs(query(collection(db, 'users'), orderBy('name')))
            setPlayers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
        } catch (error) {
            console.error('[fetchPlayers]', error)
        } finally {
            setLoadingPlayers(false)
        }
        }

        fetchPlayers()
    }, [user])

    // Filtro local pelo nome/apelido — sem precisar de query nova no Firestore
    const filteredPlayers = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return players
        return players.filter((p) => (p.nickname || p.name || '').toLowerCase().includes(term))
    }, [players, search])

    if (loading || !user) return null

    return (
        <main className={styles.page}>
        <header className={styles.header}>
            <div className={styles.logo}>
            Basquete<span className={styles.logoAccent}>AC</span>
            </div>
        </header>

        <div className={styles.content}>
            <h1 className={styles.title}>Jogadores</h1>

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

            {loadingPlayers ? (
            <p className={styles.emptyText}>Carregando...</p>
            ) : filteredPlayers.length === 0 ? (
            <p className={styles.emptyText}>Nenhum jogador encontrado.</p>
            ) : (
            <div className={styles.playerList}>
                {filteredPlayers.map((player) => (
                <button
                    key={player.uid}
                    className={styles.playerRow}
                    onClick={() => setSelectedPlayerUid(player.uid)}
                >
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
                    <span className={styles.playerName}>
                        {player.nickname || player.name || 'Jogador'}
                    </span>
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
        </div>

        <BottomNav />

        {selectedPlayerUid && (
            <PlayerModal uid={selectedPlayerUid} onClose={() => setSelectedPlayerUid(null)} />
        )}
        </main>
    )
    }