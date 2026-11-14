import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Plus,
  X,
  Shield,
  EyeOff,
  Eye,
  Layers,
  Cpu,
  Volume2,
  VolumeX,
  Zap,
  Compass,
  Gamepad2,
  Activity,
  Music,
  MessageSquare,
  User,
  Palette,
  Cloud,
  Globe,
  Code2,
  Lock,
  Store,
} from 'lucide-react';
import { BrowserTab, ModuleKind, SearchEngine } from '../types/nova';

interface BrowserChromeProps {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onNavigateOmnibox: (input: string) => void;
  searchEngine: SearchEngine;
  onChangeSearchEngine: (engine: SearchEngine) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  canBack: boolean;
  canForward: boolean;
  shieldEnabled: boolean;
  blockedCount: number;
  onToggleShield: () => void;
  streamerMode: boolean;
  onToggleStreamerMode: () => void;
  overlayOpen: boolean;
  onToggleOverlay: () => void;
  crononovaOpen: boolean;
  onToggleCrononova: () => void;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  hyperDrive: boolean;
  onToggleHyperDrive: () => void;
}

const TabIcon: React.FC<{ kind: ModuleKind; active: boolean; color: string }> = ({
  kind,
  active,
  color,
}) => {
  const cls = `w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${active ? 'scale-110' : ''}`;
  const style = { color };
  switch (kind) {
    case 'universe':
      return <Compass className={cls} style={style} />;
    case 'gaming':
      return <Gamepad2 className={cls} style={style} />;
    case 'novajolt':
      return <Store className={cls} style={style} />;
    case 'telemetry':
      return <Activity className={cls} style={style} />;
    case 'media':
      return <Music className={cls} style={style} />;
    case 'chat':
      return <MessageSquare className={cls} style={style} />;
    case 'profile':
      return <User className={cls} style={style} />;
    case 'themelab':
      return <Palette className={cls} style={style} />;
    case 'shield':
      return <Shield className={cls} style={style} />;
    case 'cloud':
      return <Cloud className={cls} style={style} />;
    case 'webapp':
      return <Code2 className={cls} style={style} />;
    default:
      return <Globe className={cls} style={style} />;
  }
};

