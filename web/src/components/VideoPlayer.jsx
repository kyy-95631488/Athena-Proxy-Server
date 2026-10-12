import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Copy, Check, Tv, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

const STREAM_QUALITIES = [
  { id: 'M3U8_AUTO_360', label: '360p Auto' },
  { id: 'M3U8_FLV_264_360', label: '360p FLV' },
  { id: 'M3U8_AUTO_480', label: '480p Auto' },
  { id: 'M3U8_FLV_264_480', label: '480p FLV' },
  { id: 'M3U8_AUTO_720', label: '720p HD' },
  { id: 'M3U8_AUTO_1080', label: '1080p FHD' }
];

export function VideoPlayer({ surl, fid, dir, title }) {
  const videoRef = useRef(null);
  const [selectedQuality, setSelectedQuality] = useState('M3U8_AUTO_360');
  const [isCopied, setIsCopied] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const streamUrl = api.getProxyStreamUrl(surl, fid, dir, selectedQuality);

  useEffect(() => {
    let hlsInstance = null;
    const video = videoRef.current;
    if (!video) return;

    setPlayerError(null);
    setIsLoading(true);

    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });

      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        video.play().catch(() => {
          // Autoplay blocked by browser policy; user can click play
        });
      });

      hlsInstance.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setPlayerError('Koneksi stream terputus. Mencoba menghubungkan kembali...');
              hlsInstance.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setPlayerError('Format media memerlukan pemulihan.');
              hlsInstance.recoverMediaError();
              break;
            default:
              setPlayerError('Stream HLS tidak dapat dimuat atau upstream TeraBox membatasi stream.');
              hlsInstance.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari HLS
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        video.play().catch(() => {});
      });
      video.addEventListener('error', () => {
        setPlayerError('Gagal memutar video HLS secara native.');
      });
    } else {
      setPlayerError('Browser Anda tidak mendukung pemutaran HLS (M3U8).');
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [streamUrl]);

  const copyStreamUrl = () => {
    navigator.clipboard.writeText(streamUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="bg-[#181d17] text-white rounded-2xl overflow-hidden border border-[#2b3329] shadow-xl">
      {/* Top Header */}
      <div className="px-4 py-3 bg-[#20271f] flex flex-wrap items-center justify-between gap-3 border-b border-[#2e372b]">
        <div className="flex items-center gap-2 min-w-0">
          <Tv className="w-4 h-4 text-[#d8f36a] shrink-0" />
          <span className="text-xs font-semibold truncate max-w-sm" title={title}>
            {title || 'HLS Video Player'}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Quality selector */}
          <select
            value={selectedQuality}
            onChange={(e) => setSelectedQuality(e.target.value)}
            className="bg-[#161a15] text-[#d6ded2] text-[11px] font-medium border border-[#374134] rounded-lg px-2.5 py-1 outline-none hover:border-[#4d5b49] transition-colors"
          >
            {STREAM_QUALITIES.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>

          {/* Copy M3U8 link for VLC */}
          <button
            onClick={copyStreamUrl}
            className="flex items-center gap-1.5 bg-[#2a3428] hover:bg-[#344132] text-[#d8f36a] text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-[#3b4939] transition-colors"
            title="Salin URL M3U8 untuk VLC / MPV Player"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Tersalin' : 'Copy M3U8'}</span>
          </button>
        </div>
      </div>

      {/* Video Canvas */}
      <div className="relative aspect-video bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          controls
          playsInline
          className="w-full h-full max-h-[580px] outline-none"
        />

        {/* Loading Spinner */}
        {isLoading && !playerError && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-white">
            <RefreshCw className="w-8 h-8 animate-spin text-[#d8f36a]" />
            <span className="text-xs font-medium text-neutral-300">Menghubungkan HLS Edge Stream...</span>
          </div>
        )}

        {/* Error Notification */}
        {playerError && (
          <div className="absolute inset-x-4 bottom-16 bg-red-950/90 border border-red-800 text-red-200 px-4 py-3 rounded-xl flex items-center gap-3 backdrop-blur-md shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="text-xs">{playerError}</div>
          </div>
        )}
      </div>
    </div>
  );
}
