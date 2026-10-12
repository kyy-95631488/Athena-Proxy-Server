import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink, Image as ImageIcon, Loader2 } from 'lucide-react';
import { formatBytes } from './FileCard';
import { api } from '../services/api';

export function ImageViewerModal({ file, surl, onClose }) {
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!file) return null;

  const fid = file.fs_id || file.fid;
  const filename = file.server_filename || file.name || 'Foto';
  const downloadUrl = api.getProxyDownloadUrl(surl, fid);
  // High-definition thumbnail URL via backend proxy (uses url3)
  const hdThumbUrl = api.getThumbnailUrl(fid, 'url3', surl, file.path ? file.path.slice(0, file.path.lastIndexOf('/')) : '');
  // For viewing, prefer the HD thumbnail or full download link
  const displayUrl = file.thumb || hdThumbUrl || downloadUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[92vh] flex flex-col bg-[#1c1f1a] border border-[#2e342b] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e342b] bg-[#141712]/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/40 text-emerald-400 flex items-center justify-center shrink-0">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white truncate" title={filename}>
                {filename}
              </div>
              <div className="text-[10px] text-[#8d9489] flex items-center gap-2">
                <span>{formatBytes(file.size)}</span>
                <span className="text-emerald-400 font-semibold">• Resolusi HD</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#d8f36a] hover:bg-[#c8e555] text-[#202820] text-xs font-bold rounded-xl transition-all shadow-sm"
              title="Unduh foto"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Unduh</span>
            </a>

            <a
              href={displayUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-xl text-[#a3aca0] hover:text-white hover:bg-[#282f25] transition-colors"
              title="Buka ukuran penuh di tab baru"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#a3aca0] hover:text-white hover:bg-[#282f25] transition-colors"
              title="Tutup (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Display Area */}
        <div className="relative flex-1 min-h-[300px] max-h-[78vh] flex items-center justify-center p-3 sm:p-5 overflow-auto bg-[#0f110e]">
          {loading && !imgError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#8d9489]">
              <Loader2 className="w-6 h-6 animate-spin text-[#d8f36a]" />
              <span className="text-xs">Memuat foto HD...</span>
            </div>
          )}

          {imgError ? (
            <div className="text-center p-8 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-red-950/40 text-red-400 mx-auto flex items-center justify-center border border-red-900/30">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="text-xs text-[#a3aca0]">
                Gagal memuat pratinjau foto secara langsung.
              </div>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#d8f36a] text-[#202820] text-xs font-bold rounded-xl"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File Asli</span>
              </a>
            </div>
          ) : (
            <img
              src={displayUrl}
              alt={filename}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setImgError(true);
              }}
              className={`max-w-full max-h-[72vh] object-contain rounded-lg transition-opacity duration-200 select-none shadow-lg ${
                loading ? 'opacity-0' : 'opacity-100'
              }`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
