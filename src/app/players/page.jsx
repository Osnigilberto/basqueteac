import { redirect } from 'next/navigation'

// Atletas agora é uma aba do Stats (o menu inferior tem no máximo 5 abas)
export default function PlayersPage() {
  redirect('/stats?tab=atletas')
}
