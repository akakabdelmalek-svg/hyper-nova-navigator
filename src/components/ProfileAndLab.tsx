import React, { useRef, useState } from 'react';
import {
  Trophy,
  Award,
  Palette,
  Shield,
  Cloud,
  CheckCircle2,
  Download,
  RefreshCw,
  Camera,
  RotateCcw,
} from 'lucide-react';
import { GamerProfile, ShieldLogEntry, ThemePreset } from '../types/nova';

interface ProfileAndLabProps {
  initialSection: 'profile' | 'themelab' | 'shield' | 'cloud';
  profile: GamerProfile;
  userEmail?: string | null;
  streamerMode: boolean;
  theme: ThemePreset;
  savedThemes: ThemePreset[];
  shieldEnabled: boolean;
  shieldRules: { ads: boolean; trackers: boolean; malware: boolean; phishing: boolean };
  shieldLogs: ShieldLogEntry[];
  bookmarks: Array<{ title: string; url: string }>;
  historyUrls: string[];
  lastCloudSync: string;
  onUpdateTheme: (next: ThemePreset) => void;
  onSaveCustomTheme: (preset: ThemePreset) => void;
  onToggleShield: () => void;
  onToggleShieldRule: (key: 'ads' | 'trackers' | 'malware' | 'phishing') => void;
  onSyncCloud: () => void;
  onResetProfile?: () => void;
  onUpdateAvatar?: (avatarDataUrl: string | undefined) => void;
}

const RANK_LADDER = [
  { level: 0, title: 'Nova Recrue' },
  { level: 1, title: 'Nova Explorer' },
  { level: 5, title: 'Nova Pilot' },
  { level: 15, title: 'Star Warrior' },
  { level: 35, title: 'Chrono Knight' },
  { level: 60, title: 'Nova Prime' },
];

const SPECIAL_BADGES = [
  { id: 'explore_web', symbol: '🌐', name: 'Explorateur Web', desc: 'Effectuer une recherche ou visiter un site dans Hyper Nova' },
  { id: 'play_game', symbol: '🎮', name: 'Joueur Nova', desc: 'Jouer à un jeu sur Nova Jolt ou Gaming Hub' },
  { id: 'publish_game', symbol: '🚀', name: 'Créateur Indé', desc: 'Publier un jeu ou un dossier sur Nova Jolt' },
  { id: 'social_pilot', symbol: '💬', name: 'Pilote Connecté', desc: 'Créer son ID Nova Chat ou envoyer un message' },
  { id: 'hyper_drive', symbol: '⚡', name: 'Speedrunner', desc: 'Activer le mode Hyper Drive' },
  { id: 'gx_booster', symbol: '🛠️', name: 'Optimiseur GX', desc: 'Nettoyer le cache ou lancer GX Booster' },
  { id: 'theme_artist', symbol: '🎨', name: 'Architecte Visuel', desc: 'Créer un thème personnalisé dans Theme Lab' },
  { id: 'ai_commander', symbol: '🤖', name: 'Commandant IA', desc: 'Envoyer une commande à Crononova IA' },
  { id: 'cloud_sync', symbol: '☁️', name: 'Gardien Cloud', desc: 'Synchroniser sa session dans Nova Cloud' },
  { id: 'level_1', symbol: '🌟', name: 'Premier Décollage', desc: 'Atteindre le Niveau 1' },
  { id: 'level_5', symbol: '⭐', name: 'Pilote Confirmé', desc: 'Atteindre le Niveau 5' },
  { id: 'level_15', symbol: '👑', name: 'Légende Nova', desc: 'Atteindre le Niveau 15' },
];

function xpRequiredForLevel(level: number): number {
  if (level <= 0) return 0;
  return level * 100 + level * (level - 1) * 25;
}

