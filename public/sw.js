const CACHE_NAME = "solar-sales-mobile-v9";
const APP_SHELL = [
  "/mobile-app.html",
  "/mobile-app.html?v=20260402",
  "/mobile-app.js",
  "/mobile-app.js?v=20260402",
  "/mobile-quote.html",
  "/mobile-quote.js",
  "/mobile-quote.js?v=20260402",
  "/mobile-attendance.html",
  "/mobile-attendance.js",
  "/mobile-attendance.js?v=20260402",
  "/mobile-payroll.html",
  "/mobile-payroll.js",
  "/mobile-payroll.js?v=20260402",
  "/mobile-saved-quotes.html",
  "/mobile-saved-quotes.js",
  "/mobile-saved-quotes.js?v=20260402",
  "/mobile-quote-detail.html",
  "/mobile-quote-detail.js",
  "/mobile-quote-detail.js?v=20260402",
  "/mobile-attendance-detail.html",
  "/mobile-attendance-detail.js",
  "/mobile-attendance-detail.js?v=20260402",
  "/mobile-customer-detail.html",
  "/mobile-customer-detail.js",
  "/mobile-invoices.html",
  "/mobile-invoices.js",
  "/mobile-repair.html",
  "/mobile-repair.js",
  "/mobile.webmanifest",
  "/mobile.webmanifest?v=20260402",
  "/mobile-icon.svg",
  "/offline.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isAppShellRequest(url) {
  return (
    url.pathname === "/" ||
    url.pathname === "/mobile-app.html" ||
    url.pathname === "/mobile-quote.html" ||
    url.pathname === "/mobile-attendance.html" ||
    url.pathname === "/mobile-payroll.html" ||
    url.pathname === "/mobile-saved-quotes.html" ||
    url.pathname === "/mobile-quote-detail.html" ||
    url.pathname === "/mobile-attendance-detail.html" ||
    url.pathname === "/mobile-customer-detail.html" ||
    url.pathname === "/mobile-invoices.html" ||
    url.pathname === "/mobile-repair.html" ||
    url.pathname === "/mobile-app.js" ||
    url.pathname === "/mobile-quote.js" ||
    url.pathname === "/mobile-attendance.js" ||
    url.pathname === "/mobile-payroll.js" ||
    url.pathname === "/mobile-saved-quotes.js" ||
    url.pathname === "/mobile-quote-detail.js" ||
    url.pathname === "/mobile-attendance-detail.js" ||
    url.pathname === "/mobile-customer-detail.js" ||
    url.pathname === "/mobile-invoices.js" ||
    url.pathname === "/mobile-repair.js" ||
    url.pathname === "/mobile.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ offline: true, items: [], summary: {} }), {
            headers: { "Content-Type": "application/json" }
          })
      )
    );
    return;
  }

  if (isAppShellRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        return response;
      });
    })
  );
});

