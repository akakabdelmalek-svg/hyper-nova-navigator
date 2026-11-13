import React from 'react';
import { X, Music, MessageSquare } from 'lucide-react';
import { TelemetryPoint } from '../types/nova';

interface GamingOverlayProps {
  latest: TelemetryPoint;
  streamerMode: boolean;
  currentTrackTitle: string;
  isPlayingMusic: boolean;
  onClose: () => void;
}

export const GamingOverlay: React.FC<GamingOverlayProps> = ({
  latest,
  streamerMode,
  currentTrackTitle,
  isPlayingMusic,
  onClose,
}) => {
  return (
    <aside
      aria-label="Gaming Overlay HUD"
      className="fixed top-24 right-5 z-40 w-64 rounded-lg border border-cyan-500/40 bg-[#080C14]/90 backdrop-blur-md p-3.5 shadow-[0_12px_36px_-8px_rgba(6,182,212,0.35)]"
    >
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800">
        <span className="font-display text-xs font-bold tracking-wider text-cyan-300">
          GAMING OVERLAY
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer Gaming Overlay"
          className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">FPS</span>
          <span className="font-mono-tabular font-semibold text-emerald-400">{latest.fps}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Ping</span>
          <span className="font-mono-tabular font-semibold text-cyan-300">{latest.ping} ms</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">CPU</span>
          <span className="font-mono-tabular font-semibold text-slate-100">
            {latest.cpu}% · {latest.cpuTemp}°C
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">GPU</span>
          <span className="font-mono-tabular font-semibold text-slate-100">
            {latest.gpu}% · {latest.gpuTemp}°C
          </span>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-800/90 space-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <MessageSquare className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="truncate">
            {streamerMode ? 'Discord : Masqué (Streamer)' : 'Discord : Squad Alpha (4)'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <Music className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">
            {isPlayingMusic ? currentTrackTitle : 'Musique en pause'}
          </span>
        </div>
      </div>
    </aside>
  );
};
