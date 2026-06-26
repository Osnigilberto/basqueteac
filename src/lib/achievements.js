    import { collection, collectionGroup, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
    import { db } from '@/lib/firebase'

    // Busca todo o histórico de jogos finalizados de um jogador, já enriquecido
    // com vitória/derrota e se foi MVP daquele jogo específico — base pra
    // calcular qualquer conquista sem precisar buscar de novo a cada uma
    export async function fetchPlayerAchievementData(uid) {
    const statsQuery = query(collectionGroup(db, 'stats'), where('uid', '==', uid))
    const snap = await getDocs(statsQuery)

    const gameEntries = []
    const h2hTally = {} // uid do adversário -> número de vitórias contra ele

    await Promise.all(
        snap.docs.map(async (statDoc) => {
        try {
            const gameRef = statDoc.ref.parent.parent
            const gameSnap = await getDoc(gameRef)
            if (!gameSnap.exists() || gameSnap.data().status !== 'finished') return

            const game = gameSnap.data()
            const data = statDoc.data()
            const isTeamA = data.team === 'A'
            const ownTeam = isTeamA ? game.teamA : game.teamB
            const oppTeam = isTeamA ? game.teamB : game.teamA
            const won = ownTeam.score > oppTeam.score

            // MVP daquele jogo específico — precisa olhar os stats de TODOS
            // os jogadores daquele jogo, não só os do uid pesquisado
            const allStatsSnap = await getDocs(collection(db, 'games', gameRef.id, 'stats'))
            const totalsByPlayer = allStatsSnap.docs.map((d) => {
            const s = d.data()
            return {
                uid: s.uid,
                total: (s.points || 0) + (s.rebounds || 0) + (s.assists || 0) + (s.blocks || 0) + (s.steals || 0),
            }
            })
            const maxTotal = Math.max(0, ...totalsByPlayer.map((t) => t.total))
            const isMvp = maxTotal > 0 && totalsByPlayer.some((t) => t.uid === uid && t.total === maxTotal)

            if (won) {
            oppTeam.players.forEach((oppUid) => {
                h2hTally[oppUid] = (h2hTally[oppUid] || 0) + 1
            })
            }

            gameEntries.push({
            gameId: gameRef.id,
            date: game.date,
            points: data.points || 0,
            rebounds: data.rebounds || 0,
            assists: data.assists || 0,
            blocks: data.blocks || 0,
            steals: data.steals || 0,
            threePointers: data.threePointers || 0,
            won,
            isMvp,
            })
        } catch (error) {
            console.error('[fetchPlayerAchievementData → jogo]', error)
        }
        })
    )

    gameEntries.sort((a, b) => a.date.toMillis() - b.date.toMillis())
    return { gameEntries, h2hTally }
    }

    // Conta quantas categorias bateram 10+ num jogo — base do double/triple/
    // quadruple/quintuple-double
    function countDoubleDigits(g) {
    return [g.points, g.rebounds, g.assists, g.blocks, g.steals].filter((v) => v >= 10).length
    }

    // Verifica se existe uma sequência de `length` jogos seguidos em que
    // `field` bateu o `threshold` (ex: 3 jogos seguidos com 10+ pontos)
    function hasStreak(games, field, threshold, length) {
    let streak = 0
    for (const g of games) {
        if (g[field] >= threshold) {
        streak += 1
        if (streak >= length) return true
        } else {
        streak = 0
        }
    }
    return false
    }

    // Calcula as 20 conquistas a partir do histórico já buscado
    export function computeAchievements({ gameEntries, h2hTally }) {
    const gamesPlayed = gameEntries.length

    const totals = gameEntries.reduce(
        (acc, g) => ({
        points: acc.points + g.points,
        rebounds: acc.rebounds + g.rebounds,
        assists: acc.assists + g.assists,
        blocks: acc.blocks + g.blocks,
        steals: acc.steals + g.steals,
        threePointers: acc.threePointers + g.threePointers,
        }),
        { points: 0, rebounds: 0, assists: 0, blocks: 0, steals: 0, threePointers: 0 }
    )

    const maxRivalWins = Math.max(0, ...Object.values(h2hTally))
    const mvpCount = gameEntries.filter((g) => g.isMvp).length

    return [
        {
        id: 'double-double',
        label: 'Double-double',
        icon: 'GiBasketballBall',
        description: '10+ em duas estatísticas no mesmo jogo.',
        earned: gameEntries.some((g) => countDoubleDigits(g) >= 2),
        },
        {
        id: 'triple-double',
        label: 'Triple-double',
        icon: 'GiDiamondTrophy',
        description: '10+ em três estatísticas no mesmo jogo.',
        earned: gameEntries.some((g) => countDoubleDigits(g) >= 3),
        },
        {
        id: 'quadruple-double',
        label: 'Quadruple-double',
        icon: 'GiLaurelsTrophy',
        description: '10+ em quatro estatísticas no mesmo jogo.',
        earned: gameEntries.some((g) => countDoubleDigits(g) >= 4),
        },
        {
        id: 'quintuple-double',
        label: 'Quintuple-double',
        icon: 'GiCrownedSkull',
        description: '10+ nas cinco estatísticas no mesmo jogo. Raríssimo!',
        earned: gameEntries.some((g) => countDoubleDigits(g) >= 5),
        },
        {
        id: 'high-scorer-game',
        label: 'Cestinha',
        icon: 'GiBullseye',
        description: '20+ pontos em um único jogo.',
        earned: gameEntries.some((g) => g.points >= 20),
        },
        {
        id: 'sharpshooter-game',
        label: 'Bombardeiro',
        icon: 'GiArrowDunk',
        description: '3 ou mais cestas de três em um único jogo.',
        earned: gameEntries.some((g) => g.threePointers >= 3),
        },
        {
        id: 'wall',
        label: 'Muralha',
        icon: 'GiShield',
        description: '5 ou mais tocos em um único jogo.',
        earned: gameEntries.some((g) => g.blocks >= 5),
        },
        {
        id: 'quick-hands',
        label: 'Mãos rápidas',
        icon: 'GiNinjaHeroicStance',
        description: '5 ou mais roubos de bola em um único jogo.',
        earned: gameEntries.some((g) => g.steals >= 5),
        },
        {
        id: 'playmaker-game',
        label: 'Garçom',
        icon: 'GiHighFive',
        description: '8 ou mais assistências em um único jogo.',
        earned: gameEntries.some((g) => g.assists >= 8),
        },
        {
        id: 'on-fire',
        label: 'Em chamas',
        icon: 'GiFlame',
        description: '3 jogos seguidos com 10 ou mais pontos.',
        earned: hasStreak(gameEntries, 'points', 10, 3),
        },
        {
        id: 'rival-dominated',
        label: 'Rival dominado',
        icon: 'GiTrophy',
        description: 'Venceu o mesmo adversário 3 ou mais vezes no confronto direto.',
        earned: maxRivalWins >= 3,
        },
        {
        id: 'mvp',
        label: 'MVP',
        icon: 'GiLaurelCrown',
        description: 'Foi MVP de pelo menos 1 jogo.',
        earned: mvpCount >= 1,
        },
        {
        id: 'mvp-streak',
        label: 'MVP em série',
        icon: 'GiCrownedHeart',
        description: 'Foi MVP em 3 ou mais jogos diferentes.',
        earned: mvpCount >= 3,
        },
        {
        id: 'scorer-career',
        label: 'Artilheiro',
        icon: 'GiTrophyCup',
        description: '100 pontos somados na carreira.',
        earned: totals.points >= 100,
        },
        {
        id: 'rebounder-career',
        label: 'Reboteiro',
        icon: 'GiWeightLiftingUp',
        description: '50 rebotes somados na carreira.',
        earned: totals.rebounds >= 50,
        },
        {
        id: 'assister-career',
        label: 'Assistente',
        icon: 'GiOpenPalm',
        description: '50 assistências somadas na carreira.',
        earned: totals.assists >= 50,
        },
        {
        id: 'blocker-career',
        label: 'Xerife',
        icon: 'GiPoliceBadge',
        description: '25 tocos somados na carreira.',
        earned: totals.blocks >= 25,
        },
        {
        id: 'stealer-career',
        label: 'Ladrão de bolas',
        icon: 'GiRobberHand',
        description: '25 roubos de bola somados na carreira.',
        earned: totals.steals >= 25,
        },
        {
        id: 'veteran',
        label: 'Veterano',
        icon: 'GiMedal',
        description: '10 jogos disputados.',
        earned: gamesPlayed >= 10,
        },
        {
        id: 'sharpshooter-career',
        label: 'Artilheiro de três',
        icon: 'GiBowArrow',
        description: '20 cestas de três somadas na carreira.',
        earned: totals.threePointers >= 20,
        },
    ]
    }