const dashboardHtml = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Athena Proxy / Console</title>
  <style>
    :root {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #20241f;
      background: #f4f5f1;
      font-synthesis: none;
      text-rendering: optimizeLegibility;
      --ink: #20241f;
      --muted: #777d74;
      --line: #e5e7e1;
      --paper: #fff;
      --canvas: #f4f5f1;
      --nav: #202820;
      --nav-muted: #a8b0a4;
      --accent: #d8f36a;
      --green: #51714e;
      --red: #a44f43;
      --radius: 12px;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 320px; background: var(--canvas); }
    button, input, select { font: inherit; }
    button { cursor: pointer; }
    .app { min-height: 100vh; }
    .sidebar {
      position: fixed; inset: 0 auto 0 0; z-index: 5; display: flex; width: 236px;
      flex-direction: column; padding: 25px 16px 18px; color: white; background: var(--nav);
    }
    .brand { display: flex; align-items: center; gap: 11px; padding: 0 8px 30px; }
    .brand-mark { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 10px; color: var(--nav); background: var(--accent); font-size: 14px; font-weight: 850; letter-spacing: -1px; }
    .brand-name { font-size: 14px; font-weight: 750; letter-spacing: -.3px; }
    .brand-caption { margin-top: 3px; color: var(--nav-muted); font-size: 10px; letter-spacing: .09em; text-transform: uppercase; }
    .nav-label { padding: 0 10px; margin: 4px 0 9px; color: #869084; font-size: 9px; font-weight: 750; letter-spacing: .14em; text-transform: uppercase; }
    .nav-list { display: grid; gap: 4px; }
    .nav-button { display: flex; align-items: center; gap: 11px; width: 100%; min-height: 39px; padding: 0 10px; border: 0; border-radius: 8px; color: var(--nav-muted); background: transparent; text-align: left; font-size: 12px; transition: background .15s, color .15s; }
    .nav-button:hover { color: white; background: #303a30; }
    .nav-button.active { color: white; background: #384337; }
    .nav-button.active .nav-icon { color: var(--accent); }
    .nav-icon { width: 16px; height: 16px; color: #9aa597; }
    .nav-spacer { flex: 1; }
    .side-note { margin: 0 3px; padding: 13px 12px; border: 1px solid #394239; border-radius: 9px; background: #283128; }
    .side-note-top { display: flex; align-items: center; gap: 7px; color: #e0e8dd; font-size: 10px; font-weight: 650; }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #91bd68; box-shadow: 0 0 0 3px #91bd6821; }
    .side-note p { margin: 7px 0 0; color: #a2ac9e; font-size: 10px; line-height: 1.55; }
    .side-footer { padding: 16px 9px 0; color: #7e897d; font-size: 10px; }
    .main { min-height: 100vh; margin-left: 236px; }
    .topbar { display: flex; min-height: 66px; align-items: center; justify-content: space-between; padding: 0 34px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.72); }
    .crumb { color: var(--muted); font-size: 11px; }
    .crumb strong { color: var(--ink); font-weight: 650; }
    .top-actions { display: flex; align-items: center; gap: 10px; }
    .top-meta { color: var(--muted); font-size: 10px; }
    .avatar { display: grid; width: 30px; height: 30px; place-items: center; border: 1px solid #dfe3d8; border-radius: 50%; color: #3b4a37; background: #e9edde; font-size: 10px; font-weight: 750; }
    .content { max-width: 1440px; margin: 0 auto; padding: 31px 34px 48px; }
    .heading-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
    .eyebrow { margin-bottom: 8px; color: var(--green); font-size: 9px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(24px, 3vw, 31px); font-weight: 690; letter-spacing: -1.3px; line-height: 1.12; }
    .subtitle { margin: 8px 0 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
    .button { display: inline-flex; min-height: 36px; align-items: center; justify-content: center; gap: 7px; padding: 0 12px; border: 1px solid #dfe2da; border-radius: 7px; color: #343a32; background: white; font-size: 11px; font-weight: 650; transition: border .15s, background .15s; }
    .button:hover { border-color: #bfc8b7; background: #fbfcf8; }
    .button-primary { border-color: var(--nav); color: white; background: var(--nav); }
    .button-primary:hover { border-color: #39463a; background: #39463a; }
    .button-small { min-height: 29px; padding: 0 9px; font-size: 10px; }
    .button-icon { width: 14px; height: 14px; }
    .grid { display: grid; gap: 14px; }
    .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 15px; }
    .card { min-width: 0; border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper); }
    .stat-card { padding: 17px 18px 16px; }
    .stat-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .stat-label { color: var(--muted); font-size: 10px; font-weight: 600; }
    .stat-glyph { display: grid; width: 27px; height: 27px; place-items: center; border-radius: 8px; color: #546849; background: #eff3e8; }
    .stat-glyph svg { width: 14px; height: 14px; }
    .stat-value { margin-top: 13px; font-size: 26px; font-weight: 680; letter-spacing: -1.2px; font-variant-numeric: tabular-nums; }
    .stat-foot { margin-top: 4px; color: #899087; font-size: 10px; }
    .overview-grid { grid-template-columns: minmax(0, 1.55fr) minmax(255px, .85fr); align-items: stretch; margin-bottom: 15px; }
    .card-head { display: flex; min-height: 57px; align-items: center; justify-content: space-between; gap: 12px; padding: 0 18px; border-bottom: 1px solid #eff0ed; }
    .card-title { font-size: 12px; font-weight: 680; letter-spacing: -.1px; }
    .card-subtitle { margin-top: 4px; color: #92988f; font-size: 10px; }
    .chart-wrap { padding: 17px 18px 12px; }
    .chart { display: flex; height: 150px; align-items: end; gap: 8px; padding: 8px 2px 0; }
    .chart-col { display: flex; height: 100%; flex: 1; flex-direction: column; align-items: center; justify-content: end; gap: 8px; min-width: 0; }
    .bar-area { display: flex; width: min(100%, 31px); height: 116px; align-items: end; overflow: hidden; border-radius: 5px 5px 2px 2px; background: #f2f4ee; }
    .bar { width: 100%; min-height: 3px; border-radius: 5px 5px 2px 2px; background: #a7b99b; transition: height .25s; }
    .bar.latest { background: #597651; }
    .chart-label { overflow: hidden; width: 100%; color: #92988f; text-align: center; text-overflow: ellipsis; white-space: nowrap; font-size: 9px; }
    .chart-empty { display: grid; width: 100%; place-items: center; color: var(--muted); font-size: 11px; }
    .chart-legend { display: flex; align-items: center; gap: 7px; margin-top: 12px; color: #92988f; font-size: 10px; }
    .legend-dot { width: 7px; height: 7px; border-radius: 2px; background: #597651; }
    .latest-list { padding: 1px 17px 5px; }
    .latest-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 53px; border-bottom: 1px solid #f0f1ed; }
    .latest-item:last-child { border-bottom: 0; }
    .latest-main { overflow: hidden; min-width: 0; }
    .latest-name { overflow: hidden; color: #323830; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 620; }
    .latest-id { margin-top: 4px; color: #969b93; font-size: 9px; }
    .latest-date { flex-shrink: 0; color: #858c81; font-size: 9px; }
    .table-card { overflow: hidden; }
    .table-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .search-wrap { position: relative; min-width: 210px; }
    .search-icon { position: absolute; top: 10px; left: 10px; width: 14px; height: 14px; color: #92988f; pointer-events: none; }
    .input, .select { width: 100%; height: 35px; padding: 0 10px; border: 1px solid #e2e5dd; border-radius: 7px; outline: 0; color: var(--ink); background: white; font-size: 11px; }
    .input:focus, .select:focus { border-color: #8a9c7d; box-shadow: 0 0 0 3px #7189661a; }
    .input-search { padding-left: 31px; }
    .select { width: auto; min-width: 113px; }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { height: 37px; padding: 0 15px; color: #858c81; background: #fafbf8; font-size: 9px; font-weight: 720; letter-spacing: .055em; text-transform: uppercase; white-space: nowrap; }
    td { height: 50px; padding: 8px 15px; border-top: 1px solid #f0f1ed; color: #50574e; font-size: 10px; }
    tr[data-clickable] { cursor: pointer; }
    tr[data-clickable]:hover td { background: #fafbf7; }
    .primary-cell { max-width: 260px; overflow: hidden; color: #30372e; font-size: 10px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
    .mono { color: #777f75; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 9px; }
    .pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 7px; border-radius: 20px; color: #55704d; background: #eff4e9; font-size: 9px; font-weight: 650; white-space: nowrap; }
    .pill-dot { width: 5px; height: 5px; border-radius: 50%; background: #81a36b; }
    .empty-cell { height: 120px; color: #8c9389; text-align: center; }
    .table-foot { display: flex; min-height: 52px; align-items: center; justify-content: space-between; gap: 10px; padding: 0 15px; border-top: 1px solid #eff0ed; color: #81877e; font-size: 10px; }
    .pagination { display: flex; align-items: center; gap: 6px; }
    .page-count { min-width: 62px; text-align: center; }
    .inline-link { padding: 0; border: 0; color: #58734f; background: transparent; font-size: inherit; font-weight: 650; }
    .inline-link:hover { text-decoration: underline; }
    .detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 9px; padding: 16px 18px 18px; }
    .detail-item { min-width: 0; padding: 10px; border: 1px solid #eff0ed; border-radius: 7px; background: #fcfcfa; }
    .detail-label { margin-bottom: 5px; color: #92988f; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }
    .detail-value { overflow-wrap: anywhere; color: #384036; font-size: 10px; }
    .notice { margin: 0 0 14px; padding: 11px 13px; border: 1px solid #e7e8db; border-radius: 8px; color: #696d58; background: #f8f8ef; font-size: 10px; line-height: 1.6; }
    .toast { position: fixed; right: 22px; bottom: 20px; z-index: 20; max-width: min(400px, calc(100vw - 40px)); padding: 12px 15px; border: 1px solid #39463a; border-radius: 8px; color: white; background: #283128; box-shadow: 0 12px 35px #1820182b; font-size: 11px; }
    .toast.error { border-color: #7e453d; background: #713f37; }
    .loading { color: #899087; }
    .drawer-backdrop { position: fixed; inset: 0; z-index: 10; background: #17201959; }
    .drawer { position: fixed; inset: 0 0 0 auto; z-index: 11; overflow: auto; width: min(520px, 100vw); padding: 25px 22px; background: var(--canvas); box-shadow: -12px 0 40px #1921181a; }
    .drawer-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 17px; }
    .drawer h2 { margin: 0; font-size: 20px; letter-spacing: -.6px; }
    .drawer-section { margin-top: 14px; }
    .drawer-section .card-head { padding: 0 13px; }
    .drawer-section td, .drawer-section th { padding-right: 10px; padding-left: 10px; }
    .hidden { display: none !important; }
    .auth-overlay { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 18px; background: #1e271f; }
    .auth-card { width: min(400px, 100%); padding: 27px; border: 1px solid #e6e9e0; border-radius: 13px; background: white; box-shadow: 0 24px 80px #1018104d; }
    .auth-card .brand { padding: 0 0 22px; color: var(--ink); }
    .auth-card h1 { font-size: 24px; }
    .auth-card .subtitle { margin-bottom: 20px; }
    .auth-card label { display: block; margin-bottom: 7px; color: #555d52; font-size: 10px; font-weight: 650; }
    .auth-card .input { height: 40px; }
    .auth-card .button { width: 100%; margin-top: 11px; }
    .auth-error { min-height: 18px; margin-top: 9px; color: var(--red); font-size: 10px; }
    .mobile-menu { display: none; }
    @media (max-width: 1050px) {
      .content { padding-right: 24px; padding-left: 24px; }
      .topbar { padding: 0 24px; }
      .stats { grid-template-columns: repeat(2, minmax(0,1fr)); }
      .overview-grid { grid-template-columns: minmax(0, 1.2fr) minmax(240px, .8fr); }
    }
    @media (max-width: 760px) {
      .sidebar { width: 68px; padding-right: 9px; padding-left: 9px; }
      .brand { justify-content: center; padding: 0 0 25px; }
      .brand-copy, .nav-label, .nav-text, .side-note, .side-footer { display: none; }
      .nav-button { justify-content: center; padding: 0; }
      .nav-icon { width: 18px; height: 18px; }
      .main { margin-left: 68px; }
      .topbar { min-height: 58px; padding: 0 16px; }
      .content { padding: 24px 16px 35px; }
      .heading-row { align-items: flex-start; }
      .overview-grid { grid-template-columns: 1fr; }
      .top-meta { display: none; }
    }
    @media (max-width: 500px) {
      .stats { gap: 9px; }
      .stat-card { padding: 13px; }
      .stat-value { font-size: 22px; }
      .stat-label { font-size: 9px; }
      .heading-row { gap: 8px; }
      .heading-row .button { min-height: 32px; padding: 0 9px; font-size: 10px; }
      .search-wrap { width: 100%; min-width: 0; }
      .table-tools { width: 100%; }
      .table-tools .select { flex: 1; }
      .card-head { align-items: flex-start; flex-direction: column; padding-top: 13px; padding-bottom: 12px; }
      .card-head .table-tools { width: 100%; }
      .detail-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div id="auth" class="auth-overlay">
    <form id="auth-form" class="auth-card">
      <div class="brand">
        <div class="brand-mark">AP</div>
        <div class="brand-copy"><div class="brand-name">Athena Proxy</div><div class="brand-caption">Console & Operations</div></div>
      </div>
      <div class="eyebrow">Admin workspace</div>
      <h1>Masuk ke console</h1>
      <p class="subtitle">Gunakan admin key Worker untuk membuka data operasional. Key hanya disimpan selama tab ini terbuka.</p>
      <label for="admin-key">Admin key</label>
      <input id="admin-key" class="input" type="password" autocomplete="current-password" placeholder="Masukkan admin key">
      <button class="button button-primary" type="submit">Buka dashboard <span aria-hidden="true">→</span></button>
      <div id="auth-error" class="auth-error" role="status"></div>
    </form>
  </div>
  <div id="app" class="app hidden">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">AP</div>
        <div class="brand-copy"><div class="brand-name">Athena Proxy</div><div class="brand-caption">Console & Operations</div></div>
      </div>
      <div class="nav-label">Workspace</div>
      <nav id="nav-list" class="nav-list" aria-label="Navigasi utama"></nav>
      <div class="nav-spacer"></div>
      <div class="side-note"><div class="side-note-top"><span id="health-dot" class="status-dot"></span><span id="health-label">Mengecek layanan</span></div><p>Ringkasan status berdasarkan respons Worker dan koneksi D1.</p></div>
      <div class="side-footer">Athena Proxy <span id="build-year"></span></div>
    </aside>
    <main class="main">
      <header class="topbar"><div class="crumb">Workspace <span aria-hidden="true">/</span> <strong id="crumb-current">Overview</strong></div>
        <div class="top-actions"><span id="last-updated" class="top-meta">Belum diperbarui</span><span class="avatar" aria-label="Admin">AD</span></div>
      </header>
      <div id="content" class="content"></div>
    </main>
  </div>
  <div id="drawer-root"></div>
  <div id="toast-root" aria-live="polite"></div>
  <script>
    (function () {
      var navItems = [
        { id: 'overview', label: 'Overview', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>' },
        { id: 'shares', label: 'Shares', icon: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/>' },
        { id: 'files', label: 'Media files', icon: '<path d="M4 3h11l5 5v13H4z"/><path d="M14 3v6h6M8 14h8M8 17h6"/>' },
        { id: 'thumbnails', label: 'Thumbnails', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/>' },
        { id: 'analytics', label: 'Analytics', icon: '<path d="M4 19V5M4 19h17"/><path d="m7 15 4-5 3 2 5-7"/>' },
        { id: 'lookup', label: 'Cache lookup', icon: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4M8 10h5M10.5 7.5v5"/>' }
      ];
      var state = { page: 'overview', pageNum: 1, pageSize: 25, query: '', sort: '', order: 'desc', busy: false, toastTimer: null };
      var content = document.getElementById('content');
      var key = sessionStorage.getItem('tbx-admin-key') || '';
      var auth = document.getElementById('auth');
      document.getElementById('build-year').textContent = new Date().getFullYear();

      function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
      }
      function number(value) { return new Intl.NumberFormat('id-ID').format(Number(value) || 0); }
      function safeHttpUrl(value) {
        try {
          var url = new URL(String(value || ''), location.origin);
          return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
        } catch (error) {
          return '';
        }
      }
      function shortId(value) {
        var text = String(value || '').split('.')[0];
        return text.length > 22 ? text.slice(0, 9) + '…' + text.slice(-8) : text;
      }
      function date(value) {
        if (!value) return '—';
        var parsed = new Date(value);
        return isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
      }
      function bytes(value) {
        var size = Number(value);
        if (!Number.isFinite(size) || size < 0) return '—';
        if (size < 1024) return number(size) + ' B';
        var units = ['KB', 'MB', 'GB', 'TB'];
        var idx = -1;
        do { size = size / 1024; idx++; } while (size >= 1024 && idx < units.length - 1);
        return size.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' ' + units[idx];
      }
      function iconMarkup(path, cls) {
        return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
      }
      function toast(message, isError) {
        var root = document.getElementById('toast-root');
        root.innerHTML = '<div class="toast' + (isError ? ' error' : '') + '">' + escapeHtml(message) + '</div>';
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(function () { root.innerHTML = ''; }, 3800);
      }
      async function api(path, params) {
        var url = new URL(path, location.origin);
        if (params) Object.keys(params).forEach(function (name) {
          if (params[name] !== '' && params[name] != null) url.searchParams.set(name, params[name]);
        });
        var headers = {};
        if (key) headers['x-admin-key'] = key;
        var response;
        try {
          response = await fetch(url, { headers: headers, credentials: 'same-origin' });
        } catch (error) {
          throw new Error('Tidak dapat menghubungi Worker. Periksa koneksi lalu coba lagi.');
        }
        var data;
        try { data = await response.json(); }
        catch (error) { throw new Error('Worker mengirim respons yang tidak dapat dibaca.'); }
        if (!response.ok) {
          if (response.status === 401) {
            sessionStorage.removeItem('tbx-admin-key');
            key = '';
            showAuth('Admin key tidak valid atau sesi sudah berakhir.');
          }
          throw new Error(data.error || data.message || 'Permintaan gagal (' + response.status + ').');
        }
        return data;
      }
      function showAuth(message) {
        document.getElementById('auth-error').textContent = message || '';
        auth.classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
      }
      function showApp() {
        auth.classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
      }
      function setHealth(label, ok) {
        document.getElementById('health-label').textContent = label;
        document.getElementById('health-dot').style.background = ok ? '#91bd68' : '#d58c69';
      }
      function navMarkup() {
        document.getElementById('nav-list').innerHTML = navItems.map(function (item) {
          return '<button type="button" class="nav-button' + (state.page === item.id ? ' active' : '') + '" data-page="' + item.id + '" aria-label="' + item.label + '" aria-current="' + (state.page === item.id ? 'page' : 'false') + '">' +
            iconMarkup(item.icon, 'nav-icon') + '<span class="nav-text">' + item.label + '</span></button>';
        }).join('');
        document.getElementById('crumb-current').textContent = (navItems.find(function (item) { return item.id === state.page; }) || navItems[0]).label;
      }
      function pageHeading(eyebrow, title, description, action) {
        return '<div class="heading-row"><div><div class="eyebrow">' + eyebrow + '</div><h1>' + title + '</h1><p class="subtitle">' + description + '</p></div>' +
          (action || '') + '</div>';
      }
      function statCard(label, value, detail, icon) {
        return '<article class="card stat-card"><div class="stat-head"><span class="stat-label">' + label + '</span><span class="stat-glyph">' + iconMarkup(icon) + '</span></div>' +
          '<div class="stat-value">' + number(value) + '</div><div class="stat-foot">' + detail + '</div></article>';
      }
      function statusCard(label, value, detail, icon) {
        return '<article class="card stat-card"><div class="stat-head"><span class="stat-label">' + label + '</span><span class="stat-glyph">' + iconMarkup(icon) + '</span></div>' +
          '<div class="stat-value" style="font-size:22px;letter-spacing:-.7px">' + escapeHtml(value) + '</div><div class="stat-foot">' + escapeHtml(detail) + '</div></article>';
      }
      function emptyRow(columns, message) {
        return '<tr><td class="empty-cell" colspan="' + columns + '">' + escapeHtml(message) + '</td></tr>';
      }
      function tableFoot(total, page, pageSize) {
        var pages = Math.max(1, Math.ceil(total / pageSize));
        var start = total ? (page - 1) * pageSize + 1 : 0;
        var end = Math.min(page * pageSize, total);
        return '<div class="table-foot"><div style="display:flex;align-items:center;gap:10px"><span>Menampilkan ' + number(start) + '–' + number(end) + ' dari ' + number(total) + '</span>' +
          '<select class="select" data-page-size aria-label="Jumlah baris per halaman" style="height:29px;min-width:72px;padding:0 6px;font-size:10px">' +
          [25, 50, 100].map(function (size) { return '<option value="' + size + '"' + (state.pageSize === size ? ' selected' : '') + '>' + size + '</option>'; }).join('') + '</select></div>' +
          '<div class="pagination"><button class="button button-small" data-pager="' + Math.max(1, page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>Sebelumnya</button>' +
          '<span class="page-count">' + number(page) + ' / ' + number(pages) + '</span>' +
          '<button class="button button-small" data-pager="' + Math.min(pages, page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>Berikutnya</button></div></div>';
      }
      function shareRows(items) {
        if (!items.length) return emptyRow(4, 'Belum ada share yang cocok dengan pencarian ini.');
        return items.map(function (item) {
          return '<tr data-clickable data-detail="share" data-id="' + escapeHtml(item.share_id) + '">' +
            '<td class="primary-cell" title="' + escapeHtml(item.title || item.share_id) + '">' + escapeHtml(item.title || item.share_id || 'Tanpa judul') + '</td>' +
            '<td class="mono">' + escapeHtml(shortId(item.share_id)) + '</td><td>' + escapeHtml(date(item.updated_at)) + '</td>' +
            '<td><button class="inline-link" type="button" data-detail="share" data-id="' + escapeHtml(item.share_id) + '">Lihat →</button></td></tr>';
        }).join('');
      }
      function overviewMarkup(data, analytics) {
        var days = (analytics.items || []).slice().reverse();
        var max = Math.max.apply(null, days.map(function (item) { return Number(item.shares) || 0; }).concat([1]));
        var chart = days.length ? days.map(function (item, index) {
          var height = Math.max(3, (Number(item.shares) / max) * 100);
          var label = String(item.day || '').slice(5);
          return '<div class="chart-col" title="' + escapeHtml(date(item.day)) + ': ' + number(item.shares) + ' share"><div class="bar-area"><div class="bar' +
            (index === days.length - 1 ? ' latest' : '') + '" style="height:' + height + '%"></div></div><span class="chart-label">' + escapeHtml(label) + '</span></div>';
        }).join('') : '<div class="chart-empty">Belum ada aktivitas tersimpan.</div>';
        var latest = (data.latestShares || []).slice(0, 6).map(function (item) {
          return '<div class="latest-item"><div class="latest-main"><div class="latest-name">' + escapeHtml(item.title || item.share_id || 'Tanpa judul') +
            '</div><div class="latest-id">' + escapeHtml(shortId(item.share_id)) + '</div></div><span class="latest-date">' + escapeHtml(date(item.updated_at)) + '</span></div>';
        }).join('') || '<div class="latest-item"><div class="latest-name loading">Belum ada data share.</div></div>';
        return pageHeading('Ringkasan operasional', 'Selamat datang di console.', 'Pantau data yang tersimpan di D1 dan aktivitas pemrosesan share.', '<button class="button" data-action="refresh">' + iconMarkup('<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9a7 7 0 0 1 12-2L20 12M4 12l2.5 5a7 7 0 0 0 12-2" />', 'button-icon') + ' Perbarui data</button>') +
          '<section class="grid stats">' +
            statCard('Total shares', data.counts.shares, 'Tersimpan di D1', '<path d="M18 8a3 3 0 1 0-2.8-4"/><path d="M6 15a3 3 0 1 0 .1 0"/><path d="M18 21a3 3 0 1 0-2.8-4"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>') +
            statCard('Media files', data.counts.media_files, 'File terindeks', '<path d="M4 3h11l5 5v13H4z"/><path d="M14 3v6h6"/>') +
            statCard('Thumbnails', data.counts.thumbnails, 'Referensi thumbnail', '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/>') +
            statusCard('Penyimpanan', 'D1 aktif', 'Data operasional tersambung', '<path d="M4 5c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2Z"/><path d="M4 5v14c0 1.1 3.6 2 8 2s8-.9 8-2V5M4 12c0 1.1 3.6 2 8 2s8-.9 8-2"/>') +
          '</section>' +
          '<section class="grid overview-grid"><article class="card"><div class="card-head"><div><div class="card-title">Share diproses</div><div class="card-subtitle">Jumlah data share per tanggal pembaruan</div></div><span class="pill"><span class="pill-dot"></span> D1</span></div><div class="chart-wrap"><div class="chart">' + chart + '</div><div class="chart-legend"><span class="legend-dot"></span>Share tersimpan per hari</div></div></article>' +
          '<article class="card"><div class="card-head"><div><div class="card-title">Share terbaru</div><div class="card-subtitle">Enam pembaruan terakhir</div></div><button class="button button-small" data-page="shares">Semua share</button></div><div class="latest-list">' + latest + '</div></article></section>' +
          '<article class="card"><div class="card-head"><div><div class="card-title">Status & konfigurasi sistem</div><div class="card-subtitle">Ringkasan integrasi Cloudflare D1 dan proxy operasional</div></div></div><div class="detail-grid">' +
          detailItem('Penyimpanan utama', 'Cloudflare D1 (sharedfile) · Aktif') +
          detailItem('Autentikasi upstream', 'Cookie session TeraBox · Aktif') +
          detailItem('Streaming video', 'HLS M3U8 proxy & segment relay') +
          detailItem('Aktivitas harian', 'Tercatat pada tabel shares (updated_at)') +
          detailItem('Status layanan', 'Worker operasional (HTTP 200)') +
          detailItem('Observabilitas', 'Logging & telemetri Cloudflare aktif') + '</div></article>';
      }
      function detailItem(label, value) {
        return '<div class="detail-item"><div class="detail-label">' + escapeHtml(label) + '</div><div class="detail-value">' + escapeHtml(value == null || value === '' ? '—' : value) + '</div></div>';
      }
      function renderShares(data) {
        return pageHeading('Eksplorasi D1', 'Shares', 'Cari tautan, judul, atau identitas pemilik yang sudah tersimpan.') +
          '<article class="card table-card"><div class="card-head"><div><div class="card-title">Semua shares</div><div class="card-subtitle">Pilih baris untuk detail · tekan Enter untuk mencari</div></div>' +
          '<div class="table-tools"><div class="search-wrap">' + iconMarkup('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', 'search-icon') +
          '<input class="input input-search" data-search placeholder="Cari share atau judul…" value="' + escapeHtml(state.query) + '"></div>' +
          '<select class="select" data-sort><option value="updated_at">Terbaru</option><option value="server_time">Waktu server</option><option value="title">Judul</option></select>' +
          '<button class="button button-small" data-order>' + (state.order === 'asc' ? 'Terlama ↑' : 'Terbaru ↓') + '</button></div></div>' +
          '<div class="table-scroll"><table><thead><tr><th>Judul</th><th>Share ID</th><th>Diperbarui</th><th></th></tr></thead><tbody>' + shareRows(data.items || []) +
          '</tbody></table></div>' + tableFoot(data.total || 0, data.page || 1, data.pageSize || state.pageSize) + '</article>';
      }
      function renderFiles(data) {
        var rows = (data.items || []).map(function (file) {
          return '<tr data-clickable data-detail="file" data-id="' + escapeHtml(file.fs_id) + '"><td class="primary-cell" title="' + escapeHtml(file.server_filename) + '">' + escapeHtml(file.server_filename || 'Tanpa nama') +
            '</td><td class="mono">' + escapeHtml(shortId(file.fs_id)) + '</td><td>' + escapeHtml(bytes(file.size)) + '</td><td class="mono">' + escapeHtml(shortId(file.share_id)) +
            '</td><td><button class="inline-link" type="button" data-detail="file" data-id="' + escapeHtml(file.fs_id) + '">Lihat →</button></td></tr>';
        }).join('') || emptyRow(5, 'Belum ada file yang cocok dengan pencarian ini.');
        return pageHeading('Eksplorasi D1', 'Media files', 'Telusuri berkas berdasarkan nama, fs_id, atau ukuran.') +
          '<article class="card table-card"><div class="card-head"><div><div class="card-title">Indeks media</div><div class="card-subtitle">Daftar hasil resolve · tekan Enter untuk mencari</div></div>' +
          '<div class="table-tools"><div class="search-wrap">' + iconMarkup('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', 'search-icon') +
          '<input class="input input-search" data-search placeholder="Cari nama atau fs_id…" value="' + escapeHtml(state.query) + '"></div>' +
          '<select class="select" data-sort><option value="server_mtime">Terbaru</option><option value="size">Ukuran</option><option value="server_filename">Nama</option></select>' +
          '<button class="button button-small" data-order>' + (state.order === 'asc' ? 'Naik ↑' : 'Turun ↓') + '</button></div></div>' +
          '<div class="table-scroll"><table><thead><tr><th>Nama file</th><th>FS ID</th><th>Ukuran</th><th>Share ID</th><th></th></tr></thead><tbody>' + rows +
          '</tbody></table></div>' + tableFoot(data.total || 0, data.page || 1, data.pageSize || state.pageSize) + '</article>';
      }
      function renderThumbnails(data) {
        var rows = (data.items || []).map(function (thumb) {
          var thumbnailUrl = safeHttpUrl(thumb.url);
          return '<tr><td class="mono">' + escapeHtml(thumb.fs_id) + '</td><td><span class="pill">' + escapeHtml(thumb.thumbnail_type || 'unknown') + '</span></td>' +
            '<td class="primary-cell" title="' + escapeHtml(thumb.url) + '">' + escapeHtml(thumb.url || '—') + '</td><td>' +
            (thumbnailUrl ? '<a class="inline-link" href="' + escapeHtml(thumbnailUrl) + '" target="_blank" rel="noopener noreferrer">Apri ↗</a>' : '—') + '</td></tr>';
        }).join('') || emptyRow(4, 'Belum ada thumbnail pada database.');
        return pageHeading('Eksplorasi D1', 'Thumbnails', 'Referensi gambar yang terhubung dengan media files.') +
          '<article class="card table-card"><div class="card-head"><div><div class="card-title">Indeks thumbnail</div><div class="card-subtitle">Filter menurut fs_id atau jenis thumbnail</div></div>' +
          '<div class="table-tools"><div class="search-wrap">' + iconMarkup('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', 'search-icon') +
          '<input class="input input-search" data-search placeholder="Cari fs_id…" value="' + escapeHtml(state.query) + '"></div>' +
          '<select class="select" data-type><option value="">Semua jenis</option><option value="url1">url1</option><option value="url2">url2</option><option value="url3">url3</option><option value="icon">icon</option></select></div></div>' +
          '<div class="table-scroll"><table><thead><tr><th>FS ID</th><th>Jenis</th><th>Referensi</th><th></th></tr></thead><tbody>' + rows +
          '</tbody></table></div>' + tableFoot(data.total || 0, data.page || 1, data.pageSize || state.pageSize) + '</article>';
      }
      function renderAnalytics(data) {
        var items = data.items || [];
        var total = items.reduce(function (sum, item) { return sum + (Number(item.shares) || 0); }, 0);
        var rows = items.map(function (item) {
          return '<tr><td>' + escapeHtml(date(item.day)) + '</td><td><span class="pill"><span class="pill-dot"></span>' + number(item.shares) + ' shares</span></td><td>' +
            '<div style="height:6px;width:min(260px,100%);border-radius:6px;background:#f0f2eb"><div style="height:6px;width:' +
            (total ? Math.max(2, Number(item.shares) / Math.max.apply(null, items.map(function (row) { return Number(row.shares) || 0; }).concat([1])) * 100) : 0) +
            '%;border-radius:6px;background:#718c65"></div></div></td></tr>';
        }).join('') || emptyRow(3, 'Belum ada aktivitas tercatat.');
        return pageHeading('Tren pemrosesan', 'Analytics', 'Pertumbuhan share berdasarkan updated_at di D1.') +
          '<section class="grid stats">' + statCard('Share pada periode', total, 'Jumlah dari tanggal yang ditampilkan', '<path d="M4 19V5M4 19h17"/><path d="m7 15 4-5 3 2 5-7"/>') +
          statCard('Hari tercatat', items.length, 'Tanggal dengan pembaruan', '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>') +
          statCard('Rentang', items.length ? date(items[items.length - 1].day) + ' – ' + date(items[0].day) : '—', 'Maksimal 180 hari', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') +
          statCard('Sumber', 'D1', 'Tabel shares · grouped by day', '<path d="M4 5c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2Z"/><path d="M4 5v14c0 1.1 3.6 2 8 2s8-.9 8-2V5M4 12c0 1.1 3.6 2 8 2s8-.9 8-2"/>') +
          '</section><article class="card table-card"><div class="card-head"><div><div class="card-title">Aktivitas harian</div><div class="card-subtitle">Data paling baru ditampilkan lebih dulu</div></div><select class="select" data-limit><option value="30">30 hari</option><option value="90">90 hari</option><option value="180">180 hari</option></select></div>' +
          '<div class="table-scroll"><table><thead><tr><th>Tanggal</th><th>Shares diperbarui</th><th>Volume relatif</th></tr></thead><tbody>' + rows +
          '</tbody></table></div></article>';
      }
      function renderLookup(data, searched) {
        var result = data && data.data;
        var thumbUrl = result && safeHttpUrl(result.thumb);
        var originalUrl = result && safeHttpUrl(result.original_url);
        var contentHtml = result ? '<div class="detail-grid">' + detailItem('Nama', result.name) + detailItem('Share ID', result.shareid) +
          detailItem('File ID', result.fid) + detailItem('Pemilik', result.uk) + detailItem('Ukuran', bytes(result.size)) +
          detailItem('Diperbarui', result.last_verified ? date(new Date(Number(result.last_verified) * 1000)) : '—') +
          detailItem('Download link', (result.dlink || (data.surl || searched)) ? ('<a href="' + escapeHtml(result.dlink || ('/?mode=download&surl=' + encodeURIComponent(data.surl || searched) + (result.fid ? '&fid=' + encodeURIComponent(result.fid) : ''))) + '" target="_blank" rel="noopener noreferrer" style="color:var(--brand);font-weight:600;text-decoration:underline">Buka download ↗</a>') : '—') +
          detailItem('Sumber', 'D1 · ' + (data.surl || searched)) + '</div>' +
          (thumbUrl ? '<div style="padding:0 18px 18px"><img src="' + escapeHtml(thumbUrl) + '" alt="Thumbnail ' + escapeHtml(result.name || '') + '" style="max-width:100%;max-height:210px;border-radius:8px;object-fit:contain;background:#f4f5f1"></div>' : '') +
          '<div style="padding:0 18px 18px"><button class="button button-small" data-copy="' + escapeHtml(originalUrl || ('https://terabox.app/s/' + (data.surl || searched))) + '">Salin URL asli</button></div>'
          : '<div class="detail-grid"><div class="detail-item" style="grid-column:1/-1"><div class="detail-value">' +
          (searched ? 'Belum ada data untuk ID ini. Pastikan share pernah berhasil di-resolve dan tersimpan ke D1.' : 'Masukkan surl untuk memeriksa apakah datanya sudah tersimpan di D1.') +
          '</div></div></div>';
        return pageHeading('Pencarian langsung', 'Cache lookup', 'Periksa metadata share tersimpan di D1 tanpa memanggil upstream.') +
          '<div class="notice">Pencarian membaca data dari tabel D1 <strong>shares</strong> dan <strong>media_files</strong> secara instan tanpa perlu memanggil upstream TeraBox.</div>' +
          '<article class="card"><div class="card-head"><div><div class="card-title">Cari share</div><div class="card-subtitle">Masukkan surl / share ID yang sudah diproses sebelumnya</div></div></div>' +
          '<form id="lookup-form" class="table-tools" style="padding:15px 18px"><div class="search-wrap" style="flex:1">' +
          iconMarkup('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', 'search-icon') +
          '<input class="input input-search" name="surl" placeholder="Contoh: 1AbCdEfGh" value="' + escapeHtml(searched || '') + '" required></div>' +
          '<button class="button button-primary" type="submit">Cari di D1</button></form>' + (result || searched ? '<div class="card-head"><div><div class="card-title">' + (result ? 'Metadata ditemukan' : 'Tidak ditemukan') + '</div></div>' +
          (originalUrl ? '<a class="button button-small" href="' + escapeHtml(originalUrl) + '" target="_blank" rel="noopener noreferrer">Buka share ↗</a>' : '') + '</div>' + contentHtml : '') + '</article>';
      }
      async function loadPage() {
        if (state.busy) return;
        state.busy = true;
        navMarkup();
        content.innerHTML = '<div class="loading" style="padding:40px 0;font-size:12px">Memuat data…</div>';
        try {
          if (state.page === 'overview') {
            var results = await Promise.all([api('/admin/overview'), api('/admin/analytics/processed', { limit: 14 })]);
            content.innerHTML = overviewMarkup(results[0], results[1]);
            setHealth('Worker & D1 aktif', true);
          } else if (state.page === 'shares') {
            var shares = await api('/admin/shares', { q: state.query, sort: state.sort || 'updated_at', order: state.order, page: state.pageNum, pageSize: state.pageSize });
            content.innerHTML = renderShares(shares);
            content.querySelector('[data-sort]').value = state.sort || 'updated_at';
          } else if (state.page === 'files') {
            var files = await api('/admin/files', { q: state.query, sort: state.sort || 'server_mtime', order: state.order, page: state.pageNum, pageSize: state.pageSize });
            content.innerHTML = renderFiles(files);
            content.querySelector('[data-sort]').value = state.sort || 'server_mtime';
          } else if (state.page === 'thumbnails') {
            var thumbs = await api('/admin/thumbnails', { fs_id: state.query, type: state.type, page: state.pageNum, pageSize: state.pageSize });
            content.innerHTML = renderThumbnails(thumbs);
            if (state.type) content.querySelector('[data-type]').value = state.type;
          } else if (state.page === 'analytics') {
            var analytics = await api('/admin/analytics/processed', { limit: state.limit || 30 });
            content.innerHTML = renderAnalytics(analytics);
            content.querySelector('[data-limit]').value = String(state.limit || 30);
          } else if (state.page === 'lookup') {
            content.innerHTML = renderLookup(state.lookupData, state.lookupSurl);
          }
          document.getElementById('last-updated').textContent = 'Diperbarui ' + new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date());
        } catch (error) {
          var message = error.message;
          if (/no such table|no such column/i.test(message)) {
            message = 'Skema D1 lokal belum diterapkan. Jalankan: npx wrangler d1 execute sharedfile --local --file=./schema.sql';
          }
          content.innerHTML = pageHeading('Koneksi data', 'Data belum dapat dimuat', 'Worker membalas dengan error saat mengambil data dashboard.') +
            '<div class="notice" role="alert">' + escapeHtml(message) + '</div><button class="button button-primary" data-action="refresh">Coba lagi</button>';
          setHealth(message.indexOf('D1') >= 0 ? 'D1 tidak tersedia' : 'Periksa koneksi', false);
        } finally {
          state.busy = false;
        }
      }
      function openShare(id) {
        openDrawer('share', id);
      }
      function openDrawer(type, id) {
        var root = document.getElementById('drawer-root');
        root.innerHTML = '<div class="drawer-backdrop" data-close-drawer></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="Detail">' +
          '<div class="drawer-head"><div><div class="eyebrow">Detail ' + (type === 'share' ? 'share' : 'file') + '</div><h2>Memuat data…</h2></div><button class="button button-small" data-close-drawer aria-label="Tutup">Tutup ×</button></div>' +
          '<div class="loading">Mengambil detail dari D1…</div><div class="drawer-content"></div></aside>';
        var cleanId = type === 'file' ? String(id || '').split('.')[0] : id;
        var url = type === 'share' ? '/admin/shares/' + encodeURIComponent(id) : '/admin/files/' + encodeURIComponent(cleanId);
        api(url).then(function (data) {
          var drawer = root.querySelector('.drawer');
          if (!drawer) return;
          var loadingEl = drawer.querySelector('.loading');
          if (loadingEl) loadingEl.remove();
          var container = drawer.querySelector('.drawer-content') || drawer;
          if (type === 'share') {
            var share = data.share || {};
            drawer.querySelector('h2').textContent = share.title || share.share_id || 'Detail share';
            var detail = '<div class="detail-grid">' + detailItem('Share ID', share.share_id) + detailItem('Share number', share.shareid) +
              detailItem('Pemilik', share.uk) + detailItem('Request ID', share.request_id) + detailItem('Diperbarui', date(share.updated_at)) +
              detailItem('Server time', share.server_time ? date(new Date(Number(share.server_time) * 1000)) : '—') + '</div>';
            var rows = (data.files || []).map(function (file) {
              return '<tr data-clickable data-detail="file" data-id="' + escapeHtml(file.fs_id) + '"><td class="primary-cell">' + escapeHtml(file.server_filename || 'Tanpa nama') +
                '</td><td>' + escapeHtml(bytes(file.size)) + '</td><td class="mono">' + escapeHtml(shortId(file.fs_id)) + '</td></tr>';
            }).join('') || emptyRow(3, 'Tidak ada media file pada share ini.');
            container.innerHTML = detail + '<section class="drawer-section card"><div class="card-head"><div><div class="card-title">Media files</div><div class="card-subtitle">' + number(data.totalFiles || 0) + ' file tersimpan</div></div></div><div class="table-scroll"><table><thead><tr><th>Nama</th><th>Ukuran</th><th>FS ID</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
          } else {
            var file = data.file || {};
            drawer.querySelector('h2').textContent = file.server_filename || file.fs_id || 'Detail file';
            var cleanAdminFid = file.fs_id ? String(file.fs_id).replace(/\.0+$/, '') : '';
            var dlLink = file.dlink || (file.share_id ? ('/?mode=download&surl=' + encodeURIComponent(file.share_id) + (cleanAdminFid ? '&fid=' + encodeURIComponent(cleanAdminFid) : '')) : '');
            var isVideoFile = /\\.(?:mp4|m4v|mov|mkv|webm|avi|3gp)$/i.test(file.server_filename || '') || file.category === '1' || file.category === 1;
            var streamLink = isVideoFile && file.share_id ? ('/?mode=stream&surl=' + encodeURIComponent(file.share_id) + '&fid=' + encodeURIComponent(file.fs_id)) : '';
            var topActions = dlLink ? (
              '<div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap;align-items:center">' +
                '<a class="button button-primary" href="' + escapeHtml(dlLink) + '" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" style="padding:10px 18px;font-weight:600;display:inline-flex;align-items:center;gap:6px">' +
                  iconMarkup('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>') + ' Unduh file ↗' +
                '</a>' +
                (streamLink ? '<a class="button" href="' + escapeHtml(streamLink) + '" target="_blank" rel="noopener noreferrer" style="padding:10px 18px;display:inline-flex;align-items:center;gap:6px">' + iconMarkup('<polygon points="5 3 19 12 5 21 5 3"/>') + ' Putar stream ↗</a>' : '') +
                '<button class="button" type="button" data-copy="' + escapeHtml(dlLink) + '" style="padding:10px 16px">Salin link unduh</button>' +
              '</div>'
            ) : '';
            var fields = ['fs_id', 'share_id', 'server_filename', 'category', 'size', 'server_mtime', 'local_mtime', 'server_ctime', 'local_ctime', 'path', 'md5', 'cmd5', 'isdir', 'play_forbid', 'is_adult'];
            var catNames = { '1': 'Video', '2': 'Audio', '3': 'Gambar', '4': 'Dokumen', '5': 'Arsip', '6': 'Lainnya' };
            var detailHtml = '<div class="detail-grid">' +
              (dlLink ? detailItem('Download link', '<a href="' + escapeHtml(dlLink) + '" target="_blank" rel="noopener noreferrer" style="color:var(--brand);font-weight:600;text-decoration:underline">Buka download ↗</a>') : '') +
              fields.map(function (field) {
                var rawVal = file[field];
                var value;
                if (field === 'size') {
                  value = bytes(rawVal);
                } else if (field.indexOf('time') >= 0) {
                  value = date(rawVal ? new Date(Number(rawVal) * 1000) : null);
                } else if (field === 'category') {
                  var c = String(rawVal == null ? '' : rawVal).split('.')[0];
                  value = catNames[c] ? catNames[c] + ' (' + c + ')' : (c || '—');
                } else {
                  value = rawVal;
                }
                return detailItem(field.replace(/_/g, ' '), value);
              }).join('') + '</div>';
            var thumbs = Object.keys(data.thumbs || {}).map(function (name) {
              var src = safeHttpUrl(data.thumbs[name]);
              return '<div class="detail-item"><div class="detail-label">' + escapeHtml(name) + '</div>' + (src ? '<a href="' + escapeHtml(src) + '" target="_blank" rel="noopener noreferrer"><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(name) + '" style="max-width:100%;max-height:130px;object-fit:contain" referrerpolicy="no-referrer"></a>' : '<div class="detail-value">—</div>') + '</div>';
            }).join('');
            var dlinkSection = dlLink ? (
              '<section class="drawer-section card" style="margin-top:16px">' +
                '<div class="card-head"><div><div class="card-title">Tautan unduhan langsung</div></div></div>' +
                '<div style="padding:12px 16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
                  '<input class="input" style="flex:1;min-width:200px;font-family:monospace;font-size:12px" readonly value="' + escapeHtml(dlLink) + '">' +
                  '<button class="button button-small" type="button" data-copy="' + escapeHtml(dlLink) + '">Salin link</button>' +
                  '<a class="button button-small button-primary" href="' + escapeHtml(dlLink) + '" target="_blank" rel="noopener noreferrer">Unduh file ↗</a>' +
                  (streamLink ? '<a class="button button-small" href="' + escapeHtml(streamLink) + '" target="_blank" rel="noopener noreferrer">Putar stream ↗</a>' : '') +
                '</div>' +
              '</section>'
            ) : '';
            container.innerHTML = topActions + detailHtml + dlinkSection + (thumbs ? '<section class="drawer-section card"><div class="card-head"><div class="card-title">Thumbnails</div></div><div class="detail-grid">' + thumbs + '</div></section>' : '');
          }
        }).catch(function (error) {
          var drawer = root.querySelector('.drawer');
          if (drawer) {
            var loadingEl = drawer.querySelector('.loading');
            if (loadingEl) loadingEl.textContent = error.message;
          }
        });
      }
      function resetFilters() {
        state.pageNum = 1;
        state.query = '';
        state.sort = '';
        state.order = 'desc';
        state.type = '';
      }

      document.getElementById('auth-form').addEventListener('submit', async function (event) {
        event.preventDefault();
        key = document.getElementById('admin-key').value.trim();
        sessionStorage.setItem('tbx-admin-key', key);
        document.getElementById('auth-error').textContent = '';
        try {
          await api('/admin/overview');
          showApp();
          loadPage();
        } catch (error) {
          document.getElementById('auth-error').textContent = error.message;
          if (error.message.indexOf('D1') >= 0) {
            showApp();
            loadPage();
          }
        }
      });
      document.addEventListener('click', function (event) {
        var pageButton = event.target.closest('[data-page]');
        if (pageButton) {
          state.page = pageButton.dataset.page;
          resetFilters();
          state.lookupData = null;
          state.lookupSurl = '';
          loadPage();
          return;
        }
        var pager = event.target.closest('[data-pager]');
        if (pager) { state.pageNum = Number(pager.dataset.pager); loadPage(); return; }
        var detail = event.target.closest('[data-detail]');
        if (detail) { openDrawer(detail.dataset.detail, detail.dataset.id); return; }
        if (event.target.closest('[data-close-drawer]')) { document.getElementById('drawer-root').innerHTML = ''; return; }
        if (event.target.closest('[data-action="refresh"]')) { loadPage(); return; }
        var orderButton = event.target.closest('[data-order]');
        if (orderButton) { state.order = state.order === 'asc' ? 'desc' : 'asc'; state.pageNum = 1; loadPage(); return; }
        var copyButton = event.target.closest('[data-copy]');
        if (copyButton) {
          navigator.clipboard.writeText(copyButton.dataset.copy).then(function () { toast('URL berhasil disalin.'); }).catch(function () { toast('Tidak dapat menyalin URL.', true); });
        }
      });
      document.addEventListener('change', function (event) {
        if (event.target.matches('[data-sort]')) { state.sort = event.target.value; state.pageNum = 1; loadPage(); }
        if (event.target.matches('[data-type]')) { state.type = event.target.value; state.pageNum = 1; loadPage(); }
        if (event.target.matches('[data-limit]')) { state.limit = Number(event.target.value); loadPage(); }
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && event.target.matches('[data-search]')) {
          state.query = event.target.value.trim();
          state.pageNum = 1;
          loadPage();
        }
        if (event.key === 'Escape') document.getElementById('drawer-root').innerHTML = '';
      });
      document.addEventListener('submit', function (event) {
        if (event.target.id === 'lookup-form') {
          event.preventDefault();
          var form = new FormData(event.target);
          state.lookupSurl = String(form.get('surl') || '').trim();
          state.lookupData = null;
          api('/admin/kv/entry', { surl: state.lookupSurl }).then(function (data) {
            state.lookupData = data;
            content.innerHTML = renderLookup(data, state.lookupSurl);
          }).catch(function (error) {
            if (error.message.indexOf('not found') >= 0 || error.message.indexOf('not_found') >= 0) {
              content.innerHTML = renderLookup(null, state.lookupSurl);
            } else {
              toast(error.message, true);
            }
          });
        }
      });
      document.addEventListener('change', function (event) {
        if (event.target.matches('[data-page-size]')) { state.pageSize = Number(event.target.value); state.pageNum = 1; loadPage(); }
      });

      if (key) {
        api('/admin/overview').then(function () {
          showApp();
          loadPage();
        }).catch(function (error) {
          if (error.message.indexOf('D1') >= 0) { showApp(); loadPage(); }
          else showAuth(error.message);
        });
      }
      setInterval(function () {
        if (!document.getElementById('app').classList.contains('hidden') && state.page === 'overview' && !state.busy) loadPage();
      }, 60000);
    })();
  </script>
</body>
</html>`;

export function adminDashboardResponse() {
  return new Response(dashboardHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' https: data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
    }
  });
}
