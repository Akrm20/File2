// backup-manager.js - مدير النسخ الاحتياطي
class BackupManager {
    constructor() {
        this.backupInterval = 24 * 60 * 60 * 1000; // 24 ساعة
        this.lastBackupKey = 'last_backup_time';
    }
    
    /**
     * إنشاء نسخة احتياطية
     */
    async createBackup() {
        try {
            const backupData = {
                timestamp: new Date().toISOString(),
                version: '2.0',
                data: {
                    products: await getAllProducts(),
                    invoices: await getAllInvoices(),
                    customers: await getAllCustomers(),
                    suppliers: await getAllSuppliers(),
                    settings: await this.getSystemSettings(),
                    license: getLicenseData()
                }
            };
            
            // حفظ محلياً
            this.saveLocalBackup(backupData);
            
            // محاولة الحفظ على السحابة إذا كان هناك اتصال
            if (navigator.onLine) {
                await this.saveCloudBackup(backupData);
            }
            
            console.log('✅ تم إنشاء النسخة الاحتياطية');
            return true;
            
        } catch (error) {
            console.error('❌ فشل إنشاء النسخة الاحتياطية:', error);
            return false;
        }
    }
    
    /**
     * حفظ النسخة محلياً
     */
    saveLocalBackup(backupData) {
        const backups = this.getLocalBackups();
        backups.push(backupData);
        
        // الاحتفاظ بـ 10 نسخ فقط
        if (backups.length > 10) {
            backups.shift();
        }
        
        localStorage.setItem('system_backups', JSON.stringify(backups));
        localStorage.setItem(this.lastBackupKey, new Date().toISOString());
    }
    
    /**
     * الحصول على النسخ المحلية
     */
    getLocalBackups() {
        try {
            return JSON.parse(localStorage.getItem('system_backups')) || [];
        } catch (error) {
            return [];
        }
    }
    
    /**
     * حفظ النسخة على السحابة
     */
    async saveCloudBackup(backupData) {
        // هنا يتم الاتصال بخدمة النسخ الاحتياطي السحابية
        // هذه خدمة اختيارية
        console.log('☁️ حفظ النسخة على السحابة (خدمة اختيارية)');
        return true;
    }
    
    /**
     * استعادة من نسخة احتياطية
     */
    async restoreBackup(backupData) {
        try {
            // استعادة البيانات
            await this.restoreProducts(backupData.data.products);
            await this.restoreInvoices(backupData.data.invoices);
            await this.restoreCustomers(backupData.data.customers);
            await this.restoreSuppliers(backupData.data.suppliers);
            
            console.log('✅ تم استعادة النسخة الاحتياطية');
            return true;
            
        } catch (error) {
            console.error('❌ فشل استعادة النسخة الاحتياطية:', error);
            return false;
        }
    }
    
    /**
     * جدولة النسخ الاحتياطي التلقائي
     */
    scheduleAutoBackup() {
        setInterval(() => {
            this.createBackup();
        }, this.backupInterval);
    }
    
    /**
     * الحصول على إعدادات النظام
     */
    async getSystemSettings() {
        return new Promise((resolve) => {
            const transaction = db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const settings = {};
                request.result.forEach(setting => {
                    settings[setting.key] = setting.value;
                });
                resolve(settings);
            };
        });
    }
    
    // دوال الاستعادة
    async restoreProducts(products) {
        const transaction = db.transaction(['products'], 'readwrite');
        const store = transaction.objectStore('products');
        
        await store.clear();
        
        products.forEach(product => {
            store.add(product);
        });
    }
    
    async restoreInvoices(invoices) {
        // ... تنفيذ مشابه ...
    }
    
    async restoreCustomers(customers) {
        // ... تنفيذ مشابه ...
    }
    
    async restoreSuppliers(suppliers) {
        // ... تنفيذ مشابه ...
    }
}

// إنشاء نسخة عامة من المدير
window.backupManager = new BackupManager();