const CACHE_NAME = "shake_v1.4",
    FILES_TO_CACHE = ["/", "/manifest.json", "/assets/main.js", "/assets/main.min.css", "/assets/vue.min.js", "/icons/icon-192.png", "/favicon.png"];
self.addEventListener("install", function (e) {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
        return cache.addAll(FILES_TO_CACHE)
    }))
}), self.addEventListener("fetch", function (e) {
    e.respondWith(caches.match(e.request).then(function (response) {
        return response || fetch(e.request)
    }))
}), self.addEventListener("activate", function (e) {
    e.waitUntil(caches.keys().then(keyList => Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) return console.log("[ServiceWorker] Removing old cache", key), caches.delete(key)
    }))))
});