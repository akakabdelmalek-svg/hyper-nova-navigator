import React, { useState } from 'react';
import { Gamepad2, Play, Cpu, Thermometer, Wifi, MessageSquare, CheckCircle2 } from 'lucide-react';
import { TelemetryPoint } from '../types/nova';

interface GamingHubProps {
  latest: TelemetryPoint;
  streamerMode: boolean;
  onLaunchPlatform: (platform: string) => void;
  onAskCrononova: (prompt: string, mode: string) => void;
}

const LAUNCHERS = [
  { name: 'Steam', gamesCount: 18, color: '#38BDF8', status: 'Prêt' },
  { name: 'Epic Games', gamesCount: 9, color: '#E2E8F0', status: 'Prêt' },
  { name: 'Xbox', gamesCount: 6, color: '#22C55E', status: 'Game Pass' },
  { name: 'Riot Games', gamesCount: 3, color: '#EF4444', status: 'Vanguard OK' },
  { name: 'Battle.net', gamesCount: 4, color: '#3B82F6', status: 'Connecté' },
  { name: 'Ubisoft Connect', gamesCount: 2, color: '#6366F1', status: 'Prêt' },
];

const FEATURED_GAMES = [
  {
    id: 'orbital',
    title: 'Orbital Vanguard: Eclipse',
    platform: 'Steam',
    hours: '412 h',
    fpsTarget: '144 FPS',
    image: '/src/assets/images/game_keyart_starfall_1794552119305.jpg',
  },
  {
    id: 'cyberblast',
    title: 'Cyberblast: Night Fury',
    platform: 'Epic Games',
    hours: '286 h',
    fpsTarget: '165 FPS',
    image: '/src/assets/images/game_keyart_velox_1794552119218.jpg',
  },
];

export const GamingHub: React.FC<GamingHubProps> = ({
  latest,
  streamerMode,
  onLaunchPlatform,
  onAskCrononova,
}) => {
  const [launchedItem, setLaunchedItem] = useState<string | null>(null);

  const handleLaunch = (name: string) => {
    setLaunchedItem(name);
    onLaunchPlatform(name);
    window.setTimeout(() => setLaunchedItem(null), 3200);
  };

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">Gaming Hub & Launcher</h1>
          <p className="text-sm text-slate-400 mt-1">
            Centre de commandement matériel, statut Discord et lancement instantané de vos bibliothèques.
          </p>
        </div>
        {launchedItem && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-xs font-medium text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            <span>Initialisation de {launchedItem} · +25 XP</span>
          </div>
        )}
      </div>

      {/* Key Gaming Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1320]">
          <div className="text-xs text-slate-400">Temps de jeu</div>
          <div className="font-mono-tabular text-xl font-bold text-slate-100 mt-1">1 428 h</div>
        </div>
        <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1320]">
          <div className="text-xs text-slate-400">Jeux installés</div>
          <div className="font-mono-tabular text-xl font-bold text-slate-100 mt-1">42</div>
        </div>
        <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1320]">
          <div className="text-xs text-slate-400">FPS Live</div>
          <div className="font-mono-tabular text-xl font-bold text-emerald-400 mt-1">{latest.fps}</div>
        </div>
        <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1320]">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Temp. CPU</span>
          </div>
          <div className="font-mono-tabular text-xl font-bold text-cyan-300 mt-1">{latest.cpuTemp}°C</div>
        </div>
        <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1320]">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Thermometer className="w-3.5 h-3.5 text-violet-400" />
            <span>Temp. GPU</span>
          </div>
          <div className="font-mono-tabular text-xl font-bold text-violet-300 mt-1">{latest.gpuTemp}°C</div>
        </div>
        <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1320]">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ping Réseau</span>
          </div>
          <div className="font-mono-tabular text-xl font-bold text-emerald-300 mt-1">{latest.ping} ms</div>
        </div>
        <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1320] col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
            <span>Discord</span>
          </div>
          <div className="text-sm font-semibold text-slate-100 mt-1.5 truncate">
            {streamerMode ? 'Masqué' : 'En vocal · Alpha'}
          </div>
        </div>
      </div>

      {/* Integrated 1-Click Launcher */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-slate-100">
            Launcher Intégré — Un seul clic
          </h2>
          <span className="text-xs text-slate-400">6 plateformes synchronisées</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {LAUNCHERS.map((launcher) => (
            <button
              key={launcher.name}
              type="button"
              onClick={() => handleLaunch(launcher.name)}
              className="group text-left p-4 rounded-lg border border-slate-800 bg-[#0D1320] hover:border-cyan-500/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <Gamepad2 className="w-5 h-5" style={{ color: launcher.color }} />
                <Play className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300 transition-colors" />
              </div>
              <div className="font-display text-sm font-bold text-slate-100 mt-3 truncate">
                {launcher.name}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {launcher.gamesCount} jeux · {launcher.status}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Games Library */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-100">
          Bibliothèque Récente
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURED_GAMES.map((game) => (
            <div
              key={game.id}
              className="overflow-hidden rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col"
            >
              <div className="relative aspect-[16/9] bg-slate-900 overflow-hidden">
                <img
                  src={game.image}
                  alt={game.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D1320] via-transparent to-transparent" />
              </div>
              <div className="p-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-100">{game.title}</h3>
                  <div className="text-xs text-slate-400 mt-1">
                    {game.platform} · {game.hours} jouées · Cible {game.fpsTarget}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onAskCrononova(
                        `Donne des conseils tactiques et réglages graphiques optimaux pour maximiser les FPS dans ${game.title}.`,
                        'gaming'
                      )
                    }
                    className="px-3 py-2 rounded-md border border-slate-700 text-xs font-medium text-slate-200 hover:border-cyan-400/60 transition-colors"
                  >
                    Coach IA
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLaunch(game.title)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Jouer</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
