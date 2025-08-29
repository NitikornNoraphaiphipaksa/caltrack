// sw.js
const CACHE = 'caltrack-v11';

// ไฟล์ที่ต้องใช้เสมอให้ออฟไลน์ได้ (precache)
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
  // หมายเหตุ: foods.json จะใช้ network-first ด้านล่าง ไม่ต้อง precache ก็ได้
  // ถ้าอยากให้เปิดครั้งแรกแล้วออฟไลน์ได้ทันที ให้เติม './foods.json' ใน ASSETS ได้เช่นกัน
];

// ——— Helpers ———
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const resp = await fetch(req);
  if (req.method === 'GET') cache.put(req, resp.clone());
  return resp;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const resp = await fetch(req, { cache: 'no-store' });
    if (req.method === 'GET') cache.put(req, resp.clone());
    return resp;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('install', (e) => {
  self.skipWaiting(); // ใช้ SW เวอร์ชันใหม่ทันที
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim(); // คุมทุกแท็บที่เปิดอยู่
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // ข้าม request ข้ามโดเมน
  if (url.origin !== location.origin) return;

  // หน้า HTML (กดลิงก์/พิมพ์ URL = navigation) → fallback เป็น index.html ตอนออฟไลน์
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', clone)).catch(()=>{});
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // foods.json → network-first (อยากได้ข้อมูลล่าสุดก่อน)
  if (url.pathname.endsWith('/foods.json')) {
    e.respondWith(networkFirst(request));
    return;
  }

  // ที่เหลือ → cache-first (เร็ว/ออฟไลน์ชัวร์)
  e.respondWith(cacheFirst(request));
});
