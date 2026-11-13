import React, { useRef } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Sliders,
  Upload,
  Volume2,
  PictureInPicture2,
  X,
} from 'lucide-react';
import { TrackItem } from '../types/nova';

interface MediaCenterProps {
  tracks: TrackItem[];
  currentTrack: TrackItem;
  isPlaying: boolean;
  eqBands: number[];
  bassBoost: boolean;
  spatialAudio: boolean;
  nightcore: boolean;
  volume: number;
  floatingOpen: boolean;
  onTogglePlay: () => void;
  onSelectTrack: (track: TrackItem) => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onChangeEqBand: (index: number, val: number) => void;
  onToggleBassBoost: () => void;
  onToggleSpatial: () => void;
  onToggleNightcore: () => void;
  onChangeVolume: (val: number) => void;
  onToggleFloating: () => void;
  onUploadLocalMp3: (file: File) => void;
}

const EQ_LABELS = ['60 Hz', '230 Hz', '910 Hz', '3.6 kHz', '14 kHz'];

export const MediaCenter: React.FC<MediaCenterProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  eqBands,
  bassBoost,
  spatialAudio,
  nightcore,
  volume,
  floatingOpen,
  onTogglePlay,
  onSelectTrack,
  onNextTrack,
  onPrevTrack,
  onChangeEqBand,
  onToggleBassBoost,
  onToggleSpatial,
  onToggleNightcore,
  onChangeVolume,
  onToggleFloating,
  onUploadLocalMp3,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">Media Center</h1>
          <p className="text-sm text-slate-400 mt-1">
            Lecteur audio compatible Spotify, YouTube Music et MP3 locaux avec égaliseur Web Audio 5 bandes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadLocalMp3(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-md border border-slate-700 bg-slate-900 text-xs font-medium text-slate-200 hover:border-cyan-400/60 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Importer MP3 local</span>
          </button>

          <button
            type="button"
            onClick={onToggleFloating}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-md border text-xs font-semibold transition-colors ${
              floatingOpen
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
            }`}
          >
            <PictureInPicture2 className="w-3.5 h-3.5" />
            <span>{floatingOpen ? 'Fenêtre flottante active' : 'Fenêtre flottante'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Player + Equalizer */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="text-xs font-mono-tabular text-emerald-400">
                {currentTrack.source} · {currentTrack.bpm} BPM
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-100">
                {currentTrack.title}
              </h2>
              <p className="text-sm text-slate-400">{currentTrack.artist}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onPrevTrack}
                aria-label="Piste précédente"
                className="p-2.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-600 transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pause' : 'Lecture'}
                className="flex items-center justify-center w-12 h-12 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button
                type="button"
                onClick={onNextTrack}
                aria-label="Piste suivante"
                className="p-2.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-600 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 5-Band Equalizer & Audio FX */}
          <div className="p-6 rounded-xl border border-slate-800 bg-[#0D1320] space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h3 className="font-display text-base font-bold text-slate-100">
                  Equalizer 5 Bandes & Effets Audio
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => onChangeVolume(Number(e.target.value))}
                  className="w-24 accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4 pt-2">
              {EQ_LABELS.map((label, idx) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <span className="font-mono-tabular text-xs text-cyan-300">
                    {eqBands[idx] > 0 ? `+${eqBands[idx]}` : eqBands[idx]} dB
                  </span>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={eqBands[idx]}
                    onChange={(e) => onChangeEqBand(idx, Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-[11px] font-mono-tabular text-slate-400">{label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={onToggleBassBoost}
                className={`px-3.5 py-2 rounded-md border text-xs font-semibold transition-colors ${
                  bassBoost
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Bass Boost (+8 dB)
              </button>
              <button
                type="button"
                onClick={onToggleSpatial}
                className={`px-3.5 py-2 rounded-md border text-xs font-semibold transition-colors ${
                  spatialAudio
                    ? 'bg-violet-500/20 border-violet-400 text-violet-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Audio Spatial 3D
              </button>
              <button
                type="button"
                onClick={onToggleNightcore}
                className={`px-3.5 py-2 rounded-md border text-xs font-semibold transition-colors ${
                  nightcore
                    ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Mode Hyper Tempo (1.25x)
              </button>
            </div>
          </div>
        </div>

        {/* Quick Playlist */}
        <div className="p-6 rounded-xl border border-slate-800 bg-[#0D1320] space-y-4">
          <h3 className="font-display text-base font-bold text-slate-100">Playlist Rapide</h3>
          <div className="divide-y divide-slate-800/80">
            {tracks.map((track) => {
              const active = track.id === currentTrack.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => onSelectTrack(track)}
                  className={`w-full text-left py-3 px-2.5 rounded-md transition-colors flex items-center justify-between gap-3 ${
                    active ? 'bg-cyan-500/10 text-cyan-200' : 'hover:bg-slate-800/40 text-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{track.title}</div>
                    <div className="text-xs text-slate-400 truncate">
                      {track.artist} · {track.source}
                    </div>
                  </div>
                  <span className="font-mono-tabular text-xs text-slate-500 shrink-0">
                    {Math.floor(track.durationSec / 60)}:{String(track.durationSec % 60).padStart(2, '0')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const FloatingMediaWidget: React.FC<{
  track: TrackItem;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onClose: () => void;
}> = ({ track, isPlaying, onTogglePlay, onNext, onClose }) => {
  return (
    <div className="fixed bottom-5 right-5 z-40 w-72 rounded-lg border border-emerald-500/40 bg-[#090E17]/95 backdrop-blur-md p-3.5 shadow-[0_12px_36px_-8px_rgba(16,185,129,0.3)]">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
        <span className="text-[11px] font-mono-tabular uppercase tracking-wider text-emerald-400">
          Media Flottant · {track.source}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le lecteur flottant"
          className="p-0.5 rounded text-slate-400 hover:text-slate-100"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-100 truncate">{track.title}</div>
          <div className="text-[11px] text-slate-400 truncate">{track.artist}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onTogglePlay}
            className="p-2 rounded bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="p-2 rounded border border-slate-700 text-slate-200 hover:border-slate-500 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
