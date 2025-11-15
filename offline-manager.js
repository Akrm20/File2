// offline-manager.js - مدير العمل دون اتصال
class OfflineManager {
    constructor() {
        this.licenseKey = 'erp_license_data';
        this.syncQueue = [];
        this.init();
    }

    async init() {
        await this.registerServiceWorker();
        this.setupEventListeners();
        this.startBackgroundSync();
    }

    // تسجيل Service Worker
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('✅ Service Worker مسجل بنجاح:', registration);
                
                // الاستماع للتحديثات
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('🔄 تم العثور على تحديث جديد:', newWorker);
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateNotification();
                        }
                    });
                });

                this.serviceWorker = registration;
            } catch (error) {
                console.error('❌ فشل تسجيل Service Worker:', error);
            }
        }
    }

    // إعداد مستمعات الأحداث
    setupEventListeners() {
        // حالة الاتصال
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // رسائل من Service Worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            this.handleServiceWorkerMessage(event.data);
        });

        // قبل إغلاق الصفحة
        window.addEventListener('beforeunload', () => this.savePendingData());
    }

    // التعامل مع الاتصال بالإنترنت
    handleOnline() {
        console.log('✅ الاتصال بالإنترنت متوفر');
        this.hideOfflineIndicator();
        this.processSyncQueue();
        this.scheduleBackgroundSync();
    }

    // التعامل مع انقطاع الاتصال
    handleOffline() {
        console.log('❌ لا يوجد اتصال بالإنترنت');
        this.showOfflineIndicator();
    }

    // عرض مؤشر عدم الاتصال
    showOfflineIndicator() {
        let indicator = document.getElementById('offlineIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'offlineIndicator';
            indicator.className = 'position-fixed top-0 start-50 translate-middle-x p-3';
            indicator.style.zIndex = '9999';
            indicator.innerHTML = `
                <div class="alert alert-warning alert-dismissible fade show">
                    <i class="bi bi-wifi-off"></i> 
                    <strong>وضع عدم الاتصال</strong> - النظام يعمل بشكل محلي
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
            document.body.appendChild(indicator);
        }
        indicator.style.display = 'block';
    }

    // إخفاء مؤشر عدم الاتصال
    hideOfflineIndicator() {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    // معالجة رسائل Service Worker
    handleServiceWorkerMessage(message) {
        switch (message.type) {
            case 'BACKUP_COMPLETED':
                this.showBackupNotification(message.timestamp);
                break;
                
            case 'SYNC_COMPLETED':
                this.showSyncNotification();
                break;
                
            case 'UPDATE_AVAILABLE':
                this.showUpdateNotification();
                break;
        }
    }

    // بدء المزامنة في الخلفية
    startBackgroundSync() {
        if ('sync' in registration) {
            registration.sync.register('background-backup');
            registration.sync.register('data-sync');
        }
    }

    // جدولة المزامنة في الخلفية
    scheduleBackgroundSync() {
        setInterval(() => {
            if (navigator.onLine) {
                this.processSyncQueue();
            }
        }, 300000); // كل 5 دقائق
    }

    // معالجة قائمة الانتظار للمزامنة
    async processSyncQueue() {
        if (this.syncQueue.length === 0 || !navigator.onLine) return;

        console.log('🔄 معالجة قائمة المزامنة:', this.syncQueue.length, 'عنصر');

        for (const item of this.syncQueue) {
            try {
                await this.syncItem(item);
                this.syncQueue = this.syncQueue.filter(i => i.id !== item.id);
            } catch (error) {
                console.error('❌ فشل مزامنة العنصر:', item, error);
            }
        }
    }

    // مزامنة عنصر فردي
    async syncItem(item) {
        // هنا يمكن إضافة منطق المزامنة مع الخادم
        console.log('✅ مزامنة العنصر:', item);
        return Promise.resolve();
    }

    // إضافة عنصر لقائمة الانتظار
    addToSyncQueue(data) {
        const item = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            data: data
        };
        
        this.syncQueue.push(item);
        this.saveSyncQueue();
        
        // محاولة المزامنة فوراً إذا كان هناك اتصال
        if (navigator.onLine) {
            this.processSyncQueue();
        }
    }

    // حفظ قائمة الانتظار
    saveSyncQueue() {
        localStorage.setItem('sync_queue', JSON.stringify(this.syncQueue));
    }

    // تحميل قائمة الانتظار
    loadSyncQueue() {
        try {
            const queue = localStorage.getItem('sync_queue');
            this.syncQueue = queue ? JSON.parse(queue) : [];
        } catch (error) {
            this.syncQueue = [];
        }
    }

    // حفظ البيانات المعلقة قبل إغلاق الصفحة
    savePendingData() {
        this.saveSyncQueue();
        
        // إرسال رسالة لـ Service Worker لحفظ البيانات
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SAVE_PENDING_DATA',
                data: {
                    syncQueue: this.syncQueue,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    // عرض إشعار النسخ الاحتياطي
    showBackupNotification(timestamp) {
        this.showNotification('النسخ الاحتياطي', 'تم إنشاء نسخة احتياطية تلقائية', 'backup');
    }

    // عرض إشعار المزامنة
    showSyncNotification() {
        this.showNotification('المزامنة', 'تمت مزامنة البيانات مع الخادم', 'sync');
    }

    // عرض إشعار التحديث
    showUpdateNotification() {
        const notification = document.createElement('div');
        notification.className = 'alert alert-info position-fixed top-0 start-0 m-3';
        notification.style.zIndex = '9999';
        notification.innerHTML = `
            <h6>🔄 تحديث جديد متوفر</h6>
            <p>يوجد إصدار جديد من النظام. يرجى تحديث الصفحة.</p>
            <button class="btn btn-sm btn-primary" onclick="location.reload()">تحديث الآن</button>
        `;
        document.body.appendChild(notification);
    }

    // عرض إشعار عام
    showNotification(title, body, type = 'info') {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/icons/icon-192.png' });
        }
    }

    // طلب صلاحيات الإشعارات
    async requestNotificationPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    }

    // التحقق من دعم العمل دون اتصال
    checkOfflineSupport() {
        const supports = {
            serviceWorker: 'serviceWorker' in navigator,
            cache: 'caches' in window,
            sync: 'sync' in (navigator.serviceWorker?.registration || {}),
            notifications: 'Notification' in window,
            backgroundSync: 'backgroundSync' in (navigator.serviceWorker?.registration || {})
        };

        console.log('🔍 دعم العمل دون اتصال:', supports);
        return supports;
    }
}

// إنشاء نسخة عامة من المدير
window.offlineManager = new OfflineManager();