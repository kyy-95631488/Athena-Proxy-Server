import React, { useState, useEffect } from 'react';
import { ArrowRight, Clipboard, RefreshCw, AlertCircle, Sparkles, FolderTree } from 'lucide-react';
import { api } from '../services/api';
import { FileCard } from '../components/FileCard';
import { FolderView } from '../components/FolderView';
import { VideoPlayer } from '../components/VideoPlayer';
import { ImageViewerModal } from '../components/ImageViewerModal';

export function DownloaderPage({ initialUrl = '' }) {
  const [urlInput, setUrlInput] = useState(initialUrl || '');
  const [surl, setSurl] = useState('');
  const [currentDir, setCurrentDir] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [resolvedData, setResolvedData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeVideoFile, setActiveVideoFile] = useState(null);
  const [activeImageFile, setActiveImageFile] = useState(null);

  // Check URL query param or initialUrl on mount
  useEffect(() => {
    if (initialUrl) {
      setUrlInput(initialUrl);
      handleResolve(initialUrl, '');
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const qSurl = params.get('surl');
    if (qSurl) {
      setUrlInput(qSurl);
      handleResolve(qSurl, '');
    }
  }, [initialUrl]);

  const handleResolve = async (inputToResolve = urlInput, targetDir = currentDir, forceRefresh = false) => {
    const extracted = api.extractSurl(inputToResolve);
    if (!extracted) {
      setError('Masukkan link atau SURL TeraBox yang valid.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSurl(extracted);

    try {
      const data = await api.resolveShare(extracted, targetDir, '', forceRefresh);

      // If root response is a single folder share (TeraBox returns items: [ { isdir: true, path: "/..." } ]),
      // automatically browse into that folder just like original Athena downloader!
      const items = data.items || [];
      if (!targetDir && data.data?.isdir && items.length <= 1 && (items[0]?.path || data.data?.path)) {
        const folderPath = items[0]?.path || data.data?.path;
        setCurrentDir(folderPath);
        const subData = await api.resolveShare(extracted, folderPath, '', forceRefresh);
        setResolvedData(subData);
        setSelectedFile(null);
        return;
      }

      setResolvedData(data);
      const isDir = Boolean(data.data?.isdir) || Boolean(targetDir);
      if (!isDir && items.length <= 1 && data.data) {
        setSelectedFile(data.data);
      } else {
        setSelectedFile(null);
      }
    } catch (err) {
      setError(err?.message || 'Terjadi kesalahan saat menghubungi server.');
      setResolvedData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text);
        setCurrentDir('');
        handleResolve(text, '');
      }
    } catch (e) {
      // Clipboard permission denied
    }
  };

  const handleSelectDir = (newDir) => {
    if (isLoading) return; // Prevent concurrent requests when folder is processing
    setCurrentDir(newDir);
    handleResolve(surl, newDir);
  };

  const handlePlayVideo = (file) => {
    setActiveVideoFile(file);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handleViewImage = (file) => {
    setActiveImageFile(file);
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-12 space-y-6 sm:space-y-8">
      {/* Hero Section */}
      <div className="text-center max-w-2xl mx-auto space-y-2.5 sm:space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e9ede7] border border-[#d4ded1] text-xs font-semibold text-[#556f4d]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Serverless TeraBox Edge Gateway</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-[#202820]">
          Putar & Unduh File TeraBox
        </h1>
        <p className="text-xs sm:text-sm text-[#7d8379] leading-relaxed max-w-lg mx-auto">
          Streaming adaptif HLS sub-25ms dan unduhan direct resumable tanpa batasan aplikasi resmi.
        </p>
      </div>

      {/* Input Card */}
      <div className="bg-white rounded-2xl border border-[#e5e7e1] p-3.5 sm:p-5 shadow-sm space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCurrentDir('');
            handleResolve(urlInput, '');
          }}
          className="flex flex-col sm:flex-row gap-2 sm:gap-2.5"
        >
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Tempel link TeraBox (contoh: https://terabox.app/s/...)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full h-11 sm:h-12 px-3.5 sm:px-4 text-xs sm:text-sm rounded-xl border border-[#dfe3da] bg-[#fbfcf9] outline-none focus:border-[#556f4d] focus:bg-white focus:ring-2 focus:ring-[#556f4d]/10 transition-all text-[#202820]"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePaste}
              className="h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border border-[#dfe3da] bg-white hover:bg-[#fbfcf9] text-xs font-semibold text-[#444c40] flex items-center justify-center gap-1.5 transition-colors shrink-0"
              title="Tempel dari Clipboard"
            >
              <Clipboard className="w-4 h-4 text-[#627650]" />
              <span className="hidden sm:inline">Paste</span>
            </button>

            <button
              type="submit"
              disabled={isLoading || !urlInput.trim()}
              className="flex-1 sm:flex-initial h-11 sm:h-12 px-5 sm:px-6 rounded-xl bg-[#202820] hover:bg-[#344132] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shrink-0 shadow-sm"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#d8f36a]" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>Ambil File</span>
                  <ArrowRight className="w-4 h-4 text-[#d8f36a]" />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="text-[11px] text-[#8d9489] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-0.5 pt-1 border-t border-[#f2f4ee] sm:border-t-0">
          <span className="leading-snug">
            Mendukung domain: terabox.app, 1024tera.com, freeterabox.com
          </span>
          {resolvedData?.source && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md font-semibold">
                Source: {resolvedData.source}
              </span>
              <button
                type="button"
                onClick={() => handleResolve(urlInput, currentDir, true)}
                disabled={isLoading}
                className="text-[10px] font-semibold text-[#556f4d] hover:text-[#202820] flex items-center gap-1 hover:underline disabled:opacity-50 transition-colors"
                title="Sinkronisasi ulang langsung dari TeraBox ke Database D1"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Sync DB</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-bold text-red-950">Gagal Mengambil Data</div>
            <div className="text-red-800">{error}</div>
          </div>
        </div>
      )}

      {/* Video Streaming Section */}
      {activeVideoFile && surl && (
        <div className="space-y-2">
          <VideoPlayer
            surl={surl}
            fid={String(activeVideoFile.fs_id || activeVideoFile.fid || '').replace(/\.0+$/, '')}
            dir={currentDir}
            title={activeVideoFile.server_filename || activeVideoFile.name}
          />
        </div>
      )}

      {/* Selected File Details (Only for single-file shares) */}
      {selectedFile && (!resolvedData?.items || resolvedData.items.length <= 1) && !currentDir && surl && (
        <div className="space-y-4">
          <FileCard
            file={selectedFile}
            surl={surl}
            onPlayVideo={handlePlayVideo}
            onViewImage={handleViewImage}
          />
        </div>
      )}

      {/* Directory Contents / Folder Tree */}
      {resolvedData?.items && resolvedData.items.length > 0 && surl && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#202820]">
            <FolderTree className="w-4 h-4 text-[#556f4d]" />
            <span>Daftar Berkas & Folder ({resolvedData.items.length})</span>
          </div>

          <FolderView
            items={resolvedData.items}
            currentDir={currentDir}
            isLoading={isLoading}
            onSelectDir={handleSelectDir}
            onSelectFile={(f) => {
              setSelectedFile(f);
              const name = f.server_filename || f.name || '';
              if (/\.(jpe?g|png|gif|webp|bmp|svg|ico|heic|tiff?)$/i.test(name)) {
                handleViewImage(f);
              } else if (/\.(mp4|mkv|mov|avi|webm)$/i.test(name)) {
                handlePlayVideo(f);
              }
            }}
            onPlayVideo={handlePlayVideo}
            onViewImage={handleViewImage}
            surl={surl}
          />
        </div>
      )}

      {/* High-Definition Image Viewer Modal */}
      {activeImageFile && surl && (
        <ImageViewerModal
          file={activeImageFile}
          surl={surl}
          onClose={() => setActiveImageFile(null)}
        />
      )}
    </div>
  );
}
