  'use client'

  import { useEffect, useState } from 'react'
  import { useRouter } from 'next/navigation'
  import { signInWithPopup } from 'firebase/auth'
  import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    Timestamp,
    where,
  } from 'firebase/firestore'
  import { BarChart3, Timer, UserRound, CalendarDays, MapPin } from 'lucide-react'
  import { auth, googleProvider, db } from '@/lib/firebase'
  import styles from './page.module.css'

  function formatGameDate(timestamp) {
    const date = timestamp.toDate()
    const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return { dateStr, timeStr }
  }

  export default function Home() {
    const router = useRouter()
    const [highlightGame, setHighlightGame] = useState(null)
    const [loadingGame, setLoadingGame] = useState(true)

    const handleGoogleLogin = async () => {
      try {
        await signInWithPopup(auth, googleProvider)
        router.push('/dashboard')
      } catch (error) {
        console.error('Erro no login:', error)
      }
    }

    // Busca o jogo a destacar, sem precisar estar logado:
    // 1) algum jogo "live" agora, 2) senão o próximo "scheduled"
    useEffect(() => {
      async function fetchHighlightGame() {
        try {
          const liveQuery = query(collection(db, 'games'), where('status', '==', 'live'), limit(1))
          const liveSnap = await getDocs(liveQuery)

          if (!liveSnap.empty) {
            const gameDoc = liveSnap.docs[0]
            setHighlightGame({ id: gameDoc.id, ...gameDoc.data() })
            setLoadingGame(false)
            return
          }

          const scheduledQuery = query(
            collection(db, 'games'),
            where('status', '==', 'scheduled'),
            where('date', '>=', Timestamp.now()),
            orderBy('date', 'asc'),
            limit(1)
          )
          const scheduledSnap = await getDocs(scheduledQuery)

          if (!scheduledSnap.empty) {
            const gameDoc = scheduledSnap.docs[0]
            setHighlightGame({ id: gameDoc.id, ...gameDoc.data() })
          }
        } catch (error) {
          console.error('Erro ao buscar próximo jogo:', error)
        } finally {
          setLoadingGame(false)
        }
      }

      fetchHighlightGame()
    }, [])

    const isLive = highlightGame?.status === 'live'
    const { dateStr, timeStr } = highlightGame ? formatGameDate(highlightGame.date) : {}

    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div className={styles.logo}>
            Basquete<span className={styles.logoAccent}>AC</span>
          </div>
          <button className={styles.headerLogin} onClick={handleGoogleLogin}>
            Entrar
          </button>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroText}>
            <div className={styles.eyebrow}>
              <span className={styles.liveDot} />
              Todos os jogos, em tempo real
            </div>
            <h1 className={styles.title}>
              Basquete<span className={styles.titleAccent}>AC</span>
            </h1>
            <p className={styles.subtitle}>
              Cada ponto, cada roubo de bola, cada toco. A estatística da nossa
              pelada, registrada em tempo real, direto da quadra.
            </p>
            <button className={styles.loginButton} onClick={handleGoogleLogin}>
              <GoogleIcon />
              Entrar com Google
            </button>
          </div>

          <div className={styles.statCard} aria-hidden="true">
            <div className={styles.statCardHeader}>
              {isLive ? (
                <>
                  <span className={styles.liveDot} />
                  EM ANDAMENTO
                </>
              ) : (
                <>
                  <CalendarDays size={14} />
                  PRÓXIMO JOGO
                </>
              )}
            </div>

            {loadingGame ? (
              <div className={styles.statCardDay}>Carregando...</div>
            ) : highlightGame ? (
              <>
                {isLive ? (
                  <div className={styles.statCardScore}>
                    {highlightGame.teamA.score} - {highlightGame.teamB.score}
                  </div>
                ) : (
                  <>
                    <div className={styles.statCardDay}>{dateStr}</div>
                    <div className={styles.statCardDate}>{timeStr}</div>
                  </>
                )}
                <div className={styles.statCardDivider} />
                <div className={styles.statCardLocation}>
                  <MapPin size={15} />
                  {highlightGame.location}
                </div>
              </>
            ) : (
              <>
                <div className={styles.statCardDay}>Nenhum jogo agendado</div>
                <div className={styles.statCardDivider} />
                <div className={styles.statCardLocation}>
                  <MapPin size={15} />
                  Fique de olho por aqui
                </div>
              </>
            )}
          </div>
        </section>

        <section className={styles.features}>
          <div className={styles.feature}>
            <BarChart3 className={styles.featureIcon} size={22} />
            <div>
              <h3>Estatísticas completas</h3>
              <p>Pontos, rebotes, assistências, tocos e roubos — de cada jogador, em cada jogo.</p>
            </div>
          </div>
          <div className={styles.feature}>
            <Timer className={styles.featureIcon} size={22} />
            <div>
              <h3>Timer de posse</h3>
              <p>O ginásio não tem relógio de 24 segundos. Agora tem — com buzzer sonoro quando zera.</p>
            </div>
          </div>
          <div className={styles.feature}>
            <UserRound className={styles.featureIcon} size={22} />
            <div>
              <h3>Perfil de jogador</h3>
              <p>Foto, apelido, posições e cidade. Seu cartão dentro do grupo.</p>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          BasqueteAC — feito para quem joga, não pra quem vende.
        </footer>
      </main>
    )
  }

  function GoogleIcon() {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    )
  }