export const ProfileAndLab: React.FC<ProfileAndLabProps> = ({
  initialSection,
  profile,
  userEmail,
  streamerMode,
  theme,
  savedThemes,
  shieldEnabled,
  shieldRules,
  shieldLogs,
  bookmarks,
  historyUrls,
  lastCloudSync,
  onUpdateTheme,
  onSaveCustomTheme,
  onToggleShield,
  onToggleShieldRule,
  onSyncCloud,
  onResetProfile,
  onUpdateAvatar,
}) => {
  const [section, setSection] = useState<'profile' | 'themelab' | 'shield' | 'cloud'>(initialSection);
  const [customName, setCustomName] = useState('Mon Thème Nova');
  const [toast, setToast] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUpdateAvatar) return;
    if (!file.type.startsWith('image/')) {
      showToast('Veuillez sélectionner une image valide (PNG, JPG, WebP...).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) return;
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onUpdateAvatar(rawDataUrl);
          showToast('Image de profil mise à jour.');
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const compressed = canvas.toDataURL('image/jpeg', 0.88);
        onUpdateAvatar(compressed);
        showToast('Image de profil importée avec succès !');
      };
      img.onerror = () => showToast('Impossible de lire cette image.');
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const currentFloorXp = xpRequiredForLevel(profile.level);
  const xpNextLevel = xpRequiredForLevel(profile.level + 1);
  const span = Math.max(1, xpNextLevel - currentFloorXp);
  const xpProgress = Math.max(
    0,
    Math.min(100, Math.round(((profile.xp - currentFloorXp) / span) * 100))
  );
  const unlockedSet = new Set(profile.unlockedAchievements || []);

  const handleSaveTheme = () => {
    const newPreset: ThemePreset = {
      ...theme,
      id: `custom-${Date.now()}`,
      name: customName.trim() || 'Thème Perso',
    };
    onSaveCustomTheme(newPreset);
    showToast(`Thème "${newPreset.name}" sauvegardé dans Nova Cloud (+30 XP)`);
  };

  const handleExportCloud = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      theme,
      bookmarks,
      historyUrls,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hyper-nova-cloud-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Sauvegarde Nova Cloud exportée.');
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-1.5 p-1 rounded-lg border border-slate-800 bg-[#0B101B] overflow-x-auto max-w-full">
          {[
            { id: 'profile', label: 'Profil & Niveaux', icon: Trophy },
            { id: 'themelab', label: 'Theme Lab', icon: Palette },
            { id: 'shield', label: 'Nova Shield', icon: Shield },
            { id: 'cloud', label: 'Nova Cloud', icon: Cloud },
          ].map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id as typeof section)}
                className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {toast && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{toast}</span>
          </div>
        )}
      </div>

      {/* SECTION 1: PROFIL GAMING & RPG LEVELS */}
      {section === 'profile' && (
        <div className="space-y-6 sm:space-y-8">
          <div className="p-4 sm:p-6 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col md:flex-row items-start md:items-center justify-between gap-5 sm:gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 min-w-0">
              <div className="flex flex-col items-center gap-2 shrink-0">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
                <div className="relative group w-20 h-20 rounded-xl border border-cyan-500/50 overflow-hidden bg-slate-900">
                  <img
                    src={profile.avatarUrl || '/src/assets/images/avatar_malek_prime_1794552117105.jpg'}
                    alt={`Avatar ${profile.name}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {onUpdateAvatar && (
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      title="Importer une image de profil"
                      aria-label="Importer une image de profil"
                      className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center text-cyan-200 transition-opacity"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {onUpdateAvatar && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="flex items-center gap-1 px-2 py-1 rounded border border-cyan-500/40 bg-cyan-500/10 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/20 transition-colors"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Importer photo</span>
                    </button>
                    {profile.avatarUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateAvatar(undefined);
                          showToast('Avatar par défaut restauré.');
                        }}
                        title="Restaurer l'avatar par défaut"
                        aria-label="Restaurer l'avatar par défaut"
                        className="p-1 rounded border border-slate-700 text-slate-400 hover:text-rose-300 hover:border-rose-500/40 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="text-xs font-mono-tabular text-cyan-300 truncate">
                  {streamerMode
                    ? 'COMPTE PROTÉGÉ (STREAMER)'
                    : userEmail || 'Mode Invité · Progression Locale'}
                </div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-100 mt-0.5 break-words">
                  {profile.name} · {profile.rankTitle}
                </h1>
                <div className="text-xs sm:text-sm text-slate-300 font-mono-tabular mt-1">
                  Niveau {profile.level} · {profile.xp.toLocaleString('fr-FR')} XP · {profile.achievements} Succès · {profile.badgesCount} Badges
                </div>
              </div>
            </div>

            <div className="w-full md:w-72 space-y-2">
              <div className="flex justify-between text-xs font-mono-tabular text-slate-400">
                <span>Progression Niveau {profile.level + 1}</span>
                <span className="text-cyan-300">{xpProgress}%</span>
              </div>
              <div className="h-2.5 rounded bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-300"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 font-mono-tabular">
                <span>Seuil suivant : {xpNextLevel.toLocaleString('fr-FR')} XP</span>
                {onResetProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetProfile();
                      showToast('Profil réinitialisé à 0.');
                    }}
                    className="text-slate-400 hover:text-rose-300 underline"
                  >
                    Réinitialiser à 0
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RPG Level Ladder */}
          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold text-slate-100">
              Système de Niveaux RPG (Départ à 0)
            </h2>
            <p className="text-xs text-slate-400">
              Vous commencez à 0 : gagnez de l’XP et débloquez des badges en explorant le web, jouant sur Nova Jolt, publiant des jeux, discutant sur Nova Chat, créant des thèmes ou optimisant via GX Booster.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {RANK_LADDER.map((tier) => {
                const unlocked = profile.level >= tier.level;
                return (
                  <div
                    key={tier.level}
                    className={`p-4 rounded-lg border ${
                      unlocked
                        ? 'border-cyan-500/40 bg-cyan-500/10'
                        : 'border-slate-800 bg-[#0D1320] opacity-55'
                    }`}
                  >
                    <div className="font-mono-tabular text-xs text-cyan-300">
                      Niveau {tier.level}
                    </div>
                    <div className="font-display text-sm font-bold text-slate-100 mt-1">
                      {tier.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Special Badges */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h2 className="font-display text-lg font-bold text-slate-100">
                Succès & Badges ({unlockedSet.size} / {SPECIAL_BADGES.length} débloqués)
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SPECIAL_BADGES.map((badge) => {
                const unlocked = unlockedSet.has(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-lg border flex items-start gap-3.5 transition-all ${
                      unlocked
                        ? 'border-cyan-500/45 bg-cyan-500/10'
                        : 'border-slate-800/80 bg-[#0D1320]/70 opacity-55'
                    }`}
                  >
                    <div className={`text-2xl leading-none ${unlocked ? '' : 'grayscale'}`}>
                      {badge.symbol}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-display text-sm font-bold text-slate-100 truncate">
                          {badge.name}
                        </div>
                        <span
                          className={`text-[10px] font-mono-tabular px-1.5 py-0.5 rounded ${
                            unlocked
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {unlocked ? 'Débloqué' : 'Verrouillé'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{badge.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: HYPER NOVA THEME LAB */}
      {section === 'themelab' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-xl border border-slate-800 bg-[#0D1320] space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-100">
                Hyper Nova Theme Lab
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Personnalisez les couleurs néon, la typographie, les effets et la vitesse des étoiles en temps réel.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <label className="space-y-1.5 block">
                <span className="text-xs font-medium text-slate-300">Couleur Néon Principale</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={theme.accent}
                    onChange={(e) => onUpdateTheme({ ...theme, accent: e.target.value })}
                    className="w-12 h-9 rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <span className="font-mono-tabular text-xs text-slate-400">{theme.accent}</span>
                </div>
              </label>

              <label className="space-y-1.5 block">
                <span className="text-xs font-medium text-slate-300">Couleur Secondaire Cosmique</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={theme.secondary}
                    onChange={(e) => onUpdateTheme({ ...theme, secondary: e.target.value })}
                    className="w-12 h-9 rounded border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <span className="font-mono-tabular text-xs text-slate-400">{theme.secondary}</span>
                </div>
              </label>

              <label className="space-y-1.5 block">
                <span className="text-xs font-medium text-slate-300">Police Principale</span>
                <select
                  value={theme.fontDisplay}
                  onChange={(e) =>
                    onUpdateTheme({
                      ...theme,
                      fontDisplay: e.target.value as ThemePreset['fontDisplay'],
                    })
                  }
                  className="w-full h-10 px-3 rounded-md border border-slate-700 bg-[#080C15] text-xs text-slate-100"
                >
                  <option value="Chakra Petch">Chakra Petch (Sci-Fi HUD)</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans (Moderne)</option>
                  <option value="JetBrains Mono">JetBrains Mono (Terminal)</option>
                </select>
              </label>

              <label className="space-y-1.5 block">
                <span className="text-xs font-medium text-slate-300">
                  Vitesse des Étoiles ({theme.starSpeed.toFixed(1)}x)
                </span>
                <input
                  type="range"
                  min={0.2}
                  max={3}
                  step={0.2}
                  value={theme.starSpeed}
                  onChange={(e) => onUpdateTheme({ ...theme, starSpeed: Number(e.target.value) })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800/80">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nom du thème..."
                className="w-full sm:w-auto flex-1 min-w-[160px] h-10 px-3 rounded-md border border-slate-700 bg-[#080C15] text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={handleSaveTheme}
                className="h-10 px-4 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-colors"
              >
                Sauvegarder le thème
              </button>
            </div>
          </div>

          {/* Saved Presets */}
          <div className="p-6 rounded-xl border border-slate-800 bg-[#0D1320] space-y-4">
            <h3 className="font-display text-base font-bold text-slate-100">
              Thèmes Disponibles
            </h3>
            <div className="space-y-2.5">
              {savedThemes.map((preset) => {
                const isSelected = preset.id === theme.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onUpdateTheme(preset);
                      showToast(`Thème "${preset.name}" activé`);
                    }}
                    className={`w-full text-left p-3.5 rounded-lg border transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/10'
                        : 'border-slate-800 bg-[#080C15] hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{preset.name}</div>
                      <div className="text-xs text-slate-400">{preset.fontDisplay}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-4 h-4 rounded-full border border-white/20"
                        style={{ backgroundColor: preset.accent }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-white/20"
                        style={{ backgroundColor: preset.secondary }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: NOVA SHIELD */}
      {section === 'shield' && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-100">
                Nova Shield — Bouclier Avancé
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Bloque en temps réel les publicités intrusives, traceurs, domaines malveillants et tentatives de phishing.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleShield}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-colors ${
                shieldEnabled
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {shieldEnabled ? 'Protection Active' : 'Protection en Pause'}
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'ads', label: 'Publicités', desc: 'Bannières & popups vidéo' },
              { key: 'trackers', label: 'Traceurs', desc: 'Scripts analytics & empreintes' },
              { key: 'malware', label: 'Sites malveillants', desc: 'Téléchargements suspects' },
              { key: 'phishing', label: 'Phishing', desc: 'Faux portails de connexion' },
            ].map((rule) => {
              const k = rule.key as keyof typeof shieldRules;
              const enabled = shieldRules[k];
              return (
                <button
                  key={rule.key}
                  type="button"
                  onClick={() => onToggleShieldRule(k)}
                  className={`text-left p-4 rounded-lg border transition-colors ${
                    enabled
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-slate-800 bg-[#0D1320] opacity-65'
                  }`}
                >
                  <div className="text-sm font-bold text-slate-100">{rule.label}</div>
                  <div className="text-xs text-slate-400 mt-1">{rule.desc}</div>
                  <div className="text-xs font-mono-tabular text-emerald-300 mt-2">
                    {enabled ? 'Bloqué' : 'Autorisé'}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0D1320] overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Journal de blocage récent
            </div>
            <div className="divide-y divide-slate-800/80">
              {shieldLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 text-xs"
                >
                  <span className="font-mono-tabular text-slate-200 truncate">{entry.domain}</span>
                  <div className="flex items-center gap-3 sm:gap-4 text-slate-400 shrink-0">
                    <span>{entry.category}</span>
                    <span className="font-mono-tabular">{entry.timestamp}</span>
                    <span className="text-emerald-400 font-semibold">Bloqué</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: NOVA CLOUD */}
      {section === 'cloud' && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-100">
                Nova Cloud — Stockage & Synchronisation
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Dernière synchronisation : <span className="font-mono-tabular text-cyan-300">{lastCloudSync}</span>
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onSyncCloud();
                  showToast('Paramètres, thèmes, favoris et historique synchronisés.');
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Synchroniser maintenant</span>
              </button>
              <button
                type="button"
                onClick={handleExportCloud}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-xs font-medium text-slate-200 hover:border-slate-500 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter JSON</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-3">
              <h3 className="font-display text-base font-bold text-slate-100">
                Favoris Synchronisés ({bookmarks.length})
              </h3>
              <ul className="space-y-2 text-xs">
                {bookmarks.map((bm) => (
                  <li key={bm.title} className="flex items-center justify-between gap-2 text-slate-300">
                    <span className="font-medium truncate">{bm.title}</span>
                    <span className="font-mono-tabular text-slate-500 truncate max-w-[55%]">
                      {bm.url}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-3">
              <h3 className="font-display text-base font-bold text-slate-100">
                Historique Récent ({historyUrls.length})
              </h3>
              <ul className="space-y-2 text-xs font-mono-tabular text-slate-400">
                {historyUrls.slice(0, 6).map((url, idx) => (
                  <li key={`${url}-${idx}`} className="truncate">
                    {url}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
