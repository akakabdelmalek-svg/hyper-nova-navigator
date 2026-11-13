import React, { useState } from 'react';
import { Zap, Trash2, PauseCircle, CheckCircle2, Activity } from 'lucide-react';
import { TelemetryPoint } from '../types/nova';

interface TelemetryAndBoosterProps {
  history: TelemetryPoint[];
  latest: TelemetryPoint;
  ramLimitGb: number;
  cpuLimitPct: number;
  autoSuspend: boolean;
  onChangeRamLimit: (val: number) => void;
  onChangeCpuLimit: (val: number) => void;
  onToggleAutoSuspend: () => void;
  onSuspendIdleTabs: () => number;
  onCleanCache: () => void;
}

const MiniTelemetryChart: React.FC<{
  label: string;
  valueText: string;
  color: string;
  data: number[];
  min: number;
  max: number;
}> = ({ label, valueText, color, data, min, max }) => {
  const width = 320;
  const height = 96;
  const range = Math.max(1, max - min);

  const points = data
    .map((val, idx) => {
      const x = (idx / Math.max(1, data.length - 1)) * width;
      const clamped = Math.max(min, Math.min(max, val));
      const y = height - ((clamped - min) / range) * (height - 14) - 7;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1320]">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className="font-mono-tabular text-lg font-bold" style={{ color }}>
          {valueText}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" />
        <polygon points={areaPoints} fill={color} fillOpacity="0.12" />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>
    </div>
  );
};

export const TelemetryAndBooster: React.FC<TelemetryAndBoosterProps> = ({
  history,
  latest,
  ramLimitGb,
  cpuLimitPct,
  autoSuspend,
  onChangeRamLimit,
  onChangeCpuLimit,
  onToggleAutoSuspend,
  onSuspendIdleTabs,
  onCleanCache,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleClean = () => {
    onCleanCache();
    setStatusMessage('Cache purgé · 480 Mo libérés (+20 XP)');
    window.setTimeout(() => setStatusMessage(null), 3200);
  };

  const handleSuspend = () => {
    const count = onSuspendIdleTabs();
    setStatusMessage(
      count > 0
        ? `${count} onglet(s) inactif(s) mis en veille (+15 XP)`
        : 'Tous les onglets sont déjà optimisés'
    );
    window.setTimeout(() => setStatusMessage(null), 3200);
  };

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            GX Booster Hyper Nova & Statistiques Live
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Contrôle automatique des ressources RAM/CPU, mise en veille des onglets et graphiques temps réel.
          </p>
        </div>
        {statusMessage && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 text-xs font-medium text-cyan-200">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* GX Booster Control Console */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-xl border border-slate-800 bg-[#0D1320] space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              <h2 className="font-display text-lg font-bold text-slate-100">
                GX Booster Hyper Nova
              </h2>
            </div>
            <button
              type="button"
              onClick={onToggleAutoSuspend}
              className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors ${
                autoSuspend
                  ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              Suspension auto : {autoSuspend ? 'Activée' : 'Désactivée'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Limiteur RAM</span>
                <span className="font-mono-tabular font-bold text-cyan-300">
                  {latest.ramGb.toFixed(1)} / {ramLimitGb} Go
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={8}
                step={0.5}
                value={ramLimitGb}
                onChange={(e) => onChangeRamLimit(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <p className="text-xs text-slate-400">
                Plafonne l’empreinte mémoire du navigateur pour réserver la RAM aux jeux.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Limiteur CPU</span>
                <span className="font-mono-tabular font-bold text-violet-300">
                  {latest.cpu}% / max {cpuLimitPct}%
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={100}
                step={5}
                value={cpuLimitPct}
                onChange={(e) => onChangeCpuLimit(Number(e.target.value))}
                className="w-full accent-violet-400 cursor-pointer"
              />
              <p className="text-xs text-slate-400">
                Évite les pics de processeur en arrière-plan pendant vos parties compétitives.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleSuspend}
              className="flex items-center gap-2 px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-100 hover:border-cyan-400/60 transition-colors"
            >
              <PauseCircle className="w-4 h-4 text-cyan-400" />
              <span>Suspendre onglets inutiles</span>
            </button>
            <button
              type="button"
              onClick={handleClean}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Nettoyer le cache</span>
            </button>
          </div>
        </div>

        {/* Instantaneous Gauges */}
        <div className="p-6 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col justify-between space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Indicateurs instantanés</span>
          </div>
          <div className="space-y-4 font-mono-tabular">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">RAM</span>
                <span className="text-cyan-300 font-bold">
                  {latest.ramGb.toFixed(1)} / {ramLimitGb} Go
                </span>
              </div>
              <div className="h-2 rounded bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, (latest.ramGb / ramLimitGb) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">CPU</span>
                <span className="text-violet-300 font-bold">{latest.cpu}%</span>
              </div>
              <div className="h-2 rounded bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-violet-400 transition-all duration-300"
                  style={{ width: `${latest.cpu}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">GPU</span>
                <span className="text-emerald-300 font-bold">{latest.gpu}%</span>
              </div>
              <div className="h-2 rounded bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-300"
                  style={{ width: `${latest.gpu}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Real-time 6-channel telemetry charts */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-100">
          Graphiques Temps Réel
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MiniTelemetryChart
            label="FPS (Images / sec)"
            valueText={`${latest.fps} FPS`}
            color="#10B981"
            data={history.map((p) => p.fps)}
            min={60}
            max={240}
          />
          <MiniTelemetryChart
            label="Ping Réseau"
            valueText={`${latest.ping} ms`}
            color="#06B6D4"
            data={history.map((p) => p.ping)}
            min={0}
            max={60}
          />
          <MiniTelemetryChart
            label="Mémoire RAM"
            valueText={`${latest.ramGb.toFixed(1)} Go`}
            color="#38BDF8"
            data={history.map((p) => p.ramGb)}
            min={0}
            max={8}
          />
          <MiniTelemetryChart
            label="Charge CPU"
            valueText={`${latest.cpu}%`}
            color="#8B5CF6"
            data={history.map((p) => p.cpu)}
            min={0}
            max={100}
          />
          <MiniTelemetryChart
            label="Charge GPU"
            valueText={`${latest.gpu}%`}
            color="#F59E0B"
            data={history.map((p) => p.gpu)}
            min={0}
            max={100}
          />
          <MiniTelemetryChart
            label="Débit Réseau (Download)"
            valueText={`${latest.netDownMbps} Mbps`}
            color="#EC4899"
            data={history.map((p) => p.netDownMbps)}
            min={0}
            max={1000}
          />
        </div>
      </section>
    </div>
  );
};
