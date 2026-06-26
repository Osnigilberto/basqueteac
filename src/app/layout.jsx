  import { Inter } from 'next/font/google'
  import './globals.css'
  import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'

  const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
  })

  export const metadata = {
    title: 'BasqueteAC',
    description: 'Estatísticas de basquete, sem complicação — pontos, rebotes, assistências, tocos e roubos, em tempo real.',
    manifest: '/site.webmanifest',
    icons: {
      icon: [
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: '/apple-touch-icon.png',
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'BasqueteAC',
    },
  }

  export const viewport = {
    themeColor: '#F4541B',
    width: 'device-width',
    initialScale: 1,
  }

  export default function RootLayout({ children }) {
    return (
      <html lang="pt-BR" suppressHydrationWarning>
        <head>
          {/* Aplica o tema salvo ANTES da página pintar, evitando o "flash"
              de aparecer um tema errado por um instante ao carregar */}
          <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try {
                var stored = localStorage.getItem('basqueteac-theme');
                var systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                var theme = stored || (systemPrefersDark ? 'dark' : 'light');
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            })();`,
          }}
        />
        </head>
        <body className={inter.variable}>
          {children}
          <ServiceWorkerRegister />
        </body>
      </html>
    )
  }