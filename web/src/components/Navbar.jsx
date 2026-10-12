import React, { useState } from 'react';
import { Download, ShieldCheck, Lock, Zap, ShieldAlert } from 'lucide-react';

export function Navbar({
  activePage,
  setActivePage,
  adminKey,
  onLogoutAdmin,
  isKeyModalOpen,
  setIsKeyModalOpen,
  onSecretTap
}) {
  const isAdminUnlocked = Boolean(adminKey) || activePage === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e5e7e1] w-full">
      <div className="max-w-6xl mx-auto px-2.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Brand with secret click gesture */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div
            className="flex items-center gap-1.5 sm:gap-2.5 text-left group select-none cursor-pointer"
            onClick={() => {
              if (onSecretTap) onSecretTap();
              if (activePage !== 'downloader') setActivePage('downloader');
            }}
            title="Athena Proxy"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#d8f36a] text-[#202820] flex items-center justify-center font-black text-xs sm:text-sm shadow-sm transition-transform group-hover:scale-105 active:scale-95 shrink-0">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs sm:text-sm tracking-tight text-[#202820] flex items-center gap-1 sm:gap-1.5 leading-none">
                <span>Athena</span>
                <span className="hidden min-[380px]:inline"> Proxy</span>
                <span className="hidden sm:inline-block text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#f0f3e9] text-[#556f4d]">
                  Edge
                </span>
              </div>
              <div className="hidden sm:block text-[10px] text-[#7d8379] font-medium tracking-wide uppercase mt-0.5 leading-none">
                TeraBox Stream & Cache
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Only rendered when Admin is unlocked) */}
        {isAdminUnlocked && (
          <nav className="flex items-center gap-0.5 sm:gap-1 bg-[#f4f5f1] p-0.5 sm:p-1 rounded-xl border border-[#e5e7e1] shrink-0 animate-fade-in">
            <button
              onClick={() => setActivePage('downloader')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all shrink-0 ${
                activePage === 'downloader'
                  ? 'bg-white text-[#202820] shadow-sm'
                  : 'text-[#62695f] hover:text-[#202820]'
              }`}
              title="Halaman Downloader"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden min-[400px]:inline">Downloader</span>
              <span className="min-[400px]:hidden">Unduh</span>
            </button>

            <button
              onClick={() => setActivePage('admin')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all shrink-0 ${
                activePage === 'admin'
                  ? 'bg-white text-[#202820] shadow-sm'
                  : 'text-[#62695f] hover:text-[#202820]'
              }`}
              title="Console Operasi Admin"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
              <span>Console</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            </button>
          </nav>
        )}

        {/* Right Actions: Lock Console (when unlocked) OR Combined Status + Version (when locked) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {isAdminUnlocked ? (
            <button
              onClick={onLogoutAdmin}
              className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 transition-colors shrink-0 shadow-sm"
              title="Kunci & Sembunyikan Console Admin"
            >
              <Lock className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span className="hidden md:inline">Kunci Console</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f0f3e9] text-[#556f4d] text-[10px] sm:text-xs font-semibold border border-[#dbe3d4]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>Edge Live</span>
              </div>
              <button
                onClick={() => {
                  if (onSecretTap) onSecretTap();
                }}
                className="px-2 py-1 rounded-md text-[#7d8379] hover:text-[#202820] hover:bg-[#f0f3e9] transition-colors text-[10px] sm:text-xs font-mono tracking-tight"
                title="Athena Gateway"
                aria-label="Gateway Status"
              >
                v1.2
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
