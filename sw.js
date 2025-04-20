const CACHE_NAME = 'v12';
const urlsToCache = [
  '/',
  '/index.html',
  '/raschet-app/',
  '/raschet-app/index.html',
  '/raschet-app/manifest.json',
  '/raschet-app/icon-192x192.png',
  '/raschet-app/icon-512x512.png'
];

self.addEventListener('install', event => {
  console.log('Service Worker: установка началась');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: кэширование ресурсов');
      return Promise.all(
        urlsToCache.map(url => {
          return fetch(url).then(response => {
            if (!response.ok) {
              console.warn(`Service Worker: не удалось кэшировать ${url}, статус: ${response.status}`);
              return;
            }
            console.log(`Service Worker: кэширован ${url}`);
            return cache.put(url, response);
          }).catch(err => {
            console.warn(`Service Worker: ошибка кэширования ${url}: ${err}`);
          });
        })
      );
    }).then(() => {
      console.log('Service Worker: установка завершена');
    }).catch(err => {
      console.error('Service Worker: ошибка установки:', err);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker: активация началась');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: активация завершена');
    }).catch(err => {
      console.error('Service Worker: ошибка активации:', err);
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  console.log('Service Worker: обработка запроса:', event.request.url);

  if (event.request.url.includes('play.google.com')) {
    console.log('Service Worker: блокировка запроса к play.google.com:', event.request.url);
    event.respondWith(
      new Response('', {
        status: 200,
        statusText: 'OK'
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(response => {
      if (response) {
        console.log('Service Worker: найден кэшированный ресурс:', event.request.url);
        return response;
      }

      console.log('Service Worker: ресурс не в кэше:', event.request.url);

      if (!navigator.onLine) {
        console.log('Service Worker: оффлайн, пытаемся вернуть кэшированный index.html');
        return caches.match('/raschet-app/index.html').then(cachedResponse => {
          if (cachedResponse) {
            console.log('Service Worker: возвращён кэшированный index.html');
            return cachedResponse;
          }
          console.error('Service Worker: кэш index.html недоступен');
          return new Response('Оффлайн-режим: кэш недоступен', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        }).catch(err => {
          console.error('Service Worker: ошибка при попытке вернуть index.html:', err);
          return new Response('Оффлайн-режим: ошибка кэша', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      }

      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
            console.log('Service Worker: ресурс сохранён в кэш:', event.request.url);
          });
        }
        return networkResponse;
      }).catch(err => {
        console.log('Service Worker: ошибка сети:', err);
        return caches.match('/raschet-app/index.html').then(cachedResponse => {
          if (cachedResponse) {
            console.log('Service Worker: возвращён кэшированный index.html после ошибки сети');
            return cachedResponse;
          }
          console.error('Service Worker: кэш index.html недоступен после ошибки сети');
          return new Response('Оффлайн-режим: кэш недоступен', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      });
    }).catch(err => {
      console.error('Service Worker: общая ошибка при обработке запроса:', err);
      return new Response('Оффлайн-режим: ошибка обработки', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    })
  );
});