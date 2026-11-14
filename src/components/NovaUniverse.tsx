import React, { useState } from 'react';
import {
  Gamepad2,
  Code2,
  Music,
  Globe,
  Cpu,
  Rocket,
  ArrowUpRight,
  Mic,
  Search,
} from 'lucide-react';
import { GamerProfile, ModuleKind, SearchEngine, TelemetryPoint } from '../types/nova';

interface NovaUniverseProps {
  profile: GamerProfile;
  latest: TelemetryPoint;
  hyperDrive: boolean;
  searchEngine: SearchEngine;
  onChangeSearchEngine: (engine: SearchEngine) => void;
  onOpenModule: (kind: ModuleKind, title?: string) => void;
  onOpenWebPortal: (platform: 'youtube' | 'discord' | 'spotify', title: string, color: string) => void;
  onRunSearch: (query: string, engine: SearchEngine) => void;
  onOpenSearchEngine: (engine: SearchEngine) => void;
  onTriggerVoice: () => void;
}

interface PlanetNode {
  id: string;
  label: string;
  sector: string;
  description: string;
  color: string;
  size: number;
  orbitDuration: string;
  target: ModuleKind | 'crononova';
  icon: React.ReactNode;
  positionClass: string;
}

export const NovaUniverse: React.FC<NovaUniverseProps> = ({
  profile,
  latest,
  hyperDrive,
  searchEngine,
  onChangeSearchEngine,
  onOpenModule,
  onOpenWebPortal,
  onRunSearch,
  onOpenSearchEngine,
  onTriggerVoice,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [hoveredPlanet, setHoveredPlanet] = useState<string | null>(null);

  const planets: PlanetNode[] = [
    {
      id: 'gaming',
      label: 'Gaming',
      sector: 'Secteur Alpha · Launcher & FPS',
      description: 'Hub de jeu, Steam, Epic, Riot, temps de jeu et métriques GPU.',
      color: '#06B6D4',
      size: 76,
      orbitDuration: '28s',
      target: 'gaming',
      icon: <Gamepad2 className="w-6 h-6" />,
      positionClass: 'top-6 left-[8%]',
    },
    {
      id: 'dev',
      label: 'Développement',
      sector: 'Secteur Code · Web & Sandbox',
      description: 'Générateur HTML/CSS/JS, débogage et Theme Lab CSS.',
      color: '#8B5CF6',
      size: 68,
      orbitDuration: '34s',
      target: 'themelab',
      icon: <Code2 className="w-5 h-5" />,
      positionClass: 'top-14 right-[10%]',
    },
    {
      id: 'music',
      label: 'Musique',
      sector: 'Secteur Audio · Equalizer 5 bandes',
      description: 'Spotify, YouTube Music, lecteur MP3 local et fenêtre flottante.',
      color: '#10B981',
      size: 64,
      orbitDuration: '24s',
      target: 'media',
      icon: <Music className="w-5 h-5" />,
      positionClass: 'bottom-10 left-[16%]',
    },
    {
      id: 'network',
      label: 'Network',
      sector: 'Secteur Orbital · Chat & Shield',
      description: 'Nova Chat vocal/vidéo, télémétrie réseau et Nova Shield.',
      color: '#3B82F6',
      size: 70,
      orbitDuration: '30s',
      target: 'chat',
      icon: <Globe className="w-5 h-5" />,
      positionClass: 'bottom-8 right-[16%]',
    },
    {
      id: 'ia',
      label: 'IA',
      sector: 'Noyau Central · CRONONOVA',
      description: 'Recherche web, commandes vocales, résumé de page et coach e-sport.',
      color: hyperDrive ? '#F43F5E' : '#22D3EE',
      size: 88,
      orbitDuration: '20s',
      target: 'crononova',
      icon: <Cpu className="w-7 h-7" />,
      positionClass: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    onRunSearch(searchInput.trim(), searchEngine);
    setSearchInput('');
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Hero Cosmic Observatory */}
      <section className="relative overflow-hidden border-b border-slate-800/80">
        <div className="absolute inset-0">
          <img
            src="/src/assets/images/nova_cosmos_backdrop_1794552118037.jpg"
            alt="Observatoire spatial Nova Universe"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#07090E]/70 via-[#07090E]/75 to-[#07090E]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 sm:gap-8">
            <div className="max-w-2xl space-y-3">
              <div className="flex items-center gap-2.5 text-[11px] sm:text-xs font-mono-tabular tracking-wider text-cyan-300">
                <img
                  src={profile.avatarUrl || '/src/assets/images/avatar_malek_prime_1794552117105.jpg'}
                  alt={profile.name}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-md object-cover border border-cyan-500/45 shrink-0"
                />
                <span>
                  NOVA UNIVERSE · {profile.name} · {profile.rankTitle} · NIVEAU {profile.level}
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-slate-100 tracking-tight text-balance">
                Station de Navigation Hyper Nova
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                Explorez les planètes de commandement, lancez vos jeux en un clic ou pilotez le navigateur à la voix avec Crononova.
              </p>

              {/* Command Search / Voice Bar */}
              <form onSubmit={handleSearch} className="pt-2 flex flex-wrap sm:flex-nowrap items-center gap-2 max-w-2xl">
                <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto h-11 px-2.5 sm:px-3 rounded-lg border border-slate-700/90 bg-[#0A0F1A]/90 focus-within:border-cyan-400 transition-colors">
                  <select
                    aria-label="Moteur de recherche Nova Universe"
                    value={searchEngine}
                    onChange={(e) => onChangeSearchEngine(e.target.value as SearchEngine)}
                    className="bg-[#11192B] border border-slate-700 rounded px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs font-semibold text-cyan-300 focus:outline-none cursor-pointer shrink-0"
                  >
                    <option value="bing">Bing</option>
                    <option value="duckduckgo">DuckDuckGo</option>
                    <option value="qwant">Qwant</option>
                  </select>
                  <Search className="w-4 h-4 text-cyan-400 shrink-0" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={`Rechercher avec ${searchEngine === 'bing' ? 'Bing' : searchEngine === 'duckduckgo' ? 'DuckDuckGo' : 'Qwant'}, URL ou Crononova...`}
                    className="w-full min-w-0 bg-transparent text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                  <button
                    type="button"
                    onClick={onTriggerVoice}
                    title="Commande vocale Crononova"
                    className="flex items-center justify-center w-11 h-11 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-colors shrink-0"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-none h-11 px-5 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold tracking-wide hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0"
                  >
                    Exécuter
                  </button>
                </div>
              </form>

              {/* Quick Engine Portals inside Hyper Nova */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-mono-tabular text-slate-400 mr-1">
                  Ouvrir dans Hyper Nova :
                </span>
                {(
                  [
                    { id: 'bing', label: 'Bing', dot: '#00A4EF' },
                    { id: 'duckduckgo', label: 'DuckDuckGo', dot: '#DE5833' },
                    { id: 'qwant', label: 'Qwant', dot: '#8B5CF6' },
                  ] as Array<{ id: SearchEngine; label: string; dot: string }>
                ).map((eng) => (
                  <button
                    key={eng.id}
                    type="button"
                    onClick={() => onOpenSearchEngine(eng.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-700/80 bg-[#0A0F1A]/90 text-xs text-slate-200 hover:border-cyan-400/60 hover:text-white transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: eng.dot }}
                    />
                    <span>{eng.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Compact Live Telemetry Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-lg border border-slate-800/90 bg-[#090E18]/85 backdrop-blur-sm shrink-0">
              <div>
                <div className="text-[11px] text-slate-400">FPS</div>
                <div className="font-mono-tabular text-base sm:text-lg font-bold text-emerald-400">{latest.fps}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Ping</div>
                <div className="font-mono-tabular text-base sm:text-lg font-bold text-cyan-300">{latest.ping} ms</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">RAM</div>
                <div className="font-mono-tabular text-base sm:text-lg font-bold text-slate-100">{latest.ramGb} Go</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">GPU</div>
                <div className="font-mono-tabular text-base sm:text-lg font-bold text-violet-300">{latest.gpu}%</div>
              </div>
            </div>
          </div>

          {/* Mobile Responsive Planets Grid (< sm) */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:hidden">
            {planets.map((planet) => (
              <button
                key={`mob-${planet.id}`}
                type="button"
                onClick={() => {
                  if (planet.target === 'crononova') {
                    onTriggerVoice();
                  } else {
                    onOpenModule(planet.target, planet.label);
                  }
                }}
                className={`p-3.5 rounded-xl border border-slate-800 bg-[#070B13]/90 flex items-center gap-3 text-left transition-colors hover:border-cyan-500/40 ${
                  planet.id === 'ia' ? 'col-span-2' : ''
                }`}
              >
                <div
                  style={{ borderColor: planet.color }}
                  className="w-11 h-11 rounded-full border-2 bg-[#0B111F] flex items-center justify-center shrink-0"
                >
                  <span style={{ color: planet.color }}>{planet.icon}</span>
                </div>
                <div className="min-w-0">
                  <div className="font-display text-xs font-bold text-slate-100 truncate">
                    Planète {planet.label}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{planet.sector}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Interactive Constellation & Planets Map (sm+ tablet/desktop) */}
          <div className="mt-8 relative h-[340px] rounded-xl border border-slate-800/90 bg-[#070B13]/85 overflow-hidden nova-grid-bg hidden sm:block">
            {/* Constellations SVG lines & starship path */}
            <svg
              aria-hidden="true"
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 1000 340"
              preserveAspectRatio="none"
            >
              <g stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" strokeDasharray="4 5">
                <line x1="120" y1="80" x2="500" y2="170" />
                <line x1="860" y1="90" x2="500" y2="170" />
                <line x1="200" y1="265" x2="500" y2="170" />
                <line x1="800" y1="265" x2="500" y2="170" />
                <line x1="120" y1="80" x2="860" y2="90" />
                <line x1="200" y1="265" x2="800" y2="265" />
              </g>
              <circle cx="500" cy="170" r="120" fill="none" stroke="rgba(139, 92, 246, 0.16)" strokeWidth="1" />
              <circle cx="500" cy="170" r="165" fill="none" stroke="rgba(6, 182, 212, 0.12)" strokeWidth="1" />
            </svg>

            {/* Animated Starship */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-7 left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs font-mono-tabular text-cyan-300/75"
            >
              <Rocket className="w-4 h-4 rotate-45 text-cyan-400" />
              <span>Croiseur Nova-01 · Orbite Basse</span>
            </div>

            {/* 5 Interactive Planets */}
            {planets.map((planet) => {
              const isHovered = hoveredPlanet === planet.id;
              return (
                <button
                  key={planet.id}
                  type="button"
                  onMouseEnter={() => setHoveredPlanet(planet.id)}
                  onMouseLeave={() => setHoveredPlanet(null)}
                  onClick={() => {
                    if (planet.target === 'crononova') {
                      onTriggerVoice();
                    } else {
                      onOpenModule(planet.target, planet.label);
                    }
                  }}
                  className={`group absolute ${planet.positionClass} flex flex-col items-center gap-2 focus:outline-none`}
                >
                  <div
                    style={{
                      width: planet.size,
                      height: planet.size,
                      borderColor: planet.color,
                      boxShadow: isHovered
                        ? `0 0 28px -2px ${planet.color}aa, inset 0 0 18px ${planet.color}44`
                        : `0 0 18px -6px ${planet.color}66, inset 0 0 12px ${planet.color}22`,
                    }}
                    className="relative rounded-full border-2 bg-[#0B111F]/90 flex items-center justify-center text-slate-100 transition-transform duration-200 group-hover:scale-110"
                  >
                    <span
                      style={{ borderColor: `${planet.color}55` }}
                      className="absolute -inset-2 rounded-full border border-dashed animate-[spin_22s_linear_infinite] pointer-events-none"
                    />
                    <span style={{ color: planet.color }}>{planet.icon}</span>
                  </div>
                  <div className="text-center">
                    <div className="font-display text-xs font-bold tracking-wide text-slate-100">
                      Planète {planet.label}
                    </div>
                    <div className="text-[11px] text-slate-400 hidden sm:block">
                      {planet.sector}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Portails & Modules Rapides */}
      <section className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-5 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base sm:text-lg font-bold text-slate-100">
            Portails Rapides & Systèmes de Bord
          </h2>
          <span className="text-xs text-slate-400">
            Accès direct aux stations de contrôle et onglets favoris
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => onOpenWebPortal('youtube', 'YouTube', '#EF4444')}
            className="text-left p-4 rounded-lg border border-slate-800 bg-[#0D1320] hover:border-red-500/50 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-red-400">Portail Web</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors" />
            </div>
            <div className="font-display text-base font-bold text-slate-100 mt-1.5">YouTube</div>
            <p className="text-xs text-slate-400 mt-1">Tournois, streams et guides gaming sans publicités.</p>
          </button>

          <button
            type="button"
            onClick={() => onOpenWebPortal('discord', 'Discord', '#8B5CF6')}
            className="text-left p-4 rounded-lg border border-slate-800 bg-[#0D1320] hover:border-violet-500/50 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-violet-400">Communications</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition-colors" />
            </div>
            <div className="font-display text-base font-bold text-slate-100 mt-1.5">Discord</div>
            <p className="text-xs text-slate-400 mt-1">Pont vocal Squad Alpha et overlay intégré.</p>
          </button>

          <button
            type="button"
            onClick={() => onOpenModule('telemetry', 'GX Booster & Stats')}
            className="text-left p-4 rounded-lg border border-slate-800 bg-[#0D1320] hover:border-cyan-500/50 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-400">Optimisation</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            </div>
            <div className="font-display text-base font-bold text-slate-100 mt-1.5">GX Booster</div>
            <p className="text-xs text-slate-400 mt-1">Limiteur RAM/CPU, veille d’onglets et stats live.</p>
          </button>

          <button
            type="button"
            onClick={() => onOpenModule('novajolt', 'Nova Jolt')}
            className="text-left p-4 rounded-lg border border-slate-800 bg-[#0D1320] hover:border-emerald-500/50 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400">Communauté Indé</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            </div>
            <div className="font-display text-base font-bold text-slate-100 mt-1.5">Nova Jolt</div>
            <p className="text-xs text-slate-400 mt-1">Publiez vos jeux HTML5/Web et jouez aux créations des joueurs.</p>
          </button>

          <button
            type="button"
            onClick={() => onOpenModule('profile', 'Profil & Cloud')}
            className="text-left p-4 rounded-lg border border-slate-800 bg-[#0D1320] hover:border-amber-500/50 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400">Progression RPG</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
            </div>
            <div className="font-display text-base font-bold text-slate-100 mt-1.5">
              {profile.name} · Niv. {profile.level}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {profile.xp.toLocaleString('fr-FR')} XP · {profile.badgesCount} Badges · Nova Cloud.
            </p>
          </button>
        </div>
      </section>
    </div>
  );
};
