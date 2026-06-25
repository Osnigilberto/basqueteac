    // Service worker mínimo: cacheia o essencial pra abrir mesmo sem internet,
    // mas sempre busca a versão mais nova da rede primeiro (importante porque
    // o app depende de dados em tempo real do Firestore, não queremos servir
    // telas "velhas" por engano)

    const CACHE_NAME = 'basqueteac-v1'

    const PRECACHE_ASSETS = ['/', '/favicon.ico', '/icon.png']

    self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)))
    self.skipWaiting()
    })

    self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
    )
    self.clients.claim()
    })

    self.addEventListener('fetch', (event) => {
    // Só intercepta GET da própria origem — deixa Firestore, Cloudinary,
    // fotos do Google, etc. passarem direto sem interferência
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return
    }

    event.respondWith(
        fetch(event.request)
        .then((response) => {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
            return response
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    )
    })