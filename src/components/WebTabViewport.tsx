import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  ShieldCheck,
  Globe,
  Code2,
  Search,
  ArrowRight,
  RotateCw,
  FileText,
  ArrowLeft,
  Image as ImageIcon,
  Newspaper,
  Video,
  Sparkles,
  Lock,
  X,
  Play,
} from 'lucide-react';
import { BrowserTab, SearchCategory, SearchEngine } from '../types/nova';

interface WebTabViewportProps {
  tab: BrowserTab;
  shieldEnabled: boolean;
  onNavigateUrl: (url: string) => void;
  onNavigateInTab: (url: string) => void;
  onSearchWithEngine: (
    query: string,
    engine: SearchEngine,
    category?: SearchCategory,
    inPlace?: boolean
  ) => void;
  onAskCrononova: (prompt: string, mode: string) => void;
}

interface SearchResultItem {
  title: string;
  url: string;
  domain: string;
  snippet?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  source?: string;
}

interface KnowledgeCardData {
  title: string;
  description: string;
  imageUrl?: string;
  url: string;
  source: string;
}

interface BrowsePageData {
  url: string;
  title: string;
  description: string;
  paragraphs: string[];
  links: Array<{ text: string; url: string }>;
}

const ENGINE_META: Record<
  SearchEngine,
  {
    label: string;
    shortTag: string;
    color: string;
    borderAccent: string;
    homeUrl: string;
    tagline: string;
    externalSearchUrl: (q: string) => string;
    proxySearchUrl: (q: string) => string;
    supportsLiveProxy: boolean;
  }
> = {
  bing: {
    label: 'Bing',
    shortTag: 'Microsoft Bing',
    color: '#00A4EF',
    borderAccent: 'border-cyan-500/50',
    homeUrl: 'https://www.bing.com',
    tagline: 'Découverte Web, Images & Actualités · Compatible Vue Live Bing',
    externalSearchUrl: (q) =>
      q ? `https://www.bing.com/search?q=${encodeURIComponent(q)}` : 'https://www.bing.com',
    proxySearchUrl: (q) =>
      q ? `https://www.bing.com/search?q=${encodeURIComponent(q)}` : 'https://www.bing.com',
    supportsLiveProxy: true,
  },
  duckduckgo: {
    label: 'DuckDuckGo',
    shortTag: 'Confidentialité · Zéro pistage',
    color: '#DE5833',
    borderAccent: 'border-orange-500/50',
    homeUrl: 'https://duckduckgo.com',
    tagline: 'Navigation privée sans pistage publicitaire · Protégé par Nova Shield',
    externalSearchUrl: (q) =>
      q ? `https://duckduckgo.com/?q=${encodeURIComponent(q)}` : 'https://duckduckgo.com',
    proxySearchUrl: (q) =>
      q
        ? `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`
        : 'https://lite.duckduckgo.com/lite/',
    supportsLiveProxy: true,
  },
  qwant: {
    label: 'Qwant',
    shortTag: 'Moteur Européen Privé',
    color: '#8B5CF6',
    borderAccent: 'border-violet-500/50',
    homeUrl: 'https://www.qwant.com',
    tagline: 'Le moteur de recherche qui respecte votre vie privée',
    externalSearchUrl: (q) =>
      q ? `https://www.qwant.com/?q=${encodeURIComponent(q)}` : 'https://www.qwant.com',
    proxySearchUrl: (q) =>
      q ? `https://www.qwant.com/?q=${encodeURIComponent(q)}` : 'https://www.qwant.com',
    supportsLiveProxy: false,
  },
};

const QUICK_TRENDING_SEARCHES = [
  'Minecraft mods',
  'Valorant patch notes',
  'Steam soldes',
  'Actualités jeux vidéo',
  'Blender 3D tutoriel',
  'SpaceX Starship',
];

