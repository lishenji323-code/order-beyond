import { readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const names = await readdir('dist/assets')
const html = await readFile('dist/index.html', 'utf8')
const hash = createHash('sha256').update(html + JSON.stringify(names))
for (const name of await readdir('dist/figma'))
  hash.update(await readFile(`dist/figma/${name}`))
const key = hash.digest('hex').slice(0, 12)
const icons = await readdir('dist/icons')
const core = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  ...icons.map((n) => `/icons/${n}`),
  ...names.map((n) => `/assets/${n}`),
]
const worker = `const CACHE='order-beyond-${key}';
const CORE=${JSON.stringify(core)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('order-beyond-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('/index.html',copy)))}return response}).catch(()=>caches.match('/index.html')));return;
 }
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const saved=await cache.match(request);
  if(url.pathname.startsWith('/assets/')&&saved)return saved;
  try{const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response}catch(error){if(saved)return saved;throw error}
 }));
});
`
await writeFile('dist/sw.js', worker)
console.log('Offline shell prepared:', key)
