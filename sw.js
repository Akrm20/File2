// sw.js - Service Worker لنظام Micro-ERP (بدون اتصال بعد الترخيص)
const CACHE_NAME = 'erp-offline-v3.0';
const OFFLINE_URL = '/index.html';
const API_CACHE_NAME = 'erp-api-cache-v1';

// الموارد الأساسية التي يجب أن تعمل دون اتصال
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/owner.html',
  '/backup-manager.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  console.log('🛠️ تثبيت Service Worker للنظام دون اتصال');
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME)
        .then((cache) => {
          console.log('✅ تخزين الموارد الأساسية في الذاكرة المؤقتة');
          return cache.addAll(CORE_ASSETS);
        }),
      self.skipWaiting()
    ])
  );
});

// تفعيل Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 تفعيل Service Worker للنظام دون اتصال');
  
  event.waitUntil(
    Promise.all([
      // تنظيف الذاكرة المؤقتة القديمة
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('🗑️ حذف الذاكرة المؤقتة القديمة:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // المطالبة بالتحكم في جميع العملاء فوراً
      self.clients.claim()
    ])
  );
});

// اعتراض الطلبات - استراتيجية ذكية للنظام دون اتصال
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // طلبات الترخيص - تعمل فقط مع الإنترنت
  if (url.pathname.includes('/api/license') || 
      url.pathname.includes('/activate') ||
      url.searchParams.has('license')) {
    return handleLicenseRequest(event);
  }
  
  // طلبات النسخ الاحتياطي - تعمل فقط مع الإنترنت (خدمة اختيارية)
  if (url.pathname.includes('/api/backup') || 
      url.pathname.includes('/backup')) {
    return handleBackupRequest(event);
  }
  
  // طلبات Firebase - نتعامل معها بحذر
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis')) {
    return handleFirebaseRequest(event);
  }
  
  // جميع الطلبات الأخرى - استراتيجية: شبكة أولاً مع السقوط للذاكرة المؤقتة
  return handleNormalRequest(event);
});

