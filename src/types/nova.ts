export type ModuleKind =
  | 'universe'
  | 'gaming'
  | 'novajolt'
  | 'telemetry'
  | 'media'
  | 'chat'
  | 'profile'
  | 'auth'
  | 'themelab'
  | 'shield'
  | 'cloud'
  | 'web'
  | 'webapp';

export type SearchEngine = 'bing' | 'duckduckgo' | 'qwant';
export type SearchCategory = 'web' | 'images' | 'news' | 'videos';

export interface BrowserTab {
  id: string;
  title: string;
  kind: ModuleKind;
  color: string;
  url: string;
  suspended?: boolean;
  pinned?: boolean;
  htmlContent?: string;
  iframeUrl?: string;
  webPlatform?: 'youtube' | 'discord' | 'spotify' | 'custom';
  searchQuery?: string;
  searchEngine?: SearchEngine;
  searchCategory?: SearchCategory;
}

export interface TelemetryPoint {
  ts: number;
  fps: number;
  ping: number;
  ramGb: number;
  cpu: number;
  gpu: number;
  netDownMbps: number;
  netUpMbps: number;
  cpuTemp: number;
  gpuTemp: number;
}

export interface ThemePreset {
  id: string;
  name: string;
  accent: string;
  secondary: string;
  background: string;
  surface: string;
  fontDisplay: 'Chakra Petch' | 'Plus Jakarta Sans' | 'JetBrains Mono';
  effectsIntensity: number;
  starSpeed: number;
  scanlines: boolean;
}

export interface ShieldLogEntry {
  id: string;
  domain: string;
  category: 'Publicité' | 'Traceur' | 'Malware' | 'Phishing';
  timestamp: string;
  blocked: boolean;
}

export interface ChatHandle {
  uid: string;
  handle: string;
  displayName: string;
  avatarColor: string;
  status: string;
  isPublic: boolean;
}

export interface ContactEntry {
  ownerUid: string;
  contactUid: string;
  contactHandle: string;
  displayName: string;
  avatarColor: string;
  category: 'private' | 'squad';
}

export interface DirectMessageRoom {
  id: string;
  participants: string[];
  participantHandles: string[];
  lastMessage: string;
}

export interface ChatMessageItem {
  id: string;
  senderUid: string;
  senderHandle: string;
  avatarColor: string;
  text: string;
  time: string;
  emojiReaction?: string;
}

export interface IndieGame {
  id: string;
  title: string;
  tagline: string;
  description: string;
  genre: 'Action' | 'Sci-Fi' | 'RPG' | 'Puzzle' | 'Arcade' | 'Course';
  playType: 'html5_code' | 'file_bundle' | 'web_url' | 'download_url';
  gameUrl: string;
  htmlCode: string;
  packageId?: string;
  entryFile?: string;
  filesCount?: number;
  totalSizeBytes?: number;
  filesPreview?: string;
  coverTheme: string;
  authorUid: string;
  authorHandle: string;
  likesCount: number;
  playsCount: number;
  isPublic: boolean;
}

export interface GameComment {
  id: string;
  authorUid: string;
  authorHandle: string;
  text: string;
  time: string;
}

export interface CrononovaAction {
  name: string;
  args: Record<string, unknown>;
}

export interface CrononovaSource {
  uri: string;
  title: string;
}

export interface CrononovaMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  mode?: string;
  actions?: CrononovaAction[];
  sources?: CrononovaSource[];
  error?: boolean;
}

export interface TrackItem {
  id: string;
  title: string;
  artist: string;
  source: 'Spotify' | 'YouTube Music' | 'MP3 Local';
  durationSec: number;
  bpm: number;
  baseFreq: number;
  objectUrl?: string;
}

export interface GamerProfile {
  name: string;
  rankTitle: string;
  level: number;
  xp: number;
  achievements: number;
  badgesCount: number;
  unlockedAchievements?: string[];
  avatarUrl?: string;
}