export const BrowserChrome: React.FC<BrowserChromeProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onNavigateOmnibox,
  searchEngine,
  onChangeSearchEngine,
  onBack,
  onForward,
  onReload,
  canBack,
  canForward,
  shieldEnabled,
  blockedCount,
  onToggleShield,
  streamerMode,
  onToggleStreamerMode,
  overlayOpen,
  onToggleOverlay,
  crononovaOpen,
  onToggleCrononova,
  sfxEnabled,
  onToggleSfx,
  hyperDrive,
  onToggleHyperDrive,
}) => {
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const [omniboxValue, setOmniboxValue] = useState(activeTab?.url || '');

  useEffect(() => {
    if (activeTab) {
      setOmniboxValue(activeTab.url);
    }
  }, [activeTab?.id, activeTab?.url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!omniboxValue.trim()) return;
    onNavigateOmnibox(omniboxValue.trim());
  };

  return (
    <header className="relative z-20 select-none border-b border-slate-800/80 bg-[#090D16]/90 backdrop-blur-md">
      {/* Row 1: Multi Gaming Tabs Strip */}
      <div className="flex items-center gap-1.5 px-2.5 sm:px-3 pt-2 pb-1.5 overflow-x-auto">
        <div className="flex items-center gap-2 pr-2 sm:pr-3 mr-0.5 sm:mr-1 border-r border-slate-800/80 shrink-0">
          <span className="font-display text-xs sm:text-sm font-bold tracking-wider text-slate-100 whitespace-nowrap">
            HYPER NOVA
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTab(tab.id);
                  }
                }}
                style={{
                  borderColor: isActive ? tab.color : 'rgba(148,163,184,0.14)',
                  boxShadow: isActive ? `0 0 14px -4px ${tab.color}66` : 'none',
                }}
                className={`group relative flex items-center gap-1.5 sm:gap-2 h-8 px-2.5 sm:px-3 rounded-md border text-xs font-medium cursor-pointer transition-all duration-150 shrink-0 max-w-[140px] sm:max-w-[190px] ${
                  isActive
                    ? 'bg-[#12192A] text-slate-100'
                    : 'bg-[#0B101B]/80 text-slate-400 hover:text-slate-200 hover:bg-[#101726]'
                } ${tab.suspended ? 'opacity-55' : ''}`}
              >
                <span
                  className="absolute top-0 left-2 right-2 h-[2px] rounded-b transition-opacity"
                  style={{
                    backgroundColor: tab.color,
                    opacity: isActive ? 1 : 0.35,
                  }}
                />
                <TabIcon kind={tab.kind} active={isActive} color={tab.color} />
                <span className="truncate whitespace-nowrap">
                  {tab.suspended ? `[Veille] ${tab.title}` : tab.title}
                </span>
                {tabs.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Fermer ${tab.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    className="p-0.5 rounded hover:bg-slate-700/60 text-slate-500 hover:text-slate-100 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={onNewTab}
            title="Nouvel onglet Nova Universe"
            aria-label="Nouvel onglet"
            className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-800/80 bg-[#0B101B] text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Ultimate Hyper Drive Toggle */}
        <button
          type="button"
          onClick={onToggleHyperDrive}
          title={hyperDrive ? 'Hyper Drive Actif' : 'Activer Hyper Drive'}
          className={`flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-md border text-xs font-semibold tracking-wide whitespace-nowrap shrink-0 transition-all duration-200 ${
            hyperDrive
              ? 'bg-rose-500/20 border-rose-400 text-rose-200 shadow-[0_0_18px_-3px_rgba(244,63,94,0.65)]'
              : 'bg-[#101726] border-slate-700/80 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${hyperDrive ? 'text-rose-400' : 'text-cyan-400'}`} />
          <span className="hidden sm:inline">{hyperDrive ? 'Hyper Drive Actif' : 'Hyper Drive'}</span>
          <span className="sm:hidden">{hyperDrive ? 'HD On' : 'HD'}</span>
        </button>
      </div>

      {/* Row 2: Navigation Controls + Omnibox + Command Toggles */}
      <div className="flex flex-wrap md:flex-nowrap items-center gap-2 sm:gap-3 px-2.5 sm:px-3 pb-2.5 pt-0.5">
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={onBack}
            disabled={!canBack}
            aria-label="Page précédente"
            className="p-1.5 sm:p-2 rounded-md text-slate-300 hover:bg-slate-800/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onForward}
            disabled={!canForward}
            aria-label="Page suivante"
            className="p-1.5 sm:p-2 rounded-md text-slate-300 hover:bg-slate-800/70 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onReload}
            aria-label="Recharger l'onglet"
            className="p-1.5 sm:p-2 rounded-md text-slate-300 hover:bg-slate-800/70 transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Omnibox with Search Engine selector */}
        <form onSubmit={handleSubmit} className="flex-1 min-w-[160px]">
          <div className="flex items-center gap-1.5 sm:gap-2 h-9 px-2 sm:px-2.5 rounded-md border border-slate-800 bg-[#06080E] focus-within:border-cyan-500/70 transition-colors">
            <select
              aria-label="Moteur de recherche"
              value={searchEngine}
              onChange={(e) => onChangeSearchEngine(e.target.value as SearchEngine)}
              className="bg-[#0E1525] border border-slate-700/80 rounded px-1.5 sm:px-2 py-1 text-[11px] font-semibold text-cyan-300 focus:outline-none cursor-pointer shrink-0"
            >
              <option value="bing">Bing</option>
              <option value="duckduckgo">DuckDuckGo</option>
              <option value="qwant">Qwant</option>
            </select>
            <Lock className="hidden sm:block w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <input
              type="text"
              value={omniboxValue}
              onChange={(e) => setOmniboxValue(e.target.value)}
              placeholder={`Rechercher sur ${searchEngine === 'bing' ? 'Bing' : searchEngine === 'duckduckgo' ? 'DuckDuckGo' : 'Qwant'} ou URL...`}
              className="w-full min-w-0 bg-transparent text-xs font-mono-tabular text-slate-200 placeholder:text-slate-500 focus:outline-none"
            />
          </div>
        </form>

        {/* System Action Toggles */}
        <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-1.5 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={onToggleShield}
            title="Nova Shield — Protection Pubs & Traceurs"
            className={`flex items-center gap-1.5 h-8 sm:h-9 px-2.5 rounded-md border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              shieldEnabled
                ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-300'
                : 'bg-[#0D1320] border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="font-mono-tabular">{blockedCount}</span>
          </button>

          <button
            type="button"
            onClick={onToggleStreamerMode}
            title="Mode Streamer — Masquer notifications & messages privés"
            className={`flex items-center gap-1.5 h-8 sm:h-9 px-2.5 rounded-md border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              streamerMode
                ? 'bg-violet-500/20 border-violet-400/50 text-violet-200'
                : 'bg-[#0D1320] border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {streamerMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">Streamer</span>
          </button>

          <button
            type="button"
            onClick={onToggleOverlay}
            title="Gaming Overlay HUD"
            className={`flex items-center gap-1.5 h-8 sm:h-9 px-2.5 rounded-md border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              overlayOpen
                ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200'
                : 'bg-[#0D1320] border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Overlay</span>
          </button>

          <button
            type="button"
            onClick={onToggleSfx}
            title="Sons HUD"
            aria-label="Activer ou couper les sons HUD"
            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-md border border-slate-800 bg-[#0D1320] text-slate-300 hover:border-slate-700 transition-colors shrink-0"
          >
            {sfxEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            type="button"
            onClick={onToggleCrononova}
            title="Assistant IA Crononova"
            className={`flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-md border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              crononovaOpen
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-[#101828] border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/15'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Crononova<span className="hidden sm:inline"> IA</span></span>
          </button>
        </div>
      </div>
    </header>
  );
};
