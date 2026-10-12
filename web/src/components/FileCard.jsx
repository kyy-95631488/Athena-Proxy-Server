import React, { useState } from 'react';
import { Download, Play, Copy, Check, FileText, Film, Folder, HardDrive, Calendar, Eye, Image as ImageIcon } from 'lucide-react';
import { api } from '../services/api';

export function formatBytes(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return new Intl.NumberFormat('id-ID').format(size) + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let s = size;
  let index = -1;
  do {
    s = s / 1024;
    index++;
  } while (s >= 1024 && index < units.length - 1);
  return s.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' ' + units[index];
}

export function formatDate(val, includeTime = false) {
  if (!val) return '-';
  let date;

  if (typeof val === 'number') {
    date = new Date(val < 1e11 ? val * 1000 : val);
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '-';
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      date = new Date(num < 1e11 ? num * 1000 : num);
    } else {
      // Normalize SQLite "YYYY-MM-DD HH:MM:SS" to "YYYY-MM-DDTHH:MM:SSZ"
      const normalized = trimmed.includes(' ') && !trimmed.includes('T')
        ? trimmed.replace(' ', 'T') + 'Z'
        : trimmed;
      date = new Date(normalized);
      if (isNaN(date.getTime())) {
        date = new Date(trimmed);
      }
    }
  } else if (val instanceof Date) {
    date = val;
  } else {
    date = new Date(val);
  }

  if (!date || isNaN(date.getTime())) {
    return '-';
  }

  const options = {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }

  return date.toLocaleDateString('id-ID', options);
}

export function FileCard({ file, surl, onPlayVideo, onViewImage }) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!file) return null;

  const fid = file.fs_id || file.fid;
  const isDir = Boolean(file.isdir);
  const filename = file.server_filename || file.name || 'Berkas tanpa nama';
  const isVideo = /\.(mp4|mkv|mov|avi|webm|flv|m4v|ts)$/i.test(filename);
  const isImage = /\.(jpe?g|png|gif|webp|bmp|svg|ico|heic|tiff?)$/i.test(filename);
  const downloadUrl = api.getProxyDownloadUrl(surl, fid);
  const thumbUrl = !imgError && fid ? api.getThumbnailUrl(fid, 'url3', surl, file.path ? file.path.slice(0, file.path.lastIndexOf('/')) : '') : null;

  const copyDownloadUrl = () => {
    navigator.clipboard.writeText(downloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImageClick = () => {
    if (onViewImage) {
      onViewImage(file);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7e1] p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Thumbnail Preview */}
        <div className="w-full sm:w-28 h-28 rounded-xl bg-[#f0f3e9] flex items-center justify-center overflow-hidden shrink-0 border border-[#e2e7dc] relative group/thumb">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={filename}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
              loading="lazy"
            />
          ) : isDir ? (
            <Folder className="w-10 h-10 text-amber-500" />
          ) : isVideo ? (
            <Film className="w-10 h-10 text-[#556f4d]" />
          ) : isImage ? (
            <ImageIcon className="w-10 h-10 text-emerald-600" />
          ) : (
            <FileText className="w-10 h-10 text-[#7d8379]" />
          )}

          {isVideo && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity cursor-pointer" onClick={() => onPlayVideo(file)} title="Putar video">
              <div className="w-10 h-10 rounded-full bg-[#d8f36a] text-[#202820] flex items-center justify-center shadow-lg">
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </div>
            </div>
          )}

          {isImage && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity cursor-pointer" onClick={handleImageClick} title="Klik untuk lihat foto HD">
              <div className="w-10 h-10 rounded-full bg-[#d8f36a] text-[#202820] flex items-center justify-center shadow-lg">
                <Eye className="w-5 h-5" />
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              isDir ? 'bg-amber-100 text-amber-800' : isVideo ? 'bg-emerald-100 text-emerald-800' : isImage ? 'bg-blue-100 text-blue-800' : 'bg-neutral-100 text-neutral-800'
            }`}>
              {isDir ? 'Folder' : isVideo ? 'Video' : isImage ? 'Foto HD' : 'Berkas'}
            </span>
            {file.fid && (
              <span className="text-[10px] font-mono text-[#8d9489]">
                ID: {String(file.fid || file.fs_id).replace(/\.0+$/, '')}
              </span>
            )}
          </div>

          <h2 className="text-base font-bold text-[#202820] truncate mb-2" title={filename}>
            {filename}
          </h2>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#7d8379]">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" />
              <span>{formatBytes(file.size)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(file.time || file.server_mtime)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {!isDir && (
          <div className="flex flex-wrap sm:flex-col gap-2 w-full sm:w-auto shrink-0">
            {isVideo && (
              <button
                onClick={() => onPlayVideo(file)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#d8f36a] hover:bg-[#c8e555] text-[#202820] font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Putar Video</span>
              </button>
            )}

            {isImage && (
              <button
                onClick={handleImageClick}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#d8f36a] hover:bg-[#c8e555] text-[#202820] font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all"
              >
                <Eye className="w-4 h-4" />
                <span>Lihat Foto (HD)</span>
              </button>
            )}

            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#202820] hover:bg-[#344132] text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Berkas</span>
            </a>

            <button
              onClick={copyDownloadUrl}
              className="flex items-center justify-center gap-2 bg-[#f4f5f1] hover:bg-[#e9ede7] text-[#444c40] font-medium text-xs px-3 py-2 rounded-xl border border-[#dfe3da] transition-colors"
              title="Salin tautan unduhan langsung"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin' : 'Salin Link'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