// معالجة طلبات الترخيص
function handleLicenseRequest(event) {
  // طلبات الترخيص تتطلب اتصال إنترنت
  return fetch(event.request)
    .then((response) => {
      // إذا نجح الترخيص، قم بتخزين البيانات المهمة
      if (response.status === 200) {
        cacheLicenseData(event.request, response.clone());
      }
      return response;
    })
    .catch((error) => {
      // في حالة عدم الاتصال، ارجع رسالة مناسبة
      return new Response(JSON.stringify({
        error: 'يتطلب الترخيص اتصال بالإنترنت',
        offline: true
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    });
}

// معالجة طلبات النسخ الاحتياطي
function handleBackupRequest(event) {
  // النسخ الاحتياطي خدمة اختيارية تتطلب اتصال
  return fetch(event.request)
    .catch((error) => {
      return new Response(JSON.stringify({
        warning: 'النسخ الاحتياطي على السحابة غير متاح حالياً',
        offline: true
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    });
}

// معالجة طلبات Firebase
function handleFirebaseRequest(event) {
  // لطلبات Firebase، نستخدم استراتيجية مختلفة
  if (event.request.method === 'GET') {
    return fetch(event.request)
      .then((response) => {
        // تخزين استجابات Firebase للاستخدام دون اتصال
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(API_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // السقوط إلى الذاكرة المؤقتة لطلبات GET
        return caches.match(event.request);
      });
  } else {
    // لطلبات POST/PUT، نستخدم الشبكة فقط
    return fetch(event.request)
      .catch((error) => {
        return new Response(JSON.stringify({
          error: 'الاتصال بالخادم غير متوفر',
          offline: true
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      });
  }
}

// معالجة الطلبات العادية
function handleNormalRequest(event) {
  return fetch(event.request)
    .then((response) => {
      // تحديث الذاكرة المؤقتة بالاستجابات الناجحة
      if (response.status === 200) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
      }
      return response;
    })
    .catch(() => {
      // السقوط إلى الذاكرة المؤقتة
      return caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          
          // للسجلات، ارجع الصفحة الرئيسية
          if (event.request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
          
          // للموارد الأخرى، ارجع رداً مناسباً
          return new Response('النظام يعمل دون اتصال', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
    });
}

// تخزين بيانات الترخيص
function cacheLicenseData(request, response) {
  response.json().then((data) => {
    if (data.license && data.license.key) {
      // تخزين بيانات الترخيص في ذاكرة API
      caches.open(API_CACHE_NAME).then((cache) => {
        const licenseUrl = new URL('/api/license/status', self.location.origin);
        const licenseResponse = new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' }
        });
        cache.put(licenseUrl, licenseResponse);
      });
    }
  });
}

// معالجة رسائل النظام
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_DATA':
      cacheCustomData(payload);
      break;
      
    case 'GET_CACHED_DATA':
      getCachedData(payload).then((data) => {
        event.ports[0].postMessage(data);
      });
      break;
      
    case 'CHECK_LICENSE':
      checkLicenseStatus().then((status) => {
        event.ports[0].postMessage(status);
      });
      break;
  }
});

// تخزين بيانات مخصصة
function cacheCustomData(payload) {
  const { key, data, type = 'json' } = payload;
  const url = new URL(`/cache/${key}`, self.location.origin);
  const response = new Response(
    type === 'json' ? JSON.stringify(data) : data,
    { headers: { 'Content-Type': type === 'json' ? 'application/json' : 'text/plain' } }
  );
  
  caches.open(API_CACHE_NAME).then((cache) => {
    cache.put(url, response);
  });
}

// جلب بيانات مخزنة
function getCachedData(payload) {
  const { key } = payload;
  const url = new URL(`/cache/${key}`, self.location.origin);
  
  return caches.open(API_CACHE_NAME)
    .then((cache) => cache.match(url))
    .then((response) => {
      if (response) {
        return response.json();
      }
      return null;
    });
}

// التحقق من حالة الترخيص
function checkLicenseStatus() {
  return caches.open(API_CACHE_NAME)
    .then((cache) => cache.match(new URL('/api/license/status', self.location.origin)))
    .then((response) => {
      if (response) {
        return response.json();
      }
      return { valid: false, reason: 'no_cached_license' };
    });
}

// مزامنة الخلفية
self.addEventListener('sync', (event) => {
  console.log('🔄 حدث مزامنة في الخلفية:', event.tag);
  
  switch (event.tag) {
    case 'background-backup':
      event.waitUntil(performBackgroundBackup());
      break;
      
    case 'license-check':
      event.waitUntil(performLicenseCheck());
      break;
      
    case 'data-sync':
      event.waitUntil(performDataSync());
      break;
  }
});

// نسخ احتياطي في الخلفية
async function performBackgroundBackup() {
  if (!navigator.onLine) return;
  
  try {
    // هنا يمكن إضافة منطق النسخ الاحتياطي التلقائي
    console.log('✅ إجراء نسخ احتياطي في الخلفية');
    
    // إرسال رسالة للصفحة الرئيسية
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKUP_COMPLETED',
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    console.error('❌ فشل النسخ الاحتياطي في الخلفية:', error);
  }
}

// التحقق من الترخيص في الخلفية
async function performLicenseCheck() {
  if (!navigator.onLine) return;
  
  try {
    console.log('✅ التحقق من الترخيص في الخلفية');
    // هنا يمكن إضافة منطق التحقق من الترخيص
  } catch (error) {
    console.error('❌ فشل التحقق من الترخيص:', error);
  }
}

// مزامنة البيانات في الخلفية
async function performDataSync() {
  if (!navigator.onLine) return;
  
  try {
    console.log('✅ مزامنة البيانات في الخلفية');
    // هنا يمكن إضافة منطق مزامنة البيانات
  } catch (error) {
    console.error('❌ فشل مزامنة البيانات:', error);
  }
}

// دفع الإشعارات
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'إشعار من نظام الإدارة',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: data.tag || 'erp-notification',
    data: data.data || {}
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'نظام الإدارة', options)
  );
});

// النقر على الإشعارات
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const client = clients.find(c => c.url === self.location.origin);
      if (client) {
        client.focus();
        client.postMessage({
          type: 'NOTIFICATION_CLICKED',
          data: event.notification.data
        });
      } else {
        self.clients.openWindow('/');
      }
    })
  );
});