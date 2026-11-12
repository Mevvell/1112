/**
 * My fav - メインアプリケーションロジック
 */

const App = {
  activeOshi: null,
  allOshis: [],
  currentTab: 'home',
  selectedPhoto: null,
  currentRawAvatarSource: null,

  // 初期化
  async init() {
    await Storage.init();
    await Storage.createSampleOshiIfNeeded();
    await this.loadOshis();
    this.initSparkleBackground();
    this.setupEventListeners();
    this.updateActiveTab(this.currentTab);
    CloudSync.initClient();
  },

  // 背景のきらきらパーティクルを動的配置
  initSparkleBackground() {
    const container = document.getElementById('sparkle-particles-container');
    if (!container) return;

    container.innerHTML = '';
    const sparkles = ['✨', '💖', '🌟', '🌸', '🪄', '💫'];
    const count = 14;

    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'sparkle-item';
      el.textContent = sparkles[Math.floor(Math.random() * sparkles.length)];
      el.style.left = `${Math.random() * 95}%`;
      el.style.top = `${Math.random() * 90}%`;
      el.style.animationDelay = `${(Math.random() * 5).toFixed(1)}s`;
      el.style.animationDuration = `${(4 + Math.random() * 5).toFixed(1)}s`;
      el.style.fontSize = `${12 + Math.floor(Math.random() * 12)}px`;
      container.appendChild(el);
    }
  },

  // 推し一覧のロード
  async loadOshis() {
    this.allOshis = await Storage.getAllOshis();
    const settings = Storage.getSettings();

    // SNSアカウントの複数対応マイグレーション
    this.allOshis.forEach(oshi => this.normalizeSnsAccounts(oshi));

    if (this.allOshis.length > 0) {
      if (settings.activeOshiId) {
        this.activeOshi = this.allOshis.find(o => o.id === settings.activeOshiId) || this.allOshis[0];
      } else {
        this.activeOshi = this.allOshis[0];
      }
    } else {
      this.activeOshi = null;
    }

    this.renderOshiSelector();
    this.applyOshiTheme();
    this.renderCurrentView();
  },

  // SNSアカウントの正規化・後方互換対応
  normalizeSnsAccounts(oshi) {
    if (!oshi) return [];
    if (Array.isArray(oshi.snsAccounts)) {
      return oshi.snsAccounts;
    }
    const accounts = [];
    if (oshi.sns) {
      if (oshi.sns.twitter) accounts.push({ id: 'acc-tw-' + Date.now(), platform: 'twitter', title: '公式X (Twitter)', url: oshi.sns.twitter });
      if (oshi.sns.instagram) accounts.push({ id: 'acc-ig-' + Date.now(), platform: 'instagram', title: '公式Instagram', url: oshi.sns.instagram });
      if (oshi.sns.youtube) accounts.push({ id: 'acc-yt-' + Date.now(), platform: 'youtube', title: 'メインチャンネル', url: oshi.sns.youtube });
      if (oshi.sns.tiktok) accounts.push({ id: 'acc-tt-' + Date.now(), platform: 'tiktok', title: '公式TikTok', url: oshi.sns.tiktok });
    }
    oshi.snsAccounts = accounts;
    return accounts;
  },

  // テーマカラーを動的適用
  applyOshiTheme() {
    if (!this.activeOshi) return;
    const color = this.activeOshi.themeColor || '#ec4899';
    const root = document.documentElement;

    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 236;
    const g = parseInt(hex.substring(2, 4), 16) || 72;
    const b = parseInt(hex.substring(4, 6), 16) || 153;

    root.style.setProperty('--oshi-primary', color);
    root.style.setProperty('--oshi-primary-rgb', `${r}, ${g}, ${b}`);
    root.style.setProperty('--oshi-primary-light', `rgba(${r}, ${g}, ${b}, 0.12)`);
    root.style.setProperty('--oshi-secondary', `rgba(${r}, ${g}, ${b}, 0.82)`);
    root.style.setProperty('--oshi-primary-dark', `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`);

    if (window.lucide) {
      lucide.createIcons();
    }
  },

  // 推し選択バーの描画
  renderOshiSelector() {
    const listEl = document.getElementById('oshi-pill-list');
    if (!listEl) return;

    listEl.innerHTML = this.allOshis.map(oshi => {
      const isActive = this.activeOshi && this.activeOshi.id === oshi.id;
      const avatarHtml = oshi.avatarUrl
        ? `<img src="${oshi.avatarUrl}" class="w-8 h-8 rounded-full object-cover ring-2 ring-white">`
        : `<div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style="background-color: ${oshi.themeColor || '#ec4899'}">${escapeHtml(oshi.name.substring(0, 1))}</div>`;

      return `
        <button
          onclick="App.switchOshi('${oshi.id}')"
          class="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-sm font-bold ${
            isActive
              ? 'bg-white text-slate-800 shadow-md ring-2 ring-offset-2'
              : 'bg-white/60 hover:bg-white/90 text-slate-600'
          }"
          style="${isActive ? `border: 2px solid ${oshi.themeColor || '#ec4899'};` : ''}"
        >
          ${avatarHtml}
          <span>${escapeHtml(oshi.name)}</span>
        </button>
      `;
    }).join('');
  },

  async switchOshi(id) {
    const target = this.allOshis.find(o => o.id === id);
    if (target) {
      this.activeOshi = target;
      Storage.saveSettings({ activeOshiId: target.id });
      this.renderOshiSelector();
      this.applyOshiTheme();
      this.renderCurrentView();
    }
  },

  renderCurrentView() {
    if (!this.activeOshi) {
      this.renderEmptyState();
      return;
    }

    this.renderHeader();
    this.renderHomeTab();
    this.renderSnsTab();
    this.renderGalleryTab();
    this.renderNotesTab();
    this.renderSettingsTab();

    if (window.lucide) {
      lucide.createIcons();
    }
  },

  renderEmptyState() {
    const container = document.getElementById('main-content');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-20">
          <div class="w-20 h-20 mx-auto rounded-full bg-pink-100 flex items-center justify-center text-pink-500 mb-4 animate-float">
            <i data-lucide="heart" class="w-10 h-10 fill-current"></i>
          </div>
          <h2 class="text-2xl font-bold text-slate-800 mb-2">まだ推しが登録されていません</h2>
          <p class="text-slate-500 mb-6">右上の「+ 推しを追加」ボタンから最初の推しを登録しましょう！</p>
          <button onclick="App.openOshiModal()" class="px-6 py-3 rounded-full bg-oshi-primary text-white font-bold shadow-lg hover:opacity-90 transition">
            推しを登録する ✨
          </button>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }
  },

  // ヘッダー描画
  renderHeader() {
    const oshi = this.activeOshi;
    const nameEl = document.getElementById('header-oshi-name');
    const groupEl = document.getElementById('header-oshi-group');
    const rubyEl = document.getElementById('header-oshi-ruby');
    const avatarEl = document.getElementById('header-oshi-avatar');

    if (nameEl) nameEl.textContent = oshi.name;
    if (groupEl) groupEl.textContent = oshi.groupName || '';
    if (rubyEl) rubyEl.textContent = oshi.ruby || '';

    if (avatarEl) {
      const sizeClass = `avatar-size-${oshi.avatarSize || 'medium'}`;
      const shapeClass = `avatar-shape-${oshi.avatarShape || 'circle'}`;
      const glowClass = oshi.avatarGlow !== false ? 'avatar-glow-ring' : '';

      avatarEl.className = `relative overflow-hidden shadow-2xl transition-all duration-300 ring-4 ring-white/90 bg-white/30 ${sizeClass} ${shapeClass} ${glowClass}`;

      if (oshi.avatarUrl) {
        avatarEl.innerHTML = `<img src="${oshi.avatarUrl}" class="w-full h-full object-cover">`;
      } else {
        avatarEl.innerHTML = `
          <div class="w-full h-full flex items-center justify-center text-white text-4xl font-black" style="background-color: ${oshi.themeColor || '#ec4899'}">
            ${escapeHtml(oshi.name.substring(0, 1))}
          </div>
        `;
      }
    }
  },

  // 日数計算
  calculateDayStats() {
    if (!this.activeOshi || !this.activeOshi.startDate) {
      return { daysSince: 0, nextMilestone: null, nextBirthday: null };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(this.activeOshi.startDate);
    startDate.setHours(0, 0, 0, 0);
    const diffTime = today - startDate;
    const daysSince = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    let years = today.getFullYear() - startDate.getFullYear();
    let months = today.getMonth() - startDate.getMonth();
    let days = today.getDate() - startDate.getDate();
    if (days < 0) {
      months--;
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    const milestones = [50, 100, 200, 300, 365, 400, 500, 600, 700, 777, 800, 900, 1000, 1500, 2000, 2500, 3000, 5000, 10000];
    let nextMilestone = null;
    for (const m of milestones) {
      if (m > daysSince) {
        const daysLeft = m - daysSince;
        const targetDate = new Date(startDate);
        targetDate.setDate(targetDate.getDate() + m - 1);
        nextMilestone = {
          count: m,
          daysLeft,
          dateStr: `${targetDate.getFullYear()}/${targetDate.getMonth() + 1}/${targetDate.getDate()}`
        };
        break;
      }
    }

    let nextBirthday = null;
    if (this.activeOshi.birthday) {
      const birthParts = this.activeOshi.birthday.split('-');
      const birthMonth = parseInt(birthParts[birthParts.length - 2], 10) - 1;
      const birthDay = parseInt(birthParts[birthParts.length - 1], 10);

      let targetBday = new Date(today.getFullYear(), birthMonth, birthDay);
      if (targetBday < today) {
        targetBday = new Date(today.getFullYear() + 1, birthMonth, birthDay);
      }

      const bdayDiffTime = targetBday - today;
      const daysUntilBday = Math.floor(bdayDiffTime / (1000 * 60 * 60 * 24));
      const isToday = daysUntilBday === 0;

      nextBirthday = {
        month: birthMonth + 1,
        day: birthDay,
        daysUntil: daysUntilBday,
        isToday
      };
    }

    return {
      daysSince,
      years,
      months,
      days,
      nextMilestone,
      nextBirthday
    };
  },

  // 1. ホームタブの描画
  renderHomeTab() {
    const stats = this.calculateDayStats();
    const oshi = this.activeOshi;

    const daysSinceEl = document.getElementById('stat-days-since');
    const yearsDetailEl = document.getElementById('stat-years-detail');
    const milestoneEl = document.getElementById('stat-milestone');
    const milestoneSubEl = document.getElementById('stat-milestone-sub');
    const bdayEl = document.getElementById('stat-birthday');
    const bdaySubEl = document.getElementById('stat-birthday-sub');

    if (daysSinceEl) daysSinceEl.textContent = stats.daysSince.toLocaleString();
    if (yearsDetailEl) {
      yearsDetailEl.textContent = `${stats.years}年 ${stats.months}ヶ月 ${stats.days}日`;
    }

    if (milestoneEl && milestoneSubEl) {
      if (stats.nextMilestone) {
        milestoneEl.innerHTML = `あと <span class="text-3xl font-black text-oshi-primary">${stats.nextMilestone.daysLeft}</span> 日`;
        milestoneSubEl.textContent = `${stats.nextMilestone.count}日記念 (${stats.nextMilestone.dateStr})`;
      } else {
        milestoneEl.textContent = '🎉 達成中';
        milestoneSubEl.textContent = 'たくさんの記念日を過ごしました！';
      }
    }

    if (bdayEl && bdaySubEl) {
      if (stats.nextBirthday) {
        if (stats.nextBirthday.isToday) {
          bdayEl.innerHTML = `<span class="text-2xl font-black text-rose-500 animate-pulse">🎉 本日お誕生日! 🎉</span>`;
          bdaySubEl.textContent = `HAPPY BIRTHDAY!!`;
        } else {
          bdayEl.innerHTML = `あと <span class="text-3xl font-black text-oshi-primary">${stats.nextBirthday.daysUntil}</span> 日`;
          bdaySubEl.textContent = `${stats.nextBirthday.month}月${stats.nextBirthday.day}日`;
        }
      } else {
        bdayEl.textContent = '未設定';
        bdaySubEl.textContent = '推し編集から誕生日を設定できます';
      }
    }

    this.renderHomeSnsCards();

    // 最新写真
    const photoContainer = document.getElementById('home-recent-photos');
    if (photoContainer) {
      const photos = (oshi.photos || []).slice(0, 4);
      if (photos.length === 0) {
        photoContainer.innerHTML = `
          <div class="col-span-full text-center py-8 text-slate-400 bg-white/60 rounded-3xl border border-dashed border-pink-200">
            <i data-lucide="image" class="w-8 h-8 mx-auto mb-2 opacity-50 text-pink-400"></i>
            <p class="text-xs font-bold">推しの写真がまだありません</p>
            <button onclick="App.updateActiveTab('gallery')" class="mt-2 text-xs text-oshi-primary font-bold hover:underline">
              写真を保存する ✨ →
            </button>
          </div>
        `;
      } else {
        photoContainer.innerHTML = photos.map(photo => `
          <div onclick="App.openPhotoModal('${photo.id}')" class="gallery-img-container aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition">
            <img src="${photo.url}" class="w-full h-full object-cover">
          </div>
        `).join('');
      }
    }

    // 直近のメモ
    const noteContainer = document.getElementById('home-recent-notes');
    if (noteContainer) {
      const notes = (oshi.notes || []).slice(0, 3);
      if (notes.length === 0) {
        noteContainer.innerHTML = `
          <div class="text-center py-6 text-slate-400 bg-white/60 rounded-3xl border border-dashed border-pink-200">
            <p class="text-xs font-bold">推し活メモはまだありません</p>
            <button onclick="App.updateActiveTab('notes')" class="mt-2 text-xs text-oshi-primary font-bold hover:underline">
              思い出を記録する 💖 →
            </button>
          </div>
        `;
      } else {
        noteContainer.innerHTML = notes.map(note => `
          <div class="p-3.5 bg-white/90 rounded-2xl border border-pink-100 flex items-start justify-between gap-3 shadow-xs">
            <div>
              <span class="text-[11px] px-2.5 py-0.5 rounded-full font-bold ${this.getCategoryBadgeClass(note.category)}">${this.getCategoryLabel(note.category)}</span>
              <h4 class="font-bold text-slate-800 text-sm mt-1">${escapeHtml(note.title)}</h4>
              <p class="text-xs text-slate-500 line-clamp-1 mt-0.5">${escapeHtml(note.content)}</p>
            </div>
            <span class="text-[10px] text-slate-400 whitespace-nowrap">${note.date}</span>
          </div>
        `).join('');
      }
    }
  },

  // SNSクイックアクセス（複数チャンネル・アカウントすべてにワンクリックでジャンプ可能）
  renderHomeSnsCards() {
    const container = document.getElementById('home-sns-quick');
    if (!container) return;

    const accounts = this.normalizeSnsAccounts(this.activeOshi);

    if (accounts.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-6 bg-white/60 rounded-2xl border border-dashed border-pink-200 text-xs text-slate-400">
          SNSリンクが登録されていません。
          <button onclick="App.openEditSnsModal()" class="text-oshi-primary font-bold hover:underline ml-1">
            + 登録する
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = accounts.map(acc => {
      const meta = this.getPlatformMeta(acc.platform);
      const url = this.formatSnsUrl(acc.platform, acc.url);

      return `
        <a
          href="${url}"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center justify-between p-3.5 rounded-2xl glass-card glass-card-hover border border-pink-100/60 transition-all cursor-pointer group"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-xs ${meta.badgeBg} flex-shrink-0 group-hover:scale-105 transition-transform">
              <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
            </div>
            <div class="min-w-0">
              <div class="font-bold text-slate-800 text-xs truncate">${escapeHtml(acc.title || meta.name)}</div>
              <div class="text-[10px] text-slate-400 truncate">${meta.name}</div>
            </div>
          </div>
          <i data-lucide="external-link" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-1"></i>
        </a>
      `;
    }).join('');
  },

  // 2. SNS一覧タブ（各プラットフォームごとに全チャンネル・アカウントが美しく一覧表示）
  renderSnsTab() {
    const container = document.getElementById('sns-cards-container');
    if (!container) return;

    const allAccounts = this.normalizeSnsAccounts(this.activeOshi);
    const platforms = [
      { key: 'youtube', name: 'YouTube', icon: 'youtube', badge: '動画・MV・生配信', desc: 'メイン、サブ、ゲーム配信、切り抜きなど複数のチャンネルを登録可能' },
      { key: 'twitter', name: 'X (旧Twitter)', icon: 'twitter', badge: 'タイムライン・ポスト', desc: '公式アカウント、個人垢、スタッフ垢などを登録' },
      { key: 'instagram', name: 'Instagram', icon: 'instagram', badge: 'ストーリー・リール・写真', desc: 'メイン垢、オフショットサブ垢などを登録' },
      { key: 'tiktok', name: 'TikTok', icon: 'video', badge: 'ショート動画・ダンス', desc: '公式アカウントやサブ垢などを登録' }
    ];

    container.innerHTML = platforms.map(p => {
      const meta = this.getPlatformMeta(p.key);
      const accountsForPlatform = allAccounts.filter(a => a.platform === p.key);

      return `
        <div class="sns-card-soft p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3.5">
                <div class="w-13 h-13 rounded-2xl flex items-center justify-center shadow-xs ${meta.iconBg} p-3">
                  <i data-lucide="${p.icon}" class="w-6 h-6"></i>
                </div>
                <div>
                  <h3 class="font-black text-slate-800 text-lg">${p.name}</h3>
                  <span class="text-[11px] font-bold text-slate-400 bg-white/70 px-2 py-0.5 rounded-full border border-slate-100">${p.badge}</span>
                </div>
              </div>
              <button
                onclick="App.openEditSnsModal('${p.key}')"
                class="flex items-center gap-1 text-xs font-bold text-pink-600 bg-pink-50 hover:bg-pink-100 px-3 py-1.5 rounded-full transition border border-pink-200"
              >
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                <span>追加・編集</span>
              </button>
            </div>
            <p class="text-xs text-slate-500 mb-5 leading-relaxed">${p.desc}</p>
          </div>

          <!-- 登録された全チャンネル・アカウントのボタンスタイル一覧 -->
          <div class="space-y-2.5">
            ${
              accountsForPlatform.length > 0
                ? accountsForPlatform.map(acc => {
                    const url = this.formatSnsUrl(p.key, acc.url);
                    return `
                      <div class="flex items-center gap-2">
                        <a
                          href="${url}"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex-1 flex items-center justify-between py-3 px-4 rounded-2xl font-bold text-xs transition-all shadow-xs ${meta.btnClass}"
                        >
                          <span class="truncate flex items-center gap-1.5">
                            <i data-lucide="${meta.icon}" class="w-3.5 h-3.5 flex-shrink-0"></i>
                            <span class="truncate">${escapeHtml(acc.title || p.name)}</span>
                          </span>
                          <span class="flex items-center gap-1 text-[11px] opacity-80 flex-shrink-0 ml-2">
                            <span>開く</span>
                            <i data-lucide="external-link" class="w-3 h-3"></i>
                          </span>
                        </a>
                        <button
                          onclick="App.deleteSnsAccount('${acc.id}')"
                          class="p-2 text-slate-300 hover:text-red-500 transition rounded-xl hover:bg-white"
                          title="このアカウントを削除"
                        >
                          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                      </div>
                    `;
                  }).join('')
                : `
                <div class="text-xs text-slate-400 text-center py-3 bg-white/50 rounded-2xl border border-dashed border-slate-200">
                  まだチャンネル・アカウントがありません
                </div>
                <button
                  onclick="App.openEditSnsModal('${p.key}')"
                  class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl border border-dashed border-pink-300 text-pink-600 font-bold text-xs hover:bg-pink-50/50 transition"
                >
                  <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                  <span>${p.name} を追加する</span>
                </button>
              `
            }
          </div>
        </div>
      `;
    }).join('');
  },

  // プラットフォームメタデータ取得
  getPlatformMeta(platform) {
    switch (platform) {
      case 'youtube':
        return {
          name: 'YouTube',
          icon: 'youtube',
          badgeBg: 'bg-rose-100 text-rose-600',
          btnClass: 'btn-sns-youtube-soft',
          iconBg: 'bg-gradient-to-tr from-rose-200 via-red-200 to-pink-100 text-red-600 border border-rose-200'
        };
      case 'twitter':
        return {
          name: 'X (Twitter)',
          icon: 'twitter',
          badgeBg: 'bg-slate-100 text-slate-800',
          btnClass: 'btn-sns-twitter-soft',
          iconBg: 'bg-gradient-to-tr from-slate-200 via-slate-100 to-white text-slate-800 border border-slate-200'
        };
      case 'instagram':
        return {
          name: 'Instagram',
          icon: 'instagram',
          badgeBg: 'bg-pink-100 text-pink-600',
          btnClass: 'btn-sns-instagram-soft',
          iconBg: 'bg-gradient-to-tr from-amber-200 via-rose-300 to-purple-300 text-pink-700 border border-pink-200'
        };
      case 'tiktok':
        return {
          name: 'TikTok',
          icon: 'video',
          badgeBg: 'bg-cyan-100 text-cyan-800',
          btnClass: 'btn-sns-tiktok-soft',
          iconBg: 'bg-gradient-to-tr from-cyan-100 via-sky-100 to-pink-100 text-slate-800 border border-cyan-200'
        };
      default:
        return {
          name: 'Web / SNS',
          icon: 'link',
          badgeBg: 'bg-slate-100 text-slate-600',
          btnClass: 'btn-sns-twitter-soft',
          iconBg: 'bg-slate-100 text-slate-700'
        };
    }
  },

  // SNSアカウントの削除
  async deleteSnsAccount(accId) {
    if (!this.activeOshi || !confirm('このチャンネル・アカウントリンクを削除してもよろしいですか？')) return;
    this.activeOshi.snsAccounts = (this.activeOshi.snsAccounts || []).filter(a => a.id !== accId);
    await Storage.saveOshi(this.activeOshi);
    this.renderSnsTab();
    this.renderHomeTab();
    this.showToast('リンクを削除しました');
  },

  // 3. 画像ギャラリータブ
  renderGalleryTab() {
    const container = document.getElementById('gallery-container');
    const countEl = document.getElementById('gallery-photo-count');
    if (!container) return;

    const photos = this.activeOshi.photos || [];
    if (countEl) countEl.textContent = `${photos.length} 枚`;

    if (photos.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-20 bg-white/60 rounded-3xl border border-dashed border-pink-200">
          <div class="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center text-oshi-primary mx-auto mb-3 animate-float">
            <i data-lucide="image-plus" class="w-8 h-8"></i>
          </div>
          <h3 class="font-bold text-slate-700 mb-1">推しの画像がまだありません</h3>
          <p class="text-xs text-slate-400 mb-4">右上の「+ 写真を追加」ボタンから推しの画像を保存できます</p>
          <button onclick="document.getElementById('photo-upload-input').click()" class="px-5 py-2.5 rounded-full bg-oshi-primary text-white font-bold text-xs shadow-md hover:opacity-90 transition">
            画像を選択して保存 ✨
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = photos.map(photo => `
      <div onclick="App.openPhotoModal('${photo.id}')" class="group gallery-img-container aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-xs hover:shadow-md transition bg-slate-100 relative">
        <img src="${photo.url}" class="w-full h-full object-cover" loading="lazy">
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          <span class="text-white text-xs font-medium truncate">${escapeHtml(photo.caption || '推し写真')}</span>
        </div>
        ${photo.isFavorite ? `<div class="absolute top-2 right-2 text-rose-500 bg-white/90 p-1.5 rounded-full shadow"><i data-lucide="heart" class="w-3.5 h-3.5 fill-current"></i></div>` : ''}
      </div>
    `).join('');
  },

  // 4. 活動メモタブ
  renderNotesTab() {
    const container = document.getElementById('notes-container');
    if (!container) return;

    const notes = this.activeOshi.notes || [];

    if (notes.length === 0) {
      container.innerHTML = `
        <div class="text-center py-16 bg-white/60 rounded-3xl border border-dashed border-pink-200">
          <i data-lucide="book-open" class="w-12 h-12 text-pink-300 mx-auto mb-2 animate-float"></i>
          <h3 class="font-bold text-slate-700 mb-1">メモ・活動記録はありません</h3>
          <p class="text-xs text-slate-400 mb-4">ライブ参戦の思い出やグッズ発売日などを記録できます</p>
          <button onclick="App.openNoteModal()" class="px-5 py-2 rounded-full bg-oshi-primary text-white font-bold text-xs shadow">
            最初のメモを書く ✨
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = notes.map(note => `
      <div class="glass-card rounded-2xl p-5 border border-pink-100/60 shadow-xs relative group">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs px-2.5 py-1 rounded-full font-bold ${this.getCategoryBadgeClass(note.category)}">
            ${this.getCategoryLabel(note.category)}
          </span>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400">${note.date}</span>
            <button onclick="App.deleteNote('${note.id}')" class="text-slate-300 hover:text-red-500 p-1 transition opacity-0 group-hover:opacity-100">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
        <h4 class="font-bold text-slate-800 text-base mb-1">${escapeHtml(note.title)}</h4>
        <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed">${escapeHtml(note.content)}</p>
      </div>
    `).join('');
  },

  // 5. 設定・クラウド同期タブ
  renderSettingsTab() {
    const settings = Storage.getSettings();
    const keyInput = document.getElementById('setting-secret-key');
    const urlInput = document.getElementById('setting-supabase-url');
    const anonInput = document.getElementById('setting-supabase-anon');
    const syncStatusEl = document.getElementById('sync-last-status');

    if (keyInput) keyInput.value = settings.secretKey || '';
    if (urlInput) urlInput.value = settings.supabaseUrl || '';
    if (anonInput) anonInput.value = settings.supabaseAnonKey || '';

    if (syncStatusEl) {
      if (settings.lastSyncedAt) {
        const d = new Date(settings.lastSyncedAt);
        syncStatusEl.textContent = `最終同期: ${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      } else {
        syncStatusEl.textContent = '未同期（ローカル保存中）';
      }
    }
  },

  updateActiveTab(tabName) {
    this.currentTab = tabName;
    const tabs = ['home', 'sns', 'gallery', 'notes', 'settings'];

    tabs.forEach(t => {
      const pane = document.getElementById(`tab-pane-${t}`);
      const btn = document.getElementById(`tab-btn-${t}`);
      const mobileBtn = document.getElementById(`mobile-tab-btn-${t}`);

      if (pane) {
        if (t === tabName) {
          pane.classList.remove('hidden');
        } else {
          pane.classList.add('hidden');
        }
      }

      if (btn) {
        if (t === tabName) {
          btn.classList.add('text-oshi-primary', 'border-b-2', 'border-oshi-primary', 'font-black');
          btn.classList.remove('text-slate-400');
        } else {
          btn.classList.remove('text-oshi-primary', 'border-b-2', 'border-oshi-primary', 'font-black');
          btn.classList.add('text-slate-400');
        }
      }

      if (mobileBtn) {
        if (t === tabName) {
          mobileBtn.classList.add('text-oshi-primary', 'font-black');
          mobileBtn.classList.remove('text-slate-400');
        } else {
          mobileBtn.classList.remove('text-oshi-primary', 'font-black');
          mobileBtn.classList.add('text-slate-400');
        }
      }
    });

    if (window.lucide) lucide.createIcons();
  },

  formatSnsUrl(type, value) {
    if (!value || !value.trim()) return '';
    value = value.trim();
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    const cleanId = value.replace(/^@/, '');

    switch (type) {
      case 'twitter':
        return `https://x.com/${cleanId}`;
      case 'instagram':
        return `https://instagram.com/${cleanId}`;
      case 'youtube':
        return cleanId.startsWith('UC') ? `https://youtube.com/channel/${cleanId}` : `https://youtube.com/@${cleanId}`;
      case 'tiktok':
        return `https://www.tiktok.com/@${cleanId}`;
      default:
        return `https://${value}`;
    }
  },

  getCategoryBadgeClass(category) {
    switch (category) {
      case 'live': return 'bg-rose-100 text-rose-700';
      case 'goods': return 'bg-amber-100 text-amber-700';
      case 'release': return 'bg-blue-100 text-blue-700';
      case 'memory': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  },

  getCategoryLabel(category) {
    switch (category) {
      case 'live': return '🎤 ライブ・イベント';
      case 'goods': return '🛍️ グッズ';
      case 'release': return '💿 発売・配信';
      case 'memory': return '✨ 思い出';
      default: return '📝 メモ';
    }
  },

  setupEventListeners() {
    const fileInput = document.getElementById('photo-upload-input');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        await this.handlePhotoUpload(files);
        fileInput.value = '';
      });
    }

    const avatarInput = document.getElementById('oshi-avatar-input');
    if (avatarInput) {
      avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          this.currentRawAvatarSource = evt.target.result;
          document.getElementById('avatar-cropper-controls').classList.remove('hidden');
          document.getElementById('avatar-zoom-slider').value = '100';
          document.getElementById('avatar-offset-y-slider').value = '0';
          this.updateAvatarCropPreview();
        };
        reader.readAsDataURL(file);
      });
    }

    const zoomSlider = document.getElementById('avatar-zoom-slider');
    const offsetYSlider = document.getElementById('avatar-offset-y-slider');
    if (zoomSlider && offsetYSlider) {
      zoomSlider.addEventListener('input', () => this.updateAvatarCropPreview());
      offsetYSlider.addEventListener('input', () => this.updateAvatarCropPreview());
    }
  },

  async updateAvatarCropPreview() {
    if (!this.currentRawAvatarSource) return;
    const zoomVal = parseInt(document.getElementById('avatar-zoom-slider').value, 10) / 100;
    const offsetYVal = parseInt(document.getElementById('avatar-offset-y-slider').value, 10);

    const cropped = await ImageUtils.cropCustomAvatar(this.currentRawAvatarSource, zoomVal, 0, offsetYVal, 400);
    document.getElementById('oshi-avatar-preview').src = cropped;
    document.getElementById('oshi-avatar-hidden').value = cropped;
  },

  async handlePhotoUpload(files) {
    if (!this.activeOshi) return;

    this.showToast('写真をふわっと最適化中... ✨');
    let addedCount = 0;

    for (const file of files) {
      try {
        const res = await ImageUtils.compressImage(file);
        const newPhoto = {
          id: 'photo-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          url: res.dataUrl,
          caption: file.name.replace(/\.[^/.]+$/, ''),
          createdAt: new Date().toISOString(),
          isFavorite: false
        };

        if (!this.activeOshi.photos) this.activeOshi.photos = [];
        this.activeOshi.photos.unshift(newPhoto);
        addedCount++;
      } catch (err) {
        console.error('画像処理エラー:', err);
      }
    }

    await Storage.saveOshi(this.activeOshi);
    this.renderGalleryTab();
    this.renderHomeTab();
    this.showToast(`${addedCount} 枚の推し写真を保存しました！💖`);
  },

  openPhotoModal(photoId) {
    const photo = (this.activeOshi.photos || []).find(p => p.id === photoId);
    if (!photo) return;

    this.selectedPhoto = photo;
    const modal = document.getElementById('photo-detail-modal');
    const imgEl = document.getElementById('photo-modal-img');
    const captionEl = document.getElementById('photo-modal-caption');
    const favIcon = document.getElementById('photo-modal-fav-icon');

    if (imgEl) imgEl.src = photo.url;
    if (captionEl) captionEl.value = photo.caption || '';
    if (favIcon) {
      favIcon.className = photo.isFavorite ? 'w-5 h-5 fill-rose-500 text-rose-500' : 'w-5 h-5 text-white/70';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
  },

  closePhotoModal() {
    const modal = document.getElementById('photo-detail-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    this.selectedPhoto = null;
  },

  async togglePhotoFavorite() {
    if (!this.selectedPhoto || !this.activeOshi) return;
    this.selectedPhoto.isFavorite = !this.selectedPhoto.isFavorite;
    await Storage.saveOshi(this.activeOshi);
    this.openPhotoModal(this.selectedPhoto.id);
    this.renderGalleryTab();
  },

  async savePhotoCaption() {
    if (!this.selectedPhoto || !this.activeOshi) return;
    const captionEl = document.getElementById('photo-modal-caption');
    if (captionEl) {
      this.selectedPhoto.caption = captionEl.value.trim();
      await Storage.saveOshi(this.activeOshi);
      this.showToast('キャプションを保存しました ✨');
      this.renderGalleryTab();
    }
  },

  downloadCurrentPhoto() {
    if (!this.selectedPhoto) return;
    const a = document.createElement('a');
    a.href = this.selectedPhoto.url;
    a.download = `${this.activeOshi.name}_${this.selectedPhoto.caption || 'photo'}.webp`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  async deleteCurrentPhoto() {
    if (!this.selectedPhoto || !this.activeOshi) return;
    if (!confirm('この写真を削除してもよろしいですか？')) return;

    this.activeOshi.photos = this.activeOshi.photos.filter(p => p.id !== this.selectedPhoto.id);
    await Storage.saveOshi(this.activeOshi);
    this.closePhotoModal();
    this.renderGalleryTab();
    this.renderHomeTab();
    this.showToast('写真を削除しました');
  },

  openOshiModal(oshiToEdit = null) {
    const modal = document.getElementById('oshi-edit-modal');
    const titleEl = document.getElementById('oshi-modal-title');
    const idInput = document.getElementById('oshi-edit-id');
    const nameInput = document.getElementById('oshi-edit-name');
    const rubyInput = document.getElementById('oshi-edit-ruby');
    const groupInput = document.getElementById('oshi-edit-group');
    const dateInput = document.getElementById('oshi-edit-start-date');
    const bdayInput = document.getElementById('oshi-edit-birthday');
    const colorInput = document.getElementById('oshi-edit-color');
    const avatarHidden = document.getElementById('oshi-avatar-hidden');
    const avatarPreview = document.getElementById('oshi-avatar-preview');

    const sizeSelect = document.getElementById('oshi-avatar-size');
    const shapeSelect = document.getElementById('oshi-avatar-shape');
    const glowCheck = document.getElementById('oshi-avatar-glow');
    const cropperControls = document.getElementById('avatar-cropper-controls');

    this.currentRawAvatarSource = null;
    if (cropperControls) cropperControls.classList.add('hidden');

    if (oshiToEdit) {
      titleEl.textContent = '推し情報の編集 ✨';
      idInput.value = oshiToEdit.id;
      nameInput.value = oshiToEdit.name || '';
      rubyInput.value = oshiToEdit.ruby || '';
      groupInput.value = oshiToEdit.groupName || '';
      dateInput.value = oshiToEdit.startDate || '';
      bdayInput.value = oshiToEdit.birthday || '';
      colorInput.value = oshiToEdit.themeColor || '#ec4899';
      avatarHidden.value = oshiToEdit.avatarUrl || '';
      avatarPreview.src = oshiToEdit.avatarUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';

      if (sizeSelect) sizeSelect.value = oshiToEdit.avatarSize || 'medium';
      if (shapeSelect) shapeSelect.value = oshiToEdit.avatarShape || 'circle';
      if (glowCheck) glowCheck.checked = oshiToEdit.avatarGlow !== false;
    } else {
      titleEl.textContent = '新しい推しを登録 💖';
      idInput.value = '';
      nameInput.value = '';
      rubyInput.value = '';
      groupInput.value = '';
      dateInput.value = new Date().toISOString().split('T')[0];
      bdayInput.value = '';
      colorInput.value = '#ec4899';
      avatarHidden.value = '';
      avatarPreview.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';

      if (sizeSelect) sizeSelect.value = 'medium';
      if (shapeSelect) shapeSelect.value = 'circle';
      if (glowCheck) glowCheck.checked = true;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
  },

  closeOshiModal() {
    const modal = document.getElementById('oshi-edit-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },

  async saveOshiForm(e) {
    e.preventDefault();
    const id = document.getElementById('oshi-edit-id').value;
    const name = document.getElementById('oshi-edit-name').value.trim();
    if (!name) {
      alert('推しの名前を入力してください');
      return;
    }

    const ruby = document.getElementById('oshi-edit-ruby').value.trim();
    const groupName = document.getElementById('oshi-edit-group').value.trim();
    const startDate = document.getElementById('oshi-edit-start-date').value;
    const birthday = document.getElementById('oshi-edit-birthday').value;
    const themeColor = document.getElementById('oshi-edit-color').value;
    const avatarUrl = document.getElementById('oshi-avatar-hidden').value;

    const avatarSize = document.getElementById('oshi-avatar-size')?.value || 'medium';
    const avatarShape = document.getElementById('oshi-avatar-shape')?.value || 'circle';
    const avatarGlow = document.getElementById('oshi-avatar-glow')?.checked ?? true;

    let targetOshi;
    if (id) {
      targetOshi = this.allOshis.find(o => o.id === id);
      if (targetOshi) {
        targetOshi.name = name;
        targetOshi.ruby = ruby;
        targetOshi.groupName = groupName;
        targetOshi.startDate = startDate;
        targetOshi.birthday = birthday;
        targetOshi.themeColor = themeColor;
        targetOshi.avatarSize = avatarSize;
        targetOshi.avatarShape = avatarShape;
        targetOshi.avatarGlow = avatarGlow;
        if (avatarUrl) targetOshi.avatarUrl = avatarUrl;
      }
    } else {
      targetOshi = {
        id: 'oshi-' + Date.now(),
        name,
        ruby,
        groupName,
        startDate: startDate || new Date().toISOString().split('T')[0],
        birthday,
        themeColor,
        avatarUrl,
        avatarSize,
        avatarShape,
        avatarGlow,
        snsAccounts: [],
        notes: [],
        photos: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.allOshis.push(targetOshi);
    }

    await Storage.saveOshi(targetOshi);
    this.activeOshi = targetOshi;
    Storage.saveSettings({ activeOshiId: targetOshi.id });
    this.closeOshiModal();
    await this.loadOshis();
    this.showToast(`推し「${name}」の情報を保存しました！✨`);
  },

  async deleteCurrentOshi() {
    if (!this.activeOshi) return;
    if (!confirm(`推し「${this.activeOshi.name}」のデータ（写真やメモ含む）を全て削除してもよろしいですか？`)) {
      return;
    }

    await Storage.deleteOshi(this.activeOshi.id);
    this.showToast(`「${this.activeOshi.name}」を削除しました`);
    this.activeOshi = null;
    Storage.saveSettings({ activeOshiId: null });
    await this.loadOshis();
  },

  // SNS編集モーダル（複数チャンネル・アカウントの登録＆管理）
  openEditSnsModal(presetPlatform = null) {
    if (!this.activeOshi) return;
    const modal = document.getElementById('sns-edit-modal');
    this.renderSnsAccountsListInModal();

    if (presetPlatform) {
      document.getElementById('new-sns-platform').value = presetPlatform;
      // プラットフォームに応じたデフォルトのプレースホルダー
      if (presetPlatform === 'youtube') {
        document.getElementById('new-sns-title').placeholder = '例: サブチャンネル, ゲーム配信ch';
      } else if (presetPlatform === 'twitter') {
        document.getElementById('new-sns-title').placeholder = '例: 個人X, スタッフ公式X';
      }
    }

    document.getElementById('new-sns-title').value = '';
    document.getElementById('new-sns-url').value = '';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) lucide.createIcons();
  },

  // モーダル内の登録済みSNSリスト描画
  renderSnsAccountsListInModal() {
    const listEl = document.getElementById('sns-modal-accounts-list');
    if (!listEl || !this.activeOshi) return;

    const accounts = this.normalizeSnsAccounts(this.activeOshi);

    if (accounts.length === 0) {
      listEl.innerHTML = `<p class="text-xs text-slate-400 text-center py-3 bg-slate-50 rounded-xl">登録されているSNSリンクはありません</p>`;
      return;
    }

    listEl.innerHTML = accounts.map(acc => {
      const meta = this.getPlatformMeta(acc.platform);
      return `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
          <div class="flex items-center gap-2 min-w-0">
            <span class="p-1.5 rounded-lg ${meta.badgeBg}">
              <i data-lucide="${meta.icon}" class="w-3.5 h-3.5"></i>
            </span>
            <div class="min-w-0">
              <div class="font-bold text-slate-800 truncate">${escapeHtml(acc.title)}</div>
              <div class="text-[10px] text-slate-400 truncate">${escapeHtml(acc.url)}</div>
            </div>
          </div>
          <button
            type="button"
            onclick="App.deleteSnsAccountInModal('${acc.id}')"
            class="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition"
            title="削除"
          >
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  async deleteSnsAccountInModal(accId) {
    if (!this.activeOshi) return;
    this.activeOshi.snsAccounts = (this.activeOshi.snsAccounts || []).filter(a => a.id !== accId);
    await Storage.saveOshi(this.activeOshi);
    this.renderSnsAccountsListInModal();
    this.renderSnsTab();
    this.renderHomeTab();
  },

  closeEditSnsModal() {
    const modal = document.getElementById('sns-edit-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },

  // 新しいSNSアカウント・チャンネルを追加
  async addNewSnsAccount(e) {
    e.preventDefault();
    if (!this.activeOshi) return;

    const platform = document.getElementById('new-sns-platform').value;
    const title = document.getElementById('new-sns-title').value.trim();
    const url = document.getElementById('new-sns-url').value.trim();

    if (!url) {
      alert('URLまたはアカウントIDを入力してください');
      return;
    }

    const meta = this.getPlatformMeta(platform);
    const newAcc = {
      id: 'acc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      platform,
      title: title || `${meta.name} アカウント`,
      url
    };

    if (!this.activeOshi.snsAccounts) this.activeOshi.snsAccounts = [];
    this.activeOshi.snsAccounts.push(newAcc);

    await Storage.saveOshi(this.activeOshi);

    document.getElementById('new-sns-title').value = '';
    document.getElementById('new-sns-url').value = '';

    this.renderSnsAccountsListInModal();
    this.renderSnsTab();
    this.renderHomeTab();
    this.showToast(`「${newAcc.title}」を追加しました！✨`);
  },

  openNoteModal() {
    const modal = document.getElementById('note-edit-modal');
    document.getElementById('note-edit-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('note-edit-title').value = '';
    document.getElementById('note-edit-content').value = '';
    document.getElementById('note-edit-category').value = 'memory';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closeNoteModal() {
    const modal = document.getElementById('note-edit-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },

  async saveNoteForm(e) {
    e.preventDefault();
    if (!this.activeOshi) return;

    const title = document.getElementById('note-edit-title').value.trim();
    const content = document.getElementById('note-edit-content').value.trim();
    if (!title || !content) {
      alert('タイトルと内容を入力してください');
      return;
    }

    const newNote = {
      id: 'note-' + Date.now(),
      date: document.getElementById('note-edit-date').value,
      title,
      content,
      category: document.getElementById('note-edit-category').value
    };

    if (!this.activeOshi.notes) this.activeOshi.notes = [];
    this.activeOshi.notes.unshift(newNote);

    await Storage.saveOshi(this.activeOshi);
    this.closeNoteModal();
    this.renderNotesTab();
    this.renderHomeTab();
    this.showToast('推し活メモを記録しました！💖');
  },

  async deleteNote(noteId) {
    if (!this.activeOshi || !confirm('このメモを削除してもよろしいですか？')) return;
    this.activeOshi.notes = (this.activeOshi.notes || []).filter(n => n.id !== noteId);
    await Storage.saveOshi(this.activeOshi);
    this.renderNotesTab();
    this.renderHomeTab();
    this.showToast('メモを削除しました');
  },

  saveSyncSettings() {
    const secretKey = document.getElementById('setting-secret-key').value.trim();
    const supabaseUrl = document.getElementById('setting-supabase-url').value.trim();
    const supabaseAnonKey = document.getElementById('setting-supabase-anon').value.trim();

    Storage.saveSettings({
      secretKey,
      supabaseUrl,
      supabaseAnonKey
    });

    CloudSync.initClient();
    this.showToast('設定を保存しました！✨');
  },

  async testSupabase() {
    const url = document.getElementById('setting-supabase-url').value.trim();
    const anon = document.getElementById('setting-supabase-anon').value.trim();
    if (!url || !anon) {
      alert('URLとAnon Keyを入力してください。');
      return;
    }
    this.showToast('接続テスト中...');
    const res = await CloudSync.testConnection(url, anon);
    alert(res.message);
  },

  async uploadCloud() {
    try {
      this.showToast('クラウドへ同期中... ☁️');
      const res = await CloudSync.uploadToCloud();
      this.renderSettingsTab();
      this.showToast('クラウドへの保存が完了しました！✨');
    } catch (err) {
      alert('保存エラー: ' + err.message);
    }
  },

  async downloadCloud() {
    try {
      if (!confirm('クラウドのデータで現在の端末のデータを上書きしますか？')) return;
      this.showToast('クラウドから受信中... ☁️');
      const res = await CloudSync.downloadFromCloud();
      await this.loadOshis();
      this.renderSettingsTab();
      this.showToast(`同期完了！ ${res.count} 人の推しデータを復元しました ✨`);
    } catch (err) {
      alert('同期エラー: ' + err.message);
    }
  },

  async exportJson() {
    const data = await Storage.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_fav_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('バックアップファイルを保存しました 💖');
  },

  async importJson(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await Storage.importAllData(json);
      await this.loadOshis();
      this.showToast('復元が完了しました！✨');
    } catch (err) {
      alert('復元に失敗しました: ' + err.message);
    }
  },

  showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 md:bottom-8 bg-slate-900/90 text-white text-xs font-bold px-5 py-3 rounded-full shadow-2xl backdrop-blur-md transition-all duration-300 z-50 pointer-events-none opacity-0 flex items-center gap-2';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('opacity-0');
    toast.classList.add('opacity-100');

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('opacity-100');
      toast.classList.add('opacity-0');
    }, 2500);
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
