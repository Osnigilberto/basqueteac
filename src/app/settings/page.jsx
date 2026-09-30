import { redirect } from 'next/navigation'

// Configurações agora ficam no Perfil (central do atleta)
export default function SettingsPage() {
  redirect('/profile#configuracoes')
}
