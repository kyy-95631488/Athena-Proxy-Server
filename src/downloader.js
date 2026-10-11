const downloaderHtml = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="description" content="Putar dan akses file dari link share TeraBox yang Anda miliki.">
  <title>Athena Proxy / Downloader</title>
  <style>
    :root {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #252922;
      background: #f4f5f1;
      font-synthesis: none;
      text-rendering: optimizeLegibility;
      --ink: #252922;
      --muted: #7d8379;
      --line: #e5e7e1;
      --paper: #fff;
      --canvas: #f4f5f1;
      --nav: #202820;
      --accent: #d8f36a;
      --green: #58734f;
      --red: #a44f43;
    }
    * { box-sizing: border-box; }
    body { min-width: 320px; min-height: 100vh; margin: 0; background: var(--canvas); }
    button, input { font: inherit; }
    button, a { -webkit-tap-highlight-color: transparent; }
    .topbar { display: flex; height: 66px; align-items: center; justify-content: space-between; padding: 0 max(24px, calc((100vw - 1120px) / 2)); border-bottom: 1px solid var(--line); background: #fff; }
    .brand { display: flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; }
    .brand-mark { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 9px; color: var(--nav); background: var(--accent); font-size: 13px; font-weight: 850; letter-spacing: -1px; }
    .brand-name { font-size: 13px; font-weight: 760; letter-spacing: -.25px; }
    .brand-caption { margin-top: 2px; color: var(--muted); font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
    .nav-link { color: #62695f; font-size: 11px; text-decoration: none; }
    .nav-link:hover { color: var(--ink); }
    .shell { width: min(100% - 40px, 1000px); margin: 0 auto; padding: 57px 0 70px; }
    .hero { max-width: 650px; margin: 0 auto 25px; text-align: center; }
    .eyebrow { margin-bottom: 13px; color: var(--green); font-size: 9px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(29px, 5vw, 43px); font-weight: 700; letter-spacing: -2px; line-height: 1.1; }
    .hero-copy { max-width: 505px; margin: 13px auto 0; color: var(--muted); font-size: 13px; line-height: 1.7; }
    .form-card { max-width: 770px; margin: 0 auto; padding: 19px; border: 1px solid var(--line); border-radius: 13px; background: var(--paper); box-shadow: 0 10px 32px #24301d08; }
    .form-label { display: block; margin: 0 0 8px 2px; color: #555d52; font-size: 10px; font-weight: 690; }
    .form-row { display: flex; gap: 9px; }
    .url-input { width: 100%; height: 48px; padding: 0 14px; border: 1px solid #dfe3da; border-radius: 8px; outline: 0; color: var(--ink); background: #fff; font-size: 12px; }
    .url-input::placeholder { color: #a1a69e; }
    .url-input:focus { border-color: #839579; box-shadow: 0 0 0 3px #7189661c; }
    .paste-button { flex: 0 0 auto; height: 48px; padding: 0 13px; border: 1px solid #dfe3da; border-radius: 8px; color: #3d443a; background: #fff; font-size: 11px; font-weight: 650; cursor: pointer; }
    .paste-button:hover { border-color: #bdc7b5; background: #fbfcf9; }
    .submit-button { flex: 0 0 auto; display: inline-flex; height: 48px; align-items: center; justify-content: center; gap: 9px; padding: 0 19px; border: 1px solid var(--nav); border-radius: 8px; color: #fff; background: var(--nav); font-size: 11px; font-weight: 670; transition: background .15s; }
    .submit-button:hover { background: #39463a; }
    .submit-button:disabled { cursor: wait; opacity: .7; }
    .submit-arrow { font-size: 15px; }
    .form-help { margin: 9px 2px 0; color: #93998f; font-size: 10px; }
    .form-error { display: none; margin-top: 12px; padding: 10px 12px; border: 1px solid #f0d7d2; border-radius: 7px; color: #904d43; background: #fff8f6; font-size: 11px; line-height: 1.55; }
    .form-error.visible { display: block; }
    .form-error a { display: inline-block; margin-top: 5px; color: #784137; font-weight: 700; }
    .result { max-width: 770px; margin: 15px auto 0; }
    .file-card { display: grid; grid-template-columns: 92px minmax(0, 1fr) auto; align-items: center; gap: 16px; padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); }
    .thumb-wrap { display: grid; width: 92px; height: 72px; place-items: center; overflow: hidden; border-radius: 8px; background: #f0f2ec; }
    .thumb-wrap img { width: 100%; height: 100%; object-fit: cover; }
    .thumb-placeholder { color: #818b78; font-size: 19px; }
    .thumb-placeholder svg { width: 20px; height: 20px; }
    .file-copy { min-width: 0; }
    .file-title { overflow: hidden; color: #293027; font-size: 13px; font-weight: 700; letter-spacing: -.2px; text-overflow: ellipsis; white-space: nowrap; }
    .file-meta { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-top: 7px; color: #858c82; font-size: 10px; }
    .file-origin { margin-top: 7px; color: #a0a59d; font-size: 9px; }
    .file-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
    .listing-card { overflow: hidden; margin-top: 12px; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
    .listing-head { display: flex; min-height: 58px; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 15px; border-bottom: 1px solid #eff0ed; }
    .listing-title { color: #30372e; font-size: 11px; font-weight: 700; }
    .breadcrumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 5px; color: #91978e; font-size: 9px; }
    .breadcrumb-button { padding: 0; border: 0; color: #58734f; background: transparent; font-size: inherit; cursor: pointer; }
    .breadcrumb-button:hover { text-decoration: underline; }
    .file-list { padding: 0 14px; }
    .file-row { display: grid; grid-template-columns: 34px minmax(0, 1fr) 86px auto; align-items: center; gap: 10px; min-height: 59px; border-bottom: 1px solid #f0f1ed; }
    .file-row:last-child { border-bottom: 0; }
    .file-row-icon { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 7px; color: #627650; background: #f0f3e9; }
    .file-row-icon svg { width: 17px; height: 17px; }
    .file-row-thumb { width: 30px; height: 30px; border-radius: 6px; object-fit: cover; }
    .file-row-name { overflow: hidden; color: #343b32; font-size: 10px; font-weight: 620; text-overflow: ellipsis; white-space: nowrap; }
    .file-row-meta { margin-top: 4px; color: #959b92; font-size: 9px; }
    .file-row-size { color: #878e84; text-align: right; font-size: 9px; white-space: nowrap; }
    .file-row-actions { display: flex; justify-content: flex-end; gap: 5px; }
    .file-row-actions .action-button { min-height: 29px; padding: 0 8px; font-size: 9px; }
    .empty-list { padding: 29px 14px; color: #8c9389; text-align: center; font-size: 10px; }
    .folder-open { color: #59734e; background: #f1f5eb; }
    .file-card.is-folder .thumb-wrap { color: #b28c3a; background: #fbf5e4; }
    .action-button { display: inline-flex; min-height: 36px; align-items: center; justify-content: center; gap: 7px; padding: 0 11px; border: 1px solid #dfe3da; border-radius: 7px; color: #3d443a; background: #fff; font-size: 10px; font-weight: 660; text-decoration: none; white-space: nowrap; cursor: pointer; }
    .action-button:hover { border-color: #bdc7b5; background: #fbfcf9; }
    .action-primary { border-color: #d7e5c7; color: #3e6039; background: #f3f7ee; }
    .action-primary:hover { border-color: #b5caa4; background: #edf4e7; }
    .action-button svg { width: 14px; height: 14px; }
    .player-card { overflow: hidden; margin-top: 12px; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
    .player-head { display: flex; min-height: 52px; align-items: center; justify-content: space-between; gap: 10px; padding: 0 15px; border-bottom: 1px solid #eff0ed; }
    .player-label { color: #3f473d; font-size: 11px; font-weight: 680; }
    .player-note { color: #91978e; font-size: 9px; }
    .player-frame { display: grid; min-height: 200px; place-items: center; padding: 0; background: #161b16; }
    video { display: block; width: 100%; max-height: min(62vw, 550px); aspect-ratio: 16 / 9; background: #111; }
    .player-message { max-width: 440px; padding: 25px; color: #d3d9cd; text-align: center; font-size: 11px; line-height: 1.7; }
    .player-message a { display: inline-flex; align-items: center; justify-content: center; min-height: 36px; margin-top: 14px; padding: 0 13px; border: 1px solid #d8f36a; border-radius: 7px; color: #202820; background: #d8f36a; font-weight: 700; text-decoration: none; }
    .player-message a:hover { background: #e2ff7d; }
    .player-frame.has-player-note { display: flex; flex-direction: column; align-items: stretch; }
    .player-inline-note { padding: 9px 13px; color: #f0e6c5; background: #393421; font-size: 10px; line-height: 1.55; }
    .privacy-note { display: flex; align-items: flex-start; gap: 9px; max-width: 770px; margin: 18px auto 0; padding: 12px 14px; border: 1px solid #e6e8df; border-radius: 8px; color: #81877d; background: #f8f9f5; font-size: 10px; line-height: 1.65; }
    .privacy-note strong { color: #555d52; font-weight: 690; }
    .info-icon { flex: 0 0 auto; display: grid; width: 17px; height: 17px; place-items: center; margin-top: 1px; border-radius: 50%; color: #58734f; background: #e9efe3; font-size: 10px; font-weight: 750; }
    .footer { margin-top: 40px; color: #9aa096; text-align: center; font-size: 9px; }
    .hidden { display: none !important; }
    @media (max-width: 700px) {
      .topbar { height: 58px; padding: 0 17px; }
      .shell { width: min(100% - 30px, 620px); padding-top: 42px; }
      .hero { margin-bottom: 20px; }
      .form-card { padding: 14px; }
      .file-card { grid-template-columns: 66px minmax(0, 1fr); gap: 12px; padding: 12px; }
      .thumb-wrap { width: 66px; height: 60px; }
      .file-actions { grid-column: 1 / -1; justify-content: stretch; }
      .file-actions .action-button { flex: 1; }
      .file-row { grid-template-columns: 30px minmax(0, 1fr) auto; gap: 8px; }
      .file-row-size { display: none; }
      .file-row-actions .action-button { min-width: 34px; }
      .player-frame { min-height: 170px; }
    }
    @media (max-width: 440px) {
      .form-row { display: grid; grid-template-columns: 1fr 1fr; }
      .url-input { grid-column: 1 / -1; }
      .paste-button, .submit-button { width: 100%; height: 44px; }
      .paste-button { grid-column: 1; }
      .submit-button { grid-column: 2; }
      .hero-copy { font-size: 12px; }
      .file-title { font-size: 12px; }
      .player-head { align-items: flex-start; flex-direction: column; justify-content: center; padding: 10px 13px; }
      .player-frame { min-height: 150px; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/download" aria-label="Athena Proxy Downloader home"><span class="brand-mark">AP</span><span><span class="brand-name">Athena Proxy</span><span class="brand-caption" style="display:block">Downloader & Stream</span></span></a>
    <a class="nav-link" href="/admin">Admin console <span aria-hidden="true">↗</span></a>
  </header>
  <main class="shell">
    <section class="hero">
      <div class="eyebrow">Athena Proxy · Share tools</div>
      <h1>Link masuk.<br>File siap diakses.</h1>
      <p class="hero-copy">Tempel link share TeraBox untuk melihat informasi file, memutar video, atau membuka tautan unduhan yang tersedia.</p>
    </section>
    <form id="download-form" class="form-card">
      <label class="form-label" for="share-link">Link share TeraBox</label>
      <div class="form-row">
        <input id="share-link" class="url-input" name="link" type="text" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false" aria-describedby="link-help" placeholder="Tempel link TeraBox atau masukkan kode share" required>
        <button id="paste-button" class="paste-button" type="button">Tempel link</button>
        <button id="submit-button" class="submit-button" type="submit"><span id="submit-label">Periksa link</span><span class="submit-arrow" aria-hidden="true">→</span></button>
      </div>
      <p id="link-help" class="form-help">Tempel link share atau masukkan kode share · hanya link yang dapat Anda akses</p>
      <div id="form-error" class="form-error" role="alert"></div>
    </form>
    <section id="result" class="result hidden" aria-live="polite"></section>
    <aside class="privacy-note">
      <span class="info-icon" aria-hidden="true">i</span>
      <span><strong>Gunakan hanya link yang memang boleh Anda akses.</strong> Halaman tidak meminta kata sandi atau cookie TeraBox. Pemutaran video mendukung durasi penuh dan navigasi waktu (seeking) melalui Athena Proxy.</span>
    </aside>
    <footer class="footer">Athena Proxy · Pemrosesan link dilakukan melalui Worker milik layanan ini.</footer>
  </main>
  <script>
    (function () {
      var form = document.getElementById('download-form');
      var input = document.getElementById('share-link');
      var button = document.getElementById('submit-button');
      var label = document.getElementById('submit-label');
      var pasteButton = document.getElementById('paste-button');
      var errorBox = document.getElementById('form-error');
      var result = document.getElementById('result');
      var currentHls = null;
      var hlsPromise = null;
      result.addEventListener('error', function (event) {
        var image = event.target;
        if (!image || image.tagName !== 'IMG') return;
        if (image.dataset.fallbackSrc && image.dataset.fallbackAttempted !== 'true') {
          image.dataset.fallbackAttempted = 'true';
          image.src = image.dataset.fallbackSrc;
          return;
        }
        if (image.classList.contains('file-row-thumb')) {
          var row = image.closest('.file-row');
          var isFolder = row && row.querySelector('.file-row-meta') &&
            row.querySelector('.file-row-meta').textContent === 'Folder';
          var placeholder = document.createElement('span');
          placeholder.className = 'file-row-icon' + (isFolder ? ' folder-open' : '');
          placeholder.innerHTML = isFolder ? folderIcon() : fileIcon();
          image.replaceWith(placeholder);
        } else if (image.parentElement && image.parentElement.classList.contains('thumb-wrap')) {
          var cardPlaceholder = document.createElement('span');
          cardPlaceholder.className = 'thumb-placeholder';
          cardPlaceholder.innerHTML = fileIcon();
          image.replaceWith(cardPlaceholder);
        }
      }, true);
      var allowedHosts = [
        'terabox.com', 'terabox.app', '1024tera.com', '1024terabox.com',
        'freeterabox.com', 'teraboxurl.com', 'teraboxshare.com',
        'terasharelink.com', 'terafileshare.com', 'terasharefile.com',
        'teraboxlink.com'
      ];

      function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
      }
      function formatBytes(value) {
        var size = Number(value);
        if (!Number.isFinite(size) || size < 0) return '';
        if (size < 1024) return new Intl.NumberFormat('id-ID').format(size) + ' B';
        var units = ['KB', 'MB', 'GB', 'TB'];
        var index = -1;
        do { size = size / 1024; index++; } while (size >= 1024 && index < units.length - 1);
        return size.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' ' + units[index];
      }
      function safeHttps(value) {
        try {
          var url = new URL(String(value || ''), location.origin);
          return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : '';
        } catch (error) {
          return '';
        }
      }
      function thumbnailProxyUrl(fid, surl, dir) {
        if (!fid) return '';
        var url = new URL('/', location.origin);
        url.searchParams.set('mode', 'thumbnail');
        url.searchParams.set('fid', fid);
        url.searchParams.set('surl', surl);
        if (dir) url.searchParams.set('dir', dir);
        return url.toString();
      }
      function showError(message, surl) {
        errorBox.textContent = message;
        if (surl) {
          var shareUrl = new URL('https://www.terabox.app/sharing/link');
          shareUrl.searchParams.set('surl', surl);
          var link = document.createElement('a');
          link.href = shareUrl.toString();
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.referrerPolicy = 'no-referrer';
          link.textContent = 'Buka share resmi di TeraBox ↗';
          errorBox.append(document.createElement('br'), link);
        }
        errorBox.classList.add('visible');
      }
      function resetPlayer() {
        if (currentHls) {
          currentHls.destroy();
          currentHls = null;
        }
        var frame = document.getElementById('player-frame');
        if (frame) frame.classList.remove('has-player-note');
      }
      function getSurl(value) {
        var raw = String(value || '').trim();
        if (!raw) throw new Error('Masukkan link share atau kode surl terlebih dahulu.');
        var surl = raw;
        if (raw.indexOf('http://') === 0 || raw.indexOf('https://') === 0) {
          var parsed;
          try { parsed = new URL(raw); }
          catch (error) { throw new Error('Format URL tidak valid. Periksa kembali link yang ditempel.'); }
          var hostAllowed = allowedHosts.some(function (host) {
            return parsed.hostname === host || parsed.hostname.endsWith('.' + host);
          });
          if (parsed.protocol !== 'https:' || !hostAllowed) {
            throw new Error('Gunakan link HTTPS dari domain TeraBox yang didukung.');
          }
          surl = parsed.searchParams.get('surl') || parsed.searchParams.get('shorturl') || '';
          if (!surl) {
            var sIndex = parsed.pathname.indexOf('/s/');
            if (sIndex !== -1) {
              surl = parsed.pathname.slice(sIndex + 3).split('/')[0];
            }
          }
          if (!surl) throw new Error('Kode surl tidak ditemukan di URL. Coba tempel link share lengkap.');
        } else if (/[/?#]/.test(raw)) {
          throw new Error('Masukkan kode surl saja atau tempel link share TeraBox yang lengkap.');
        }
        try { surl = decodeURIComponent(surl); }
        catch (error) { throw new Error('Kode surl pada URL tidak valid.'); }
        if (surl.length === 23 && surl.charAt(0) === '1') surl = surl.slice(1);
        if (!/^[a-zA-Z0-9_-]{6,50}$/.test(surl)) {
          throw new Error('Kode surl tidak sesuai format TeraBox.');
        }
        return surl;
      }
      function icon(path) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
      }
      function isVideo(name) {
        return /\\.(?:mp4|m4v|mov|mkv|webm|avi|3gp|m3u8)$/i.test(String(name || ''));
      }
      function folderIcon() {
        return icon('<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
      }
      function fileIcon() {
        return icon('<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>');
      }
      function renderRecord(record, surl) {
        resetPlayer();
        var title = record.name || 'File dari TeraBox';
        if (record.isdir) {
          renderDirectory(surl, record.path || '/', [], title, true);
          return;
        }
        var thumb = safeHttps(record.thumb);
        var cleanRecordFid = record.fid ? String(record.fid).replace(/\.0+$/, '') : '';
        var dlink = safeHttps(record.dlink) || (cleanRecordFid ? ('/?mode=download&surl=' + encodeURIComponent(surl) + '&fid=' + encodeURIComponent(cleanRecordFid)) : '');
        var playable = isVideo(title);
        var sourceLabel = record.last_verified ? 'Diperbarui ' + new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(Number(record.last_verified) * 1000)) : 'Link berhasil diperiksa';
        result.innerHTML =
          '<article class="file-card"><div class="thumb-wrap">' + (thumb ? '<img src="' + escapeHtml(thumb) + '" data-fallback-src="' + escapeHtml(thumbnailProxyUrl(record.fid, surl, getParentPath(record.path))) + '" alt="Thumbnail file">' : '<span class="thumb-placeholder" aria-hidden="true">▧</span>') + '</div>' +
          '<div class="file-copy"><div class="file-title" title="' + escapeHtml(title) + '">' + escapeHtml(title) + '</div><div class="file-meta">' +
          (record.size != null ? '<span>' + escapeHtml(formatBytes(record.size)) + '</span>' : '') +
          (record.fid ? '<span>File ID ' + escapeHtml(String(record.fid).slice(-8)) + '</span>' : '') +
          '<span class="source-label">' + escapeHtml(sourceLabel) + '</span></div><div class="file-origin">Surl · ' + escapeHtml(surl) + '</div></div>' +
          '<div class="file-actions">' +
          (playable ? '<button id="play-button" class="action-button" type="button">' + icon('<polygon points="6 3 20 12 6 21 6 3"/>') + ' Putar video</button>' : '') +
          (dlink ? '<a class="action-button action-primary" href="' + escapeHtml(dlink) + '" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">' + icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>') + ' Unduh file</a>' : '') +
          '</div></article>' +
          (playable ? '<section id="player-card" class="player-card hidden"><div class="player-head"><div><span class="player-label">' + escapeHtml(title) + '</span><span class="player-note">Stream diproses melalui Athena Proxy</span></div>' + (dlink ? '<a id="player-download-btn" class="action-button action-primary" style="padding:6px 14px;font-size:12px;text-decoration:none" href="' + escapeHtml(dlink) + '" target="_blank" rel="noopener noreferrer">Unduh video ↗</a>' : '') + '</div><div id="player-frame" class="player-frame"></div></section>' : '');
        result.classList.remove('hidden');
        var playButton = document.getElementById('play-button');
        if (playButton) playButton.addEventListener('click', function () {
          playVideo(surl, title, record.fid, '', dlink);
        });
      }
      function getParentPath(path) {
        var clean = String(path || '').replace(/\\/+$/, '');
        var index = clean.lastIndexOf('/');
        return index <= 0 ? '' : clean.slice(0, index);
      }
      function renderDirectory(surl, path, items, title, openOnLoad) {
        resetPlayer();
        var normalizedPath = path || '';
        var parts = normalizedPath.split('/').filter(Boolean);
        var breadcrumbs = '<button class="breadcrumb-button" type="button" data-dir-path="">Share</button>';
        var accumulated = '';
        parts.forEach(function (part, index) {
          accumulated += '/' + part;
          breadcrumbs += '<span aria-hidden="true">/</span>' + (index === parts.length - 1
            ? '<span>' + escapeHtml(decodeURIComponentSafe(part)) + '</span>'
            : '<button class="breadcrumb-button" type="button" data-dir-path="' + escapeHtml(accumulated) + '">' + escapeHtml(decodeURIComponentSafe(part)) + '</button>');
        });
        var rows = (items || []).map(function (item) {
          var name = item.name || (item.isdir ? 'Folder tanpa nama' : 'File tanpa nama');
          var thumb = safeHttps(item.thumb);
          var dirPath = item.path || '';
          var thumbnailFallback = thumbnailProxyUrl(item.fid, surl, getParentPath(dirPath));
          var cleanItemFid = item.fid ? String(item.fid).replace(/\.0+$/, '') : '';
          var dlink = safeHttps(item.dlink) || (cleanItemFid ? ('/?mode=download&surl=' + encodeURIComponent(surl) + '&fid=' + encodeURIComponent(cleanItemFid)) : '');
          var video = !item.isdir && isVideo(name);
          var actions = item.isdir
            ? '<button class="action-button folder-open" type="button" data-open-folder="' + escapeHtml(dirPath) + '" data-folder-name="' + escapeHtml(name) + '">Buka</button>'
            : (video ? '<button class="action-button" type="button" data-play-fid="' + escapeHtml(item.fid || '') + '" data-play-name="' + escapeHtml(name) + '" data-play-dir="' + escapeHtml(normalizedPath) + '" data-play-dlink="' + escapeHtml(dlink) + '">Putar</button>' : '') +
              (dlink ? '<a class="action-button action-primary" href="' + escapeHtml(dlink) + '" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" aria-label="Unduh ' + escapeHtml(name) + '" title="Unduh ' + escapeHtml(name) + '">' + icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>') + ' Unduh</a>' : '');
          var itemIcon = thumb
            ? '<img class="file-row-thumb" src="' + escapeHtml(thumb) + '" data-fallback-src="' + escapeHtml(thumbnailFallback) + '" alt="">'
            : '<span class="file-row-icon' + (item.isdir ? ' folder-open' : '') + '">' + (item.isdir ? folderIcon() : fileIcon()) + '</span>';
          var meta = item.isdir ? 'Folder' : (item.fid ? 'ID ' + String(item.fid).slice(-8) : '');
          return '<div class="file-row"><span>' + itemIcon + '</span><div style="min-width:0"><div class="file-row-name" title="' + escapeHtml(name) + '">' + escapeHtml(name) +
            '</div><div class="file-row-meta">' + escapeHtml(meta) + '</div></div><span class="file-row-size">' +
            (item.isdir ? '—' : escapeHtml(formatBytes(item.size) || '—')) + '</span><div class="file-row-actions">' + actions + '</div></div>';
        }).join('');
        result.innerHTML = (openOnLoad ? '' : '<article class="file-card is-folder"><div class="thumb-wrap">' + folderIcon() + '</div><div class="file-copy"><div class="file-title">' + escapeHtml(title || 'Folder share') +
          '</div><div class="file-meta"><span>Folder share</span></div><div class="file-origin">Surl · ' + escapeHtml(surl) + '</div></div><div class="file-actions"><button class="action-button folder-open" type="button" data-open-folder="' + escapeHtml(normalizedPath || '/') + '" data-folder-name="' + escapeHtml(title || 'Folder') + '">' + folderIcon() + ' Buka folder</button></div></article>') +
          '<section class="listing-card"><div class="listing-head"><div><div class="listing-title">' + escapeHtml(title || 'Isi folder') + '</div><nav class="breadcrumbs" aria-label="Lokasi folder">' + breadcrumbs + '</nav></div>' +
          (normalizedPath ? '<button class="action-button" type="button" data-dir-path="' + escapeHtml(getParentPath(normalizedPath)) + '">← Kembali</button>' : '') +
          '</div><div class="file-list">' + (rows || '<div class="empty-list">Folder ini kosong atau tidak memiliki item yang bisa ditampilkan.</div>') + '</div></section>' +
          '<section id="player-card" class="player-card hidden"><div class="player-head"><div><span id="player-title" class="player-label"></span><span class="player-note">Stream diproses melalui Athena Proxy</span></div><a id="player-download-btn" class="action-button action-primary hidden" style="padding:6px 14px;font-size:12px;text-decoration:none" href="#" target="_blank" rel="noopener noreferrer">Unduh video ↗</a></div><div id="player-frame" class="player-frame"></div></section>';
        result.classList.remove('hidden');
        result.querySelectorAll('[data-open-folder]').forEach(function (button) {
          button.addEventListener('click', function () {
            browseFolder(surl, button.dataset.openFolder || '/', button.dataset.folderName || 'Isi folder');
          });
        });
        result.querySelectorAll('.breadcrumb-button, [data-dir-path]').forEach(function (button) {
          button.addEventListener('click', function () {
            browseFolder(surl, button.dataset.dirPath || '', button.dataset.dirPath ? button.dataset.dirPath.split('/').filter(Boolean).pop() : 'Isi share');
          });
        });
        result.querySelectorAll('[data-play-fid]').forEach(function (button) {
          button.addEventListener('click', function () {
            playVideo(surl, button.dataset.playName, button.dataset.playFid, button.dataset.playDir, button.dataset.playDlink);
          });
        });
      }
      function decodeURIComponentSafe(value) {
        try { return decodeURIComponent(value); }
        catch (error) { return value; }
      }
      async function browseFolder(surl, dir, title) {
        resetPlayer();
        var browseDir = dir || '';
        var url = new URL('/', location.origin);
        url.searchParams.set('mode', 'resolve');
        url.searchParams.set('surl', surl);
        if (browseDir) url.searchParams.set('dir', browseDir);
        result.innerHTML = '<div class="empty-list">Memuat isi folder…</div>';
        result.classList.remove('hidden');
        try {
          var response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
          var body;
          try { body = await response.json(); }
          catch (error) { throw new Error('Worker mengirim respons yang tidak dapat dibaca.'); }
          if (!response.ok) {
            throw new Error(body.error || 'Isi folder tidak dapat dimuat (' + response.status + ').');
          }
          renderDirectory(surl, browseDir, body.items || [], title || 'Isi folder', true);
        } catch (error) {
          showError(error.message || 'Isi folder tidak dapat dimuat.');
        }
      }
      async function resolve(surl) {
        resetPlayer();
        errorBox.textContent = '';
        errorBox.classList.remove('visible');
        result.classList.add('hidden');
        button.disabled = true;
        pasteButton.disabled = true;
        label.textContent = 'Memeriksa…';
        try {
          var url = new URL('/', location.origin);
          url.searchParams.set('mode', 'resolve');
          url.searchParams.set('surl', surl);
          var response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
          var body;
          try { body = await response.json(); }
          catch (error) { throw new Error('Worker mengirim respons yang tidak dapat dibaca.'); }
          if (!response.ok) {
            if (body.code === 'upstream_backoff' || body.code === 'upstream_rate_limited' || response.status === 429) {
              var retryAfter = Number(response.headers.get('Retry-After'));
              var waitMessage = Number.isFinite(retryAfter) && retryAfter > 0
                ? 'Coba lagi dalam sekitar ' + Math.ceil(retryAfter) + ' detik.'
                : 'Tunggu sebentar sebelum mencoba lagi.';
              throw new Error('TeraBox sedang membatasi permintaan. ' + waitMessage);
            }
            if (body.code === 'token_extract_failed_all' || body.code === 'upstream_verification_required') {
              throw new Error('TeraBox meminta verifikasi untuk link ini. Selesaikan verifikasi dan lanjutkan unduhan di situs resmi TeraBox; sesi browser tidak diteruskan ke server proyek.');
            }
            throw new Error(body.error || body.message || 'Link tidak dapat diproses (' + response.status + ').');
          }
          if (!body.data || typeof body.data !== 'object') throw new Error('Metadata file tidak tersedia untuk link ini.');
          var items = body.items || [];
          if (body.data.isdir && items.length <= 1) {
            await browseFolder(surl, body.data.path || '/', body.data.name || 'Isi folder');
          } else if (items.length > 1) {
            renderDirectory(surl, '', items, body.data.name || 'Isi share', true);
          } else {
            renderRecord(body.data, surl);
          }
        } catch (error) {
          showError(error.message || 'Terjadi kesalahan saat memeriksa link.', surl);
        } finally {
          button.disabled = false;
          pasteButton.disabled = false;
          label.textContent = 'Periksa link';
        }
      }
      function showPlayerMessage(message) {
        var frame = document.getElementById('player-frame');
        if (frame) frame.innerHTML = '<div class="player-message">' + escapeHtml(message) + '</div>';
      }
      function showOfficialPlayerFallback(message, surl) {
        var frame = document.getElementById('player-frame');
        if (!frame) return;
        var shareUrl = new URL('https://www.terabox.app/sharing/link');
        shareUrl.searchParams.set('surl', surl);
        frame.innerHTML = '<div class="player-message">' + escapeHtml(message) +
          '<br><a href="' + escapeHtml(shareUrl.toString()) + '" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Buka video di TeraBox ↗</a></div>';
      }
      function loadHls() {
        if (window.Hls) return Promise.resolve(window.Hls);
        if (!hlsPromise) {
          hlsPromise = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
            script.async = true;
            script.onload = function () {
              if (window.Hls) resolve(window.Hls);
              else reject(new Error('Library HLS tidak tersedia.'));
            };
            script.onerror = function () {
              script.remove();
              reject(new Error('Library pemutar HLS tidak dapat dimuat.'));
            };
            document.head.appendChild(script);
          }).catch(function (error) {
            hlsPromise = null;
            throw error;
          });
        }
        return hlsPromise;
      }
      function playVideo(surl, title, fid, dir, dlink) {
        var card = document.getElementById('player-card');
        var frame = document.getElementById('player-frame');
        if (!card || !frame) return;
        resetPlayer();
        card.classList.remove('hidden');
        frame.innerHTML = '<div class="player-message">Menyiapkan stream…</div>';
        var playerNote = card.querySelector('.player-note');
        var defaultPlayerNote = 'Stream diproses melalui Athena Proxy';
        var mediaRecoveries = 0;
        var networkRecoveries = 0;
        function setPlayerNote(message) {
          if (playerNote) playerNote.textContent = message;
        }
        var playlist = new URL('/', location.origin);
        playlist.searchParams.set('mode', 'stream');
        playlist.searchParams.set('surl', surl);
        if (fid) playlist.searchParams.set('fid', fid);
        if (dir) playlist.searchParams.set('dir', dir);
        var playerTitle = document.getElementById('player-title');
        if (playerTitle) playerTitle.textContent = title || 'Video';
        var playerDlBtn = document.getElementById('player-download-btn');
        if (playerDlBtn) {
          var cleanDlFid = fid ? String(fid).replace(/\.0+$/, '') : '';
          var dlUrl = dlink || (cleanDlFid ? ('/?mode=download&surl=' + encodeURIComponent(surl) + '&fid=' + encodeURIComponent(cleanDlFid)) : '');
          if (dlUrl) {
            playerDlBtn.href = dlUrl;
            playerDlBtn.classList.remove('hidden');
          } else {
            playerDlBtn.classList.add('hidden');
          }
        }
        var video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.setAttribute('aria-label', 'Pemutar ' + title);
        video.addEventListener('waiting', function () {
          setPlayerNote('Buffering · menunggu data stream…');
        });
        video.addEventListener('playing', function () {
          setPlayerNote(defaultPlayerNote);
        });
        var playlistNotice = null;

        function showStreamError(response, bodyText) {
          var body;
          try { body = JSON.parse(bodyText); }
          catch (error) { body = {}; }
          if (body.code === 'incomplete_stream_metadata') {
            showOfficialPlayerFallback('TeraBox tidak memberikan parameter stream publik yang dibutuhkan. Buka share resmi dan pilih video yang sama untuk memutarnya di TeraBox.', surl);
          } else if (body.code === 'not_found') {
            showPlayerMessage('Video tidak ditemukan di folder ini. Kembali ke daftar folder lalu coba file lain.');
          } else {
            showOfficialPlayerFallback((body.error || 'Stream gagal disiapkan (' + response.status + ').') + ' Anda tetap dapat mencoba memutarnya langsung dari share resmi.', surl);
          }
        }

        function attachWithHls(engine) {
          if (engine && engine.isSupported()) {
            currentHls = new engine({
              enableWorker: true,
            });
            currentHls.loadSource(playlist.toString());
            currentHls.attachMedia(video);
            currentHls.on(engine.Events.MANIFEST_PARSED, function () {
              video.play().catch(function () {});
            });
            currentHls.on(engine.Events.ERROR, function (event, data) {
              if (!data) return;
              if (data.details === engine.ErrorDetails.BUFFER_STALLED_ERROR) {
                setPlayerNote('Buffering · HLS.js sedang menunggu segmen berikutnya…');
              }
              if (!data.fatal) return;

              if (data.type === engine.ErrorTypes.NETWORK_ERROR && networkRecoveries < 1) {
                networkRecoveries++;
                setPlayerNote('Koneksi stream terputus · mencoba menyambungkan kembali…');
                currentHls.startLoad();
                return;
              }
              if (data.type === engine.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 1) {
                mediaRecoveries++;
                setPlayerNote('Stream tersendat · mencoba memulihkan pemutar…');
                currentHls.recoverMediaError();
                return;
              }

              resetPlayer();
              showPlayerMessage('Stream tidak dapat dilanjutkan. Periksa koneksi atau coba buka video langsung di TeraBox.');
            });
          } else {
            showPlayerMessage('Browser ini tidak mendukung pemutaran HLS. Coba Safari atau browser modern dengan JavaScript aktif.');
            return;
          }
          if (playlistNotice) frame.classList.add('has-player-note');
          frame.replaceChildren.apply(frame, playlistNotice ? [playlistNotice, video] : [video]);
        }

        fetch(playlist.toString(), {
          headers: { Accept: 'application/vnd.apple.mpegurl, application/json' },
          credentials: 'same-origin'
        }).then(function (response) {
          return response.text().then(function (bodyText) {
            if (!response.ok) {
              showStreamError(response, bodyText);
              return false;
            }
            if (!bodyText.includes('#EXTM3U')) {
              showPlayerMessage('Worker tidak mengembalikan playlist HLS yang valid.');
              return false;
            }
            var durations = Array.from(bodyText.matchAll(/#EXTINF:([\\d.]+)/g))
              .map(function (match) { return Number(match[1]); });
            var totalDuration = durations.reduce(function (total, duration) {
              return total + duration;
            }, 0);
            if (totalDuration === 30) {
              playlistNotice = document.createElement('div');
              playlistNotice.className = 'player-inline-note';
              playlistNotice.textContent = 'TeraBox mengirim playlist 30 detik untuk request ini. Worker tidak memotong playlist; periksa konfigurasi sesi jika durasi tersebut tidak sesuai.';
            }
            return true;
          });
        }).then(function (ready) {
          if (!ready) return;
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = playlist.toString();
            video.addEventListener('loadedmetadata', function () { video.play().catch(function () {}); }, { once: true });
            video.addEventListener('error', function () {
              showPlayerMessage('Playlist tersedia, tetapi browser gagal memuat segmen video. Link mungkin kedaluwarsa atau sumber menolak permintaan.');
            }, { once: true });
            if (playlistNotice) frame.classList.add('has-player-note');
            frame.replaceChildren.apply(frame, playlistNotice ? [playlistNotice, video] : [video]);
          } else {
            loadHls().then(attachWithHls).catch(function () {
              showPlayerMessage('Playlist tersedia, tetapi library pemutar HLS gagal dimuat. Periksa koneksi browser.');
            });
          }
        }).catch(function () {
          showPlayerMessage('Worker tidak dapat dihubungi untuk menyiapkan stream. Periksa koneksi lalu coba lagi.');
        });
      }
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        errorBox.textContent = '';
        errorBox.classList.remove('visible');
        var surl;
        try { surl = getSurl(input.value); }
        catch (error) {
          errorBox.textContent = error.message;
          errorBox.classList.add('visible');
          return;
        }
        resolve(surl);
      });
      pasteButton.addEventListener('click', function () {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          showError('Browser tidak mengizinkan akses clipboard. Tempel link secara manual pada kolom di atas.');
          return;
        }
        navigator.clipboard.readText().then(function (value) {
          if (!value.trim()) {
            showError('Clipboard kosong. Salin link share terlebih dahulu, lalu coba lagi.');
            return;
          }
          input.value = value.trim();
          input.focus();
          errorBox.textContent = '';
          errorBox.classList.remove('visible');
        }).catch(function () {
          showError('Clipboard tidak dapat dibaca. Izinkan akses clipboard atau tempel link secara manual.');
        });
      });
      var initial = new URLSearchParams(location.search).get('l');
      if (initial) {
        input.value = initial;
        try {
          var initialSurl = getSurl(initial);
          resolve(initialSurl);
        } catch (error) {
          showError(error.message);
        }
      }
    })();
  </script>
</body>
</html>`;

export function downloaderResponse() {
  return new Response(downloaderHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self'; img-src 'self' https: data:; media-src 'self' blob:; worker-src blob:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
    }
  });
}
