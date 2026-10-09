const CACHE_NAME = 'growth-checkin-v103';
const APP_SHELL = [
  './',
  './index.html',
  './questions.json',
  './recovery.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];
// 非导航请求的网络超时
const NETWORK_TIMEOUT = 6000;
// 导航请求的网络超时：导航绝不能因为"慢"就返回错误页，给它更长的预算，失败再退回缓存的 shell
const NAV_TIMEOUT = 15000;

// 解析成绝对地址，避免 new Request 的相对路径基准不确定
function absUrl(path) {
  try { return new URL(path, self.location.href).href; } catch (e) { return path; }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(APP_SHELL.map(path =>
        // cache: 'reload' 绕过浏览器 HTTP 缓存。GitHub Pages 对 HTML 会下发
        // Cache-Control: max-age=600，否则新 SW 可能把"上一版的 index.html"装进新缓存。
        cache.add(new Request(absUrl(path), { cache: 'reload' }))
          .catch(err => { console.warn('预缓存失败:', path, err); return null; })
      )))
      .then(() => caches.open(CACHE_NAME))
      .then(cache => cache.match(absUrl('./index.html')).then(r => r || cache.match(absUrl('./'))))
      .then(critical => {
        // 关键资源没缓存成功就不激活新版本，避免把应用换成"半成品"，
        // 同时不再像以前那样因为一个文件失败就永远卡在旧版且毫无提示。
        if (!critical) {
          console.warn('关键资源未缓存成功，放弃本次更新，继续使用当前版本');
          return;
        }
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(allKeys => Promise.all(
        allKeys
          // 只清理本应用自己的缓存。以前这里会把同域下所有其它缓存都删掉，
          // 而 origin 是 gzhao521-coder.github.io，是所有 GitHub Pages 项目共用的。
          .filter(key => key.indexOf('growth-checkin-') === 0 && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('network timeout')), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

// 按版本号数值排序（不能用字典序：v9 会排在 v89 前面，v99 会排在 v100 前面）
function cacheKeysNewestFirst(keys) {
  const num = k => {
    const m = /growth-checkin-v(\d+)/.exec(k);
    return m ? parseInt(m[1], 10) : 0;
  };
  return keys.filter(k => k.indexOf('growth-checkin-') === 0).sort((a, b) => num(b) - num(a));
}

async function matchAnyCache(request, ignoreSearch) {
  let keys = [];
  try { keys = cacheKeysNewestFirst(await caches.keys()); } catch (e) { return null; }
  for (const key of keys) {
    try {
      const hit = await caches.match(request, { cacheName: key, ignoreSearch: !!ignoreSearch });
      if (hit) return hit;
    } catch (e) {}
  }
  return null;
}

async function handleRequest(request) {
  const isNavigate = request.mode === 'navigate';

  // 导航请求忽略 query，这样 README 里的 "?v=..." 修复地址能直接命中缓存的 shell
  let cached = await matchAnyCache(request, isNavigate);
  if (cached) return cached;

  const network = fetch(request).then(response => {
    if (response && response.status === 200 && (response.type === 'basic' || response.type === 'default')) {
      const copy = response.clone();
      caches.open(CACHE_NAME)
        .then(cache => cache.put(request, copy))
        .catch(err => console.warn('写入缓存失败:', err));
    }
    return response;
  });

  if (isNavigate) {
    // 关键：导航请求不能超时就返回 Response.error()（浏览器会显示错误页）。
    // 网络失败或超时都退回缓存的 shell。
    let res = null;
    try { res = await withTimeout(network, NAV_TIMEOUT); } catch (e) { res = null; }
    if (res && res.ok) return res;
    const shell = await matchAnyCache(new Request(absUrl('./index.html')), false);
    return shell || res || Response.error();
  }

  try {
    const res = await withTimeout(network, NETWORK_TIMEOUT);
    // 不要返回 null（respondWith(null) 会抛错），退回到缓存的 shell 或明确的错误响应
    return res || cached || (await matchAnyCache(new Request(absUrl('./index.html')), false)) || Response.error();
  } catch (e) {
    return cached || (await matchAnyCache(new Request(absUrl('./index.html')), false)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(handleRequest(event.request));
});

// 点击通知时打开/聚焦应用（以前完全没有这个处理，点通知没反应）
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.indexOf(self.registration.scope) === 0 && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(absUrl('./'));
    })
  );
});
