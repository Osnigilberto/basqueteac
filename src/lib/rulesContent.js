    // src/lib/rulesContent.js
    // Conteúdo das regras exibidas no modal de ajuda ("?") do BasqueteAC.
    // Separado em "oficial" (FIBA - Official Basketball Rules 2024) e "casa"
    // (regras próprias do grupo). Edite livremente sem tocar no componente.

    export const RULES_CONTENT = {
    "5x5": {
        label: "5x5",
        official: {
        title: "Regras oficiais (FIBA)",
        items: [
            "Cada time em quadra tem 5 jogadores.",
            "Cesta de dentro do arco de 3 pontos vale 2 pontos.",
            "Cesta de fora do arco de 3 pontos vale 3 pontos.",
            "Lance livre vale 1 ponto.",
            "O time com posse de bola precisa arremessar antes que o tempo de posse se esgote (regra oficial FIBA: 24 segundos).",
            "Ao recuperar a bola no próprio campo de defesa, o time tem até 8 segundos para levá-la ao campo de ataque.",
            "Nenhum jogador atacante pode ficar mais de 3 segundos seguidos dentro da área restrita (garrafão) do adversário enquanto seu time tem a posse.",
            "Passos (caminhada): o jogador não pode dar mais de 2 passos sem quicar a bola. Drible duplo: uma vez que o jogador para de driblar, não pode driblar de novo.",
            "Rebote: quando um jogador recupera a posse da bola após um arremesso errado — pode ser rebote ofensivo (time que arremessou) ou defensivo (time adversário).",
            "Depois que a bola toca o aro: se o time adversário pegar o rebote, a posse de bola reinicia com o tempo cheio (24 segundos). Se o próprio time que arremessou pegar o rebote (rebote ofensivo), a posse reinicia com apenas 14 segundos.",
            "Interferência (goaltending): nenhum jogador pode tocar a bola quando ela está descendo em direção ao aro em trajetória de entrar na cesta, ou já dentro do cilindro do aro.",
        ],
        },
        house: {
        title: "Regras da casa (BasqueteAC)",
        items: [
            "Nenhuma regra da casa nesse modo — segue 100% o oficial FIBA, incluindo os 24 segundos de posse.",
        ],
        },
    },

    "3x3": {
        label: "3x3",
        official: {
        title: "Regras oficiais (FIBA 3x3)",
        note: null,
        items: [
            "Times de 3 jogadores em quadra + 1 reserva.",
            "Jogo em meia quadra, com uma cesta única — os times revezam ataque e defesa.",
            "Cesta de dentro do arco (ou lance livre) vale 1 ponto. Cesta de fora do arco vale 2 pontos.",
            "Tempo de posse oficial: 12 segundos.",
            "Vence o time que atingir 21 pontos primeiro, ou quem estiver na frente ao fim de 10 minutos de jogo.",
            "Se empatar no fim do tempo, tem prorrogação: o primeiro time a fazer 2 pontos vence.",
            "Depois de uma cesta convertida, a posse passa direto pro time adversário.",
            "Se o time atacante pegar o rebote (rebote ofensivo), pode continuar e arremessar direto, sem precisar recuar.",
            "Se o time defensor pegar o rebote, ou roubar/tocar a bola, precisa levar a bola pra trás da linha de 3 pontos antes de poder arremessar (regra do \"clearance\").",
        ],
        },
        house: {
        title: "Regras da casa (BasqueteAC)",
        items: [
            "Além da vitória aos 21, o jogo pausa por 2 minutos para atualizar as estatísticas quando o primeiro time chega a 7 e a 14 pontos.",
            "Faltas e violações seguem o padrão FIBA (aba \"Faltas\").",
        ],
        },
    },

    "1x1": {
        label: "1x1",
        official: {
        title: "Regras oficiais",
        note: "A FIBA não define uma modalidade oficial de 1x1 — é uma adaptação totalmente informal do grupo, sem regulamento oficial por trás.",
        items: [],
        },
        house: {
        title: "Regras da casa (BasqueteAC)",
        items: [
            "Mesma pontuação padrão: cesta de dentro do arco vale 2, de fora vale 3, lance livre vale 1.",
            "Posse de bola: 14 segundos.",
            "Faltas e violações seguem o padrão FIBA (aba \"Faltas\").",
        ],
        },
    },
    };

    // Faltas e violações — regra FIBA, válida para todos os modos de jogo.
    export const FOULS_CONTENT = {
    fouls: {
        title: "Tipos de falta (FIBA)",
        items: [
        "Falta pessoal: contato ilegal com o adversário (empurrão, segurada, bloqueio irregular etc).",
        "Falta técnica: infração sem contato físico, ligada a comportamento antidesportivo (reclamação, desrespeito, demora de jogo).",
        "Falta antidesportiva: contato pessoal excessivo ou desnecessário, sem que o jogador esteja fazendo uma jogada legítima na bola.",
        "Falta desqualificante: comportamento extremamente antidesportivo — resulta em expulsão imediata do jogo.",
        "Um jogador que cometer 5 faltas pessoais é automaticamente eliminado do jogo (regra oficial FIBA).",
        ],
    },
    bonus: {
        title: "Bônus de faltas coletivas",
        items: [
        "Cada falta pessoal cometida por um jogador conta também como falta do time.",
        "A partir da 4ª falta coletiva do time no período, toda falta pessoal sofrida por um jogador que não esteja arremessando passa a valer 2 lances livres, em vez de reposição de bola.",
        ],
    },
    violations: {
        title: "Violações comuns",
        items: [
        "Passos (caminhada): andar com a bola nas mãos sem driblar.",
        "Drible duplo: driblar, parar de driblar e voltar a driblar em seguida.",
        "3 segundos: ficar mais de 3 segundos seguidos dentro da área restrita do ataque.",
        "8 segundos: não levar a bola do campo de defesa para o de ataque dentro do tempo.",
        "Interferência (goaltending): tocar a bola enquanto ela está em trajetória de queda em direção à cesta.",
        "Bola fora: quando a bola ou o jogador com a bola toca a linha lateral/de fundo ou sai da quadra.",
        ],
    },
    };

    // Definições usadas para explicar como cada estatística é contabilizada no app.
    export const STATS_DEFINITIONS = [
    {
        key: "points",
        label: "Pontos",
        description:
        "Somados conforme a cesta: 2 pontos de dentro do arco, 3 pontos de fora do arco, 1 ponto por lance livre.",
    },
    {
        key: "rebounds",
        label: "Rebotes",
        description:
        "Contado quando um jogador recupera a posse da bola após um arremesso errado, seja do próprio time (rebote ofensivo) ou do time adversário (rebote defensivo).",
    },
    {
        key: "assists",
        label: "Assistências",
        description:
        "Contado quando o passe de um jogador resulta diretamente em uma cesta do companheiro logo em seguida.",
    },
    {
        key: "blocks",
        label: "Tocos",
        description:
        "Contado quando um jogador desvia ou impede o arremesso do adversário antes que a bola complete a trajetória até a cesta.",
    },
    {
        key: "steals",
        label: "Roubos de bola",
        description:
        "Contado quando um jogador tira a posse da bola do adversário, seja interceptando um passe ou desarmando o drible.",
    },
    {
        key: "threePointers",
        label: "Bolas de 3",
        description:
        "Contado toda vez que uma cesta é convertida de fora do arco de 3 pontos. Contabilizado separadamente, além de somar 3 pontos.",
    },
    ];