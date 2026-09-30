import { redirect } from 'next/navigation'

// Conquistas agora ficam no Perfil (central do atleta)
export default function AchievementsPage() {
  redirect('/profile#conquistas')
}
