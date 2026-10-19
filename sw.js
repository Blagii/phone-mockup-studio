// Versioned offline cache. Navigations use the network first so UI fixes are not
// trapped behind a cached index.html; large models and library assets stay cached.
const CACHE = "phone-mockup-studio-v104";
const PRECACHE = [
    "./",
    "./index.html",
    "./promo.js",
    "./promo-media.js",
    "./promo-devices.js",
    "./promo.css",
    "./promo-core.js",
    "./vendor/three/three.module.js",
    "./vendor/three/examples/jsm/controls/OrbitControls.js",
    "./vendor/three/examples/jsm/loaders/GLTFLoader.js",
    "./vendor/three/examples/jsm/environments/RoomEnvironment.js",
    "./vendor/three/examples/jsm/utils/BufferGeometryUtils.js",
    "./manifest.webmanifest",
    "./default-screenshot.jpg",
    "./icon-192.png",
    "./icon-512.png",
    "./icon-maskable-512.png",
    "./apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((k) => k.startsWith("phone-mockup-studio-") && k !== CACHE).map((k) => caches.delete(k)))
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (e) => {
    if (e.request.method !== "GET") return;
    const url = new URL(e.request.url);
    const isAppShell = e.request.mode === "navigate" ||
        (url.origin === self.location.origin && (
            url.pathname.endsWith("/") || url.pathname.endsWith("/index.html") ||
            /\/(promo\.js|promo-media\.js|promo-devices\.js|promo\.css|promo-core\.js)$/.test(url.pathname)
        ));
    if (isAppShell) {
        e.respondWith((async () => {
            const cache = await caches.open(CACHE);
            try {
                const response = await fetch(e.request, { cache: "no-store" });
                if (response.ok) {
                    await cache.put(e.request, response.clone());
                    return response;
                }
                return (await cache.match(e.request)) || response;
            } catch (error) {
                const cached = await cache.match(e.request);
                if (cached) return cached;
                throw error;
            }
        })());
        return;
    }
    e.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const response = await fetch(e.request);
        if (response.ok && response.type !== "opaque") {
            await cache.put(e.request, response.clone());
        }
        return response;
    })());
});
