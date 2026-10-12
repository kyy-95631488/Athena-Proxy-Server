import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Files,
  Image as ImageIcon,
  BarChart2,
  Database,
  Search,
  RefreshCw,
  Key,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Lock,
  HardDrive,
  Trash2,
  Plus,
  Play,
  Download,
  Copy,
  Check,
  X,
  Eye,
  Film,
  FileText,
  Cpu,
  Server,
  Activity,
  AlertTriangle,
  Sparkles,
  SlidersHorizontal,
  ArrowUpDown,
  Clock
} from 'lucide-react';
import { api } from '../services/api';
import { formatBytes, formatDate } from '../components/FileCard';
import { VideoPlayer } from '../components/VideoPlayer';

export function AdminPage({ adminKey, setAdminKey, onLogoutAdmin, setIsKeyModalOpen, onOpenInDownloader }) {
  const [unlockInput, setUnlockInput] = useState('');
  const [gateError, setGateError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Overview data
  const [overview, setOverview] = useState(null);

  // Shares data
  const [sharesData, setSharesData] = useState({ items: [], total: 0, page: 1, pageSize: 25 });
  const [sharesQuery, setSharesQuery] = useState('');
  const [sharesSort, setSharesSort] = useState('updated_at');
  const [sharesOrder, setSharesOrder] = useState('DESC');
  const [selectedShareId, setSelectedShareId] = useState(null);
  const [shareDetail, setShareDetail] = useState(null);

  // Media files data
  const [filesData, setFilesData] = useState({ items: [], total: 0, page: 1, pageSize: 25 });
  const [filesQuery, setFilesQuery] = useState('');
  const [filesCategory, setFilesCategory] = useState('');
  const [filesSizeFilter, setFilesSizeFilter] = useState('');
  const [filesSort, setFilesSort] = useState('server_mtime');
  const [filesOrder, setFilesOrder] = useState('DESC');

  // Thumbnails data
  const [thumbsData, setThumbsData] = useState({ items: [], total: 0, page: 1, pageSize: 24 });
  const [thumbsType, setThumbsType] = useState('');
  const [thumbsFsId, setThumbsFsId] = useState('');

  // KV / Cache inspector
  const [lookupSurl, setLookupSurl] = useState('');
  const [lookupResult, setLookupResult] = useState(null);

  // System Diagnostics
  const [diagResults, setDiagResults] = useState({});
  const [isDiagTesting, setIsDiagTesting] = useState(false);

  // Modals state
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [ingestInput, setIngestInput] = useState('');
  const [ingestDir, setIngestDir] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);

  const [deleteConfirmShare, setDeleteConfirmShare] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [previewMediaFile, setPreviewMediaFile] = useState(null);
  const [previewType, setPreviewType] = useState(null); // 'video' | 'image'
  const [copiedKey, setCopiedKey] = useState(null);

  // Clipboard copy helper
  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Load data when tab or key changes
  useEffect(() => {
    loadTabData();
  }, [activeTab, adminKey]);

  const loadTabData = async () => {
    setError(null);
    setLoading(true);

    try {
      if (activeTab === 'overview') {
        const data = await api.adminOverview(adminKey);
        setOverview(data);
      } else if (activeTab === 'shares') {
        const data = await api.adminShares({
          key: adminKey,
          q: sharesQuery,
          sort: sharesSort,
          order: sharesOrder,
          page: sharesData.page,
          pageSize: sharesData.pageSize
        });
        setSharesData(data);
      } else if (activeTab === 'files') {
        let sizeMin = '';
        let sizeMax = '';
        if (filesSizeFilter === 'small') {
          sizeMax = String(10 * 1024 * 1024);
        } else if (filesSizeFilter === 'medium') {
          sizeMin = String(10 * 1024 * 1024);
          sizeMax = String(100 * 1024 * 1024);
        } else if (filesSizeFilter === 'large') {
          sizeMin = String(100 * 1024 * 1024);
        }

        const data = await api.adminFiles({
          key: adminKey,
          q: filesQuery,
          category: filesCategory,
          sizeMin,
          sizeMax,
          sort: filesSort,
          order: filesOrder,
          page: filesData.page,
          pageSize: filesData.pageSize
        });
        setFilesData(data);
      } else if (activeTab === 'thumbnails') {
        const data = await api.adminThumbnails({
          key: adminKey,
          type: thumbsType,
          fsId: thumbsFsId,
          page: thumbsData.page,
          pageSize: thumbsData.pageSize
        });
        setThumbsData(data);
      } else if (activeTab === 'system') {
        runDiagnostics();
      }
    } catch (err) {
      setError(err?.message || 'Gagal memuat data dari API admin');
    } finally {
      setLoading(false);
    }
  };

  // Ingest Share from TeraBox Link
  const handleIngestShare = async (e) => {
    e?.preventDefault();
    const cleanSurl = api.extractSurl(ingestInput);
    if (!cleanSurl) {
      setError('Masukkan Link atau SURL TeraBox yang valid');
      return;
    }

    setIsIngesting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await api.adminIngestShare(cleanSurl, ingestDir.trim(), adminKey);
      setSuccessMessage(`Berhasil sinkronisasi share "${cleanSurl}" (${res?.items?.length || 0} berkas)!`);
      setIsIngestModalOpen(false);
      setIngestInput('');
      setIngestDir('');
      loadTabData();
    } catch (err) {
      setError(err?.message || 'Gagal melakukan sinkronisasi share');
    } finally {
      setIsIngesting(false);
    }
  };

  // Delete Share
  const handleDeleteShare = async () => {
    if (!deleteConfirmShare) return;
    setIsDeleting(true);
    setError(null);

    try {
      await api.adminDeleteShare(deleteConfirmShare.share_id, adminKey);
      setSuccessMessage(`Share ${deleteConfirmShare.share_id} dan seluruh berkasnya berhasil dihapus dari D1 dan KV.`);
      setDeleteConfirmShare(null);
      if (selectedShareId === deleteConfirmShare.share_id) {
        setSelectedShareId(null);
        setShareDetail(null);
      }
      loadTabData();
    } catch (err) {
      setError(err?.message || 'Gagal menghapus share');
    } finally {
      setIsDeleting(false);
    }
  };

  // Inspect Share Detail
  const handleInspectShare = async (shareId) => {
    setSelectedShareId(shareId);
    setLoading(true);
    try {
      const data = await api.adminShareDetail(shareId, { key: adminKey, page: 1, pageSize: 50 });
      setShareDetail(data);
    } catch (err) {
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  };

  // KV / Cache Lookup
  const handleKvLookup = async (e) => {
    e?.preventDefault();
    if (!lookupSurl.trim()) return;
    const clean = api.extractSurl(lookupSurl.trim());
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminKvLookup(clean, adminKey);
      setLookupResult(data);
    } catch (err) {
      setError(err?.message || 'Data cache tidak ditemukan');
      setLookupResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Purge KV Key
  const handlePurgeKv = async (surlToPurge) => {
    if (!surlToPurge) return;
    setLoading(true);
    try {
      await api.adminPurgeKv(surlToPurge, adminKey);
      setSuccessMessage(`Cache KV untuk surl "${surlToPurge}" berhasil dibersihkan.`);
      if (lookupSurl) handleKvLookup();
    } catch (err) {
      setError(err?.message || 'Gagal membersihkan cache KV');
    } finally {
      setLoading(false);
    }
  };

  // Run System Diagnostics
  const runDiagnostics = async () => {
    setIsDiagTesting(true);
    const results = {};
    const tests = [
      { name: 'Health Probe (/health)', url: '/?mode=health' },
      { name: 'D1 Overview (/admin/overview)', url: '/admin/overview' },
      { name: 'Workers KV Stats (/admin/kv/stats)', url: '/admin/kv/stats' }
    ];

    for (const test of tests) {
      const start = performance.now();
      try {
        const res = await fetch(test.url, { headers: api.adminHeaders(adminKey) });
        const latency = Math.round(performance.now() - start);
        const json = await res.json().catch(() => ({}));
        results[test.name] = {
          status: res.status,
          ok: res.ok,
          latency: `${latency}ms`,
          data: json
        };
      } catch (e) {
        results[test.name] = {
          status: 500,
          ok: false,
          latency: 'Error',
          error: e.message
        };
      }
    }
    setDiagResults(results);
    setIsDiagTesting(false);
  };

  // Storage breakdown calculations
  const totalBytes = overview?.counts?.total_bytes || 0;
  const totalFiles = overview?.counts?.media_files || 0;
  const totalVideos = overview?.counts?.total_videos || 0;
  const totalImages = overview?.counts?.total_images || 0;
  const totalFolders = overview?.counts?.total_folders || 0;
  const totalOther = overview?.counts?.total_other || 0;

  const videoPct = totalFiles > 0 ? Math.round((totalVideos / totalFiles) * 100) : 0;
  const imagePct = totalFiles > 0 ? Math.round((totalImages / totalFiles) * 100) : 0;
  const folderPct = totalFiles > 0 ? Math.round((totalFolders / totalFiles) * 100) : 0;
  const otherPct = Math.max(0, 100 - videoPct - imagePct - folderPct);

  // Security gatekeeper screen if no adminKey
  if (!adminKey) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-3xl border border-[#e5e7e1] p-6 sm:p-8 max-w-md w-full shadow-xl space-y-6 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-[#f0f3e9] text-[#556f4d] border border-[#dfe3da] flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8 stroke-[2.2]" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-[#202820] tracking-tight">
              Console Terproteksi
            </h2>
            <p className="text-xs text-[#7d8379] leading-relaxed">
              Area ini dibatasi khusus administrator. Masukkan Security Key untuk membuka dashboard operasi.
            </p>
          </div>

          {gateError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-xl font-medium animate-shake">
              {gateError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const clean = unlockInput.trim();
              if (!clean) {
                setGateError('Harap masukkan Security Key.');
                return;
              }
              if (setAdminKey) setAdminKey(clean);
            }}
            className="space-y-3"
          >
            <input
              type="password"
              placeholder="Masukkan Security Key..."
              value={unlockInput}
              onChange={(e) => {
                setUnlockInput(e.target.value);
                setGateError(null);
              }}
              autoFocus
              className="w-full h-11 px-4 text-xs rounded-xl border border-[#dfe3da] bg-[#fafbf9] outline-none focus:border-[#556f4d] focus:bg-white focus:ring-2 focus:ring-[#556f4d]/10 transition-all text-[#202820]"
            />

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-[#202820] hover:bg-[#344132] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Key className="w-4 h-4 text-[#d8f36a]" />
              <span>Buka Kunci Console</span>
            </button>
          </form>

          <div className="pt-2 border-t border-[#f0f2ec]">
            <button
              type="button"
              onClick={() => {
                if (onLogoutAdmin) onLogoutAdmin();
              }}
              className="text-xs text-[#627650] hover:underline font-semibold"
            >
              ← Kembali ke Downloader Publik
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6 w-full min-w-0">
      {/* Top Header & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-6 rounded-2xl border border-[#e5e7e1] shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-black text-[#202820] tracking-tight">
              Console & Operations
            </h1>
            <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-[#d8f36a] text-[#202820] font-black uppercase tracking-wider">
              D1 Enterprise
            </span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] sm:text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Edge Live</span>
            </div>
          </div>
          <p className="text-[11px] sm:text-xs text-[#70776b] line-clamp-1 sm:line-clamp-none">
            Pusat kontrol Cloudflare D1 SQL, Workers KV Cache, & metadata TeraBox.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t border-[#f2f4ee] sm:border-t-0">
          <button
            type="button"
            onClick={() => setIsIngestModalOpen(true)}
            className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold bg-[#202820] text-white rounded-xl hover:bg-[#344132] flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-[#d8f36a]" />
            <span>Ingest Link</span>
          </button>

          <button
            type="button"
            onClick={onLogoutAdmin}
            className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            title="Kunci & Sembunyikan Console"
          >
            <Lock className="w-3.5 h-3.5 text-red-600" />
            <span>Kunci</span>
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3 text-xs animate-shake">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Galat Operasi: </span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3 text-xs animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{successMessage}</div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tab Bar: Mobile Grid (< sm) & Desktop Bar (>= sm) */}
      <div className="sm:hidden grid grid-cols-3 gap-1 bg-[#e9ece4] p-1 rounded-2xl border border-[#dfe3da]">
        {[
          { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
          { id: 'shares', label: 'Shares', count: overview?.counts?.shares, icon: FolderOpen },
          { id: 'files', label: 'Files', count: overview?.counts?.media_files, icon: Files },
          { id: 'thumbnails', label: 'Thumbs', count: overview?.counts?.thumbnails, icon: ImageIcon },
          { id: 'kv', label: 'KV Cache', icon: Database },
          { id: 'system', label: 'Diagnostik', icon: Activity }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setError(null);
              }}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-bold transition-all ${
                isActive
                  ? 'bg-white text-[#202820] shadow-sm'
                  : 'text-[#60675c] hover:text-[#202820]'
              }`}
            >
              <div className="flex items-center gap-1">
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#556f4d]' : ''}`} />
                {tab.count != null && (
                  <span className={`text-[9px] px-1 rounded-full font-bold ${
                    isActive ? 'bg-[#f0f3e9] text-[#556f4d]' : 'bg-[#dde2d7] text-[#6b7367]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </div>
              <span className="mt-0.5 truncate w-full text-center">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Desktop Tab Bar (>= sm) */}
      <div className="hidden sm:block overflow-x-auto no-scrollbar pb-1">
        <div className="inline-flex items-center gap-1 bg-[#e9ece4] p-1.5 rounded-2xl border border-[#dfe3da] min-w-full sm:min-w-0">
          {[
            { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
            { id: 'shares', label: 'Shares', count: overview?.counts?.shares, icon: FolderOpen },
            { id: 'files', label: 'Media Files', count: overview?.counts?.media_files, icon: Files },
            { id: 'thumbnails', label: 'Thumbnails', count: overview?.counts?.thumbnails, icon: ImageIcon },
            { id: 'kv', label: 'KV Inspector', icon: Database },
            { id: 'system', label: 'Diagnostik', icon: Activity }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setError(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-white text-[#202820] shadow-sm'
                    : 'text-[#60675c] hover:text-[#202820] hover:bg-white/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#556f4d]' : ''}`} />
                <span>{tab.label}</span>
                {tab.count != null && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-[#f0f3e9] text-[#556f4d]' : 'bg-[#dde2d7] text-[#6b7367]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & SYSTEM COMMAND CENTER                                   */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-4 sm:space-y-6">
          {/* 6 Metric KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
            <div
              onClick={() => setActiveTab('shares')}
              className="bg-white p-3 sm:p-4 rounded-2xl border border-[#e5e7e1] shadow-sm hover:border-[#556f4d] cursor-pointer transition-all hover:-translate-y-0.5 group min-w-0 overflow-hidden"
            >
              <div className="flex items-center justify-between text-xs text-[#7d8379] mb-1.5">
                <span className="font-semibold text-[11px] truncate">Total Shares</span>
                <FolderOpen className="w-3.5 h-3.5 text-[#556f4d] shrink-0 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-[#202820]">
                {overview?.counts?.shares ?? '—'}
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold mt-1 flex items-center gap-1 truncate">
                <span>D1 Database</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
              </div>
            </div>

            <div
              onClick={() => setActiveTab('files')}
              className="bg-white p-3 sm:p-4 rounded-2xl border border-[#e5e7e1] shadow-sm hover:border-[#556f4d] cursor-pointer transition-all hover:-translate-y-0.5 group min-w-0 overflow-hidden"
            >
              <div className="flex items-center justify-between text-xs text-[#7d8379] mb-1.5">
                <span className="font-semibold text-[11px] truncate">Media Files</span>
                <Files className="w-3.5 h-3.5 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-[#202820]">
                {overview?.counts?.media_files ?? '—'}
              </div>
              <div className="text-[10px] text-blue-700 font-semibold mt-1 flex items-center gap-1 truncate">
                <span>Tersimpan Rapi</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-[#e5e7e1] shadow-sm min-w-0 overflow-hidden">
              <div className="flex items-center justify-between text-xs text-[#7d8379] mb-1.5">
                <span className="font-semibold text-[11px] truncate">Total Storage</span>
                <HardDrive className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-[#202820] truncate">
                {totalBytes > 0 ? formatBytes(totalBytes) : '—'}
              </div>
              <div className="text-[10px] text-purple-700 font-semibold mt-1 truncate">
                {totalFiles > 0 ? `Rata-rata ${formatBytes(totalBytes / totalFiles)}` : '0 Byte'}
              </div>
            </div>

            <div
              onClick={() => {
                setFilesCategory('video');
                setActiveTab('files');
              }}
              className="bg-white p-3 sm:p-4 rounded-2xl border border-[#e5e7e1] shadow-sm hover:border-emerald-600 cursor-pointer transition-all hover:-translate-y-0.5 group min-w-0 overflow-hidden"
            >
              <div className="flex items-center justify-between text-xs text-[#7d8379] mb-1.5">
                <span className="font-semibold text-[11px] truncate">Video Stream</span>
                <Film className="w-3.5 h-3.5 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-emerald-900">
                {totalVideos}
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold mt-1 truncate">
                HLS Adaptif Ready
              </div>
            </div>

            <div
              onClick={() => {
                setFilesCategory('image');
                setActiveTab('files');
              }}
              className="bg-white p-3 sm:p-4 rounded-2xl border border-[#e5e7e1] shadow-sm hover:border-amber-600 cursor-pointer transition-all hover:-translate-y-0.5 group min-w-0 overflow-hidden"
            >
              <div className="flex items-center justify-between text-xs text-[#7d8379] mb-1.5">
                <span className="font-semibold text-[11px] truncate">Foto & Gambar</span>
                <ImageIcon className="w-3.5 h-3.5 text-amber-600 shrink-0 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-amber-900">
                {totalImages}
              </div>
              <div className="text-[10px] text-amber-700 font-semibold mt-1 truncate">
                Preview Thumbnail
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-[#e5e7e1] shadow-sm min-w-0 overflow-hidden">
              <div className="flex items-center justify-between text-xs text-[#7d8379] mb-1.5">
                <span className="font-semibold text-[11px] truncate">Subfolder</span>
                <FolderOpen className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              </div>
              <div className="text-lg sm:text-2xl font-black text-teal-900">
                {totalFolders}
              </div>
              <div className="text-[10px] text-teal-700 font-semibold mt-1 truncate">
                Hirarki Direktori
              </div>
            </div>
          </div>

          {/* Storage & Category Visual Breakdown */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#e5e7e1] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#556f4d]" />
                <h3 className="font-bold text-sm text-[#202820]">Distribusi Kategori Berkas dalam D1</h3>
              </div>
              <span className="text-xs text-[#7d8379]">Total {totalFiles} Berkas & Folder</span>
            </div>

            {/* Multi-segment progress bar */}
            <div className="h-4 w-full bg-[#f0f2eb] rounded-full overflow-hidden flex shadow-inner">
              <div style={{ width: `${videoPct}%` }} className="bg-emerald-500 h-full transition-all" title={`Video: ${videoPct}%`} />
              <div style={{ width: `${imagePct}%` }} className="bg-amber-500 h-full transition-all" title={`Gambar: ${imagePct}%`} />
              <div style={{ width: `${folderPct}%` }} className="bg-teal-500 h-full transition-all" title={`Folder: ${folderPct}%`} />
              <div style={{ width: `${otherPct}%` }} className="bg-slate-400 h-full transition-all" title={`Lainnya: ${otherPct}%`} />
            </div>

            {/* Legend Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-emerald-500 shrink-0" />
                <span className="text-[#3b4137] font-medium">Video: <b>{totalVideos}</b> ({videoPct}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-amber-500 shrink-0" />
                <span className="text-[#3b4137] font-medium">Gambar: <b>{totalImages}</b> ({imagePct}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-teal-500 shrink-0" />
                <span className="text-[#3b4137] font-medium">Folder: <b>{totalFolders}</b> ({folderPct}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-slate-400 shrink-0" />
                <span className="text-[#3b4137] font-medium">Lainnya: <b>{totalOther}</b> ({otherPct}%)</span>
              </div>
            </div>
          </div>

          {/* Quick Ingest Box directly on Overview */}
          <div className="bg-gradient-to-br from-[#fafbf9] to-[#f4f7ee] p-5 sm:p-6 rounded-2xl border border-[#dbe4d3] shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#202820]">
              <Sparkles className="w-4 h-4 text-[#556f4d]" />
              <span>Sinkronisasi Cepat (Live Ingest)</span>
            </div>
            <p className="text-xs text-[#6e7769] leading-relaxed">
              Ketik atau tempel link TeraBox langsung di bawah ini untuk mengambil struktur folder dan menyimpannya secara realtime ke D1 SQL & Workers KV.
            </p>
            <form onSubmit={handleIngestShare} className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                type="text"
                placeholder="https://terabox.app/s/1xxxxxx atau surl ID..."
                value={ingestInput}
                onChange={(e) => setIngestInput(e.target.value)}
                className="flex-1 px-4 py-2.5 text-xs bg-white border border-[#ced6c6] rounded-xl outline-none focus:border-[#556f4d]"
              />
              <button
                type="submit"
                disabled={isIngesting || !ingestInput.trim()}
                className="px-5 py-2.5 text-xs font-bold bg-[#202820] text-white rounded-xl hover:bg-[#344132] disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
              >
                {isIngesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{isIngesting ? 'Memproses...' : 'Ingest ke D1'}</span>
              </button>
            </form>
          </div>

          {/* Latest Shares Section */}
          <div className="bg-white rounded-2xl border border-[#e5e7e1] overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-[#e5e7e1] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-[#556f4d]" />
                <h3 className="font-bold text-sm text-[#202820]">Aktivitas Share Terbaru</h3>
              </div>
              <button
                onClick={() => setActiveTab('shares')}
                className="text-xs font-semibold text-[#556f4d] hover:underline flex items-center gap-1"
              >
                <span>Lihat Semua</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {overview?.latestShares?.length > 0 ? (
              <div className="divide-y divide-[#f0f2ec]">
                {overview.latestShares.map((s) => (
                  <div key={s.share_id} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 hover:bg-[#fafbf9] transition-colors">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="font-mono text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-[#f0f3e9] text-[#425239] font-bold shrink-0">
                          {s.share_id}
                        </span>
                        <h4 className="text-xs font-bold text-[#202820] truncate flex-1 min-w-[120px]" title={s.title}>
                          {s.title || 'Tanpa Judul'}
                        </h4>
                      </div>
                      <div className="text-[11px] text-[#848c80] flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#7d8379]" />
                          <span>{formatDate(s.updated_at, true)}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                      <button
                        onClick={() => handleInspectShare(s.share_id)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#dfe3da] bg-white text-[#384034] hover:bg-[#f6f8f4] transition-colors"
                      >
                        Detail
                      </button>
                      <button
                        onClick={() => onOpenInDownloader && onOpenInDownloader(s.share_id)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#202820] text-white hover:bg-[#344132] transition-colors flex items-center gap-1"
                      >
                        <span>Buka</span>
                        <ExternalLink className="w-3 h-3 text-[#d8f36a]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#878e84]">
                Belum ada share yang tersimpan di database D1.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SHARES MANAGEMENT                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'shares' && (
        <div className="space-y-4">
          {/* Controls bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#e5e7e1] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#8f9689] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari berdasarkan SURL, judul, atau UK ID..."
                value={sharesQuery}
                onChange={(e) => setSharesQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadTabData()}
                className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#dfe3da] rounded-xl outline-none focus:border-[#556f4d]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[#878e84] font-medium hidden sm:inline">Urutkan:</span>
                <select
                  value={sharesSort}
                  onChange={(e) => {
                    setSharesSort(e.target.value);
                    setTimeout(loadTabData, 50);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-white border border-[#dfe3da] rounded-xl outline-none"
                >
                  <option value="updated_at">Tanggal Diperbarui</option>
                  <option value="server_time">Server Time</option>
                  <option value="title">Judul</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setSharesOrder(sharesOrder === 'ASC' ? 'DESC' : 'ASC');
                    setTimeout(loadTabData, 50);
                  }}
                  className="p-1.5 rounded-xl border border-[#dfe3da] bg-white text-[#556f4d] hover:bg-[#fafbf9]"
                  title="Balik urutan"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsIngestModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-bold bg-[#202820] text-white rounded-xl hover:bg-[#344132] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-[#d8f36a]" />
                <span>Ingest</span>
              </button>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-[#e5e7e1] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fafbf9] border-b border-[#e5e7e1] text-[#788073] font-bold">
                <tr>
                  <th className="py-3 px-4">SURL</th>
                  <th className="py-3 px-4">Judul / Title</th>
                  <th className="py-3 px-4">Owner UK</th>
                  <th className="py-3 px-4">Diperbarui</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f2ec]">
                {sharesData.items.map((share) => (
                  <tr key={share.share_id} className="hover:bg-[#fafbf9] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#353f31]">
                      <div className="flex items-center gap-1.5">
                        <span>{share.share_id}</span>
                        <button
                          onClick={() => handleCopy(share.share_id, share.share_id)}
                          className="text-[#969e92] hover:text-[#202820]"
                          title="Salin SURL"
                        >
                          {copiedKey === share.share_id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate font-semibold text-[#202820]" title={share.title}>
                      {share.title || 'Tanpa Judul'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#788073]">
                      {share.uk || '—'}
                    </td>
                    <td className="py-3 px-4 text-[#878e84]">
                      {formatDate(share.updated_at, true)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleInspectShare(share.share_id)}
                          className="px-2.5 py-1 rounded-lg border border-[#dfe3da] bg-white text-[#384034] hover:bg-[#f6f8f4] font-semibold"
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => onOpenInDownloader && onOpenInDownloader(share.share_id)}
                          className="px-2.5 py-1 rounded-lg bg-[#f0f3e9] text-[#4a6342] hover:bg-[#e4ebd9] font-bold flex items-center gap-1"
                          title="Buka di Downloader"
                        >
                          <span>Buka</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmShare(share)}
                          className="p-1 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700"
                          title="Hapus share dari D1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Touch Cards View */}
          <div className="md:hidden space-y-3">
            {sharesData.items.map((share) => (
              <div key={share.share_id} className="bg-white p-4 rounded-2xl border border-[#e5e7e1] shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-[#202820] leading-snug line-clamp-2">
                      {share.title || 'Tanpa Judul'}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#f0f3e9] text-[#4a6342] font-bold">
                        {share.share_id}
                      </span>
                      <button
                        onClick={() => handleCopy(share.share_id, share.share_id)}
                        className="text-[#969e92] hover:text-[#202820]"
                      >
                        {copiedKey === share.share_id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteConfirmShare(share)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#878e84] pt-1 border-t border-[#f0f2ec]">
                  <span>UK: {share.uk || '—'}</span>
                  <span>{formatDate(share.updated_at, true)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleInspectShare(share.share_id)}
                    className="w-full py-1.5 text-xs font-semibold rounded-xl border border-[#dfe3da] bg-white text-[#384034] text-center"
                  >
                    Detail Berkas
                  </button>
                  <button
                    onClick={() => onOpenInDownloader && onOpenInDownloader(share.share_id)}
                    className="w-full py-1.5 text-xs font-bold rounded-xl bg-[#202820] text-white flex items-center justify-center gap-1"
                  >
                    <span>Buka Web</span>
                    <ExternalLink className="w-3 h-3 text-[#d8f36a]" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-[#788073] bg-white p-3 rounded-2xl border border-[#e5e7e1]">
            <span>Total {sharesData.total} Shares</span>
            <div className="flex items-center gap-2">
              <button
                disabled={sharesData.page <= 1}
                onClick={() => {
                  setSharesData(prev => ({ ...prev, page: prev.page - 1 }));
                  setTimeout(loadTabData, 50);
                }}
                className="p-1 rounded-lg border border-[#dfe3da] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-[#202820]">
                Hal {sharesData.page} / {Math.ceil(sharesData.total / sharesData.pageSize) || 1}
              </span>
              <button
                disabled={sharesData.page >= Math.ceil(sharesData.total / sharesData.pageSize)}
                onClick={() => {
                  setSharesData(prev => ({ ...prev, page: prev.page + 1 }));
                  setTimeout(loadTabData, 50);
                }}
                className="p-1 rounded-lg border border-[#dfe3da] disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MEDIA FILES EXPLORER                                               */}
      {/* ========================================================================= */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#e5e7e1] space-y-3 shadow-sm">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#8f9689] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama berkas atau FS_ID..."
                  value={filesQuery}
                  onChange={(e) => setFilesQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadTabData()}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#dfe3da] rounded-xl outline-none focus:border-[#556f4d]"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                <select
                  value={filesSizeFilter}
                  onChange={(e) => {
                    setFilesSizeFilter(e.target.value);
                    setTimeout(loadTabData, 50);
                  }}
                  className="px-2.5 py-1.5 bg-white border border-[#dfe3da] rounded-xl outline-none"
                >
                  <option value="">Semua Ukuran</option>
                  <option value="small">&lt; 10 MB</option>
                  <option value="medium">10 - 100 MB</option>
                  <option value="large">&gt; 100 MB</option>
                </select>

                <select
                  value={filesSort}
                  onChange={(e) => {
                    setFilesSort(e.target.value);
                    setTimeout(loadTabData, 50);
                  }}
                  className="px-2.5 py-1.5 bg-white border border-[#dfe3da] rounded-xl outline-none"
                >
                  <option value="server_mtime">Waktu Modifikasi</option>
                  <option value="size">Ukuran Berkas</option>
                  <option value="server_filename">Nama Berkas</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setFilesOrder(filesOrder === 'ASC' ? 'DESC' : 'ASC');
                    setTimeout(loadTabData, 50);
                  }}
                  className="p-1.5 rounded-xl border border-[#dfe3da] bg-white text-[#556f4d]"
                  title="Balik urutan"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {[
                { id: '', label: 'Semua Berkas' },
                { id: 'video', label: '🎬 Video', count: overview?.counts?.total_videos },
                { id: 'image', label: '🖼️ Foto / Gambar', count: overview?.counts?.total_images },
                { id: 'folder', label: '📁 Folder', count: overview?.counts?.total_folders }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setFilesCategory(cat.id);
                    setTimeout(loadTabData, 50);
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                    filesCategory === cat.id
                      ? 'bg-[#202820] text-white shadow-sm'
                      : 'bg-[#f0f3e9] text-[#4f5c49] hover:bg-[#e4ecd9]'
                  }`}
                >
                  <span>{cat.label}</span>
                  {cat.count != null && <span className="ml-1 opacity-75">({cat.count})</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-[#e5e7e1] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fafbf9] border-b border-[#e5e7e1] text-[#788073] font-bold">
                <tr>
                  <th className="py-3 px-4">Nama Berkas</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Ukuran</th>
                  <th className="py-3 px-4">FS_ID</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f2ec]">
                {filesData.items.map((file) => {
                  const isDir = Boolean(file.isdir);
                  const isVid = !isDir && (file.category === '1' || /\.(mp4|mkv|mov|webm)$/i.test(file.server_filename || ''));
                  const isImg = !isDir && (file.category === '3' || /\.(jpe?g|png|gif|webp)$/i.test(file.server_filename || ''));
                  const downloadUrl = api.getProxyDownloadUrl(file.share_id, file.fs_id);

                  return (
                    <tr key={file.fs_id} className="hover:bg-[#fafbf9] transition-colors">
                      <td className="py-3 px-4 max-w-sm">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#f0f3e9] flex items-center justify-center shrink-0">
                            {isDir ? <FolderOpen className="w-3.5 h-3.5 text-[#556f4d]" /> : isVid ? <Film className="w-3.5 h-3.5 text-emerald-600" /> : isImg ? <ImageIcon className="w-3.5 h-3.5 text-amber-600" /> : <FileText className="w-3.5 h-3.5 text-slate-500" />}
                          </div>
                          <span className="font-semibold text-[#202820] truncate" title={file.server_filename}>
                            {file.server_filename}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isDir ? 'bg-teal-50 text-teal-800' : isVid ? 'bg-emerald-50 text-emerald-800' : isImg ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {isDir ? 'Folder' : isVid ? 'Video' : isImg ? 'Gambar' : 'Berkas'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#778073]">
                        {isDir ? '—' : formatBytes(file.size)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#8a9185]">
                        {file.fs_id}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isVid && (
                            <button
                              onClick={() => {
                                setPreviewMediaFile(file);
                                setPreviewType('video');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold flex items-center gap-1"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Putar</span>
                            </button>
                          )}
                          {isImg && (
                            <button
                              onClick={() => {
                                setPreviewMediaFile(file);
                                setPreviewType('image');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Lihat</span>
                            </button>
                          )}
                          {!isDir && (
                            <a
                              href={downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 rounded-lg border border-[#dfe3da] bg-white text-[#384034] hover:bg-[#f6f8f4] font-semibold flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              <span>Unduh</span>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filesData.items.map((file) => {
              const isDir = Boolean(file.isdir);
              const isVid = !isDir && (file.category === '1' || /\.(mp4|mkv|mov|webm)$/i.test(file.server_filename || ''));
              const isImg = !isDir && (file.category === '3' || /\.(jpe?g|png|gif|webp)$/i.test(file.server_filename || ''));
              const downloadUrl = api.getProxyDownloadUrl(file.share_id, file.fs_id);

              return (
                <div key={file.fs_id} className="bg-white p-4 rounded-2xl border border-[#e5e7e1] shadow-sm space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#f0f3e9] flex items-center justify-center shrink-0 mt-0.5">
                      {isDir ? <FolderOpen className="w-4 h-4 text-[#556f4d]" /> : isVid ? <Film className="w-4 h-4 text-emerald-600" /> : isImg ? <ImageIcon className="w-4 h-4 text-amber-600" /> : <FileText className="w-4 h-4 text-slate-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-[#202820] leading-snug line-clamp-2" title={file.server_filename}>
                        {file.server_filename}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-[#848c80]">
                        <span className="font-mono">{isDir ? 'Folder' : formatBytes(file.size)}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px]">ID {String(file.fs_id).slice(-8)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f0f2ec]">
                    {isVid && (
                      <button
                        onClick={() => {
                          setPreviewMediaFile(file);
                          setPreviewType('video');
                        }}
                        className="flex-1 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Putar</span>
                      </button>
                    )}
                    {isImg && (
                      <button
                        onClick={() => {
                          setPreviewMediaFile(file);
                          setPreviewType('image');
                        }}
                        className="flex-1 py-1.5 rounded-xl bg-amber-50 text-amber-800 font-bold text-xs flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Lihat</span>
                      </button>
                    )}
                    {!isDir && (
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-1.5 rounded-xl border border-[#dfe3da] bg-white text-[#384034] font-semibold text-xs text-center flex items-center justify-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Unduh</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-[#788073] bg-white p-3 rounded-2xl border border-[#e5e7e1]">
            <span>Total {filesData.total} Berkas</span>
            <div className="flex items-center gap-2">
              <button
                disabled={filesData.page <= 1}
                onClick={() => {
                  setFilesData(prev => ({ ...prev, page: prev.page - 1 }));
                  setTimeout(loadTabData, 50);
                }}
                className="p-1 rounded-lg border border-[#dfe3da] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-[#202820]">
                Hal {filesData.page} / {Math.ceil(filesData.total / filesData.pageSize) || 1}
              </span>
              <button
                disabled={filesData.page >= Math.ceil(filesData.total / filesData.pageSize)}
                onClick={() => {
                  setFilesData(prev => ({ ...prev, page: prev.page + 1 }));
                  setTimeout(loadTabData, 50);
                }}
                className="p-1 rounded-lg border border-[#dfe3da] disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: THUMBNAILS GALLERY                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'thumbnails' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-white p-4 rounded-2xl border border-[#e5e7e1] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[#878e84] font-medium">Resolusi:</span>
              <select
                value={thumbsType}
                onChange={(e) => {
                  setThumbsType(e.target.value);
                  setTimeout(loadTabData, 50);
                }}
                className="px-3 py-1.5 bg-white border border-[#dfe3da] rounded-xl outline-none"
              >
                <option value="">Semua Ukuran</option>
                <option value="url3">url3 (Besar 850x580)</option>
                <option value="url2">url2 (Sedang 360x270)</option>
                <option value="url1">url1 (Kecil 140x90)</option>
                <option value="icon">icon (60x60)</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#8f9689] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari berdasarkan FS_ID..."
                value={thumbsFsId}
                onChange={(e) => setThumbsFsId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadTabData()}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#dfe3da] rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Grid View */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {thumbsData.items.map((thumb, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-[#e5e7e1] overflow-hidden shadow-sm group hover:border-[#556f4d] transition-all">
                <div className="aspect-[4/3] bg-neutral-100 relative overflow-hidden flex items-center justify-center">
                  <img
                    src={thumb.url}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <a
                      href={thumb.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-white/90 text-[#202820] hover:bg-white"
                      title="Buka langsung"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleCopy(thumb.url, `thumb-${idx}`)}
                      className="p-1.5 rounded-lg bg-white/90 text-[#202820] hover:bg-white"
                      title="Salin URL gambar"
                    >
                      {copiedKey === `thumb-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="p-2.5 text-[10px] space-y-1">
                  <div className="flex items-center justify-between text-[#878e84]">
                    <span className="font-bold text-[#556f4d] uppercase">{thumb.thumbnail_type}</span>
                    <span className="font-mono truncate max-w-[80px]">ID {String(thumb.fs_id).slice(-6)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-[#788073] bg-white p-3 rounded-2xl border border-[#e5e7e1]">
            <span>Total {thumbsData.total} Thumbnail Tersimpan</span>
            <div className="flex items-center gap-2">
              <button
                disabled={thumbsData.page <= 1}
                onClick={() => {
                  setThumbsData(prev => ({ ...prev, page: prev.page - 1 }));
                  setTimeout(loadTabData, 50);
                }}
                className="p-1 rounded-lg border border-[#dfe3da] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-[#202820]">
                Hal {thumbsData.page} / {Math.ceil(thumbsData.total / thumbsData.pageSize) || 1}
              </span>
              <button
                disabled={thumbsData.page >= Math.ceil(thumbsData.total / thumbsData.pageSize)}
                onClick={() => {
                  setThumbsData(prev => ({ ...prev, page: prev.page + 1 }));
                  setTimeout(loadTabData, 50);
                }}
                className="p-1 rounded-lg border border-[#dfe3da] disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: KV & EDGE CACHE INSPECTOR                                          */}
      {/* ========================================================================= */}
      {activeTab === 'kv' && (
        <div className="space-y-6">
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#e5e7e1] shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#202820]">
              <Database className="w-4 h-4 text-[#556f4d]" />
              <span>Inspector Cache KV & D1 Layer</span>
            </div>
            <p className="text-xs text-[#70776b]">
              Masukkan SURL atau URL share untuk memeriksa apakah rekaman saat ini tersimpan di Cloudflare Workers KV atau D1 SQL, serta periksa JSON struktur pohonnya.
            </p>

            <form onSubmit={handleKvLookup} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Masukkan SURL (cth: Y0EF_o076ye2dXF2-KsoWg)..."
                value={lookupSurl}
                onChange={(e) => setLookupSurl(e.target.value)}
                className="flex-1 px-4 py-2.5 text-xs bg-white border border-[#dfe3da] rounded-xl outline-none focus:border-[#556f4d]"
              />
              <button
                type="submit"
                disabled={loading || !lookupSurl.trim()}
                className="px-5 py-2.5 text-xs font-bold bg-[#202820] text-white rounded-xl hover:bg-[#344132] disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Cari di Cache</span>
              </button>
            </form>

            {lookupResult && (
              <div className="space-y-3 pt-3 border-t border-[#f0f2ec]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[#202820]">Sumber Cache:</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                      lookupResult.source === 'kv' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                    }`}>
                      {lookupResult.source === 'kv' ? 'Workers KV Edge' : 'D1 SQL Database'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(JSON.stringify(lookupResult.data, null, 2), 'kv-json')}
                      className="px-3 py-1 text-xs font-semibold rounded-lg border border-[#dfe3da] bg-white text-[#3d443a] hover:bg-[#fafbf9] flex items-center gap-1"
                    >
                      {copiedKey === 'kv-json' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>Salin JSON</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePurgeKv(lookupResult.surl)}
                      className="px-3 py-1 text-xs font-bold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-1"
                      title="Hapus cache KV untuk SURL ini"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Purge KV</span>
                    </button>
                  </div>
                </div>

                <div className="bg-[#1e231d] text-[#e0e8dc] p-4 rounded-xl overflow-x-auto text-xs font-mono max-h-96 leading-relaxed">
                  <pre>{JSON.stringify(lookupResult.data, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: DIAGNOSTIK & SISTEM                                                */}
      {/* ========================================================================= */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#e5e7e1] shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#202820]">
                <Server className="w-4 h-4 text-[#556f4d]" />
                <span>Cloudflare D1 Database</span>
              </div>
              <div className="text-xl font-black text-[#202820]">
                {overview?.d1?.configured !== false ? 'Terkoneksi' : 'Belum Konfigurasi'}
              </div>
              <p className="text-[11px] text-[#788073]">
                Binding: <code className="font-mono bg-[#f4f5f1] px-1 py-0.5 rounded">env.sharedfile</code>
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#e5e7e1] shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#202820]">
                <Cpu className="w-4 h-4 text-[#556f4d]" />
                <span>Workers KV Namespace</span>
              </div>
              <div className="text-xl font-black text-[#202820]">
                {overview?.kv?.active ? 'Aktif' : 'Tersedia'}
              </div>
              <p className="text-[11px] text-[#788073]">
                Binding: <code className="font-mono bg-[#f4f5f1] px-1 py-0.5 rounded">env.SHARE_KV</code>
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#e5e7e1] shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#202820]">
                <Activity className="w-4 h-4 text-[#556f4d]" />
                <span>Probe Latensi Edge</span>
              </div>
              <div className="text-xl font-black text-[#202820]">
                {diagResults['Health Probe (/health)']?.latency || '~ sub-25ms'}
              </div>
              <p className="text-[11px] text-[#788073]">
                Global Edge CDN Network
              </p>
            </div>
          </div>

          {/* Test Runner */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#e5e7e1] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-[#202820]">
                <Activity className="w-4 h-4 text-[#556f4d]" />
                <span>Hasil Pengujian Endpoint Gateway</span>
              </div>
              <button
                onClick={runDiagnostics}
                disabled={isDiagTesting}
                className="px-3.5 py-1.5 text-xs font-bold bg-[#202820] text-white rounded-xl hover:bg-[#344132] disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDiagTesting ? 'animate-spin' : ''}`} />
                <span>Uji Ulang</span>
              </button>
            </div>

            <div className="divide-y divide-[#f0f2ec]">
              {Object.entries(diagResults).map(([testName, res]) => (
                <div key={testName} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="font-semibold text-[#202820]">{testName}</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[#788073]">{res.latency}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      res.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                    }`}>
                      {res.status} {res.ok ? 'OK' : 'Error'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SHARE DETAIL DRAWER / MODAL                                      */}
      {/* ========================================================================= */}
      {selectedShareId && shareDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#e5e7e1] max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#e5e7e1] flex items-center justify-between bg-[#fafbf9]">
              <div className="min-w-0 flex-1 pr-2">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#f0f3e9] text-[#4a6342] font-bold">
                  {selectedShareId}
                </span>
                <h3 className="text-sm font-bold text-[#202820] truncate mt-1">
                  {shareDetail.share?.title || 'Detail Berkas Share'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedShareId(null);
                  setShareDetail(null);
                }}
                className="p-1 rounded-xl text-[#7a8174] hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-[#fafbf9] p-3 rounded-2xl border border-[#e5e7e1]">
                <div>
                  <span className="text-[#848c80] block text-[10px]">Owner UK:</span>
                  <span className="font-mono font-semibold">{shareDetail.share?.uk || '—'}</span>
                </div>
                <div>
                  <span className="text-[#848c80] block text-[10px]">Total Berkas:</span>
                  <span className="font-semibold">{shareDetail.totalFiles} Item</span>
                </div>
                <div>
                  <span className="text-[#848c80] block text-[10px]">Terakhir Sinkron:</span>
                  <span>{formatDate(shareDetail.share?.updated_at, true)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-[#202820]">
                  Daftar Berkas Terkait ({shareDetail.files?.length || 0})
                </div>
                <div className="divide-y divide-[#f0f2ec] border border-[#e5e7e1] rounded-2xl overflow-hidden">
                  {(shareDetail.files || []).map((f) => (
                    <div key={f.fs_id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-[#fafbf9]">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[#202820] truncate" title={f.server_filename}>
                          {f.server_filename}
                        </div>
                        <div className="text-[10px] text-[#848c80] flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{formatBytes(f.size)}</span>
                          <span>•</span>
                          <span className="truncate max-w-[200px]">{f.path}</span>
                        </div>
                      </div>
                      <a
                        href={api.getProxyDownloadUrl(selectedShareId, f.fs_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#f0f3e9] text-[#4a6342] hover:bg-[#e4ebd9] shrink-0"
                      >
                        Unduh
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#e5e7e1] bg-[#fafbf9] flex items-center justify-between">
              <button
                onClick={() => onOpenInDownloader && onOpenInDownloader(selectedShareId)}
                className="px-4 py-2 text-xs font-bold bg-[#202820] text-white rounded-xl hover:bg-[#344132] flex items-center gap-1.5"
              >
                <span>Buka di Web Downloader</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#d8f36a]" />
              </button>
              <button
                onClick={() => {
                  setSelectedShareId(null);
                  setShareDetail(null);
                }}
                className="px-4 py-2 text-xs font-semibold border border-[#dfe3da] bg-white rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INGEST NEW SHARE MODAL                                           */}
      {/* ========================================================================= */}
      {isIngestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#e5e7e1] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#f0f3e9] flex items-center justify-center text-[#556f4d]">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#202820]">Ingest Link TeraBox Baru</h3>
              </div>
              <button onClick={() => setIsIngestModalOpen(false)} className="text-[#82887d] hover:text-[#202820]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#70776b] leading-relaxed">
              Worker akan melakukan scraping jsToken, mengambil data upstream, dan menyimpannya secara otomatis ke database Cloudflare D1.
            </p>

            <form onSubmit={handleIngestShare} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#353f31] block mb-1">
                  Link TeraBox atau SURL:
                </label>
                <input
                  type="text"
                  placeholder="https://terabox.app/s/1xxxxxx atau surl ID"
                  value={ingestInput}
                  onChange={(e) => setIngestInput(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#dfe3da] outline-none focus:border-[#556f4d]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#353f31] block mb-1">
                  Subdirektori Spesifik (Opsional):
                </label>
                <input
                  type="text"
                  placeholder="Cth: /otherside free/PICT (kosongkan untuk root)"
                  value={ingestDir}
                  onChange={(e) => setIngestDir(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#dfe3da] outline-none focus:border-[#556f4d]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsIngestModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#dfe3da]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isIngesting || !ingestInput.trim()}
                  className="px-4 py-2 text-xs font-bold bg-[#202820] text-white rounded-xl hover:bg-[#344132] disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isIngesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isIngesting ? 'Menyinkronkan...' : 'Mulai Ingest'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MEDIA PREVIEW MODAL (VIDEO / IMAGE)                              */}
      {/* ========================================================================= */}
      {previewMediaFile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#e5e7e1] max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#e5e7e1] flex items-center justify-between bg-[#fafbf9]">
              <div className="min-w-0 flex-1 pr-2">
                <span className="text-[10px] font-bold text-[#556f4d] uppercase block">
                  {previewType === 'video' ? '🎬 Streaming Preview' : '🖼️ Gambar Preview'}
                </span>
                <h4 className="text-xs font-bold text-[#202820] truncate">
                  {previewMediaFile.server_filename}
                </h4>
              </div>
              <button
                onClick={() => setPreviewMediaFile(null)}
                className="p-1 rounded-xl text-[#788073] hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-black/5">
              {previewType === 'video' ? (
                <div className="w-full">
                  <VideoPlayer
                    surl={previewMediaFile.share_id}
                    fid={String(previewMediaFile.fs_id).replace(/\.0+$/, '')}
                    dir={previewMediaFile.path ? previewMediaFile.path.slice(0, previewMediaFile.path.lastIndexOf('/')) : ''}
                    title={previewMediaFile.server_filename}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center p-2">
                  <img
                    src={api.getThumbnailUrl(previewMediaFile.fs_id, 'url3', previewMediaFile.share_id)}
                    alt=""
                    className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-md"
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#e5e7e1] bg-[#fafbf9] flex items-center justify-between">
              <span className="text-xs font-mono text-[#788073]">
                {formatBytes(previewMediaFile.size)}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={api.getProxyDownloadUrl(previewMediaFile.share_id, previewMediaFile.fs_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 text-xs font-bold bg-[#202820] text-white rounded-xl hover:bg-[#344132] flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh File</span>
                </a>
                <button
                  onClick={() => setPreviewMediaFile(null)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-[#dfe3da] bg-white"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION MODAL                                        */}
      {/* ========================================================================= */}
      {deleteConfirmShare && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#e5e7e1] max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#202820]">Konfirmasi Hapus Share</h3>
                <p className="text-xs text-[#788073]">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <div className="bg-[#fafbf9] p-3 rounded-2xl border border-[#e5e7e1] text-xs space-y-1">
              <span className="font-mono text-[10px] font-bold text-[#556f4d]">{deleteConfirmShare.share_id}</span>
              <p className="font-semibold text-[#202820] truncate">{deleteConfirmShare.title || 'Tanpa Judul'}</p>
            </div>

            <p className="text-xs text-[#788073] leading-relaxed">
              Menghapus share ini akan menghapus rekaman di tabel <b>shares</b>, seluruh berkas di <b>media_files</b>, data <b>thumbnails</b>, serta membersihkan cache di <b>Workers KV</b>.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmShare(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#dfe3da]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteShare}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
