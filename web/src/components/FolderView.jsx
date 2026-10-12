import React, { useState } from 'react';
import { Folder, Film, FileText, ChevronRight, Download, Search, ArrowLeft, Image as ImageIcon, Loader2 } from 'lucide-react';
import { formatBytes } from './FileCard';
import { api } from '../services/api';

export function FolderView({
  items = [],
  currentDir = '',
  isLoading = false,
  onSelectDir,
  onSelectFile,
  onPlayVideo,
  onViewImage,
  surl
}) {
  const [searchQuery, setSearchQuery] = useState('');

  // Breadcrumbs calculation
  const pathParts = currentDir ? currentDir.split('/').filter(Boolean) : [];

  const handleBreadcrumbClick = (index) => {
    if (isLoading) return;
    if (index === -1) {
      onSelectDir('');
      return;
    }
    const newPath = '/' + pathParts.slice(0, index + 1).join('/');
    onSelectDir(newPath);
  };

  const handleParentClick = () => {
    if (isLoading) return;
    if (pathParts.length <= 1) {
      onSelectDir('');
    } else {
      const parent = '/' + pathParts.slice(0, pathParts.length - 1).join('/');
      onSelectDir(parent);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const name = item.name || item.server_filename || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7e1] overflow-hidden shadow-sm">
      {/* Folder Header & Breadcrumbs */}
      <div className="p-3 sm:p-4 border-b border-[#e5e7e1] bg-[#fafbf9] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap max-w-full pb-1 sm:pb-0 text-xs text-[#556f4d] no-scrollbar touch-scroll">
          <button
            onClick={() => handleBreadcrumbClick(-1)}
            disabled={isLoading}
            className={`font-bold text-[#556f4d] shrink-0 flex items-center gap-1 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:underline'
            }`}
          >
            <span>Root</span>
          </button>

          {pathParts.map((part, index) => (
            <React.Fragment key={index}>
              <ChevronRight className="w-3.5 h-3.5 text-[#a1a89c] shrink-0" />
              <button
                onClick={() => handleBreadcrumbClick(index)}
                disabled={isLoading}
                className={`font-medium max-w-[130px] sm:max-w-[220px] md:max-w-none truncate shrink-0 ${
                  index === pathParts.length - 1
                    ? 'text-[#202820] font-bold cursor-default'
                    : isLoading
                    ? 'text-[#556f4d] opacity-50 cursor-not-allowed'
                    : 'text-[#556f4d] hover:underline'
                }`}
                title={part}
              >
                {part}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-60 shrink-0">
          <Search className="w-3.5 h-3.5 text-[#8f9689] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari dalam folder..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#dfe3da] rounded-xl outline-none focus:border-[#6d8a65] transition-all"
          />
        </div>
      </div>

      {/* Loading banner when folder is being fetched */}
      {isLoading && (
        <div className="px-3 sm:px-4 py-2.5 bg-amber-50/90 border-b border-amber-200/80 text-amber-900 text-xs font-semibold flex items-center gap-2 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
          <span>Memproses direktori folder... Klik dinonaktifkan sementara untuk mencegah error I/O.</span>
        </div>
      )}

      {/* Item List */}
      <div className="divide-y divide-[#f0f2ec]">
        {/* Parent Directory Link */}
        {currentDir && (
          <button
            onClick={handleParentClick}
            disabled={isLoading}
            className={`w-full px-3 sm:px-4 py-2.5 text-left flex items-center gap-2.5 text-xs font-semibold text-[#556f4d] transition-colors ${
              isLoading ? 'opacity-50 cursor-not-allowed bg-[#fbfcf9]' : 'hover:bg-[#f6f8f4]'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke direktori sebelumnya</span>
          </button>
        )}

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#8d9489]">
            Tidak ada berkas atau folder dalam direktori ini.
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const isDir = Boolean(item.isdir);
            const fid = item.fs_id || item.fid;
            const cleanFid = fid ? String(fid).replace(/\.0+$/, '').trim() : '';
            const filename = item.server_filename || item.name || (isDir ? 'Folder tanpa nama' : 'Berkas');
            const isVideo = !isDir && /\.(mp4|mkv|mov|avi|webm|flv|m4v|ts)$/i.test(filename);
            const isImage = !isDir && /\.(jpe?g|png|gif|webp|bmp|svg|ico|heic|tiff?)$/i.test(filename);
            const downloadUrl = api.getProxyDownloadUrl(surl, cleanFid);
            const parentDir = item.path ? item.path.slice(0, item.path.lastIndexOf('/')) : '';
            const thumbUrl = item.thumb || (!isDir && cleanFid ? api.getThumbnailUrl(cleanFid, 'url3', surl, parentDir) : null);
            const meta = isDir ? 'Folder' : (cleanFid ? `ID ${cleanFid.slice(-8)}` : '');
            const sizeDisplay = isDir ? '—' : (item.size != null ? formatBytes(item.size) : '—');
            const targetPath = (item.path && item.path !== currentDir) ? item.path : (currentDir ? `${currentDir}/${filename}` : `/${filename}`);

            return (
              <div
                key={cleanFid || idx}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2.5 sm:gap-4 transition-colors group ${
                  isDir && isLoading ? 'opacity-50 cursor-not-allowed bg-[#fafbf9]' : 'hover:bg-[#fbfcf9]'
                }`}
              >
                {/* Left: Thumbnail & Info */}
                <div
                  className={`flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 ${
                    isDir && isLoading ? 'cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  onClick={() => {
                    if (isDir) {
                      if (isLoading) return;
                      onSelectDir(targetPath);
                    } else if (isVideo) {
                      if (onPlayVideo) onPlayVideo(item);
                    } else if (isImage) {
                      if (onViewImage) onViewImage(item);
                    } else if (onSelectFile) {
                      onSelectFile(item);
                    }
                  }}
                >
                  {/* Icon or Thumbnail */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                    {isDir ? (
                      <div className="w-8 h-8 rounded-lg bg-[#f0f3e9] text-[#627650] border border-[#dce4d6] flex items-center justify-center">
                        <Folder className="w-4 h-4 stroke-[2]" />
                      </div>
                    ) : thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt=""
                        className="w-8 h-8 rounded-md object-cover border border-[#e5e7e1]"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : isVideo ? (
                      <div className="w-8 h-8 rounded-md bg-[#f0f3e9] text-[#627650] border border-[#dce4d6] flex items-center justify-center">
                        <Film className="w-4 h-4" />
                      </div>
                    ) : isImage ? (
                      <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Title & Subtitle */}
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-xs font-semibold text-[#343b32] group-hover:text-[#556f4d] truncate"
                      title={filename}
                    >
                      {filename}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#959b92] mt-0.5">
                      {meta && <span>{meta}</span>}
                      {!isDir && item.size != null && (
                        <span className="sm:hidden font-mono text-[#778074]">
                          • {formatBytes(item.size)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Size & Action buttons */}
                <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
                  <span className="hidden sm:inline text-xs text-[#878e84] text-right font-normal min-w-[65px]">
                    {sizeDisplay}
                  </span>

                  <div className="flex items-center gap-1 sm:gap-2">
                    {isDir ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isLoading) return;
                          onSelectDir(targetPath);
                        }}
                        disabled={isLoading}
                        className={`px-2.5 sm:px-3.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg border border-[#dfe3da] bg-[#f1f5eb] text-[#59734e] hover:bg-[#e6ecd9] transition-colors ${
                          isLoading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        Buka
                      </button>
                    ) : (
                      <>
                        {isVideo && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onPlayVideo) onPlayVideo(item);
                            }}
                            className="px-2.5 sm:px-3.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg border border-[#dfe3da] bg-white text-[#3d443a] hover:bg-[#fbfcf9] transition-colors"
                          >
                            Putar
                          </button>
                        )}

                        {isImage && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onViewImage) onViewImage(item);
                            }}
                            className="px-2.5 sm:px-3.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg border border-[#dfe3da] bg-white text-[#3d443a] hover:bg-[#fbfcf9] transition-colors"
                          >
                            Lihat
                          </button>
                        )}

                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-lg border border-[#d7e5c7] bg-[#f3f7ee] text-[#3e6039] hover:bg-[#edf4e7] flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 stroke-[2.2] shrink-0" />
                          <span>Unduh</span>
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
