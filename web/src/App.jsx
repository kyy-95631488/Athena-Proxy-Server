import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DownloaderPage } from './pages/DownloaderPage';
import { AdminPage } from './pages/AdminPage';
import { Key, X, Check } from 'lucide-react';

export function App() {
  const [activePage, setActivePage] = useState(() => {
    return window.location.pathname.startsWith('/admin') ? 'admin' : 'downloader';
  });

  const [adminKey, setAdminKey] = useState(() => {
    return localStorage.getItem('athena_admin_key') || '';
  });

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState('');
  const [secretTapCount, setSecretTapCount] = useState(0);

  const [downloaderInitialUrl, setDownloaderInitialUrl] = useState('');

  const handleOpenInDownloader = (surl) => {
    setDownloaderInitialUrl(surl);
    handlePageChange('downloader');
  };

  // Synchronize browser history / URL path
  const handlePageChange = (page) => {
    setActivePage(page);
    const targetPath = page === 'admin' ? '/admin' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  // Secret shortcut: Ctrl + Shift + A or Alt + A
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') ||
        (e.altKey && e.key.toLowerCase() === 'a')
      ) {
        e.preventDefault();
        setTempKeyInput(adminKey);
        setIsKeyModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [adminKey]);

  // Read URL params (?key=... or ?admin=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const keyParam = params.get('key');
    if (keyParam) {
      const clean = keyParam.trim();
      setAdminKey(clean);
      localStorage.setItem('athena_admin_key', clean);
      // Remove sensitive key from URL without refreshing
      params.delete('key');
      const restSearch = params.toString();
      const cleanUrl = window.location.pathname + (restSearch ? `?${restSearch}` : '');
      window.history.replaceState({}, '', cleanUrl);
    }

    if (params.get('admin') === '1' && !window.location.pathname.startsWith('/admin')) {
      handlePageChange('admin');
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActivePage(window.location.pathname.startsWith('/admin') ? 'admin' : 'downloader');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Secret 5-tap gesture on logo to reveal console
  const handleSecretTap = () => {
    setSecretTapCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setTempKeyInput(adminKey);
        setIsKeyModalOpen(true);
        return 0;
      }
      return next;
    });
    // Auto reset tap count after 3 seconds of inactivity
    setTimeout(() => setSecretTapCount(0), 3000);
  };

  const handleLogoutAdmin = () => {
    setAdminKey('');
    localStorage.removeItem('athena_admin_key');
    handlePageChange('downloader');
  };

  const saveAdminKey = (e) => {
    e.preventDefault();
    const clean = tempKeyInput.trim();
    setAdminKey(clean);
    localStorage.setItem('athena_admin_key', clean);
    setIsKeyModalOpen(false);
    if (clean) {
      handlePageChange('admin');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f5f1] text-[#202820] w-full max-w-full overflow-x-hidden">
      {/* Navigation */}
      <Navbar
        activePage={activePage}
        setActivePage={handlePageChange}
        adminKey={adminKey}
        onLogoutAdmin={handleLogoutAdmin}
        isKeyModalOpen={isKeyModalOpen}
        setIsKeyModalOpen={() => {
          setTempKeyInput(adminKey);
          setIsKeyModalOpen(true);
        }}
        onSecretTap={handleSecretTap}
      />

      {/* Main Content */}
      <main className="flex-1 w-full min-w-0 overflow-x-hidden">
        {activePage === 'downloader' ? (
          <DownloaderPage initialUrl={downloaderInitialUrl} />
        ) : (
          <AdminPage
            adminKey={adminKey}
            setAdminKey={(key) => {
              setAdminKey(key);
              localStorage.setItem('athena_admin_key', key);
            }}
            onLogoutAdmin={handleLogoutAdmin}
            onOpenInDownloader={handleOpenInDownloader}
            setIsKeyModalOpen={() => {
              setTempKeyInput(adminKey);
              setIsKeyModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Modern Footer */}
      <footer className="mt-auto border-t border-[#e5e7e1] bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-[#7d8379] space-y-1">
          <p className="font-semibold text-[#202820]">
            <span
              onClick={handleSecretTap}
              className="cursor-pointer select-none hover:opacity-75"
              title="Athena Platform"
            >
              ⚡
            </span>{' '}
            Athena Proxy — Cloudflare Workers Edge Gateway
          </p>
          <p>
            Mendukung streaming HLS adaptif, D1 caching terdistribusi, dan direct resumable download.
          </p>
        </div>
      </footer>

      {/* Admin Key Modal */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#e5e7e1] p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#f0f3e9] flex items-center justify-center text-[#556f4d]">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#202820]">Admin Security Gateway</h3>
              </div>
              <button
                onClick={() => setIsKeyModalOpen(false)}
                className="text-[#7d8379] hover:text-[#202820]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#7d8379] leading-relaxed">
              Masukkan Security Key untuk membuka Console Operasi D1 & KV.
            </p>

            <form onSubmit={saveAdminKey} className="space-y-3">
              <input
                type="password"
                placeholder="Masukkan Admin Secret Key..."
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#dfe3da] outline-none focus:border-[#556f4d] focus:ring-2 focus:ring-[#556f4d]/10"
              />

              <div className="flex justify-end gap-2 pt-1">
                {adminKey && (
                  <button
                    type="button"
                    onClick={handleLogoutAdmin}
                    className="px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    Kunci & Hapus
                  </button>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-[#202820] text-white rounded-xl hover:bg-[#344132] flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Check className="w-3.5 h-3.5 text-[#d8f36a]" />
                  <span>Buka Akses</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
