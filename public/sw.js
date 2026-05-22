const CACHE_NAME = "pitagoras-veri-v2";

// Força o Service Worker novo a se tornar ativo imediatamente
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Limpa TODOS os caches antigos do navegador no momento da ativação
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("Limpa cache antigo interceptado:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepta requisições com tratamento contra quebras
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});