const EngineWordmark: React.FC<{ engine: SearchEngine; large?: boolean }> = ({ engine, large }) => {
  const sizeCls = large ? 'text-4xl sm:text-5xl' : 'text-xl';
  if (engine === 'bing') {
    return (
      <span className={`inline-flex items-center gap-2 font-sans font-bold tracking-tight select-none ${sizeCls}`}>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={large ? 'w-9 h-9' : 'w-5 h-5'}
          fill="none"
        >
          <path d="M5 3L9.5 4.6V15.7L15.8 12.1L12.7 10.6L14.4 6.8L20 9.4V13.8L9.5 19.9L5 17.4V3Z" fill="#00A4EF" />
        </svg>
        <span className="text-slate-100">Bing</span>
      </span>
    );
  }
  if (engine === 'duckduckgo') {
    return (
      <span className={`inline-flex items-center gap-2 font-sans font-bold tracking-tight select-none ${sizeCls}`}>
        <span
          className={`inline-flex items-center justify-center rounded-full bg-[#DE5833] text-white font-black ${
            large ? 'w-11 h-11 text-xl' : 'w-6 h-6 text-xs'
          }`}
        >
          D
        </span>
        <span className="text-slate-100">
          Duck<span className="text-[#DE5833]">DuckGo</span>
        </span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2 font-sans font-bold tracking-tight select-none ${sizeCls}`}>
      <span
        className={`inline-flex items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-500 text-white font-black ${
          large ? 'w-10 h-10 text-xl' : 'w-6 h-6 text-xs'
        }`}
      >
        Q
      </span>
      <span className="text-slate-100">
        Q<span className="text-violet-400">want</span>
      </span>
    </span>
  );
};

export const WebTabViewport: React.FC<WebTabViewportProps> = ({
  tab,
  shieldEnabled,
  onNavigateUrl,
  onNavigateInTab,
  onSearchWithEngine,
  onAskCrononova,
}) => {
  const [showSource, setShowSource] = useState(false);

  // Search tab state
  const [searchDisplayMode, setSearchDisplayMode] = useState<'nova' | 'live'>('nova');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSummary, setSearchSummary] = useState('');
  const [knowledgeCard, setKnowledgeCard] = useState<KnowledgeCardData | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [inlineQuery, setInlineQuery] = useState(tab.searchQuery || '');

  // Web URL proxy/reader/iframe state
  const [viewMode, setViewMode] = useState<'proxy' | 'reader' | 'iframe'>('proxy');
  const [pageLoading, setPageLoading] = useState(false);
  const [pageData, setPageData] = useState<BrowsePageData | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [urlBackStack, setUrlBackStack] = useState<string[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const proxyIframeRef = React.useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setInlineQuery(tab.searchQuery || '');
    setSearchDisplayMode('nova');
  }, [tab.id, tab.searchEngine, tab.searchQuery]);

  // Listen for link clicks / form submissions inside proxied websites
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!proxyIframeRef.current || event.source !== proxyIframeRef.current.contentWindow) return;
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type === 'hypernova-proxy-navigate' && typeof data.url === 'string') {
        if (tab.url.startsWith('http')) {
          setUrlBackStack((prev) => [...prev.slice(-19), tab.url]);
        }
        onNavigateInTab(data.url);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [tab.url, onNavigateInTab]);

  // Fetch search results when tab has searchEngine and non-empty searchQuery
  useEffect(() => {
    const queryText = (tab.searchQuery || '').trim();
    if (!tab.searchEngine || !queryText) {
      setSearchResults([]);
      setSearchSummary('');
      setKnowledgeCard(null);
      setSearchError(null);
      return;
    }

    const activeCategory: SearchCategory = tab.searchCategory || 'web';
    let cancelled = false;
    setSearchLoading(true);
    setSearchError(null);

    fetch('/api/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: queryText,
        engine: tab.searchEngine,
        category: activeCategory,
      }),
    })
      .then(async (res) => {
        const rawText = await res.text();
        let data: {
          error?: string;
          summary?: string;
          knowledgeCard?: KnowledgeCardData | null;
          results?: SearchResultItem[];
        } | null = null;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error(`Réponse serveur invalide (HTTP ${res.status}).`);
        }
        if (!res.ok) throw new Error(data?.error || 'Erreur de recherche');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setSearchSummary(data?.summary || '');
        setKnowledgeCard(data?.knowledgeCard || null);
        setSearchResults(Array.isArray(data?.results) ? data.results : []);
      })
      .catch(async (err: unknown) => {
        if (cancelled) return;
        // Client-side CORS fallback via Wikipedia API if backend search endpoint is unreachable
        try {
          const wikiRes = await fetch(
            `https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
              queryText
            )}&gsrlimit=6&prop=pageimages|extracts|info&inprop=url&pithumbsize=480&exintro=1&explaintext=1&exsentences=3&format=json&origin=*`
          );
          if (wikiRes.ok) {
            const wikiRaw = await wikiRes.text();
            const wikiJson = JSON.parse(wikiRaw) as {
              query?: {
                pages?: Record<
                  string,
                  {
                    index?: number;
                    title?: string;
                    extract?: string;
                    fullurl?: string;
                    thumbnail?: { source?: string };
                  }
                >;
              };
            };
            const pages = Object.values(wikiJson.query?.pages || {}).sort(
              (a, b) => (a.index ?? 99) - (b.index ?? 99)
            );
            if (!cancelled && pages.length > 0) {
              const fallbackItems: SearchResultItem[] = pages
                .filter((p) => p.fullurl)
                .map((p) => ({
                  title: `${p.title || queryText} — Wikipédia`,
                  url: p.fullurl!,
                  domain: 'fr.wikipedia.org',
                  snippet: p.extract,
                  thumbnailUrl: p.thumbnail?.source,
                  imageUrl: p.thumbnail?.source,
                }));
              setSearchResults(fallbackItems);
              setSearchSummary(pages[0]?.extract || '');
              setKnowledgeCard(
                pages[0]?.fullurl && pages[0]?.extract
                  ? {
                      title: pages[0].title || queryText,
                      description: pages[0].extract,
                      imageUrl: pages[0].thumbnail?.source,
                      url: pages[0].fullurl,
                      source: 'Wikipédia (FR)',
                    }
                  : null
              );
              return;
            }
          }
        } catch {
          // ignore fallback error and show original message
        }
        if (!cancelled) {
          setSearchError(err instanceof Error ? err.message : 'Recherche indisponible');
        }
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab.id, tab.searchQuery, tab.searchEngine, tab.searchCategory]);

  // Fetch web page via text reader API when reader mode is selected
  useEffect(() => {
    if (tab.kind !== 'web' || tab.searchEngine || tab.webPlatform) return;
    if (viewMode !== 'reader' || !tab.url.startsWith('http')) return;

    let cancelled = false;
    setPageLoading(true);
    setPageError(null);

    fetch(`/api/browse?url=${encodeURIComponent(tab.url)}`)
      .then(async (res) => {
        const rawText = await res.text();
        let data: BrowsePageData & { error?: string };
        try {
          data = JSON.parse(rawText) as BrowsePageData & { error?: string };
        } catch {
          throw new Error(`Réponse serveur invalide (HTTP ${res.status}).`);
        }
        if (!res.ok) throw new Error(data.error || 'Chargement impossible');
        return data;
      })
      .then((data) => {
        if (!cancelled) setPageData(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setPageError(err instanceof Error ? err.message : 'Erreur de chargement');
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab.id, tab.url, tab.kind, tab.searchEngine, tab.webPlatform, viewMode, reloadTick]);

  // 1. Live AI-generated or Nova Jolt HTML5/JS micro-site/game
  if (tab.kind === 'webapp' && (tab.htmlContent || tab.iframeUrl)) {
    return (
      <div className="flex flex-col h-full bg-[#080B12]">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-[#0C111C] text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span className="font-medium">{tab.title}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">
              {tab.iframeUrl ? 'Dossier / Fichiers Nova Jolt' : 'Exécution Sandbox Hyper Nova'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {tab.iframeUrl && (
              <a
                href={tab.iframeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1 rounded border border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-400/60 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Plein écran</span>
              </a>
            )}
            {tab.htmlContent && (
              <button
                type="button"
                onClick={() => setShowSource((prev) => !prev)}
                className="px-3 py-1 rounded border border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-400/60 transition-colors"
              >
                {showSource ? 'Voir le rendu' : 'Voir le code source'}
              </button>
            )}
          </div>
        </div>
        {showSource && tab.htmlContent ? (
          <pre className="flex-1 overflow-auto p-5 text-xs font-mono-tabular text-cyan-200 bg-[#05070C] leading-relaxed">
            <code>{tab.htmlContent}</code>
          </pre>
        ) : tab.iframeUrl ? (
          <iframe
            title={tab.title}
            src={tab.iframeUrl}
            sandbox="allow-scripts allow-forms allow-same-origin"
            className="flex-1 w-full bg-white border-0"
          />
        ) : (
          <iframe
            title={tab.title}
            srcDoc={tab.htmlContent}
            sandbox="allow-scripts allow-forms"
            className="flex-1 w-full bg-white border-0"
          />
        )}
      </div>
    );
  }

  // 2. Engine-Authentic Portal & Search Results (Bing / DuckDuckGo / Qwant inside Hyper Nova)
  if (tab.searchEngine) {
    const engine: SearchEngine = ENGINE_META[tab.searchEngine] ? tab.searchEngine : 'bing';
    const meta = ENGINE_META[engine];
    const queryText = (tab.searchQuery || '').trim();
    const activeCategory: SearchCategory = tab.searchCategory || 'web';
    const showLiveProxy = searchDisplayMode === 'live' && meta.supportsLiveProxy;
    const liveProxySrc = `/api/proxy?url=${encodeURIComponent(meta.proxySearchUrl(queryText))}`;

    // Engine Home Portal when no query yet
    if (!queryText && !showLiveProxy) {
      return (
        <div className="h-full flex flex-col bg-[#080B12] overflow-y-auto">
          {/* Top Engine Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-slate-800/70 bg-[#0B101B]/80">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{meta.shortTag}</span>
              <span>·</span>
              <span className="text-emerald-400">
                {shieldEnabled ? 'Nova Shield Actif' : 'Shield off'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['bing', 'duckduckgo', 'qwant'] as SearchEngine[]).map((eng) => (
                <button
                  key={eng}
                  type="button"
                  onClick={() => onSearchWithEngine('', eng, 'web', true)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    engine === eng
                      ? 'text-slate-950 font-bold'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                  style={engine === eng ? { backgroundColor: ENGINE_META[eng].color } : undefined}
                >
                  {ENGINE_META[eng].label}
                </button>
              ))}
              {meta.supportsLiveProxy && (
                <button
                  type="button"
                  onClick={() => setSearchDisplayMode('live')}
                  className="px-3 py-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                >
                  Ouvrir {meta.label} Live
                </button>
              )}
            </div>
          </div>

          {/* Centered Classic Search Engine Home */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
            <div className="w-full max-w-2xl flex flex-col items-center space-y-7">
              <div className="text-center space-y-2">
                <EngineWordmark engine={engine} large />
                <p className="text-xs text-slate-400">{meta.tagline}</p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inlineQuery.trim()) {
                    onSearchWithEngine(inlineQuery.trim(), engine, 'web', true);
                  }
                }}
                className="w-full space-y-4"
              >
                <div
                  className={`flex items-center gap-3 h-12 px-5 rounded-full border bg-[#0E1525] shadow-lg focus-within:ring-2 transition-all ${meta.borderAccent}`}
                >
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    value={inlineQuery}
                    onChange={(e) => setInlineQuery(e.target.value)}
                    placeholder={`Rechercher sur ${meta.label} dans Hyper Nova...`}
                    className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                  {inlineQuery && (
                    <button
                      type="button"
                      onClick={() => setInlineQuery('')}
                      className="text-slate-400 hover:text-slate-200"
                      aria-label="Effacer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-md text-xs font-semibold text-slate-950 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: meta.color }}
                  >
                    Recherche {meta.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const pick =
                        inlineQuery.trim() ||
                        QUICK_TRENDING_SEARCHES[
                          Math.floor(Math.random() * QUICK_TRENDING_SEARCHES.length)
                        ];
                      onSearchWithEngine(pick, engine, 'web', true);
                    }}
                    className="px-5 py-2.5 rounded-md border border-slate-700 bg-[#0E1525] text-xs font-medium text-slate-200 hover:border-slate-500 transition-colors"
                  >
                    Explorer un sujet
                  </button>
                </div>
              </form>

              <div className="w-full pt-4">
                <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-slate-500 text-center mb-3">
                  Recherches populaires
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {QUICK_TRENDING_SEARCHES.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => onSearchWithEngine(suggestion, engine, 'web', true)}
                      className="px-3 py-1.5 rounded-full border border-slate-800 bg-[#0D1320] text-xs text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const categories: Array<{ id: SearchCategory; label: string; icon: React.ComponentType<{ className?: string }> }> = [
      { id: 'web', label: 'Tout', icon: Search },
      { id: 'images', label: 'Images', icon: ImageIcon },
      { id: 'news', label: 'Actualités', icon: Newspaper },
      { id: 'videos', label: 'Vidéos', icon: Video },
    ];

    return (
      <div className="h-full flex flex-col bg-[#080B12]">
        {/* Engine Header (Bing / DuckDuckGo / Qwant look inside Hyper Nova) */}
        <div className="px-3 sm:px-5 pt-3.5 pb-0 border-b border-slate-800 bg-[#0B101B]">
          <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pb-3">
            <div className="flex items-center gap-2.5 sm:gap-4 flex-1 min-w-0 w-full md:w-auto md:min-w-[260px]">
              <button
                type="button"
                onClick={() => onSearchWithEngine('', engine, 'web', true)}
                className="shrink-0 hover:opacity-85 transition-opacity"
                title={`Accueil ${meta.label}`}
              >
                <EngineWordmark engine={engine} />
              </button>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inlineQuery.trim()) {
                    onSearchWithEngine(inlineQuery.trim(), engine, activeCategory, true);
                  }
                }}
                className="flex items-center gap-2 flex-1 max-w-2xl"
              >
                <div
                  className={`flex items-center gap-2 flex-1 h-10 px-4 rounded-full border bg-[#060910] focus-within:ring-1 transition-all ${meta.borderAccent}`}
                >
                  <input
                    type="text"
                    value={inlineQuery}
                    onChange={(e) => setInlineQuery(e.target.value)}
                    placeholder={`Rechercher sur ${meta.label}...`}
                    className="w-full bg-transparent text-sm text-slate-100 focus:outline-none"
                  />
                  {inlineQuery && (
                    <button
                      type="button"
                      onClick={() => setInlineQuery('')}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="p-1.5 rounded-full hover:bg-slate-800 transition-colors"
                    style={{ color: meta.color }}
                    aria-label="Lancer la recherche"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {meta.supportsLiveProxy && (
                <div className="flex items-center rounded-full border border-slate-800 bg-[#060910] p-0.5 mr-1">
                  <button
                    type="button"
                    onClick={() => setSearchDisplayMode('nova')}
                    className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                      searchDisplayMode === 'nova'
                        ? 'bg-cyan-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Hyper Nova
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchDisplayMode('live')}
                    className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                      searchDisplayMode === 'live'
                        ? 'bg-cyan-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Site Live {meta.label}
                  </button>
                </div>
              )}

              {(['bing', 'duckduckgo', 'qwant'] as SearchEngine[]).map((eng) => (
                <button
                  key={eng}
                  type="button"
                  onClick={() =>
                    onSearchWithEngine(
                      inlineQuery.trim() || queryText,
                      eng,
                      activeCategory,
                      true
                    )
                  }
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    engine === eng
                      ? 'text-slate-950 font-bold'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                  style={engine === eng ? { backgroundColor: ENGINE_META[eng].color } : undefined}
                >
                  {ENGINE_META[eng].label}
                </button>
              ))}

              <a
                href={meta.externalSearchUrl(queryText)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-700 text-xs text-slate-300 hover:text-white"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Externe</span>
              </a>
            </div>
          </div>

          {/* Search Category Tabs (Tout / Images / Actualités / Vidéos) */}
          {!showLiveProxy && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const active = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => onSearchWithEngine(queryText, engine, cat.id, true)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                        active
                          ? 'text-slate-100'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                      style={active ? { borderColor: meta.color, color: meta.color } : undefined}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() =>
                  onAskCrononova(
                    `Synthétise et explique clairement les informations principales sur : ${queryText}`,
                    'search'
                  )
                }
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 mb-1 rounded-full border border-cyan-500/35 bg-cyan-500/10 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
              >
                <Sparkles className="w-3 h-3" />
                <span>Résumé Crononova IA</span>
              </button>
            </div>
          )}
        </div>

        {/* Viewport Body: Live Proxy Iframe OR Engine-Authentic Hyper Nova SERP */}
        {showLiveProxy ? (
          <iframe
            ref={proxyIframeRef}
            key={`${tab.id}-${liveProxySrc}`}
            title={`${meta.label} — ${queryText}`}
            src={liveProxySrc}
            sandbox="allow-scripts allow-forms allow-same-origin"
            className="flex-1 w-full bg-white border-0"
          />
        ) : (
          <div className="flex-1 overflow-y-auto px-3.5 sm:px-5 py-4 sm:py-6 lg:px-10">
            <div className="max-w-6xl mx-auto">
              {searchLoading ? (
                <div className="flex items-center gap-3 p-6 rounded-xl border border-slate-800 bg-[#0D1320] text-sm text-cyan-300">
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>
                    Recherche {meta.label} ({activeCategory}) pour « {queryText} »...
                  </span>
                </div>
              ) : searchError ? (
                <div className="p-6 rounded-xl border border-rose-500/40 bg-rose-500/10 text-sm text-rose-200">
                  {searchError}
                </div>
              ) : activeCategory === 'images' ? (
                <div className="space-y-4">
                  <div className="text-xs text-slate-400">
                    {searchResults.length} images trouvées sur {meta.label} pour « {queryText} »
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="p-6 rounded-xl border border-slate-800 bg-[#0D1320] text-xs text-slate-400">
                      Aucune image trouvée pour cette requête.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {searchResults.map((item, idx) => (
                        <button
                          key={`${item.imageUrl || item.url}-${idx}`}
                          type="button"
                          onClick={() => onNavigateInTab(item.url)}
                          className="group text-left rounded-xl border border-slate-800 bg-[#0D1320] overflow-hidden hover:border-cyan-400/60 transition-all"
                        >
                          <div className="aspect-video bg-slate-950 overflow-hidden">
                            <img
                              src={item.thumbnailUrl || item.imageUrl}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <div className="p-2.5 space-y-0.5">
                            <div className="text-xs font-medium text-slate-200 truncate">
                              {item.title}
                            </div>
                            <div className="text-[11px] font-mono-tabular text-slate-500 truncate">
                              {item.domain}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeCategory === 'videos' ? (
                <div className="space-y-4 max-w-4xl">
                  <div className="text-xs text-slate-400">
                    Vidéos trouvées via {meta.label} pour « {queryText} »
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="p-6 rounded-xl border border-slate-800 bg-[#0D1320] text-xs text-slate-400">
                      Aucune vidéo trouvée. Essayez un autre mot-clé.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {searchResults.map((item, idx) => (
                        <div
                          key={`${item.url}-${idx}`}
                          className="p-4 rounded-xl border border-slate-800 bg-[#0D1320] hover:border-slate-700 flex flex-col sm:flex-row gap-4 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => onNavigateInTab(item.url)}
                            className="relative w-full sm:w-52 aspect-video rounded-lg bg-slate-950 overflow-hidden shrink-0 group"
                          >
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500">
                                <Video className="w-8 h-8" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/15 transition-colors">
                              <span className="w-10 h-10 rounded-full bg-black/75 border border-white/25 flex items-center justify-center text-white">
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </span>
                            </div>
                          </button>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="text-xs font-mono-tabular text-slate-400 truncate">
                              {item.domain}
                            </div>
                            <button
                              type="button"
                              onClick={() => onNavigateInTab(item.url)}
                              className="text-left text-base font-semibold text-[#8AB4F8] hover:underline line-clamp-2"
                            >
                              {item.title}
                            </button>
                            {item.snippet && (
                              <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                                {item.snippet}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeCategory === 'news' ? (
                <div className="space-y-4 max-w-4xl">
                  <div className="text-xs text-slate-400">
                    Actualités {meta.label} pour « {queryText} »
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="p-6 rounded-xl border border-slate-800 bg-[#0D1320] text-xs text-slate-400">
                      Aucune actualité récente trouvée pour cette recherche.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {searchResults.map((item, idx) => (
                        <div
                          key={`${item.url}-${idx}`}
                          className="p-4 rounded-xl border border-slate-800 bg-[#0D1320] hover:border-slate-700 transition-colors space-y-1.5"
                        >
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="font-semibold text-emerald-400">
                              {item.source || item.domain}
                            </span>
                            {item.publishedAt && (
                              <>
                                <span>·</span>
                                <span className="font-mono-tabular text-[11px]">{item.publishedAt}</span>
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onNavigateInTab(item.url)}
                            className="text-left text-base font-semibold text-[#8AB4F8] hover:underline block"
                          >
                            {item.title}
                          </button>
                          {item.snippet && (
                            <p className="text-xs text-slate-300 leading-relaxed">{item.snippet}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Classic 'Tout' Web Search Results with Right Knowledge Panel */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-8 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <span>
                        Environ {searchResults.length} résultats sur {meta.label} pour « {queryText} »
                      </span>
                      {meta.supportsLiveProxy && (
                        <button
                          type="button"
                          onClick={() => setSearchDisplayMode('live')}
                          className="text-cyan-300 hover:underline font-medium"
                        >
                          Passer en vue {meta.label} Live →
                        </button>
                      )}
                    </div>

                    {searchResults.length === 0 ? (
                      <div className="p-6 rounded-xl border border-slate-800 bg-[#0D1320] text-xs text-slate-400">
                        Aucun résultat trouvé. Essayez des mots-clés plus généraux ou cliquez sur « Externe ».
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {searchResults.map((item, idx) => (
                          <article key={`${item.url}-${idx}`} className="group space-y-1.5">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-300 shrink-0 uppercase">
                                {item.domain.replace(/^www\./, '').charAt(0)}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs text-slate-200 truncate">
                                  {item.domain.replace(/^www\./, '')}
                                </div>
                                <div className="text-[11px] font-mono-tabular text-slate-500 truncate max-w-md">
                                  {item.url}
                                </div>
                              </div>
                            </div>

                            <div>
                              <button
                                type="button"
                                onClick={() => onNavigateInTab(item.url)}
                                className="text-left text-lg font-medium text-[#8AB4F8] hover:underline leading-snug"
                              >
                                {item.title}
                              </button>
                            </div>

                            {item.snippet && (
                              <p className="text-sm text-slate-300/90 leading-relaxed line-clamp-2 max-w-2xl">
                                {item.snippet}
                              </p>
                            )}

                            <div className="flex items-center gap-3 pt-0.5 text-[11px]">
                              <button
                                type="button"
                                onClick={() => onNavigateInTab(item.url)}
                                className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 font-medium"
                              >
                                <span>Ouvrir dans Hyper Nova</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-300"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Nouvel onglet</span>
                              </a>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Knowledge Card (Wikipedia / Summary) */}
                  <aside className="lg:col-span-4 space-y-4">
                    {knowledgeCard ? (
                      <div className="rounded-xl border border-slate-800 bg-[#0D1320] overflow-hidden">
                        {knowledgeCard.imageUrl && (
                          <div className="h-44 bg-slate-950 overflow-hidden">
                            <img
                              src={knowledgeCard.imageUrl}
                              alt={knowledgeCard.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-5 space-y-3">
                          <div>
                            <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-cyan-300">
                              Fiche Info · {knowledgeCard.source}
                            </div>
                            <h3 className="font-display text-xl font-bold text-slate-100 mt-1">
                              {knowledgeCard.title}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {knowledgeCard.description}
                          </p>
                          <button
                            type="button"
                            onClick={() => onNavigateInTab(knowledgeCard.url)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:underline"
                          >
                            <span>Lire l’article complet</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : searchSummary ? (
                      <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-2">
                        <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-cyan-300">
                          Aperçu Rapide · {meta.label}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {searchSummary}
                        </p>
                      </div>
                    ) : null}
                  </aside>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Curated Gaming Portals (YouTube, Discord, Spotify)
  const presets: Record<
    string,
    {
      label: string;
      accent: string;
      description: string;
      externalUrl: string;
      quickActions: Array<{ label: string; prompt: string; mode: string }>;
      highlights: Array<{ title: string; meta: string; targetUrl: string }>;
    }
  > = {
    youtube: {
      label: 'YouTube Gaming Station',
      accent: '#EF4444',
      description: 'Flux vidéo haute fréquence, tournois e-sport et guides de build optimisés sans publicité via Nova Shield.',
      externalUrl: 'https://www.youtube.com/gaming',
      quickActions: [
        { label: 'Résumer les tendances Gaming', prompt: 'Résume les principales actualités et sorties gaming du moment sur YouTube.', mode: 'search' },
        { label: 'Optimiser la latence vidéo', prompt: 'Donne 5 réglages navigateur et GPU pour réduire la latence en streaming vidéo 1440p 60fps.', mode: 'gaming' },
      ],
      highlights: [
        { title: 'Championship Finals · Replay Tactique 4K 60fps', meta: 'E-Sport · Nova Shield actif', targetUrl: 'https://www.youtube.com/gaming' },
        { title: 'Optimisation Shader & Latence Zéro — Guide Complet', meta: 'Hardware Lab · 1080p60', targetUrl: 'https://www.youtube.com' },
      ],
    },
    discord: {
      label: 'Discord Command Bridge',
      accent: '#8B5CF6',
      description: 'Passerelle vocale Squad Alpha, alertes serveurs communautaires et synchronisation overlay en jeu.',
      externalUrl: 'https://discord.com/app',
      quickActions: [
        { label: 'Préparer une annonce Raid', prompt: 'Rédige une annonce claire et motivante pour un raid Discord ce soir à 21h.', mode: 'assistant' },
      ],
      highlights: [
        { title: '#squad-nova-prime · Vocal actif', meta: 'Ping vocal 11 ms · Bitrate 96 kbps', targetUrl: 'https://discord.com/app' },
      ],
    },
    spotify: {
      label: 'Spotify Cyber Deck',
      accent: '#10B981',
      description: 'Mixes Synthwave, Focus Deep Space et bandes-son épiques synchronisés avec l’égaliseur du Media Center.',
      externalUrl: 'https://open.spotify.com',
      quickActions: [
        { label: 'Recommander une playlist Focus Gaming', prompt: 'Propose 8 titres synthwave et electro instrumentale parfaits pour une session gaming compétitive.', mode: 'search' },
      ],
      highlights: [
        { title: 'Hyper Drive Synthwave Protocol', meta: 'Playlist · 42 titres · 128 BPM', targetUrl: 'https://open.spotify.com' },
      ],
    },
  };

  const info = tab.webPlatform && presets[tab.webPlatform];

  if (info) {
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="rounded-xl border border-slate-800/90 bg-[#0D1320]/90 p-4 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-800/80">
            <div className="space-y-2 max-w-2xl min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-slate-400">
                <Globe className="w-4 h-4 shrink-0" style={{ color: info.accent }} />
                <span className="truncate max-w-[220px] sm:max-w-none">{tab.url}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {shieldEnabled ? 'Nova Shield Actif' : 'Shield en pause'}
                </span>
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-100">{info.label}</h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{info.description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onSearchWithEngine(tab.title, 'bing', 'web', false)}
                className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-md bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 transition-colors whitespace-nowrap"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Rechercher sur Bing</span>
              </button>
              <a
                href={info.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-md border border-slate-700 bg-slate-900 text-slate-200 text-xs font-medium hover:border-slate-500 transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Ouvrir le site officiel</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6">
            <div className="md:col-span-2 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Flux & Canaux rapides
              </h2>
              <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-lg bg-[#080C15]">
                {info.highlights.map((item) => (
                  <div key={item.title} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{item.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{item.meta}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAskCrononova(`Analyse et résume ce sujet : ${item.title}`, 'search')}
                      className="px-3 py-1.5 rounded border border-slate-700/80 text-xs text-cyan-300 hover:bg-cyan-500/10 transition-colors whitespace-nowrap"
                    >
                      Brief IA
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Actions Crononova
              </h2>
              <div className="space-y-2.5">
                {info.quickActions.map((qa) => (
                  <button
                    key={qa.label}
                    type="button"
                    onClick={() => onAskCrononova(qa.prompt, qa.mode)}
                    className="w-full text-left p-3.5 rounded-lg border border-slate-800 bg-[#080C15] hover:border-cyan-500/50 transition-colors"
                  >
                    <div className="text-xs font-semibold text-cyan-300">{qa.label}</div>
                    <div className="text-xs text-slate-400 mt-1 line-clamp-2">{qa.prompt}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. General Web Page Navigator (Live Proxy + Text Reader + Direct Iframe)
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(tab.url)}`;

  return (
    <div className="h-full flex flex-col bg-[#080B12]">
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 px-3 sm:px-5 py-2.5 border-b border-slate-800/80 bg-[#0C111C] text-xs">
        <div className="flex items-center gap-2 text-slate-300 min-w-0">
          {urlBackStack.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const prevUrl = urlBackStack[urlBackStack.length - 1];
                setUrlBackStack((s) => s.slice(0, -1));
                onNavigateInTab(prevUrl);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-400/50 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retour</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setReloadTick((n) => n + 1)}
            title="Recharger la page"
            className="p-1.5 rounded border border-slate-800 bg-slate-900 text-slate-300 hover:text-white shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-mono-tabular truncate max-w-[170px] sm:max-w-md">{tab.url}</span>
          <span className="text-emerald-400 shrink-0 hidden sm:inline">
            · {shieldEnabled ? 'Nova Shield Actif' : 'Shield off'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="flex items-center rounded-md border border-slate-800 bg-[#080C15] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('proxy')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                viewMode === 'proxy' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400'
              }`}
            >
              Site Live
            </button>
            <button
              type="button"
              onClick={() => setViewMode('reader')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                viewMode === 'reader' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400'
              }`}
            >
              Lecteur Texte
            </button>
            <button
              type="button"
              onClick={() => setViewMode('iframe')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                viewMode === 'iframe' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400'
              }`}
            >
              Iframe Direct
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              onAskCrononova(
                `Résume cette page web (${tab.url}) : ${pageData?.paragraphs.slice(0, 4).join(' ') || tab.title}`,
                'summarize'
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Résumer IA</span>
          </button>

          <a
            href={tab.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-700 text-slate-300 hover:text-white"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Externe</span>
          </a>
        </div>
      </div>

      {viewMode === 'proxy' ? (
        <iframe
          ref={proxyIframeRef}
          key={`${tab.id}-${tab.url}-${reloadTick}`}
          title={tab.title}
          src={proxyUrl}
          sandbox="allow-scripts allow-forms allow-same-origin"
          className="flex-1 w-full bg-white border-0"
        />
      ) : viewMode === 'iframe' ? (
        <iframe
          key={`${tab.id}-${tab.url}-${reloadTick}-direct`}
          title={tab.title}
          src={tab.url}
          className="flex-1 w-full bg-white border-0"
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
          {pageLoading ? (
            <div className="flex items-center gap-2 text-sm font-mono-tabular text-cyan-300">
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>Chargement sécurisé via Lecteur Texte...</span>
            </div>
          ) : pageError ? (
            <div className="p-6 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-3">
              <div className="text-sm font-semibold text-amber-200">
                Ce site bloque l’extraction directe ({pageError})
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setViewMode('proxy')}
                  className="px-3.5 py-2 rounded bg-cyan-500 text-slate-950 text-xs font-bold"
                >
                  Essayer Site Live
                </button>
                <a
                  href={tab.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded border border-slate-700 text-xs text-slate-200"
                >
                  Ouvrir dans un onglet externe
                </a>
              </div>
            </div>
          ) : pageData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-6 rounded-xl border border-slate-800 bg-[#0D1320] space-y-4">
                <h1 className="font-display text-2xl font-bold text-slate-100">
                  {pageData.title}
                </h1>
                {pageData.description && (
                  <p className="text-sm text-cyan-200/90 leading-relaxed">
                    {pageData.description}
                  </p>
                )}
                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  {pageData.paragraphs.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      Contenu textuel limité sur cette page (application dynamique JS). Utilisez le mode « Site Live » ou « Externe ».
                    </p>
                  ) : (
                    pageData.paragraphs.map((p, idx) => (
                      <p key={idx} className="text-sm text-slate-300 leading-relaxed">
                        {p}
                      </p>
                    ))
                  )}
                </div>
              </div>

              <div className="p-5 rounded-xl border border-slate-800 bg-[#0D1320] space-y-3 h-fit">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Liens de la page ({pageData.links.length})
                </h2>
                <div className="space-y-1.5 max-h-[460px] overflow-y-auto">
                  {pageData.links.map((lnk, idx) => (
                    <button
                      key={`${lnk.url}-${idx}`}
                      type="button"
                      onClick={() => onNavigateUrl(lnk.url)}
                      className="w-full text-left px-2.5 py-2 rounded border border-slate-800/80 bg-[#080C15] hover:border-cyan-500/40 text-xs text-cyan-300 truncate block transition-colors"
                    >
                      {lnk.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
