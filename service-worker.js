// Service Worker para Lotería Predictor - Versión ligera
const APP_VERSION = '2.0';
const CACHE_NAME = `loteria-cache-v${APP_VERSION}`;

// ============================================
// 1. ASSETS ESENCIALES A CACHEAR
// ============================================
const STATIC_ASSETS = [
    // Raíz
    './',
    './index.html',
    './manifest.json',
    
    // CSS
    './public/css/styles.css',
    
    // JavaScript
    './public/js/api.js',
    './public/js/app.js'
];

// URLs que NO deben ser cacheadas
const EXCLUDED_PATHS = [
    '/api/',           // Backend Flask
    '/proxy/',         // Proxy Node.js
    'sheets.googleapis.com',
    'fonts.googleapis.com',
    'cdn.jsdelivr.net'
];

// ============================================
// 2. INSTALACIÓN
// ============================================
self.addEventListener('install', (event) => {
    console.log(`[SW ${APP_VERSION}] Instalando...`);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando assets esenciales...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Instalación completada');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Error en instalación:', error);
            })
    );
});

// ============================================
// 3. ACTIVACIÓN
// ============================================
self.addEventListener('activate', (event) => {
    console.log(`[SW ${APP_VERSION}] Activando...`);
    
    event.waitUntil(
        // Limpiar caches antiguos
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[SW] Eliminando cache antiguo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                return self.clients.claim();
            })
            .then(() => {
                console.log('[SW] Activación completada');
            })
    );
});

// ============================================
// 4. ESTRATEGIA DE FETCH
// ============================================
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // 1. EXCLUIR URLs de API, proxy y CDNs
    const shouldExclude = EXCLUDED_PATHS.some(path => 
        url.href.includes(path) ||
        url.hostname.includes('localhost:5000') ||  // Flask
        url.hostname.includes('localhost:3001')     // Proxy
    );
    
    if (shouldExclude) {
        console.log('[SW] Excluyendo:', url.pathname);
        return; // Dejar pasar sin cachear
    }
    
    // 2. Solo manejar GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // 3. Estrategia: Cache First para assets estáticos
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    console.log('[SW] Sirviendo desde cache:', url.pathname);
                    return cachedResponse;
                }
                
                // No encontrado en cache, fetch de red
                console.log('[SW] Fetch de red:', url.pathname);
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Solo cachear si la respuesta es válida
                        if (!networkResponse || 
                            networkResponse.status !== 200 || 
                            networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Clonar la respuesta para cachearla
                        const responseToCache = networkResponse.clone();
                        
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                // Solo cachear si es un asset estático nuestro
                                if (url.origin === self.location.origin) {
                                    cache.put(event.request, responseToCache);
                                    console.log('[SW] Cacheado:', url.pathname);
                                }
                            })
                            .catch((err) => {
                                console.warn('[SW] Error cacheando:', err);
                            });
                        
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.error('[SW] Error de fetch:', error);
                        
                        // Si estamos offline y es una página HTML
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('./index.html');
                        }
                        
                        throw error;
                    });
            })
    );
});

// ============================================
// 5. MENSAJES (para actualización)
// ============================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ============================================
// 6. SINCRONIZACIÓN EN BACKGROUND
// ============================================
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        console.log('[SW] Sincronización en background');
        // Aquí podrías añadir lógica para sincronizar datos
    }
});

// ============================================
// 7. PUSH NOTIFICATIONS (opcional)
// ============================================
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    
    const options = {
        body: data.body || 'Nuevo sorteo disponible',
        icon: './public/icons/icon-192x192.png',
        badge: './public/icons/icon-96x96.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        },
        actions: [
            {
                action: 'analyze',
                title: 'Analizar',
                icon: './public/icons/analyze-icon.png'
            },
            {
                action: 'close',
                title: 'Cerrar',
                icon: './public/icons/close-icon.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Lotería Predictor', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'analyze') {
        event.waitUntil(
            clients.openWindow('/?action=analyze')
        );
    } else {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});

// ============================================
// 8. LOGS DE DEPURACIÓN
// ============================================
console.log(`[SW ${APP_VERSION}] Cargado y listo`);