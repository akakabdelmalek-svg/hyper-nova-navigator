import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  Gamepad2,
  Store,
  Activity,
  Music,
  MessageSquare,
  User as UserIcon,
  Palette,
  Shield,
  Cloud,
} from 'lucide-react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType, testFirestoreConnection } from './firebase';
import {
  BrowserTab,
  ChatHandle,
  CrononovaAction,
  CrononovaMessage,
  GamerProfile,
  ModuleKind,
  SearchCategory,
  SearchEngine,
  ShieldLogEntry,
  TelemetryPoint,
  ThemePreset,
  TrackItem,
} from './types/nova';
import { soundEngine } from './utils/soundEngine';
import { StarfieldCanvas } from './components/StarfieldCanvas';
import { BrowserChrome } from './components/BrowserChrome';
import { NovaUniverse } from './components/NovaUniverse';
import { GamingHub } from './components/GamingHub';
import { NovaJolt } from './components/NovaJolt';
import { TelemetryAndBooster } from './components/TelemetryAndBooster';
import { MediaCenter, FloatingMediaWidget } from './components/MediaCenter';
import { NovaChat } from './components/NovaChat';
import { ProfileAndLab } from './components/ProfileAndLab';
import { CrononovaPanel } from './components/CrononovaPanel';
import { GamingOverlay } from './components/GamingOverlay';
import { WebTabViewport } from './components/WebTabViewport';

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'cosmic-dark',
    name: 'Cosmic Dark',
    accent: '#06B6D4',
    secondary: '#8B5CF6',
    background: '#07090E',
    surface: '#0D1320',
    fontDisplay: 'Chakra Petch',
    effectsIntensity: 75,
    starSpeed: 1.0,
    scanlines: true,
  },
  {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    accent: '#22D3EE',
    secondary: '#EC4899',
    background: '#060711',
    surface: '#110F24',
    fontDisplay: 'Chakra Petch',
    effectsIntensity: 95,
    starSpeed: 1.8,
    scanlines: true,
  },
  {
    id: 'galaxy-blue',
    name: 'Galaxy Blue',
    accent: '#3B82F6',
    secondary: '#38BDF8',
    background: '#050A14',
    surface: '#0B1528',
    fontDisplay: 'Plus Jakarta Sans',
    effectsIntensity: 70,
    starSpeed: 1.2,
    scanlines: false,
  },
  {
    id: 'phoenix-fire',
    name: 'Phoenix Fire',
    accent: '#F97316',
    secondary: '#EF4444',
    background: '#0D0707',
    surface: '#1A0F0E',
    fontDisplay: 'Chakra Petch',
    effectsIntensity: 85,
    starSpeed: 1.5,
    scanlines: true,
  },
];

const INITIAL_TABS: BrowserTab[] = [
  { id: 'tab-universe', title: 'Hyper Nova', kind: 'universe', color: '#06B6D4', url: 'hypernova://universe', pinned: true },
  { id: 'tab-novajolt', title: 'Nova Jolt', kind: 'novajolt', color: '#10B981', url: 'hypernova://nova-jolt' },
  { id: 'tab-youtube', title: 'YouTube', kind: 'web', color: '#EF4444', url: 'https://www.youtube.com/gaming', webPlatform: 'youtube' },
  { id: 'tab-discord', title: 'Discord', kind: 'web', color: '#8B5CF6', url: 'https://discord.com/app', webPlatform: 'discord' },
];

const INITIAL_TRACKS: TrackItem[] = [
  { id: 't1', title: 'Hyper Drive Protocol', artist: 'Nova Synth Collective', source: 'Spotify', durationSec: 214, bpm: 126, baseFreq: 110 },
  { id: 't2', title: 'Orbital Drift 2088', artist: 'Kaelen Beats', source: 'YouTube Music', durationSec: 192, bpm: 118, baseFreq: 130.81 },
  { id: 't3', title: 'Chrono Arena Boss', artist: 'Solaris Audio', source: 'Spotify', durationSec: 245, bpm: 138, baseFreq: 98 },
];

const INITIAL_SHIELD_LOGS: ShieldLogEntry[] = [
  { id: 's1', domain: 'ads.doubleclick-telemetry.net', category: 'Publicité', timestamp: '22:38:12', blocked: true },
  { id: 's2', domain: 'pixel.tracker-analytics.io', category: 'Traceur', timestamp: '22:39:04', blocked: true },
  { id: 's3', domain: 'login-steam-verify-gift.ru', category: 'Phishing', timestamp: '22:40:19', blocked: true },
  { id: 's4', domain: 'cdn-dropper.malicious-host.biz', category: 'Malware', timestamp: '22:41:02', blocked: true },
];

function computeRankTitle(level: number): string {
  if (level >= 60) return 'Nova Prime';
  if (level >= 35) return 'Chrono Knight';
  if (level >= 15) return 'Star Warrior';
  if (level >= 5) return 'Nova Pilot';
  if (level >= 1) return 'Nova Explorer';
  return 'Nova Recrue';
}

function xpRequiredForLevel(level: number): number {
  if (level <= 0) return 0;
  return level * 100 + level * (level - 1) * 25;
}

function computeLevelFromXp(xp: number): number {
  let lvl = 0;
  while (lvl < 200 && xp >= xpRequiredForLevel(lvl + 1)) {
    lvl++;
  }
  return lvl;
}

function createZeroProfile(name = 'EXPLORATEUR'): GamerProfile {
  return {
    name,
    rankTitle: 'Nova Recrue',
    level: 0,
    xp: 0,
    achievements: 0,
    badgesCount: 0,
    unlockedAchievements: [],
  };
}

