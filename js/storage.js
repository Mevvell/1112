/**
 * My fav - ストレージ管理層 (IndexedDB & LocalStorage)
 */

const Storage = {
  DB_NAME: 'MyFavDB',
  DB_VERSION: 1,
  STORE_OSHIS: 'oshis',
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.STORE_OSHIS)) {
          db.createObjectStore(this.STORE_OSHIS, { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB error:', e);
        reject(e);
      };
    });
  },

  // 推し一覧の取得
  async getAllOshis() {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.STORE_OSHIS, 'readonly');
      const store = tx.objectStore(this.STORE_OSHIS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  // 特定の推しを取得
  async getOshi(id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.STORE_OSHIS, 'readonly');
      const store = tx.objectStore(this.STORE_OSHIS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  // 推しの保存・更新
  async saveOshi(oshi) {
    if (!this.db) await this.init();
    oshi.updatedAt = new Date().toISOString();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.STORE_OSHIS, 'readwrite');
      const store = tx.objectStore(this.STORE_OSHIS);
      const req = store.put(oshi);
      req.onsuccess = () => resolve(oshi);
      req.onerror = () => reject(req.error);
    });
  },

  // 推しの削除
  async deleteOshi(id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.STORE_OSHIS, 'readwrite');
      const store = tx.objectStore(this.STORE_OSHIS);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  // 設定の取得 (LocalStorage)
  getSettings() {
    const defaultSettings = {
      activeOshiId: null,
      secretKey: '', // 合言葉
      supabaseUrl: '',
      supabaseAnonKey: '',
      autoSync: false,
      lastSyncedAt: null
    };
    try {
      const saved = localStorage.getItem('my_fav_settings');
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  },

  // 設定の保存
  saveSettings(settings) {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem('my_fav_settings', JSON.stringify(updated));
    return updated;
  },

  // 全データのエクスポート（JSONファイル用）
  async exportAllData() {
    const oshis = await this.getAllOshis();
    const settings = this.getSettings();
    return {
      version: 1,
      appName: 'My fav',
      exportedAt: new Date().toISOString(),
      oshis,
      settings: {
        activeOshiId: settings.activeOshiId,
        secretKey: settings.secretKey
      }
    };
  },

  // 全データのインポート
  async importAllData(data) {
    if (!data || !Array.isArray(data.oshis)) {
      throw new Error('無効なバックアップデータ形式です。');
    }
    if (!this.db) await this.init();

    const tx = this.db.transaction(this.STORE_OSHIS, 'readwrite');
    const store = tx.objectStore(this.STORE_OSHIS);

    // 既存データをクリアして新しいデータを投入
    await new Promise((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });

    for (const oshi of data.oshis) {
      store.put(oshi);
    }

    if (data.settings) {
      this.saveSettings(data.settings);
    }

    return true;
  },

  // 初期サンプルデータの作成
  async createSampleOshiIfNeeded() {
    const oshis = await this.getAllOshis();
    if (oshis.length === 0) {
      const today = new Date();
      const pastDate = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
      const startDateStr = pastDate.toISOString().split('T')[0];

      const sampleOshi = {
        id: 'sample-' + Date.now(),
        name: '星乃 るな',
        ruby: 'Hoshino Runa',
        groupName: 'Starlight Project',
        themeColor: '#ec4899', // キュートピンク
        startDate: startDateStr,
        birthday: '2004-07-07',
        avatarUrl: '', // 空の場合はイニシャル表示
        sns: {
          twitter: 'https://twitter.com',
          instagram: 'https://instagram.com',
          youtube: 'https://youtube.com',
          tiktok: 'https://tiktok.com'
        },
        notes: [
          {
            id: 'note-1',
            date: new Date().toISOString().split('T')[0],
            title: 'My fav アプリはじめました✨',
            content: '推しのSNSまとめや画像ストック、日数をこれからここで記録していきます！',
            category: 'memory'
          }
        ],
        photos: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.saveOshi(sampleOshi);
      this.saveSettings({ activeOshiId: sampleOshi.id });
      return sampleOshi;
    }
    return null;
  }
};
