/**
 * My fav - Supabase クラウド同期モジュール
 * 合言葉（シークレットキー/PIN）を使った安全＆シンプルなクロスデバイス同期
 */

const CloudSync = {
  client: null,

  // 合言葉から安全なSHA-256ハッシュIDを生成
  async hashKey(secretKey) {
    if (!secretKey || !secretKey.trim()) {
      throw new Error('合言葉が入力されていません。');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(secretKey.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // Supabaseクライアントの初期化
  initClient() {
    const settings = Storage.getSettings();
    if (settings.supabaseUrl && settings.supabaseAnonKey && window.supabase) {
      try {
        this.client = window.supabase.createClient(settings.supabaseUrl, settings.supabaseAnonKey);
        return this.client;
      } catch (e) {
        console.error('Supabase init error:', e);
        return null;
      }
    }
    return null;
  },

  // 接続テスト
  async testConnection(url, anonKey) {
    if (!window.supabase) {
      throw new Error('Supabase SDKが読み込まれていません。');
    }
    try {
      const testClient = window.supabase.createClient(url, anonKey);
      // テーブルへの接続テスト
      const { data, error } = await testClient.from('my_fav_sync').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        // テーブルが存在しないか権限エラーの場合もエラー内容を返す
        if (error.code === '42P01') {
          return { success: false, message: '接続は成功しましたが、テーブル「my_fav_sync」が未作成です。設定画面のSQLを実行してください。' };
        }
        throw error;
      }
      return { success: true, message: 'Supabaseへの接続に成功しました！' };
    } catch (e) {
      return { success: false, message: e.message || '接続に失敗しました。URLとAnon Keyを確認してください。' };
    }
  },

  // クラウドへデータをアップロード（同期送信）
  async uploadToCloud() {
    const settings = Storage.getSettings();
    if (!settings.secretKey) {
      throw new Error('クラウド同期を行うには「合言葉（PIN/パスコード）」の設定が必要です。');
    }
    const client = this.initClient();
    if (!client) {
      throw new Error('SupabaseのURLとAnon Keyが設定されていません。');
    }

    const roomId = await this.hashKey(settings.secretKey);
    const exportData = await Storage.exportAllData();

    const payload = {
      id: roomId,
      data: exportData,
      updated_at: new Date().toISOString()
    };

    const { error } = await client.from('my_fav_sync').upsert(payload);
    if (error) {
      throw error;
    }

    Storage.saveSettings({ lastSyncedAt: new Date().toISOString() });
    return { success: true, syncedAt: new Date().toISOString() };
  },

  // クラウドからデータをダウンロード（同期受信）
  async downloadFromCloud() {
    const settings = Storage.getSettings();
    if (!settings.secretKey) {
      throw new Error('クラウド同期を行うには「合言葉（PIN/パスコード）」の設定が必要です。');
    }
    const client = this.initClient();
    if (!client) {
      throw new Error('SupabaseのURLとAnon Keyが設定されていません。');
    }

    const roomId = await this.hashKey(settings.secretKey);
    const { data, error } = await client
      .from('my_fav_sync')
      .select('data, updated_at')
      .eq('id', roomId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('この合言葉で保存されたクラウドデータはまだありません。「クラウドに保存」を先に行ってください。');
      }
      throw error;
    }

    if (!data || !data.data) {
      throw new Error('有効なデータが見つかりませんでした。');
    }

    await Storage.importAllData(data.data);
    Storage.saveSettings({ lastSyncedAt: data.updated_at || new Date().toISOString() });
    return { success: true, count: data.data.oshis ? data.data.oshis.length : 0 };
  }
};