export default function App() {
  const [tabs, setTabs] = useState<BrowserTab[]>(INITIAL_TABS);
  const [activeTabId, setActiveTabId] = useState<string>('tab-universe');
  const [tabHistory, setTabHistory] = useState<string[]>(['tab-universe']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [searchEngine, setSearchEngine] = useState<SearchEngine>('bing');

  const [hyperDrive, setHyperDrive] = useState(false);
  const [streamerMode, setStreamerMode] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [crononovaOpen, setCrononovaOpen] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(true);

  // Firebase Auth + Nova Chat Account Handle
  const [user, setUser] = useState<User | null>(null);
  const [myHandle, setMyHandle] = useState<ChatHandle | null>(null);
  const [handleLoading, setHandleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // GX Booster & Telemetry
  const [ramLimitGb, setRamLimitGb] = useState(8);
  const [cpuLimitPct, setCpuLimitPct] = useState(80);
  const [autoSuspend, setAutoSuspend] = useState(true);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>(() =>
    Array.from({ length: 24 }, (_, idx) => ({
      ts: Date.now() - (24 - idx) * 1000,
      fps: 144,
      ping: 12,
      ramGb: 3.5,
      cpu: 24,
      gpu: 43,
      netDownMbps: 420,
      netUpMbps: 85,
      cpuTemp: 54,
      gpuTemp: 61,
    }))
  );

  // Profile & Cloud (starts at 0 and grows as user explores & plays)
  const [profile, setProfile] = useState<GamerProfile>(() => {
    const saved = localStorage.getItem('hypernova_profile_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as GamerProfile;
        return {
          ...createZeroProfile(),
          ...parsed,
          unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
            ? parsed.unlockedAchievements
            : [],
        };
      } catch {
        // ignore
      }
    }
    return createZeroProfile();
  });

  const [savedThemes, setSavedThemes] = useState<ThemePreset[]>(() => {
    const saved = localStorage.getItem('hypernova_themes');
    if (saved) {
      try {
        return JSON.parse(saved) as ThemePreset[];
      } catch {
        // ignore
      }
    }
    return THEME_PRESETS;
  });

  const [theme, setTheme] = useState<ThemePreset>(() => {
    const saved = localStorage.getItem('hypernova_active_theme');
    if (saved) {
      try {
        return JSON.parse(saved) as ThemePreset;
      } catch {
        // ignore
      }
    }
    return THEME_PRESETS[0];
  });

  // Shield & Cloud
  const [shieldEnabled, setShieldEnabled] = useState(true);
  const [blockedCount, setBlockedCount] = useState(1428);
  const [shieldRules, setShieldRules] = useState({
    ads: true,
    trackers: true,
    malware: true,
    phishing: true,
  });
  const [shieldLogs] = useState<ShieldLogEntry[]>(INITIAL_SHIELD_LOGS);
  const [bookmarks] = useState([
    { title: 'Nova Universe', url: 'hypernova://universe' },
    { title: 'Nova Jolt (Jeux Indés)', url: 'hypernova://nova-jolt' },
    { title: 'YouTube Gaming', url: 'https://www.youtube.com/gaming' },
    { title: 'Discord Squad Alpha', url: 'https://discord.com/app' },
  ]);
  const [historyUrls, setHistoryUrls] = useState<string[]>([
    'hypernova://universe',
    'hypernova://nova-jolt',
    'https://www.youtube.com/gaming',
  ]);
  const [lastCloudSync, setLastCloudSync] = useState('Synchronisé à l’instant');

  // Media Center
  const [tracks, setTracks] = useState<TrackItem[]>(INITIAL_TRACKS);
  const [currentTrack, setCurrentTrack] = useState<TrackItem>(INITIAL_TRACKS[0]);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [eqBands, setEqBands] = useState<number[]>([2, 1, 0, 2, 3]);
  const [bassBoost, setBassBoost] = useState(false);
  const [spatialAudio, setSpatialAudio] = useState(true);
  const [nightcore, setNightcore] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [floatingMediaOpen, setFloatingMediaOpen] = useState(false);
  const localAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Crononova AI
  const [crononovaMode, setCrononovaMode] = useState('assistant');
  const [crononovaLoading, setCrononovaLoading] = useState(false);
  const [listeningTrigger, setListeningTrigger] = useState(0);
  const [crononovaMessages, setCrononovaMessages] = useState<CrononovaMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Système CRONONOVA prêt. Naviguez avec Bing/DuckDuckGo/Qwant dans Hyper Nova, discutez sur Nova Chat par ID, publiez des jeux sur Nova Jolt ou pilotez le navigateur à la voix.',
      timestamp: '22:41',
    },
  ]);

  const awardXp = useCallback((amount: number, achievementKey?: string) => {
    setProfile((prev) => {
      const unlocked = new Set(prev.unlockedAchievements || []);
      let bonusXp = 0;
      if (achievementKey && !unlocked.has(achievementKey)) {
        unlocked.add(achievementKey);
        bonusXp += 25;
      }
      const nextXp = prev.xp + amount + bonusXp;
      const nextLevel = computeLevelFromXp(nextXp);
      if (nextLevel >= 1) unlocked.add('level_1');
      if (nextLevel >= 5) unlocked.add('level_5');
      if (nextLevel >= 15) unlocked.add('level_15');

      const unlockedList = Array.from(unlocked);
      const updated: GamerProfile = {
        ...prev,
        xp: nextXp,
        level: nextLevel,
        rankTitle: computeRankTitle(nextLevel),
        achievements: unlockedList.length,
        badgesCount: unlockedList.length,
        unlockedAchievements: unlockedList,
      };
      localStorage.setItem('hypernova_profile_v2', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetProfileToZero = useCallback(() => {
    const freshName = myHandle?.displayName?.toUpperCase() || user?.displayName?.toUpperCase() || 'EXPLORATEUR';
    const fresh = createZeroProfile(freshName);
    setProfile(fresh);
    localStorage.setItem('hypernova_profile_v2', JSON.stringify(fresh));
  }, [myHandle, user]);

  // Boot Firestore connection test + Auth state listener
  useEffect(() => {
    testFirestoreConnection();
    getRedirectResult(auth).catch((err: { code?: string; message?: string }) => {
      if (err?.code === 'auth/unauthorized-domain') {
        setAuthError('UNAUTHORIZED_DOMAIN');
      } else if (err?.message) {
        setAuthError(err.message);
      }
    });
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setMyHandle(null);
        return;
      }
      setAuthError(null);
      setHandleLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'handles'), where('uid', '==', fbUser.uid), limit(1))
        );
        if (!snap.empty) {
          setMyHandle(snap.docs[0].data() as ChatHandle);
        } else {
          setMyHandle(null);
        }
      } catch (err) {
        console.error('Erreur chargement handle Nova Chat:', err);
        setAuthError(err instanceof Error ? err.message : 'Erreur de lecture du profil Nova Chat.');
      } finally {
        setHandleLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/unauthorized-domain') {
        setAuthError('UNAUTHORIZED_DOMAIN');
      } else if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr: unknown) {
          const rCode = (redirectErr as { code?: string })?.code || '';
          setAuthError(
            rCode === 'auth/unauthorized-domain'
              ? 'UNAUTHORIZED_DOMAIN'
              : 'Popup bloquée par le navigateur. Autorisez les popups ou réessayez via redirection.'
          );
        }
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('Fenêtre de connexion Google fermée avant validation. Réessayez.');
      } else {
        setAuthError(err instanceof Error ? err.message : 'Erreur de connexion Google.');
      }
    }
  };

  const handleSignInRedirect = async () => {
    setAuthError(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      setAuthError(
        code === 'auth/unauthorized-domain'
          ? 'UNAUTHORIZED_DOMAIN'
          : err instanceof Error
          ? err.message
          : 'Erreur de redirection Google.'
      );
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleRegisterHandle = async (handle: string, displayName: string, color: string) => {
    if (!user) throw new Error('Connexion requise.');
    const handleRef = doc(db, 'handles', handle);
    const existing = await getDoc(handleRef);
    if (existing.exists()) {
      throw new Error(`L’identifiant "@${handle}" est déjà pris. Choisissez un autre ID.`);
    }

    const privateRef = doc(db, `users/${user.uid}/private`, 'info');
    const batch = writeBatch(db);
    const handlePayload: ChatHandle = {
      uid: user.uid,
      handle,
      displayName,
      avatarColor: color,
      status: 'En ligne · Hyper Nova',
      isPublic: true,
    };

    batch.set(handleRef, {
      ...handlePayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(privateRef, {
      uid: user.uid,
      email: user.email || `${user.uid}@hypernova.local`,
      handle,
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
      setMyHandle(handlePayload);
      awardXp(40, 'social_pilot');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `handles/${handle}`);
    }
  };

  // Startup sound on first user interaction
  useEffect(() => {
    const onFirstClick = () => {
      soundEngine.playStartup();
      window.removeEventListener('pointerdown', onFirstClick);
    };
    window.addEventListener('pointerdown', onFirstClick, { once: true });
    return () => window.removeEventListener('pointerdown', onFirstClick);
  }, []);

  // Apply Theme CSS Variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--nova-accent', hyperDrive ? '#F43F5E' : theme.accent);
    root.style.setProperty('--nova-secondary', hyperDrive ? '#06B6D4' : theme.secondary);
    root.style.setProperty('--nova-bg', theme.background);
    root.style.setProperty('--nova-surface', theme.surface);
    root.style.setProperty('--nova-font-display', `"${theme.fontDisplay}", sans-serif`);
    localStorage.setItem('hypernova_active_theme', JSON.stringify(theme));
  }, [theme, hyperDrive]);

  // Live Telemetry Ticker (every 1.2s)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTelemetryHistory((prev) => {
        const last = prev[prev.length - 1];
        const activeTabsFactor = tabs.filter((t) => !t.suspended).length * 0.25;
        const targetRam = Math.min(ramLimitGb, Number((2.6 + activeTabsFactor + Math.random() * 0.4).toFixed(1)));
        const targetCpu = Math.min(
          cpuLimitPct,
          Math.max(12, Math.round((hyperDrive ? 38 : 22) + (Math.random() - 0.5) * 8))
        );
        const targetGpu = Math.min(96, Math.max(25, Math.round((hyperDrive ? 68 : 42) + (Math.random() - 0.5) * 9)));
        const next: TelemetryPoint = {
          ts: Date.now(),
          fps: Math.max(95, Math.min(240, Math.round((hyperDrive ? 185 : 144) + (Math.random() - 0.5) * 14))),
          ping: Math.max(7, Math.min(34, Math.round(12 + (Math.random() - 0.5) * 5))),
          ramGb: targetRam,
          cpu: targetCpu,
          gpu: targetGpu,
          netDownMbps: Math.max(180, Math.round((last?.netDownMbps || 420) + (Math.random() - 0.5) * 90)),
          netUpMbps: Math.max(40, Math.round(85 + (Math.random() - 0.5) * 20)),
          cpuTemp: Math.round(52 + targetCpu * 0.16),
          gpuTemp: Math.round(55 + targetGpu * 0.18),
        };
        return [...prev.slice(-29), next];
      });

      if (shieldEnabled && Math.random() > 0.72) {
        setBlockedCount((c) => c + 1);
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [tabs, ramLimitGb, cpuLimitPct, hyperDrive, shieldEnabled]);

  const selectTab = useCallback((id: string) => {
    soundEngine.playTabSwitch();
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, suspended: false } : t)));
    setActiveTabId(id);
    setTabHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      if (sliced[sliced.length - 1] === id) return prev;
      const next = [...sliced, id];
      setHistoryIndex(next.length - 1);
      return next;
    });
  }, [historyIndex]);

  const openOrFocusModule = useCallback(
    (kind: ModuleKind, customTitle?: string) => {
      soundEngine.playClick();
      const existing = tabs.find((t) => t.kind === kind && kind !== 'web' && kind !== 'webapp');
      if (existing) {
        selectTab(existing.id);
        return;
      }
      const metaMap: Record<ModuleKind, { title: string; color: string; url: string }> = {
        universe: { title: 'Nova Universe', color: '#06B6D4', url: 'hypernova://universe' },
        gaming: { title: 'Gaming Hub', color: '#38BDF8', url: 'hypernova://gaming-hub' },
        novajolt: { title: 'Nova Jolt', color: '#10B981', url: 'hypernova://nova-jolt' },
        telemetry: { title: 'GX Booster & Stats', color: '#22D3EE', url: 'hypernova://telemetry' },
        media: { title: 'Media Center', color: '#10B981', url: 'hypernova://media' },
        chat: { title: 'Nova Chat', color: '#8B5CF6', url: 'hypernova://chat' },
        profile: { title: 'Profil & Niveaux', color: '#F59E0B', url: 'hypernova://profile' },
        themelab: { title: 'Theme Lab', color: '#EC4899', url: 'hypernova://theme-lab' },
        shield: { title: 'Nova Shield', color: '#10B981', url: 'hypernova://shield' },
        cloud: { title: 'Nova Cloud', color: '#3B82F6', url: 'hypernova://cloud' },
        web: { title: customTitle || 'Web', color: '#06B6D4', url: 'https://hypernova.space' },
        webapp: { title: customTitle || 'App Live', color: '#22D3EE', url: 'hypernova://live-app' },
      };
      const meta = metaMap[kind];
      const newTab: BrowserTab = {
        id: `tab-${kind}-${Date.now()}`,
        title: customTitle || meta.title,
        kind,
        color: meta.color,
        url: meta.url,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setHistoryUrls((prev) => [meta.url, ...prev.slice(0, 14)]);
      awardXp(10);
    },
    [tabs, selectTab, awardXp]
  );

  const openWebPortal = useCallback(
    (platform: 'youtube' | 'discord' | 'spotify', title: string, color: string) => {
      soundEngine.playClick();
      const existing = tabs.find((t) => t.webPlatform === platform);
      if (existing) {
        selectTab(existing.id);
        return;
      }
      const urls = {
        youtube: 'https://www.youtube.com/gaming',
        discord: 'https://discord.com/app',
        spotify: 'https://open.spotify.com',
      };
      const newTab: BrowserTab = {
        id: `tab-${platform}-${Date.now()}`,
        title,
        kind: 'web',
        color,
        url: urls[platform],
        webPlatform: platform,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setHistoryUrls((prev) => [newTab.url, ...prev.slice(0, 14)]);
      awardXp(10);
    },
    [tabs, selectTab, awardXp]
  );

  const openSearchTab = useCallback(
    (
      queryText: string,
      engine: SearchEngine,
      category: SearchCategory = 'web',
      inPlace = false
    ) => {
      soundEngine.playClick();
      setSearchEngine(engine);
      const cleanQuery = queryText.trim();
      const engineColors: Record<SearchEngine, string> = {
        bing: '#00A4EF',
        duckduckgo: '#DE5833',
        qwant: '#8B5CF6',
      };
      const engineLabels: Record<SearchEngine, string> = {
        bing: 'Bing',
        duckduckgo: 'DuckDuckGo',
        qwant: 'Qwant',
      };
      const engineUrls: Record<SearchEngine, string> = {
        bing: cleanQuery
          ? `https://www.bing.com/search?q=${encodeURIComponent(cleanQuery)}`
          : 'https://www.bing.com',
        duckduckgo: cleanQuery
          ? `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`
          : 'https://duckduckgo.com',
        qwant: cleanQuery
          ? `https://www.qwant.com/?q=${encodeURIComponent(cleanQuery)}`
          : 'https://www.qwant.com',
      };

      const nextTitle = cleanQuery
        ? `${engineLabels[engine]} : ${cleanQuery}`
        : `${engineLabels[engine]} — Accueil`;
      const nextUrl = engineUrls[engine];

      if (inPlace) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  title: nextTitle,
                  kind: 'web',
                  color: engineColors[engine],
                  url: nextUrl,
                  webPlatform: undefined,
                  searchQuery: cleanQuery,
                  searchEngine: engine,
                  searchCategory: category,
                }
              : t
          )
        );
      } else {
        const newTab: BrowserTab = {
          id: `tab-search-${Date.now()}`,
          title: nextTitle,
          kind: 'web',
          color: engineColors[engine],
          url: nextUrl,
          searchQuery: cleanQuery,
          searchEngine: engine,
          searchCategory: category,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
      }

      setHistoryUrls((prev) => [nextUrl, ...prev.slice(0, 14)]);
      if (cleanQuery) {
        awardXp(15, 'explore_web');
      } else {
        awardXp(5);
      }
    },
    [activeTabId, awardXp]
  );

  const openUrlInTab = useCallback(
    (url: string) => {
      soundEngine.playClick();
      const formatted = url.startsWith('http') ? url : `https://${url}`;
      const newTab: BrowserTab = {
        id: `tab-url-${Date.now()}`,
        title: formatted.replace(/^https?:\/\//, '').split('/')[0],
        kind: 'web',
        color: theme.accent,
        url: formatted,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setHistoryUrls((prev) => [formatted, ...prev.slice(0, 14)]);
      awardXp(15, 'explore_web');
    },
    [theme.accent, awardXp]
  );

  const navigateInTab = useCallback(
    (tabId: string, url: string) => {
      soundEngine.playClick();
      const formatted = url.startsWith('http') ? url : `https://${url}`;
      let host = formatted;
      try {
        host = new URL(formatted).hostname;
      } catch {
        // keep formatted
      }
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                kind: 'web',
                url: formatted,
                title: host,
                searchQuery: undefined,
                searchEngine: undefined,
                searchCategory: undefined,
                webPlatform: undefined,
              }
            : t
        )
      );
      setHistoryUrls((prev) => [formatted, ...prev.slice(0, 14)]);
      awardXp(10, 'explore_web');
    },
    [awardXp]
  );

  const openHtmlAppTab = useCallback(
    (title: string, htmlCode: string, iframeUrl?: string) => {
      soundEngine.playClick();
      const newTab: BrowserTab = {
        id: `tab-app-${Date.now()}`,
        title,
        kind: 'webapp',
        color: '#22D3EE',
        url: `hypernova://play/${title.toLowerCase().replace(/\s+/g, '-')}`,
        htmlContent: htmlCode || undefined,
        iframeUrl: iframeUrl || undefined,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      awardXp(25, 'play_game');
    },
    [awardXp]
  );

  const closeTab = (id: string) => {
    soundEngine.playClick();
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((t) => t.id === id);
      const nextTabs = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        const fallback = nextTabs[Math.max(0, idx - 1)] || nextTabs[0];
        setActiveTabId(fallback.id);
      }
      return nextTabs;
    });
  };

  const handleToggleHyperDrive = (forceState?: boolean) => {
    const next = typeof forceState === 'boolean' ? forceState : !hyperDrive;
    setHyperDrive(next);
    soundEngine.playHyperDrive(next);
    if (next) awardXp(50, 'hyper_drive');
  };

  const startTrackPlayback = (track: TrackItem, nc = nightcore, sp = spatialAudio) => {
    soundEngine.stopSynthTrack();
    if (track.objectUrl && localAudioRef.current) {
      localAudioRef.current.src = track.objectUrl;
      soundEngine.attachAudioElement(localAudioRef.current);
      localAudioRef.current.play().catch(() => {});
    } else {
      soundEngine.startSynthTrack(track.baseFreq, track.bpm, nc, sp);
    }
    setIsPlayingMusic(true);
  };

  const handleTogglePlayMusic = () => {
    if (isPlayingMusic) {
      soundEngine.stopSynthTrack();
      setIsPlayingMusic(false);
    } else {
      startTrackPlayback(currentTrack);
    }
  };

  const handleSelectTrack = (track: TrackItem) => {
    setCurrentTrack(track);
    startTrackPlayback(track);
  };

  const handleUploadLocalMp3 = (file: File) => {
    const url = URL.createObjectURL(file);
    const newTrack: TrackItem = {
      id: `local-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: 'Fichier Audio Local',
      source: 'MP3 Local',
      durationSec: 180,
      bpm: 120,
      baseFreq: 110,
      objectUrl: url,
    };
    setTracks((prev) => [newTrack, ...prev]);
    setCurrentTrack(newTrack);
    startTrackPlayback(newTrack);
  };

  const executeCrononovaActions = (actions: CrononovaAction[]) => {
    actions.forEach((act) => {
      const args = act.args || {};
      switch (act.name) {
        case 'open_tab': {
          const target = String(args.target || '').toLowerCase();
          if (target.includes('youtube')) openWebPortal('youtube', 'YouTube', '#EF4444');
          else if (target.includes('discord')) openWebPortal('discord', 'Discord', '#8B5CF6');
          else if (target.includes('spotify')) openWebPortal('spotify', 'Spotify', '#10B981');
          else if (target.includes('novajolt') || target.includes('gamejolt')) openOrFocusModule('novajolt');
          else if (target.includes('gaming')) openOrFocusModule('gaming');
          else if (target.includes('telemetry') || target.includes('booster')) openOrFocusModule('telemetry');
          else if (target.includes('media')) openOrFocusModule('media');
          else if (target.includes('chat')) openOrFocusModule('chat');
          else if (target.includes('profile')) openOrFocusModule('profile');
          else if (target.includes('theme')) openOrFocusModule('themelab');
          else if (target.includes('cloud')) openOrFocusModule('cloud');
          else if (target.includes('universe')) openOrFocusModule('universe');
          else openUrlInTab(String(args.target || 'https://example.com'));
          break;
        }
        case 'toggle_hyper_drive':
          handleToggleHyperDrive(Boolean(args.enabled));
          break;
        case 'toggle_streamer_mode':
          setStreamerMode(Boolean(args.enabled));
          break;
        case 'run_gx_booster':
          if (typeof args.ramLimitGb === 'number') {
            setRamLimitGb(Math.max(2, Math.min(8, args.ramLimitGb)));
          }
          setTabs((prev) =>
            prev.map((t) => (t.id === activeTabId || t.pinned ? t : { ...t, suspended: true }))
          );
          awardXp(25, 'gx_booster');
          break;
        case 'launch_game_platform':
          openOrFocusModule('gaming');
          awardXp(25, 'play_game');
          break;
        case 'apply_theme_preset': {
          const name = String(args.presetName || '').toLowerCase();
          const match = savedThemes.find((t) => t.name.toLowerCase().includes(name));
          if (match) setTheme(match);
          break;
        }
        case 'create_web_app': {
          const htmlCode = String(args.htmlCode || '');
          const title = String(args.title || 'App Crononova');
          if (htmlCode) openHtmlAppTab(title, htmlCode);
          break;
        }
      }
    });
  };

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const handleSendCrononova = async (promptText: string, modeOverride?: string) => {
    const modeToUse = modeOverride || crononovaMode;
    if (modeOverride) setCrononovaMode(modeOverride);
    setCrononovaOpen(true);
    soundEngine.playAiAlert();

    const userMsg: CrononovaMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      mode: modeToUse,
    };

    setCrononovaMessages((prev) => [...prev, userMsg]);
    setCrononovaLoading(true);

    try {
      const activeContext = activeTab
        ? `Onglet actif: "${activeTab.title}" (${activeTab.url}), type: ${activeTab.kind}.`
        : '';

      const res = await fetch('/api/crononova', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          mode: modeToUse,
          activePageContext: activeContext,
          hyperDrive,
          history: crononovaMessages.slice(-6).map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      const rawText = await res.text();
      let data: {
        error?: string;
        text?: string;
        actions?: CrononovaAction[];
        sources?: Array<{ uri: string; title: string }>;
      };
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Réponse Crononova invalide (HTTP ${res.status}).`);
      }
      if (!res.ok) {
        throw new Error(data.error || 'Erreur serveur Crononova');
      }

      if (Array.isArray(data.actions) && data.actions.length > 0) {
        executeCrononovaActions(data.actions);
      }

      const aiMsg: CrononovaMessage = {
        id: `a-${Date.now()}`,
        role: 'model',
        text: data.text || 'Opération terminée.',
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        actions: data.actions,
        sources: data.sources,
      };

      setCrononovaMessages((prev) => [...prev, aiMsg]);
      awardXp(20, 'ai_commander');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Impossible de joindre Crononova.';
      setCrononovaMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: message,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          error: true,
        },
      ]);
    } finally {
      setCrononovaLoading(false);
    }
  };

  const handleNavigateOmnibox = (input: string) => {
    soundEngine.playClick();
    const low = input.toLowerCase();
    if (low === 'hypernova://universe' || low === 'universe') return openOrFocusModule('universe');
    if (low === 'hypernova://gaming-hub' || low === 'gaming') return openOrFocusModule('gaming');
    if (low === 'hypernova://nova-jolt' || low === 'novajolt' || low === 'gamejolt') return openOrFocusModule('novajolt');
    if (low === 'hypernova://telemetry' || low === 'booster') return openOrFocusModule('telemetry');
    if (low === 'hypernova://media' || low === 'media') return openOrFocusModule('media');
    if (low === 'hypernova://chat' || low === 'chat') return openOrFocusModule('chat');
    if (low === 'hypernova://profile' || low === 'profil') return openOrFocusModule('profile');
    if (low === 'hypernova://theme-lab' || low === 'themes') return openOrFocusModule('themelab');
    if (low === 'hypernova://shield' || low === 'shield') return openOrFocusModule('shield');
    if (low === 'hypernova://cloud' || low === 'cloud') return openOrFocusModule('cloud');
    if (low === 'youtube' || low === 'youtube.com') return openWebPortal('youtube', 'YouTube', '#EF4444');
    if (low === 'discord' || low === 'discord.com') return openWebPortal('discord', 'Discord', '#8B5CF6');
    if (low === 'spotify' || low === 'spotify.com') return openWebPortal('spotify', 'Spotify', '#10B981');

    if (low === 'bing' || low === 'bing.com' || low === 'https://www.bing.com') {
      return openSearchTab('', 'bing');
    }
    if (
      low === 'duckduckgo' ||
      low === 'duckduckgo.com' ||
      low === 'ddg' ||
      low === 'duky' ||
      low === 'https://duckduckgo.com'
    ) {
      return openSearchTab('', 'duckduckgo');
    }
    if (low === 'qwant' || low === 'qwant.com' || low === 'https://www.qwant.com') {
      return openSearchTab('', 'qwant');
    }

    if (input.startsWith('http://') || input.startsWith('https://') || (!input.includes(' ') && input.includes('.'))) {
      openUrlInTab(input);
      return;
    }

    openSearchTab(input, searchEngine);
  };

  const latestTelemetry = telemetryHistory[telemetryHistory.length - 1];

  const SIDEBAR_MODULES: Array<{ kind: ModuleKind; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { kind: 'universe', label: 'Universe', icon: Compass },
    { kind: 'gaming', label: 'Gaming Hub', icon: Gamepad2 },
    { kind: 'novajolt', label: 'Nova Jolt', icon: Store },
    { kind: 'telemetry', label: 'GX Booster', icon: Activity },
    { kind: 'media', label: 'Media', icon: Music },
    { kind: 'chat', label: 'Nova Chat', icon: MessageSquare },
    { kind: 'profile', label: 'Profil', icon: UserIcon },
    { kind: 'themelab', label: 'Theme Lab', icon: Palette },
    { kind: 'shield', label: 'Shield', icon: Shield },
    { kind: 'cloud', label: 'Cloud', icon: Cloud },
  ];

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden relative ${
        hyperDrive ? 'hyper-drive-active' : ''
      }`}
      style={{
        backgroundColor: theme.background,
        fontFamily: 'var(--nova-font-body)',
      }}
    >
      <StarfieldCanvas
        hyperDrive={hyperDrive}
        speedMultiplier={theme.starSpeed}
        accentColor={hyperDrive ? '#F43F5E' : theme.accent}
        secondaryColor={hyperDrive ? '#06B6D4' : theme.secondary}
      />

      <audio ref={localAudioRef} className="hidden" />

      {/* Top Browser Chrome */}
      <BrowserChrome
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={selectTab}
        onCloseTab={closeTab}
        onNewTab={() => openOrFocusModule('universe')}
        onNavigateOmnibox={handleNavigateOmnibox}
        searchEngine={searchEngine}
        onChangeSearchEngine={setSearchEngine}
        onBack={() => {
          if (historyIndex > 0) {
            const nextIdx = historyIndex - 1;
            setHistoryIndex(nextIdx);
            setActiveTabId(tabHistory[nextIdx]);
          }
        }}
        onForward={() => {
          if (historyIndex < tabHistory.length - 1) {
            const nextIdx = historyIndex + 1;
            setHistoryIndex(nextIdx);
            setActiveTabId(tabHistory[nextIdx]);
          }
        }}
        onReload={() => soundEngine.playTabSwitch()}
        canBack={historyIndex > 0}
        canForward={historyIndex < tabHistory.length - 1}
        shieldEnabled={shieldEnabled}
        blockedCount={blockedCount}
        onToggleShield={() => {
          soundEngine.playClick();
          openOrFocusModule('shield');
        }}
        streamerMode={streamerMode}
        onToggleStreamerMode={() => {
          soundEngine.playClick();
          setStreamerMode((s) => !s);
        }}
        overlayOpen={overlayOpen}
        onToggleOverlay={() => {
          soundEngine.playClick();
          setOverlayOpen((o) => !o);
        }}
        crononovaOpen={crononovaOpen}
        onToggleCrononova={() => {
          soundEngine.playClick();
          setCrononovaOpen((c) => !c);
        }}
        sfxEnabled={sfxEnabled}
        onToggleSfx={() => {
          const next = !sfxEnabled;
          setSfxEnabled(next);
          soundEngine.setSfxEnabled(next);
        }}
        hyperDrive={hyperDrive}
        onToggleHyperDrive={() => handleToggleHyperDrive()}
      />

      {/* Main Station Workspace */}
      <div className="relative z-10 flex-1 flex min-h-0 overflow-hidden">
        {/* Compact Left Command Rail */}
        <nav
          aria-label="Navigation des modules Hyper Nova"
          className="w-16 shrink-0 border-r border-slate-800/80 bg-[#080C15]/90 backdrop-blur-md flex flex-col items-center py-3 gap-1.5 overflow-y-auto"
        >
          {SIDEBAR_MODULES.map((mod) => {
            const Icon = mod.icon;
            const isActive = activeTab?.kind === mod.kind;
            return (
              <button
                key={mod.kind}
                type="button"
                onClick={() => openOrFocusModule(mod.kind)}
                title={mod.label}
                className={`w-12 py-2 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none truncate max-w-[44px]">
                  {mod.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Active Tab Content Stage */}
        <main className="flex-1 min-w-0 h-full overflow-hidden bg-[#07090E]/60 backdrop-blur-[2px]">
          {activeTab?.kind === 'universe' && (
            <NovaUniverse
              profile={
                myHandle
                  ? { ...profile, name: myHandle.displayName.toUpperCase() }
                  : user?.displayName
                  ? { ...profile, name: user.displayName.toUpperCase() }
                  : profile
              }
              latest={latestTelemetry}
              hyperDrive={hyperDrive}
              searchEngine={searchEngine}
              onChangeSearchEngine={setSearchEngine}
              onOpenModule={openOrFocusModule}
              onOpenWebPortal={openWebPortal}
              onRunSearch={(q, eng) => {
                const low = q.toLowerCase().trim();
                if (low === 'bing' || low === 'bing.com') return openSearchTab('', 'bing');
                if (low === 'duckduckgo' || low === 'duckduckgo.com' || low === 'ddg' || low === 'duky') {
                  return openSearchTab('', 'duckduckgo');
                }
                if (low === 'qwant' || low === 'qwant.com') return openSearchTab('', 'qwant');
                if (low.startsWith('crononova') || low.includes('ouvre ') || low.includes('active ')) {
                  handleSendCrononova(q, 'assistant');
                } else if (q.startsWith('http://') || q.startsWith('https://') || (!q.includes(' ') && q.includes('.'))) {
                  openUrlInTab(q);
                } else {
                  openSearchTab(q, eng);
                }
              }}
              onOpenSearchEngine={(eng) => openSearchTab('', eng)}
              onTriggerVoice={() => {
                setCrononovaOpen(true);
                setListeningTrigger((n) => n + 1);
              }}
            />
          )}

          {activeTab?.kind === 'gaming' && (
            <GamingHub
              latest={latestTelemetry}
              streamerMode={streamerMode}
              onLaunchPlatform={(platform) => {
                soundEngine.playClick();
                setOverlayOpen(true);
                awardXp(30, 'play_game');
                console.info(`Launched ${platform}`);
              }}
              onAskCrononova={(p, m) => handleSendCrononova(p, m)}
            />
          )}

          {activeTab?.kind === 'novajolt' && (
            <NovaJolt
              user={user}
              myHandle={myHandle}
              onSignIn={handleSignIn}
              onOpenChatModule={() => openOrFocusModule('chat')}
              onLaunchHtmlGame={(title, code) => openHtmlAppTab(title, code)}
              onLaunchPackageGame={(title, iframeUrl) => openHtmlAppTab(title, '', iframeUrl)}
              onAwardXp={awardXp}
            />
          )}

          {activeTab?.kind === 'telemetry' && (
            <TelemetryAndBooster
              history={telemetryHistory}
              latest={latestTelemetry}
              ramLimitGb={ramLimitGb}
              cpuLimitPct={cpuLimitPct}
              autoSuspend={autoSuspend}
              onChangeRamLimit={setRamLimitGb}
              onChangeCpuLimit={setCpuLimitPct}
              onToggleAutoSuspend={() => setAutoSuspend((a) => !a)}
              onSuspendIdleTabs={() => {
                let count = 0;
                setTabs((prev) =>
                  prev.map((t) => {
                    if (t.id !== activeTabId && !t.pinned && !t.suspended) {
                      count++;
                      return { ...t, suspended: true };
                    }
                    return t;
                  })
                );
                if (count > 0) awardXp(15, 'gx_booster');
                return count;
              }}
              onCleanCache={() => {
                soundEngine.playClick();
                awardXp(20, 'gx_booster');
              }}
            />
          )}

          {activeTab?.kind === 'media' && (
            <MediaCenter
              tracks={tracks}
              currentTrack={currentTrack}
              isPlaying={isPlayingMusic}
              eqBands={eqBands}
              bassBoost={bassBoost}
              spatialAudio={spatialAudio}
              nightcore={nightcore}
              volume={volume}
              floatingOpen={floatingMediaOpen}
              onTogglePlay={handleTogglePlayMusic}
              onSelectTrack={handleSelectTrack}
              onNextTrack={() => {
                const idx = tracks.findIndex((t) => t.id === currentTrack.id);
                const next = tracks[(idx + 1) % tracks.length];
                handleSelectTrack(next);
              }}
              onPrevTrack={() => {
                const idx = tracks.findIndex((t) => t.id === currentTrack.id);
                const prev = tracks[(idx - 1 + tracks.length) % tracks.length];
                handleSelectTrack(prev);
              }}
              onChangeEqBand={(idx, val) => {
                setEqBands((prev) => prev.map((v, i) => (i === idx ? val : v)));
                soundEngine.setEqBand(idx, val);
              }}
              onToggleBassBoost={() => {
                const next = !bassBoost;
                setBassBoost(next);
                soundEngine.setBassBoost(next);
              }}
              onToggleSpatial={() => {
                const next = !spatialAudio;
                setSpatialAudio(next);
                if (isPlayingMusic && !currentTrack.objectUrl) {
                  startTrackPlayback(currentTrack, nightcore, next);
                }
              }}
              onToggleNightcore={() => {
                const next = !nightcore;
                setNightcore(next);
                if (isPlayingMusic && !currentTrack.objectUrl) {
                  startTrackPlayback(currentTrack, next, spatialAudio);
                }
              }}
              onChangeVolume={(val) => {
                setVolume(val);
                soundEngine.setVolume(val);
              }}
              onToggleFloating={() => setFloatingMediaOpen((f) => !f)}
              onUploadLocalMp3={handleUploadLocalMp3}
            />
          )}

          {activeTab?.kind === 'chat' && (
            <NovaChat
              user={user}
              myHandle={myHandle}
              handleLoading={handleLoading}
              authError={authError}
              streamerMode={streamerMode}
              onSignIn={handleSignIn}
              onSignInRedirect={handleSignInRedirect}
              onSignOut={handleSignOut}
              onRegisterHandle={handleRegisterHandle}
              onAwardXp={awardXp}
            />
          )}

          {(activeTab?.kind === 'profile' ||
            activeTab?.kind === 'themelab' ||
            activeTab?.kind === 'shield' ||
            activeTab?.kind === 'cloud') && (
            <ProfileAndLab
              key={activeTab.kind}
              initialSection={activeTab.kind}
              profile={
                myHandle
                  ? { ...profile, name: myHandle.displayName.toUpperCase() }
                  : user?.displayName
                  ? { ...profile, name: user.displayName.toUpperCase() }
                  : profile
              }
              userEmail={user?.email}
              streamerMode={streamerMode}
              theme={theme}
              savedThemes={savedThemes}
              shieldEnabled={shieldEnabled}
              shieldRules={shieldRules}
              shieldLogs={shieldLogs}
              bookmarks={bookmarks}
              historyUrls={historyUrls}
              lastCloudSync={lastCloudSync}
              onUpdateTheme={(next) => setTheme(next)}
              onSaveCustomTheme={(preset) => {
                const updated = [...savedThemes, preset];
                setSavedThemes(updated);
                setTheme(preset);
                localStorage.setItem('hypernova_themes', JSON.stringify(updated));
                awardXp(30, 'theme_artist');
              }}
              onToggleShield={() => setShieldEnabled((s) => !s)}
              onToggleShieldRule={(k) =>
                setShieldRules((prev) => ({ ...prev, [k]: !prev[k] }))
              }
              onSyncCloud={() => {
                localStorage.setItem('hypernova_themes', JSON.stringify(savedThemes));
                localStorage.setItem('hypernova_profile_v2', JSON.stringify(profile));
                setLastCloudSync(
                  new Date().toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                );
                awardXp(20, 'cloud_sync');
              }}
              onResetProfile={resetProfileToZero}
            />
          )}

          {(activeTab?.kind === 'web' || activeTab?.kind === 'webapp') && (
            <WebTabViewport
              tab={activeTab}
              shieldEnabled={shieldEnabled}
              onNavigateUrl={openUrlInTab}
              onNavigateInTab={(url) => navigateInTab(activeTab.id, url)}
              onSearchWithEngine={openSearchTab}
              onAskCrononova={(p, m) => handleSendCrononova(p, m)}
            />
          )}
        </main>

        {/* Right CRONONOVA AI Drawer */}
        <CrononovaPanel
          open={crononovaOpen}
          hyperDrive={hyperDrive}
          messages={crononovaMessages}
          loading={crononovaLoading}
          activeMode={crononovaMode}
          listeningTrigger={listeningTrigger}
          onChangeMode={setCrononovaMode}
          onSendPrompt={handleSendCrononova}
          onClose={() => setCrononovaOpen(false)}
        />
      </div>

      {/* Floating Gaming Overlay HUD */}
      {overlayOpen && (
        <GamingOverlay
          latest={latestTelemetry}
          streamerMode={streamerMode}
          currentTrackTitle={currentTrack.title}
          isPlayingMusic={isPlayingMusic}
          onClose={() => setOverlayOpen(false)}
        />
      )}

      {/* Floating Media Center PiP Window */}
      {floatingMediaOpen && (
        <FloatingMediaWidget
          track={currentTrack}
          isPlaying={isPlayingMusic}
          onTogglePlay={handleTogglePlayMusic}
          onNext={() => {
            const idx = tracks.findIndex((t) => t.id === currentTrack.id);
            handleSelectTrack(tracks[(idx + 1) % tracks.length]);
          }}
          onClose={() => setFloatingMediaOpen(false)}
        />
      )}
    </div>
  );
}
