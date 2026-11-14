import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';

dotenv.config();

const GAME_UPLOADS_DIR = process.env.VERCEL
  ? '/tmp/.nova_uploads'
  : path.resolve(process.cwd(), '.nova_uploads');

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
};

function sanitizeRelativeFilePath(rawPath: string): string | null {
  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!normalized || normalized.includes('\0')) return null;
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0 || parts.length > 16) return null;
  for (const part of parts) {
    if (part === '.' || part === '..') return null;
  }
  const joined = parts.join('/');
  if (joined.length > 260) return null;
  return joined;
}

function getMimeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildStoreZipBuffer(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + size;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const browserControlFunctions: FunctionDeclaration[] = [
  {
    name: 'open_tab',
    description:
      'Ouvre un nouvel onglet ou bascule vers un module/site dans Hyper Nova Navigator (ex: YouTube, Discord, Spotify, Gaming Hub, Nova Jolt, Telemetry, Media Center, Nova Chat, Theme Lab, Profile, Nova Universe, ou une URL web).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        target: {
          type: Type.STRING,
          description:
            'Nom du site ou module à ouvrir: youtube, discord, spotify, universe, gaming, novajolt, telemetry, media, chat, profile, themelab, cloud, ou une URL complète.',
        },
        title: {
          type: Type.STRING,
          description: 'Titre lisible de l’onglet à afficher.',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'toggle_hyper_drive',
    description: 'Active ou désactive le mode ultime Hyper Drive du navigateur.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: 'true pour activer Hyper Drive, false pour désactiver.',
        },
      },
      required: ['enabled'],
    },
  },
  {
    name: 'toggle_streamer_mode',
    description: 'Active ou désactive le Mode Streamer pour masquer les notifications et messages privés.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        enabled: {
          type: Type.BOOLEAN,
          description: 'true pour activer le Mode Streamer, false pour désactiver.',
        },
      },
      required: ['enabled'],
    },
  },
  {
    name: 'run_gx_booster',
    description: 'Lance l’optimisation GX Booster Hyper Nova (nettoyage cache, suspension onglets inactifs, limite RAM/CPU).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ramLimitGb: {
          type: Type.NUMBER,
          description: 'Limite RAM optionnelle en Go (entre 2 et 8).',
        },
      },
    },
  },
  {
    name: 'launch_game_platform',
    description: 'Lance une plateforme ou un jeu via le Launcher intégré (Steam, Epic Games, Xbox, Riot Games, Battle.net, Ubisoft Connect).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        platform: {
          type: Type.STRING,
          description: 'Nom de la plateforme: Steam, Epic Games, Xbox, Riot Games, Battle.net, ou Ubisoft Connect.',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'apply_theme_preset',
    description: 'Applique un thème visuel du Hyper Nova Theme Lab.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        presetName: {
          type: Type.STRING,
          description: 'Nom du thème: Cosmic Dark, Cyber Neon, Galaxy Blue, ou Phoenix Fire.',
        },
      },
      required: ['presetName'],
    },
  },
  {
    name: 'create_web_app',
    description:
      'Crée et ouvre instantanément un mini-site ou une application HTML/CSS/JS interactive dans un nouvel onglet Aperçu Live du navigateur.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Nom du site ou de l’application créée.',
        },
        htmlCode: {
          type: Type.STRING,
          description: 'Code HTML complet et autonome (incluant <style> et <script> inline) prêt à être exécuté dans un iframe.',
        },
      },
      required: ['title', 'htmlCode'],
    },
  },
];

function isPublicHttpUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      host.endsWith('.local')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decodeXmlField(raw: string): string {
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const numericDecoded = withoutCdata
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
  return stripTags(numericDecoded);
}

interface WebSearchItem {
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

async function fetchBingRssSearch(query: string): Promise<WebSearchItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const rssUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss&mkt=fr-FR&setlang=fr`;
    const response = await fetch(rssUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const items: WebSearchItem[] = [];
    const seen = new Set<string>();
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 14) {
      const block = match[1];
      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
      const descMatch = block.match(/<description>([\s\S]*?)<\/description>/i);
      const url = linkMatch ? decodeXmlField(linkMatch[1]) : '';
      const parsed = isPublicHttpUrl(url);
      if (!parsed || seen.has(parsed.toString())) continue;
      seen.add(parsed.toString());
      const title = titleMatch ? decodeXmlField(titleMatch[1]) : parsed.hostname;
      const snippet = descMatch ? decodeXmlField(descMatch[1]) : '';
      items.push({
        title: title || parsed.hostname,
        url: parsed.toString(),
        domain: parsed.hostname,
        snippet: snippet || undefined,
      });
    }
    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBingNewsRss(query: string): Promise<WebSearchItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const rssUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=fr-FR&setlang=fr`;
    const response = await fetch(rssUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const items: WebSearchItem[] = [];
    const seen = new Set<string>();
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 14) {
      const block = match[1];
      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
      const descMatch = block.match(/<description>([\s\S]*?)<\/description>/i);
      const pubMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const sourceMatch = block.match(/<News:Source>([\s\S]*?)<\/News:Source>/i);

      let rawUrl = linkMatch ? decodeXmlField(linkMatch[1]) : '';
      try {
        const u = new URL(rawUrl);
        if (u.hostname.endsWith('bing.com') && u.searchParams.get('url')) {
          rawUrl = u.searchParams.get('url') || rawUrl;
        }
      } catch {
        // ignore URL unwrap errors
      }
      const parsed = isPublicHttpUrl(rawUrl);
      if (!parsed || seen.has(parsed.toString())) continue;
      seen.add(parsed.toString());

      const title = titleMatch ? decodeXmlField(titleMatch[1]) : parsed.hostname;
      const snippet = descMatch ? decodeXmlField(descMatch[1]) : '';
      const publishedAt = pubMatch ? decodeXmlField(pubMatch[1]) : undefined;
      const source = sourceMatch ? decodeXmlField(sourceMatch[1]) : parsed.hostname;

      items.push({
        title: title || parsed.hostname,
        url: parsed.toString(),
        domain: parsed.hostname,
        snippet: snippet || undefined,
        publishedAt,
        source,
      });
    }
    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBingImagesSearch(query: string): Promise<WebSearchItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const imgUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(imgUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    });
    if (!response.ok) return [];
    const html = await response.text();
    const items: WebSearchItem[] = [];
    const seen = new Set<string>();
    const matches = html.matchAll(/m="(\{&quot;[^"]+\})"/g);
    for (const m of matches) {
      if (items.length >= 18) break;
      const decoded = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      try {
        const obj = JSON.parse(decoded) as {
          murl?: string;
          turl?: string;
          purl?: string;
          t?: string;
        };
        const pageParsed = isPublicHttpUrl(obj.purl || obj.murl || '');
        const imgParsed = isPublicHttpUrl(obj.murl || '');
        const thumbParsed = isPublicHttpUrl(obj.turl || obj.murl || '');
        if (!pageParsed || !imgParsed || seen.has(imgParsed.toString())) continue;
        seen.add(imgParsed.toString());
        items.push({
          title: stripTags(obj.t || pageParsed.hostname) || pageParsed.hostname,
          url: pageParsed.toString(),
          domain: pageParsed.hostname,
          imageUrl: imgParsed.toString(),
          thumbnailUrl: thumbParsed ? thumbParsed.toString() : imgParsed.toString(),
        });
      } catch {
        // skip invalid json blob
      }
    }
    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function extractYouTubeThumb(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{6,20}$/.test(v)) {
        return `https://i.ytimg.com/vi/${v}/hqdefault.jpg`;
      }
    } else if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (id && /^[a-zA-Z0-9_-]{6,20}$/.test(id)) {
        return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function fetchBingVideoSearch(query: string): Promise<WebSearchItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const ytRes = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
      }
    );
    if (ytRes.ok) {
      const html = await ytRes.text();
      const items: WebSearchItem[] = [];
      const seenIds = new Set<string>();
      const rendererRegex =
        /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"[\s\S]*?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)+)"\}/g;
      let match: RegExpExecArray | null;
      while ((match = rendererRegex.exec(html)) !== null && items.length < 14) {
        const videoId = match[1];
        if (seenIds.has(videoId)) continue;
        seenIds.add(videoId);
        let decodedTitle = match[2];
        try {
          decodedTitle = JSON.parse(`"${match[2]}"`);
        } catch {
          // keep raw
        }
        items.push({
          title: decodedTitle,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          domain: 'youtube.com',
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          snippet: `Vidéo YouTube · ${decodedTitle}`,
        });
      }
      if (items.length > 0) return items;
    }
  } catch {
    // fallback to Bing RSS below
  } finally {
    clearTimeout(timeout);
  }

  const videoResults = await fetchBingRssSearch(`${query} video youtube`);
  return videoResults.map((item) => ({
    ...item,
    thumbnailUrl: extractYouTubeThumb(item.url),
  }));
}

async function fetchWikipediaData(query: string): Promise<{
  summary: string;
  links: WebSearchItem[];
  knowledgeCard?: KnowledgeCardData;
}> {
  for (const lang of ['fr', 'en']) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        query
      )}&gsrlimit=3&prop=pageimages|extracts|info&inprop=url&pithumbsize=480&exintro=1&explaintext=1&exsentences=4&format=json`;
      const res = await fetch(apiUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'HyperNovaNavigator/1.0' },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
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
      const pages = Object.values(data.query?.pages || {}).sort(
        (a, b) => (a.index ?? 99) - (b.index ?? 99)
      );
      if (pages.length === 0) continue;

      const links: WebSearchItem[] = [];
      for (const page of pages) {
        if (!page.fullurl) continue;
        const parsed = isPublicHttpUrl(page.fullurl);
        if (!parsed) continue;
        links.push({
          title: `${page.title || query} — Wikipédia`,
          url: parsed.toString(),
          domain: parsed.hostname,
          snippet: page.extract || undefined,
          thumbnailUrl: page.thumbnail?.source,
        });
      }

      const primary = pages[0];
      const primaryUrl = primary.fullurl && isPublicHttpUrl(primary.fullurl)?.toString();
      const summary = primary.extract || '';
      const knowledgeCard: KnowledgeCardData | undefined =
        primary.title && primaryUrl && summary
          ? {
              title: primary.title,
              description: summary,
              imageUrl: primary.thumbnail?.source,
              url: primaryUrl,
              source: `Wikipédia (${lang.toUpperCase()})`,
            }
          : undefined;

      return { summary, links, knowledgeCard };
    } catch {
      // try next language
    } finally {
      clearTimeout(timeout);
    }
  }
  return { summary: '', links: [] };
}

function isRetryableGeminiError(err: unknown): boolean {
  if (!err) return false;
  const text = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number; code?: number })?.status ?? (err as { code?: number })?.code;
  return (
    status === 429 ||
    status === 404 ||
    status === 503 ||
    text.includes('429') ||
    text.includes('404') ||
    text.includes('RESOURCE_EXHAUSTED') ||
    text.toLowerCase().includes('quota') ||
    text.toLowerCase().includes('not found')
  );
}

function buildFallbackCalculatorHtml(): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Calculatrice Hyper Nova</title>
<style>
  *{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}
  body{margin:0;min-height:100vh;background:radial-gradient(circle at top,#0f172a,#050811);color:#e2e8f0;display:flex;align-items:center;justify-content:center;padding:16px}
  .calc{width:100%;max-width:340px;background:#0b1120;border:1px solid rgba(34,211,238,.35);border-radius:16px;padding:18px;box-shadow:0 20px 50px rgba(6,182,212,.2)}
  .hud{font-size:11px;letter-spacing:.14em;color:#22d3ee;text-transform:uppercase;margin-bottom:10px;display:flex;justify-content:space-between}
  .screen{background:#050811;border:1px solid #1e293b;border-radius:10px;padding:14px;text-align:right;margin-bottom:14px}
  .expr{font-size:12px;color:#64748b;min-height:18px;word-break:break-all}
  .val{font-size:30px;font-weight:700;color:#f8fafc;margin-top:4px;overflow-x:auto}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  button{height:50px;border:1px solid #1e293b;border-radius:10px;background:#111827;color:#f1f5f9;font-size:16px;font-weight:600;cursor:pointer;transition:.15s}
  button:hover{border-color:#22d3ee;background:#162238}
  button.op{color:#22d3ee;background:#0c192c}
  button.eq{grid-column:span 2;background:linear-gradient(135deg,#06b6d4,#8b5cf6);color:#04101d;border:none;font-weight:700}
  button.clr{color:#fb7185}
</style>
</head>
<body>
<div class="calc">
  <div class="hud"><span>HYPER NOVA CALC</span><span>SYS READY</span></div>
  <div class="screen"><div class="expr" id="expr"></div><div class="val" id="val">0</div></div>
  <div class="grid">
    <button class="clr" onclick="clr()">C</button>
    <button class="op" onclick="del()">⌫</button>
    <button class="op" onclick="add('%')">%</button>
    <button class="op" onclick="add('/')">÷</button>
    <button onclick="add('7')">7</button><button onclick="add('8')">8</button><button onclick="add('9')">9</button>
    <button class="op" onclick="add('*')">×</button>
    <button onclick="add('4')">4</button><button onclick="add('5')">5</button><button onclick="add('6')">6</button>
    <button class="op" onclick="add('-')">−</button>
    <button onclick="add('1')">1</button><button onclick="add('2')">2</button><button onclick="add('3')">3</button>
    <button class="op" onclick="add('+')">+</button>
    <button onclick="add('0')">0</button><button onclick="add('.')">.</button>
    <button class="eq" onclick="eq()">=</button>
  </div>
</div>
<script>
  let cur = '';
  const exprEl = document.getElementById('expr');
  const valEl = document.getElementById('val');
  function render(res){ exprEl.textContent = cur; valEl.textContent = res ?? (cur || '0'); }
  function add(ch){ cur += ch; render(); }
  function clr(){ cur = ''; render('0'); }
  function del(){ cur = cur.slice(0,-1); render(); }
  function eq(){
    try{
      if(!/^[0-9+\\-*/.%()\\s]+$/.test(cur)) throw new Error();
      const out = Function('"use strict";return (' + cur + ')')();
      const str = Number.isFinite(out) ? String(Number(out.toFixed(8))) : 'Erreur';
      exprEl.textContent = cur + ' ='; cur = str === 'Erreur' ? '' : str; valEl.textContent = str;
    }catch{ valEl.textContent = 'Erreur'; }
  }
  window.addEventListener('keydown', (e) => {
    if(/^[0-9+\\-*/.%()]$/.test(e.key)) add(e.key);
    else if(e.key === 'Enter' || e.key === '=') eq();
    else if(e.key === 'Backspace') del();
    else if(e.key === 'Escape') clr();
  });
</script>
</body>
</html>`;
}

function buildFallbackMiniGameHtml(title: string): string {
  const safeTitle = title.replace(/[<>&"]/g, '');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${safeTitle}</title>
<style>
  body{margin:0;background:#050811;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:16px}
  .bar{display:flex;gap:16px;align-items:center;margin-bottom:10px;font-size:14px}
  canvas{background:#090f1e;border:1px solid rgba(34,211,238,.45);border-radius:12px;max-width:100%;touch-action:none}
  button{padding:6px 14px;border-radius:8px;border:none;background:#06b6d4;color:#04101d;font-weight:700;cursor:pointer}
</style>
</head>
<body>
<div class="bar"><strong>${safeTitle}</strong><span>Score : <b id="sc">0</b></span><button onclick="resetGame()">Rejouer</button></div>
<canvas id="c" width="520" height="360"></canvas>
<script>
  const c = document.getElementById('c'), ctx = c.getContext('2d'), sc = document.getElementById('sc');
  let score = 0, target = {x:260,y:180,r:22}, particles = [];
  function spawn(){ target = {x: 40 + Math.random()*(c.width-80), y: 40 + Math.random()*(c.height-80), r: 18 + Math.random()*12}; }
  function resetGame(){ score = 0; sc.textContent = '0'; spawn(); }
  c.addEventListener('pointerdown', (e) => {
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) * (c.width / r.width);
    const y = (e.clientY - r.top) * (c.height / r.height);
    if(Math.hypot(x-target.x, y-target.y) <= target.r + 6){
      score += 10; sc.textContent = String(score);
      for(let i=0;i<14;i++) particles.push({x:target.x,y:target.y,vx:(Math.random()-.5)*6,vy:(Math.random()-.5)*6,life:24});
      spawn();
    }
  });
  function loop(){
    ctx.fillStyle = 'rgba(9,15,30,0.35)'; ctx.fillRect(0,0,c.width,c.height);
    ctx.beginPath(); ctx.arc(target.x,target.y,target.r,0,Math.PI*2);
    ctx.fillStyle = '#06b6d4'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#f43f5e'; ctx.stroke();
    particles = particles.filter(p => p.life > 0);
    for(const p of particles){ p.x+=p.vx; p.y+=p.vy; p.life--; ctx.fillStyle='#22d3ee'; ctx.fillRect(p.x,p.y,3,3); }
    requestAnimationFrame(loop);
  }
  loop();
</script>
</body>
</html>`;
}

function buildFallbackCustomSiteHtml(topic: string): string {
  const safeTopic = topic.replace(/[<>&"]/g, '').slice(0, 80) || 'Station Hyper Nova';
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${safeTopic}</title>
<style>
  *{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}
  body{margin:0;min-height:100vh;background:linear-gradient(160deg,#050811,#0f172a);color:#e2e8f0;padding:28px}
  .wrap{max-width:760px;margin:0 auto}
  .badge{display:inline-block;padding:4px 10px;border:1px solid rgba(34,211,238,.45);border-radius:6px;color:#22d3ee;font-size:12px;margin-bottom:12px}
  h1{font-size:28px;margin:0 0 10px}
  p{color:#94a3b8;line-height:1.6}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:24px}
  .card{background:#0b1120;border:1px solid #1e293b;border-radius:12px;padding:16px}
  .card h3{margin:0 0 6px;color:#38bdf8;font-size:15px}
  button{margin-top:18px;padding:10px 18px;border-radius:8px;border:none;background:#06b6d4;color:#04101d;font-weight:700;cursor:pointer}
</style>
</head>
<body>
<div class="wrap">
  <div class="badge">CRONONOVA LIVE BUILDER</div>
  <h1>${safeTopic}</h1>
  <p>Application web interactive générée instantanément dans Hyper Nova Navigator.</p>
  <button onclick="document.getElementById('status').textContent='Système activé à '+new Date().toLocaleTimeString('fr-FR')">Tester l'interaction</button>
  <p id="status" style="color:#34d399;font-size:13px"></p>
  <div class="grid">
    <div class="card"><h3>Interface HUD</h3><p>Design sombre optimisé haute lisibilité.</p></div>
    <div class="card"><h3>Performance 60 FPS</h3><p>Exécution locale autonome sans latence.</p></div>
    <div class="card"><h3>Responsive</h3><p>Adapté mobile, tablette et ordinateur.</p></div>
  </div>
</div>
</body>
</html>`;
}

function tryLocalBrowserControlFallback(
  prompt: string,
  mode = 'assistant'
): { text: string; actions: Array<{ name: string; args: Record<string, unknown> }> } | null {
  const lower = prompt.toLowerCase().trim();

  // 1. Hyper Drive toggle
  if (lower.includes('hyper drive') || lower.includes('hyperdrive')) {
    const disable =
      lower.includes('désactive') ||
      lower.includes('desactive') ||
      lower.includes('stop') ||
      lower.includes('off') ||
      lower.includes('coupe');
    return {
      text: disable
        ? 'Hyper Drive désactivé dans Hyper Nova Navigator.'
        : 'Hyper Drive activé ! Performances visuelles et télémétrie en surrégime.',
      actions: [{ name: 'toggle_hyper_drive', args: { enabled: !disable } }],
    };
  }

  // 2. Streamer mode toggle
  if (lower.includes('streamer')) {
    const disable =
      lower.includes('désactive') || lower.includes('desactive') || lower.includes('off') || lower.includes('stop');
    return {
      text: disable
        ? 'Mode Streamer désactivé.'
        : 'Mode Streamer activé : notifications et messages privés masqués.',
      actions: [{ name: 'toggle_streamer_mode', args: { enabled: !disable } }],
    };
  }

  // 3. GX Booster / RAM / Cache optimization
  if (
    lower.includes('gx booster') ||
    (lower.includes('optimise') && (lower.includes('ram') || lower.includes('pc') || lower.includes('navigateur'))) ||
    lower.includes('nettoie le cache')
  ) {
    const gbMatch = lower.match(/(\d+)\s*go/);
    const ramLimitGb = gbMatch ? Math.min(8, Math.max(2, Number(gbMatch[1]))) : 4;
    return {
      text: `GX Booster exécuté : limite RAM réglée sur ${ramLimitGb} Go et onglets inactifs suspendus.`,
      actions: [{ name: 'run_gx_booster', args: { ramLimitGb } }],
    };
  }

  // 4. Theme Preset switcher
  const themeMatches: Array<{ keywords: string[]; presetName: string }> = [
    { keywords: ['cosmic dark', 'sombre'], presetName: 'Cosmic Dark' },
    { keywords: ['cyber neon', 'néon', 'neon'], presetName: 'Cyber Neon' },
    { keywords: ['galaxy blue', 'bleu', 'galaxy'], presetName: 'Galaxy Blue' },
    { keywords: ['phoenix fire', 'feu', 'phoenix'], presetName: 'Phoenix Fire' },
  ];
  if (lower.includes('thème') || lower.includes('theme') || lower.includes('couleur')) {
    for (const t of themeMatches) {
      if (t.keywords.some((kw) => lower.includes(kw))) {
        return {
          text: `Thème « ${t.presetName} » appliqué au cockpit Hyper Nova.`,
          actions: [{ name: 'apply_theme_preset', args: { presetName: t.presetName } }],
        };
      }
    }
  }

  // 5. Launch Game Platforms
  const platforms = ['Steam', 'Epic Games', 'Xbox', 'Riot Games', 'Battle.net', 'Ubisoft Connect'];
  if (lower.includes('lance') || lower.includes('démarre') || lower.includes('joue')) {
    for (const plat of platforms) {
      if (lower.includes(plat.toLowerCase())) {
        return {
          text: `Ouverture du Launcher ${plat} dans le Gaming Hub.`,
          actions: [{ name: 'launch_game_platform', args: { platform: plat } }],
        };
      }
    }
  }

  // 6. Open tabs / modules / explicit URLs
  const targetMap: Array<{ keywords: string[]; target: string; title: string }> = [
    { keywords: ['youtube', 'ytb'], target: 'youtube', title: 'YouTube' },
    { keywords: ['discord'], target: 'discord', title: 'Discord' },
    { keywords: ['spotify'], target: 'spotify', title: 'Spotify' },
    { keywords: ['nova jolt', 'novajolt', 'gamejolt'], target: 'novajolt', title: 'Nova Jolt' },
    { keywords: ['gaming hub', 'launcher'], target: 'gaming', title: 'Gaming Hub' },
    { keywords: ['telemetry', 'télémétrie', 'statistique', 'fps'], target: 'telemetry', title: 'Télémétrie' },
    { keywords: ['media', 'musique', 'lecteur'], target: 'media', title: 'Media Center' },
    { keywords: ['chat', 'contact', 'message'], target: 'chat', title: 'Nova Chat' },
    { keywords: ['profil', 'profile', 'niveau'], target: 'profile', title: 'Profil Gaming' },
    { keywords: ['theme', 'thème'], target: 'themelab', title: 'Theme Lab' },
    { keywords: ['cloud'], target: 'cloud', title: 'Nova Cloud' },
    { keywords: ['universe', 'accueil'], target: 'universe', title: 'Nova Universe' },
  ];

  if (
    lower.includes('ouvre') ||
    lower.includes('open') ||
    lower.includes('va sur') ||
    lower.includes('lance') ||
    lower.includes('affiche')
  ) {
    for (const entry of targetMap) {
      if (entry.keywords.some((kw) => lower.includes(kw))) {
        return {
          text: `Ouverture de ${entry.title} dans Hyper Nova Navigator.`,
          actions: [{ name: 'open_tab', args: { target: entry.target, title: entry.title } }],
        };
      }
    }
    const domainMatch = prompt.match(/https?:\/\/[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/i);
    if (domainMatch) {
      const targetUrl = domainMatch[0].startsWith('http') ? domainMatch[0] : `https://${domainMatch[0]}`;
      return {
        text: `Ouverture de ${targetUrl} dans un nouvel onglet Hyper Nova.`,
        actions: [{ name: 'open_tab', args: { target: targetUrl, title: domainMatch[0] } }],
      };
    }
  }

  // 7. Mode "site" or explicit mini-app creation
  const wantsWebApp =
    mode === 'site' ||
    lower.includes('calculatrice') ||
    lower.includes('crée un site') ||
    lower.includes('cree un site') ||
    lower.includes('crée une') ||
    lower.includes('cree une') ||
    lower.includes('mini-site') ||
    lower.includes('mini site') ||
    lower.includes('mini-jeu') ||
    lower.includes('mini jeu');

  if (wantsWebApp) {
    if (lower.includes('calc')) {
      return {
        text: 'Calculatrice Hyper Nova générée et ouverte dans un nouvel onglet Aperçu Live !',
        actions: [
          {
            name: 'create_web_app',
            args: { title: 'Calculatrice Hyper Nova', htmlCode: buildFallbackCalculatorHtml() },
          },
        ],
      };
    }
    if (lower.includes('jeu') || lower.includes('game') || lower.includes('aim') || lower.includes('arcade')) {
      return {
        text: 'Mini-jeu Aim Reflex Hyper Nova généré et lancé dans un nouvel onglet Aperçu Live !',
        actions: [
          {
            name: 'create_web_app',
            args: { title: 'Nova Reflex Mini-Game', htmlCode: buildFallbackMiniGameHtml('Nova Reflex Aim') },
          },
        ],
      };
    }
    const cleanTopic = prompt.replace(/crononova/gi, '').trim() || 'Mini-Site Hyper Nova';
    return {
      text: `Mini-site interactif « ${cleanTopic.slice(0, 50)} » créé et ouvert dans un onglet Aperçu Live.`,
      actions: [
        {
          name: 'create_web_app',
          args: { title: cleanTopic.slice(0, 40), htmlCode: buildFallbackCustomSiteHtml(cleanTopic) },
        },
      ],
    };
  }

  return null;
}

async function buildSmartCrononovaFallback(
  prompt: string,
  mode = 'assistant',
  activePageContext = '',
  hyperDrive = false
): Promise<{
  text: string;
  actions: Array<{ name: string; args: Record<string, unknown> }>;
  sources: Array<{ uri: string; title: string }>;
}> {
  const localControl = tryLocalBrowserControlFallback(prompt, mode);
  if (localControl) {
    return { ...localControl, sources: [] };
  }

  const lower = prompt.toLowerCase().trim();

  // Conversational greetings & assistant help
  if (
    /^(bonjour|salut|coucou|hello|hi|hey|yo|bonsoir)\b/.test(lower) ||
    lower.includes('qui es-tu') ||
    lower.includes('qui es tu') ||
    lower.includes('que peux-tu faire') ||
    lower.includes('comment ça marche') ||
    lower.includes('aide')
  ) {
    return {
      text: `${
        hyperDrive ? '[HYPER DRIVE ACTIF] ' : ''
      }Bonjour Commandant ! Je suis CRONONOVA, l'assistant intégré d'Hyper Nova Navigator.\n\nJe peux exécuter immédiatement :\n• Contrôle du navigateur : "Ouvre YouTube", "Active Hyper Drive", "Lance GX Booster à 4 Go", "Mode Streamer"\n• Création instantanée : "Crée une calculatrice web", "Crée un mini-jeu"\n• Recherche web en direct (Bing + Wikipédia) et résumé de l'onglet actif.\n\nQue voulez-vous lancer ?`,
      actions: [],
      sources: [],
    };
  }

  // Summarize active tab context
  if (mode === 'summarize' || lower.includes('résume cette page') || lower.includes('resume cette page')) {
    const contextInfo = activePageContext
      ? `Analyse de l'onglet actif :\n• ${activePageContext}`
      : 'Aucun contenu de page spécifique détecté.';
    const extraTopic = prompt.replace(/crononova|résume|resume|cette page/gi, '').trim();
    if (extraTopic.length > 18) {
      const [bingItems, wikiData] = await Promise.all([
        fetchBingRssSearch(extraTopic),
        fetchWikipediaData(extraTopic),
      ]);
      const bullets = [
        wikiData.summary ? `• Synthèse : ${wikiData.summary}` : '',
        ...bingItems.slice(0, 3).map((b) => `• ${b.title}${b.snippet ? ` — ${b.snippet}` : ''}`),
      ].filter(Boolean);
      return {
        text: `${contextInfo}\n\n${bullets.join('\n') || 'Astuce : ouvrez un article web puis cliquez sur « Résumer IA » pour extraire ses points clés.'}`,
        actions: [],
        sources: wikiData.links.slice(0, 3).map((l) => ({ uri: l.url, title: l.title })),
      };
    }
    return {
      text: `${contextInfo}\n\nPoints clés :\n• Vous pouvez basculer entre la vue Hyper Nova, Site Live et Lecteur Texte depuis la barre de l'onglet.\n• Utilisez "Ouvre YouTube", "GX Booster" ou la barre de recherche Bing/DuckDuckGo/Qwant pour explorer sans limite.`,
      actions: [],
      sources: [],
    };
  }

  // Gaming coach mode
  if (mode === 'gaming') {
    return {
      text: `Briefing Tactique Gaming (${hyperDrive ? 'Hyper Drive Actif' : 'Mode Standard'}) :\n• Activez le mode Hyper Drive + GX Booster (limite RAM 4 Go) pour couper les onglets inactifs.\n• Réduisez les ombres dynamiques et le flou cinétique pour stabiliser vos 144+ FPS.\n• Vérifiez votre latence réseau dans le module GX Booster & Stats (cible < 25 ms).`,
      actions: [],
      sources: [],
    };
  }

  // Live web search + Wikipedia synthesis
  const cleanSearch = prompt.replace(/crononova/gi, '').trim() || prompt;
  const [bingSettled, wikiSettled] = await Promise.allSettled([
    fetchBingRssSearch(cleanSearch),
    fetchWikipediaData(cleanSearch),
  ]);
  const bingItems = bingSettled.status === 'fulfilled' ? bingSettled.value : [];
  const wikiData =
    wikiSettled.status === 'fulfilled' ? wikiSettled.value : { summary: '', links: [] };

  const sources = [
    ...wikiData.links.map((l) => ({ uri: l.url, title: l.title })),
    ...bingItems.slice(0, 4).map((b) => ({ uri: b.url, title: b.title })),
  ].slice(0, 5);

  const summaryParts: string[] = [];
  if (wikiData.summary) {
    summaryParts.push(wikiData.summary);
  }
  if (bingItems.length > 0) {
    summaryParts.push(
      bingItems
        .slice(0, 4)
        .map((r) => `• ${r.title}${r.snippet ? ` — ${r.snippet}` : ''}`)
        .join('\n')
    );
  }

  const text =
    summaryParts.length > 0
      ? `Réponse Crononova (Synthèse Web Live) :\n\n${summaryParts.join('\n\n')}`
      : `Commande reçue : « ${prompt} ». Essayez une question web précise, ou une commande directe comme "Ouvre YouTube", "Active Hyper Drive", "Optimise la RAM" ou "Crée une calculatrice web".`;

  return { text, actions: [], sources };
}

export function createApiApp(): express.Express {
  const app = express();

  // Vercel @vercel/node pre-parses JSON bodies before invoking the handler without setting _body.
  // Mark already-parsed bodies so express.json() does not hang waiting on an empty stream.
  app.use((req, _res, next) => {
    const reqAny = req as express.Request & { _body?: boolean; rawBody?: unknown };
    if (
      req.method !== 'GET' &&
      req.method !== 'HEAD' &&
      req.body !== undefined &&
      !Buffer.isBuffer(req.body) &&
      typeof req.body === 'object' &&
      !reqAny._body
    ) {
      reqAny._body = true;
    }
    next();
  });

  const defaultJsonParser = express.json({ limit: '4mb' });
  app.use((req, res, next) => {
    if (req.path === '/api/game-packages' && req.method === 'POST') {
      next();
      return;
    }
    defaultJsonParser(req, res, next);
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      runtime: process.env.VERCEL ? 'vercel' : 'node',
    });
  });

  // Live Web Search Endpoint (Bing / DuckDuckGo / Qwant) — Direct quota-free web search
  app.post('/api/web-search', async (req, res) => {
    try {
      const {
        query,
        engine = 'bing',
        category = 'web',
      } = (req.body || {}) as {
        query?: string;
        engine?: string;
        category?: 'web' | 'images' | 'news' | 'videos';
      };

      if (!query || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ error: 'Requête de recherche manquante.' });
        return;
      }

      const cleanQuery = query.trim();
      const safeCategory =
        category === 'images' || category === 'news' || category === 'videos' ? category : 'web';

      if (safeCategory === 'images') {
        const images = await fetchBingImagesSearch(cleanQuery);
        res.json({
          engine,
          category: 'images',
          query: cleanQuery,
          summary: '',
          results: images,
        });
        return;
      }

      if (safeCategory === 'news') {
        const news = await fetchBingNewsRss(cleanQuery);
        res.json({
          engine,
          category: 'news',
          query: cleanQuery,
          summary: '',
          results: news,
        });
        return;
      }

      if (safeCategory === 'videos') {
        const videos = await fetchBingVideoSearch(cleanQuery);
        res.json({
          engine,
          category: 'videos',
          query: cleanQuery,
          summary: '',
          results: videos,
        });
        return;
      }

      const [bingSettled, wikiSettled] = await Promise.allSettled([
        fetchBingRssSearch(cleanQuery),
        fetchWikipediaData(cleanQuery),
      ]);

      const bingItems = bingSettled.status === 'fulfilled' ? bingSettled.value : [];
      const wikiData =
        wikiSettled.status === 'fulfilled'
          ? wikiSettled.value
          : { summary: '', links: [], knowledgeCard: undefined };

      const combined: WebSearchItem[] = [];
      const seenUrls = new Set<string>();

      for (const item of bingItems) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          combined.push(item);
        }
      }
      for (const item of wikiData.links) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          combined.push(item);
        }
      }

      const snippetSummary = combined
        .filter((r) => r.snippet)
        .slice(0, 3)
        .map((r) => `• ${r.title}: ${r.snippet}`)
        .join('\n');

      const summary =
        wikiData.summary ||
        snippetSummary ||
        `Résultats directs trouvés pour « ${cleanQuery} ».`;

      res.json({
        engine,
        category: 'web',
        query: cleanQuery,
        summary,
        knowledgeCard: wikiData.knowledgeCard,
        results: combined,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la recherche web.';
      console.error('Web search error:', err);
      res.status(500).json({ error: message });
    }
  });

  // Live Web Proxy Endpoint — Renders external websites (including Bing) inside Hyper Nova tabs
  app.get('/api/proxy', async (req, res) => {
    try {
      const rawUrl = String(req.query.url || '');
      const parsed = isPublicHttpUrl(rawUrl);
      if (!parsed) {
        res.status(400).send('URL invalide ou non autorisée.');
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const upstream = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      clearTimeout(timeout);

      const finalUrl = upstream.url || parsed.toString();
      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';

      if (!contentType.toLowerCase().includes('text/html')) {
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.setHeader('Content-Type', contentType);
        res.status(upstream.status).send(buf);
        return;
      }

      let html = await upstream.text();
      html = html
        .replace(/<meta[^>]+http-equiv=["']?(?:Content-Security-Policy|X-Frame-Options)["']?[^>]*>/gi, '')
        .replace(/<base\b[^>]*>/gi, '');

      const safeHref = finalUrl
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const baseTag = `<base href="${safeHref}">`;
      const bridgeScript = `<script>
(function(){
  var BASE_URL = ${JSON.stringify(finalUrl)};
  function resolveTarget(raw) {
    if (!raw) return null;
    var trimmed = String(raw).trim();
    if (!trimmed || trimmed.charAt(0) === '#' || /^javascript:|^mailto:|^tel:|^data:/i.test(trimmed)) return null;
    try {
      var u = new URL(trimmed, BASE_URL);
      if (u.hostname.endsWith('bing.com') && u.pathname === '/ck/a') {
        var enc = u.searchParams.get('u');
        if (enc && enc.indexOf('a1') === 0) {
          var b64 = enc.slice(2).replace(/-/g, '+').replace(/_/g, '/');
          while (b64.length % 4) b64 += '=';
          try {
            var decoded = atob(b64);
            if (/^https?:\\/\\//i.test(decoded)) return decoded;
          } catch (e) {}
        }
      }
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
    } catch (e) {}
    return null;
  }
  function notify(url) {
    if (!url) return;
    window.parent.postMessage({ type: 'hypernova-proxy-navigate', url: url }, '*');
  }
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;
    var href = el.getAttribute('href');
    var target = resolveTarget(href);
    if (target) {
      e.preventDefault();
      e.stopPropagation();
      notify(target);
    }
  }, true);
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var method = (form.getAttribute('method') || 'get').toLowerCase();
    if (method !== 'get') return;
    var actionRaw = form.getAttribute('action') || BASE_URL;
    var actionUrl = resolveTarget(actionRaw) || BASE_URL;
    try {
      var dest = new URL(actionUrl);
      var fd = new FormData(form);
      dest.search = '';
      fd.forEach(function(val, key) {
        if (typeof val === 'string') dest.searchParams.append(key, val);
      });
      e.preventDefault();
      e.stopPropagation();
      notify(dest.toString());
    } catch (err) {}
  }, true);
  window.open = function(url) {
    var resolved = resolveTarget(url);
    if (resolved) notify(resolved);
    return null;
  };
})();
</script>`;

      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${baseTag}`);
      } else {
        html = `${baseTag}\n${html}`;
      }

      if (/<\/body>/i.test(html)) {
        html = html.replace(/<\/body>/i, `${bridgeScript}\n</body>`);
      } else {
        html = `${html}\n${bridgeScript}`;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(upstream.status).send(html);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Impossible de charger cette page.';
      res
        .status(502)
        .send(
          `<!doctype html><html><body style="background:#080B12;color:#e2e8f0;font-family:sans-serif;padding:32px;"><h3>Chargement bloqué ou expiré</h3><p>${message}</p></body></html>`
        );
    }
  });

  // Safe Server-Side Web Reader / Link Navigator Endpoint
  app.get('/api/browse', async (req, res) => {
    try {
      const rawUrl = String(req.query.url || '');
      const parsed = isPublicHttpUrl(rawUrl);
      if (!parsed) {
        res.status(400).json({ error: 'URL invalide ou non autorisée.' });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const upstream = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeout);

      const contentType = upstream.headers.get('content-type') || '';
      const rawText = await upstream.text();

      if (!contentType.includes('html')) {
        res.json({
          url: upstream.url || parsed.toString(),
          title: parsed.hostname,
          description: '',
          paragraphs: [rawText.slice(0, 4000)],
          links: [],
        });
        return;
      }

      const cleanedHtml = rawText
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');

      const titleMatch = cleanedHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? stripTags(titleMatch[1]) : parsed.hostname;

      const descMatch = cleanedHtml.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i
      );
      const description = descMatch ? decodeHtmlEntities(descMatch[1]).trim() : '';

      const paragraphs: string[] = [];
      const pRegex = /<(?:p|h1|h2|h3|li)[^>]*>([\s\S]*?)<\/(?:p|h1|h2|h3|li)>/gi;
      let match: RegExpExecArray | null;
      while ((match = pRegex.exec(cleanedHtml)) !== null && paragraphs.length < 36) {
        const text = stripTags(match[1]);
        if (text.length >= 24) {
          paragraphs.push(text);
        }
      }

      const links: Array<{ text: string; url: string }> = [];
      const seenLinks = new Set<string>();
      const aRegex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = aRegex.exec(cleanedHtml)) !== null && links.length < 24) {
        const href = match[1].trim();
        const label = stripTags(match[2]);
        if (!label || label.length < 2) continue;
        try {
          const resolved = new URL(href, upstream.url || parsed.toString()).toString();
          if (isPublicHttpUrl(resolved) && !seenLinks.has(resolved)) {
            seenLinks.add(resolved);
            links.push({ text: label.slice(0, 90), url: resolved });
          }
        } catch {
          // ignore malformed href
        }
      }

      res.json({
        url: upstream.url || parsed.toString(),
        title: title.slice(0, 140),
        description: description.slice(0, 320),
        paragraphs,
        links,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Impossible de charger cette page web.';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/crononova', async (req, res) => {
    try {
      const {
        prompt,
        mode = 'assistant',
        activePageContext = '',
        hyperDrive = false,
        history = [],
      } = (req.body || {}) as {
        prompt: string;
        mode?: string;
        activePageContext?: string;
        hyperDrive?: boolean;
        history?: Array<{ role: 'user' | 'model'; text: string }>;
      };

      const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';
      if (!cleanPrompt) {
        res.status(400).json({ error: 'Le prompt est requis.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        const smartFallback = await buildSmartCrononovaFallback(
          cleanPrompt,
          mode,
          activePageContext,
          hyperDrive
        );
        res.json(smartFallback);
        return;
      }

      const modeInstructions: Record<string, string> = {
        assistant:
          'Réponds de façon claire, précise et structurée en français. Tu peux effectuer des recherches web et contrôler le navigateur via tes outils (open_tab, toggle_hyper_drive, toggle_streamer_mode, run_gx_booster, launch_game_platform, apply_theme_preset, create_web_app).',
        search:
          'Effectue une recherche web approfondie et fournis une synthèse fiable avec les faits clés récents.',
        code:
          'Génère du code propre, moderne, bien typé et commenté. Si l’utilisateur demande une interface web/calculatrice/jeu HTML/CSS/JS testable, tu peux aussi appeler create_web_app avec un document HTML autonome complet.',
        summarize:
          'Résume la page ou le contexte actif de manière structurée : points clés, chiffres importants et actions recommandées.',
        translate:
          'Traduis fidèlement le texte fourni en conservant le ton, les termes techniques et la fluidité naturelle.',
        debug:
          'Analyse le bug ou message d’erreur fourni : identifie la cause racine, explique pourquoi cela arrive et propose le correctif exact.',
        site:
          'Crée un mini-site HTML/CSS/JS complet, esthétique, moderne et 100% fonctionnel dans un seul document HTML autonome, et appelle OBLIGATOIREMENT l’outil create_web_app pour l’ouvrir directement dans un onglet du navigateur.',
        gaming:
          'Agis en coach e-sport et tacticien gaming d’élite : donne des conseils concrets d’optimisation FPS, réglages, stratégie et méta.',
      };

      const systemInstruction = [
        'Tu es CRONONOVA, l’intelligence artificielle intégrée au navigateur gaming futuriste Hyper Nova Navigator.',
        hyperDrive
          ? 'MODE HYPER DRIVE ACTIF : Tes capacités d’analyse sont poussées au maximum (réponses ultra-précises, tactiques et directes, avec style commandant de bord).'
          : 'Style : Assistant technologique vif, précis, utile et orienté joueur/développeur.',
        modeInstructions[mode] || modeInstructions.assistant,
        activePageContext
          ? `Contexte de l'onglet actif dans le navigateur :\n${activePageContext}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const useSearch = mode === 'search' || mode === 'assistant' || mode === 'gaming';
      const tools = useSearch
        ? [{ googleSearch: {} }, { functionDeclarations: browserControlFunctions }]
        : [{ functionDeclarations: browserControlFunctions }];

      // Sanitize history: must start with 'user' and alternate cleanly before the new 'user' prompt
      const rawHistory = (history || [])
        .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
        .slice(-8);
      const sanitizedHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
      for (const msg of rawHistory) {
        const role = msg.role === 'user' ? 'user' : 'model';
        if (sanitizedHistory.length === 0 && role === 'model') continue;
        const last = sanitizedHistory[sanitizedHistory.length - 1];
        if (last && last.role === role) {
          last.parts[0].text += `\n${msg.text.trim()}`;
        } else {
          sanitizedHistory.push({ role, parts: [{ text: msg.text.trim() }] });
        }
      }
      if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
        sanitizedHistory.pop();
      }

      const contents = [...sanitizedHistory, { role: 'user', parts: [{ text: cleanPrompt }] }];

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            tools,
            ...(useSearch ? { toolConfig: { includeServerSideToolInvocations: true } } : {}),
          },
        });
      } catch (primaryErr: unknown) {
        if (isRetryableGeminiError(primaryErr)) {
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: browserControlFunctions }],
            },
          });
        } else {
          throw primaryErr;
        }
      }

      const functionCalls = response.functionCalls || [];
      const actions = functionCalls.map((fc) => ({
        name: fc.name,
        args: fc.args || {},
      }));

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = rawChunks
        .map((chunk: { web?: { uri?: string; title?: string } }) =>
          chunk.web?.uri
            ? { uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri }
            : null
        )
        .filter(Boolean);

      let text = response.text || '';
      if (!text && actions.length > 0) {
        const actionLabels = actions.map((a) => `${a.name}`).join(', ');
        text = `Commande exécutée dans Hyper Nova Navigator (${actionLabels}).`;
      }

      res.json({
        text,
        actions,
        sources,
      });
    } catch (err: unknown) {
      console.error('Crononova API fallback activated:', err);
      const reqBody = (req.body || {}) as {
        prompt?: unknown;
        mode?: unknown;
        activePageContext?: unknown;
        hyperDrive?: unknown;
      };
      const reqPrompt = typeof reqBody.prompt === 'string' ? reqBody.prompt.trim() : '';
      const reqMode = typeof reqBody.mode === 'string' ? reqBody.mode : 'assistant';
      const reqContext = typeof reqBody.activePageContext === 'string' ? reqBody.activePageContext : '';
      const reqHyperDrive = Boolean(reqBody.hyperDrive);

      if (reqPrompt) {
        const smartFallback = await buildSmartCrononovaFallback(
          reqPrompt,
          reqMode,
          reqContext,
          reqHyperDrive
        );
        res.json(smartFallback);
        return;
      }

      const message = err instanceof Error ? err.message : 'Erreur inconnue avec Crononova.';
      res.status(500).json({ error: message });
    }
  });

  // Nova Jolt — Streaming Unlimited File & Folder Upload Endpoints
  app.post('/api/game-packages/init', async (_req, res) => {
    try {
      const packageId = `pkg_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
      const packageRoot = path.resolve(GAME_UPLOADS_DIR, packageId);
      await fs.mkdir(packageRoot, { recursive: true });
      res.json({ packageId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur d’initialisation du dossier.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/game-packages/:packageId/file', async (req, res) => {
    const pkgId = String(req.params.packageId || '');
    if (!/^[a-zA-Z0-9_-]{4,64}$/.test(pkgId)) {
      res.status(400).json({ error: 'Identifiant de paquet invalide.' });
      return;
    }

    const rawHeader = req.headers['x-nova-file-path'];
    const rawPathInput =
      typeof rawHeader === 'string' && rawHeader
        ? decodeURIComponent(rawHeader)
        : String(req.query.path || '');
    const safeRel = sanitizeRelativeFilePath(rawPathInput);
    if (!safeRel || safeRel === '_manifest.json') {
      res.status(400).json({ error: 'Chemin de fichier invalide.' });
      return;
    }

    const packageRoot = path.resolve(GAME_UPLOADS_DIR, pkgId);
    const destPath = path.resolve(packageRoot, safeRel);
    if (!destPath.startsWith(packageRoot + path.sep)) {
      res.status(403).json({ error: 'Chemin interdit.' });
      return;
    }

    try {
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      if (Buffer.isBuffer(req.body)) {
        await fs.writeFile(destPath, req.body);
      } else {
        await new Promise<void>((resolve, reject) => {
          const writeStream = fsSync.createWriteStream(destPath);
          req.pipe(writeStream);
          writeStream.on('finish', () => resolve());
          writeStream.on('error', (err) => reject(err));
          req.on('error', (err) => {
            writeStream.destroy();
            reject(err);
          });
        });
      }

      const stat = await fs.stat(destPath);
      res.json({
        path: safeRel,
        size: stat.size,
        mimeType: getMimeForFile(safeRel),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Échec de l’écriture du fichier.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/game-packages/:packageId/finalize', async (req, res) => {
    const pkgId = String(req.params.packageId || '');
    if (!/^[a-zA-Z0-9_-]{4,64}$/.test(pkgId)) {
      res.status(400).json({ error: 'Identifiant de paquet invalide.' });
      return;
    }
    const packageRoot = path.resolve(GAME_UPLOADS_DIR, pkgId);
    try {
      const manifestFiles: Array<{ path: string; size: number; mimeType: string }> = [];
      let totalBytes = 0;

      const walk = async (dir: string, relPrefix = ''): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            await walk(full, rel);
          } else if (entry.isFile() && rel !== '_manifest.json') {
            const st = await fs.stat(full);
            totalBytes += st.size;
            manifestFiles.push({
              path: rel,
              size: st.size,
              mimeType: getMimeForFile(rel),
            });
          }
        }
      };

      await walk(packageRoot);
      if (manifestFiles.length === 0) {
        await fs.rm(packageRoot, { recursive: true, force: true });
        res.status(400).json({ error: 'Aucun fichier valide détecté.' });
        return;
      }

      const htmlCandidates = manifestFiles
        .filter((item) => /\.(html|htm)$/i.test(item.path))
        .sort((a, b) => {
          const aIsIndex = path.basename(a.path).toLowerCase() === 'index.html' ? 0 : 1;
          const bIsIndex = path.basename(b.path).toLowerCase() === 'index.html' ? 0 : 1;
          if (aIsIndex !== bIsIndex) return aIsIndex - bIsIndex;
          return a.path.split('/').length - b.path.split('/').length;
        });

      const entryFile = htmlCandidates[0]?.path || null;
      const manifest = {
        packageId: pkgId,
        entryFile,
        totalBytes,
        fileCount: manifestFiles.length,
        files: manifestFiles,
      };

      await fs.writeFile(
        path.join(packageRoot, '_manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf8'
      );

      res.json(manifest);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la finalisation du dossier.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/game-packages', express.json({ limit: '512mb' }), async (req, res) => {
    try {
      const { files } = (req.body || {}) as {
        files?: Array<{ path?: string; contentBase64?: string; mimeType?: string }>;
      };

      if (!Array.isArray(files) || files.length === 0) {
        res.status(400).json({ error: 'Aucun fichier ou dossier fourni.' });
        return;
      }

      const packageId = `pkg_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
      const packageRoot = path.resolve(GAME_UPLOADS_DIR, packageId);
      await fs.mkdir(packageRoot, { recursive: true });

      const manifestFiles: Array<{ path: string; size: number; mimeType: string }> = [];
      let totalBytes = 0;

      for (const f of files) {
        if (!f || typeof f.path !== 'string' || typeof f.contentBase64 !== 'string') continue;
        const safeRel = sanitizeRelativeFilePath(f.path);
        if (!safeRel || safeRel === '_manifest.json') continue;

        const base64Clean = f.contentBase64.includes(',')
          ? f.contentBase64.split(',').pop() || ''
          : f.contentBase64;
        const buf = Buffer.from(base64Clean, 'base64');
        totalBytes += buf.length;

        const destPath = path.resolve(packageRoot, safeRel);
        if (!destPath.startsWith(packageRoot + path.sep)) continue;
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, buf);

        manifestFiles.push({
          path: safeRel,
          size: buf.length,
          mimeType: f.mimeType || getMimeForFile(safeRel),
        });
      }

      if (manifestFiles.length === 0) {
        await fs.rm(packageRoot, { recursive: true, force: true });
        res.status(400).json({ error: 'Aucun fichier valide détecté.' });
        return;
      }

      const htmlCandidates = manifestFiles
        .filter((item) => /\.(html|htm)$/i.test(item.path))
        .sort((a, b) => {
          const aIsIndex = path.basename(a.path).toLowerCase() === 'index.html' ? 0 : 1;
          const bIsIndex = path.basename(b.path).toLowerCase() === 'index.html' ? 0 : 1;
          if (aIsIndex !== bIsIndex) return aIsIndex - bIsIndex;
          return a.path.split('/').length - b.path.split('/').length;
        });

      const entryFile = htmlCandidates[0]?.path || null;
      const manifest = {
        packageId,
        entryFile,
        totalBytes,
        fileCount: manifestFiles.length,
        files: manifestFiles,
      };

      await fs.writeFile(
        path.join(packageRoot, '_manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf8'
      );

      res.json(manifest);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la publication des fichiers.';
      console.error('Game package upload error:', err);
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/game-packages/:packageId/manifest', async (req, res) => {
    const pkgId = String(req.params.packageId || '');
    if (!/^[a-zA-Z0-9_-]{4,64}$/.test(pkgId)) {
      res.status(400).json({ error: 'Identifiant de paquet invalide.' });
      return;
    }
    try {
      const manifestPath = path.resolve(GAME_UPLOADS_DIR, pkgId, '_manifest.json');
      const raw = await fs.readFile(manifestPath, 'utf8');
      res.json(JSON.parse(raw));
    } catch {
      res.status(404).json({ error: 'Dossier de jeu introuvable sur ce serveur.' });
    }
  });

  app.get('/api/game-packages/:packageId/archive.zip', async (req, res) => {
    const pkgId = String(req.params.packageId || '');
    if (!/^[a-zA-Z0-9_-]{4,64}$/.test(pkgId)) {
      res.status(400).json({ error: 'Identifiant de paquet invalide.' });
      return;
    }
    try {
      const packageRoot = path.resolve(GAME_UPLOADS_DIR, pkgId);
      const rawManifest = await fs.readFile(path.join(packageRoot, '_manifest.json'), 'utf8');
      const manifest = JSON.parse(rawManifest) as {
        files: Array<{ path: string }>;
      };

      const entries: Array<{ name: string; data: Buffer }> = [];
      for (const f of manifest.files) {
        const safeRel = sanitizeRelativeFilePath(f.path);
        if (!safeRel) continue;
        const abs = path.resolve(packageRoot, safeRel);
        if (!abs.startsWith(packageRoot + path.sep)) continue;
        const data = await fs.readFile(abs);
        entries.push({ name: safeRel, data });
      }

      const zipBuf = buildStoreZipBuffer(entries);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="novajolt-${pkgId}.zip"`);
      res.send(zipBuf);
    } catch {
      res.status(404).json({ error: 'Archive introuvable.' });
    }
  });

  app.get('/api/game-packages/:packageId/play/*', async (req, res) => {
    const pkgId = String(req.params.packageId || '');
    if (!/^[a-zA-Z0-9_-]{4,64}$/.test(pkgId)) {
      res.status(400).send('Invalid package ID');
      return;
    }
    const rawSubPath = decodeURIComponent(String((req.params as Record<string, string>)[0] || 'index.html'));
    const safeRel = sanitizeRelativeFilePath(rawSubPath);
    if (!safeRel || safeRel === '_manifest.json') {
      res.status(400).send('Invalid file path');
      return;
    }
    const packageRoot = path.resolve(GAME_UPLOADS_DIR, pkgId);
    const absPath = path.resolve(packageRoot, safeRel);
    if (!absPath.startsWith(packageRoot + path.sep)) {
      res.status(403).send('Forbidden');
      return;
    }

    try {
      await fs.access(absPath);
      res.setHeader('Content-Type', getMimeForFile(safeRel));
      if (req.query.download === '1') {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${path.basename(safeRel).replace(/"/g, '')}"`
        );
      }
      res.sendFile(absPath);
    } catch {
      res.status(404).send('File not found');
    }
  });

  // One-Click Cross-Platform Desktop Installer Bundle (.zip) with Hyper Nova icon
  app.get('/api/install-package', async (req, res) => {
    try {
      const rawOrigin = typeof req.query.origin === 'string' ? req.query.origin.trim() : '';
      const parsedOrigin = isPublicHttpUrl(rawOrigin);
      const safeBaseUrl = (parsedOrigin ? `${parsedOrigin.protocol}//${parsedOrigin.host}` : 'https://hyper-nova-navigator.vercel.app')
        .replace(/[^a-zA-Z0-9.:/_-]/g, '');

      let iconBytes: Buffer | null = null;
      const iconCandidates = [
        path.resolve(process.cwd(), 'public', 'pwa-512x512.png'),
        path.resolve(process.cwd(), 'dist', 'pwa-512x512.png'),
      ];
      for (const candidate of iconCandidates) {
        try {
          iconBytes = await fs.readFile(candidate);
          if (iconBytes.length > 0) break;
        } catch {
          // try next candidate
        }
      }
      if (!iconBytes && parsedOrigin) {
        try {
          const iconRes = await fetch(`${safeBaseUrl}/pwa-512x512.png`);
          if (iconRes.ok) {
            iconBytes = Buffer.from(await iconRes.arrayBuffer());
          }
        } catch {
          // ignore
        }
      }

      const windowsBat = [
        '@echo off',
        'setlocal enableextensions',
        'title Installation de Hyper Nova Navigator',
        'set "APP_DIR=%LOCALAPPDATA%\\HyperNovaNavigator"',
        'set "URL=' + safeBaseUrl + '"',
        'if not exist "%APP_DIR%" mkdir "%APP_DIR%"',
        'if exist "%~dp0hyper-nova-icon.png" copy /Y "%~dp0hyper-nova-icon.png" "%APP_DIR%\\hyper-nova-icon.png" >nul',
        'if exist "%~dp0Hyper-Nova-Launcher.html" copy /Y "%~dp0Hyper-Nova-Launcher.html" "%APP_DIR%\\Hyper-Nova-Launcher.html" >nul',
        'powershell -NoProfile -ExecutionPolicy Bypass -Command "$png=\'%APP_DIR%\\hyper-nova-icon.png\'; $ico=\'%APP_DIR%\\hyper-nova.ico\'; if(Test-Path $png){ $b=[IO.File]::ReadAllBytes($png); $ms=New-Object IO.MemoryStream; $bw=New-Object IO.BinaryWriter($ms); $bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1); $bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([Byte]0); $bw.Write([UInt16]1); $bw.Write([UInt16]32); $bw.Write([UInt32]$b.Length); $bw.Write([UInt32]22); $bw.Write($b); [IO.File]::WriteAllBytes($ico,$ms.ToArray()) }; $target=\'%URL%\'; $exe=\'\'; $args=\'\'; foreach($p in @(\"$env:ProgramFiles(x86)\\Microsoft\\Edge\\Application\\msedge.exe\",\"$env:ProgramFiles\\Microsoft\\Edge\\Application\\msedge.exe\",\"$env:ProgramFiles\\Google\\Chrome\\Application\\chrome.exe\",\"$env:ProgramFiles(x86)\\Google\\Chrome\\Application\\chrome.exe\",\"$env:LOCALAPPDATA\\Google\\Chrome\\Application\\chrome.exe\")){ if(Test-Path $p){ $exe=$p; $args=\\\"--app=$target\\\"; break } }; $ws=New-Object -ComObject WScript.Shell; foreach($dir in @($ws.SpecialFolders(\'Desktop\'),\"$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\")){ $sc=$ws.CreateShortcut(\"$dir\\Hyper Nova Navigator.lnk\"); if($exe){ $sc.TargetPath=$exe; $sc.Arguments=$args } else { $sc.TargetPath=$target }; if(Test-Path $ico){ $sc.IconLocation=\"$ico,0\" }; $sc.Description=\'Hyper Nova Navigator\'; $sc.Save() }; if($exe){ Start-Process $exe -ArgumentList $args } else { Start-Process $target }"',
        'echo Hyper Nova Navigator installe sur votre Bureau et Menu Demarrer !',
        'timeout /t 3 >nul',
      ].join('\r\n');

      const linuxSh = [
        '#!/usr/bin/env bash',
        'set -e',
        'APP_DIR="$HOME/.local/share/hyper-nova-navigator"',
        'mkdir -p "$APP_DIR" "$HOME/.local/share/applications"',
        'SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"',
        'if [ -f "$SCRIPT_DIR/hyper-nova-icon.png" ]; then cp "$SCRIPT_DIR/hyper-nova-icon.png" "$APP_DIR/icon.png"; fi',
        `URL="${safeBaseUrl}"`,
        'BROWSER=""',
        'for bin in google-chrome chromium chromium-browser microsoft-edge brave-browser; do',
        '  if command -v "$bin" >/dev/null 2>&1; then BROWSER="$bin"; break; fi',
        'done',
        'EXEC_CMD="xdg-open $URL"',
        'if [ -n "$BROWSER" ]; then EXEC_CMD="$BROWSER --app=$URL"; fi',
        'DESKTOP_FILE="$HOME/.local/share/applications/hyper-nova-navigator.desktop"',
        'cat > "$DESKTOP_FILE" <<EOF',
        '[Desktop Entry]',
        'Version=1.0',
        'Type=Application',
        'Name=Hyper Nova Navigator',
        'Comment=Station de controle futuriste et navigateur gaming',
        'Exec=$EXEC_CMD',
        'Icon=$APP_DIR/icon.png',
        'Terminal=false',
        'Categories=Network;Game;WebBrowser;',
        'EOF',
        'chmod +x "$DESKTOP_FILE"',
        'if [ -d "$HOME/Desktop" ]; then cp "$DESKTOP_FILE" "$HOME/Desktop/Hyper-Nova-Navigator.desktop" && chmod +x "$HOME/Desktop/Hyper-Nova-Navigator.desktop"; fi',
        'nohup $EXEC_CMD >/dev/null 2>&1 &',
        'echo "Hyper Nova Navigator installe !"',
      ].join('\n');

      const macCommand = [
        '#!/usr/bin/env bash',
        `URL="${safeBaseUrl}"`,
        'if [ -d "/Applications/Google Chrome.app" ]; then',
        '  open -a "Google Chrome" --args --app="$URL"',
        'elif [ -d "/Applications/Microsoft Edge.app" ]; then',
        '  open -a "Microsoft Edge" --args --app="$URL"',
        'else',
        '  open "$URL"',
        'fi',
      ].join('\n');

      const launcherHtml = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0;url=${safeBaseUrl}" />
  <title>Hyper Nova Navigator</title>
  <style>
    body{margin:0;min-height:100vh;background:#07090E;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}
    a{display:inline-block;margin-top:16px;padding:12px 24px;border-radius:10px;background:#06b6d4;color:#04101d;font-weight:700;text-decoration:none}
  </style>
</head>
<body>
  <div>
    <h1>Hyper Nova Navigator</h1>
    <p>Lancement de votre station spatiale...</p>
    <a href="${safeBaseUrl}">Ouvrir Hyper Nova Navigator</a>
  </div>
</body>
</html>`;

      const readmeTxt = [
        'HYPER NOVA NAVIGATOR - INSTALLATION EN 1 CLIC',
        '================================================',
        '',
        'Windows :',
        '  Extrayez le dossier puis double-cliquez sur Install-Hyper-Nova-Windows.bat',
        '  -> Cree le raccourci avec le logo Hyper Nova sur le Bureau + Menu Demarrer',
        '  -> Ouvre immediatement Hyper Nova Navigator en fenetre programme autonome.',
        '',
        'macOS :',
        '  Double-cliquez sur Install-Hyper-Nova-Mac.command',
        '',
        'Linux :',
        '  Lancez : bash Install-Hyper-Nova-Linux.sh',
        '',
        `URL directe : ${safeBaseUrl}`,
      ].join('\r\n');

      const entries: Array<{ name: string; data: Buffer }> = [
        { name: 'Install-Hyper-Nova-Windows.bat', data: Buffer.from(windowsBat, 'utf8') },
        { name: 'Install-Hyper-Nova-Linux.sh', data: Buffer.from(linuxSh, 'utf8') },
        { name: 'Install-Hyper-Nova-Mac.command', data: Buffer.from(macCommand, 'utf8') },
        { name: 'Hyper-Nova-Launcher.html', data: Buffer.from(launcherHtml, 'utf8') },
        { name: 'LISEZ-MOI.txt', data: Buffer.from(readmeTxt, 'utf8') },
      ];
      if (iconBytes) {
        entries.push({ name: 'hyper-nova-icon.png', data: iconBytes });
      }

      const zipBuf = buildStoreZipBuffer(entries);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="Hyper-Nova-Navigator-Setup.zip"');
      res.send(zipBuf);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de génération du paquet d’installation.';
      res.status(500).json({ error: message });
    }
  });

  // Check GitHub Releases for prebuilt native desktop installers (.exe / .dmg / .AppImage)
  app.get('/api/latest-installer', async (req, res) => {
    const platform = String(req.query.platform || 'win').toLowerCase();
    const ext = platform === 'mac' ? '.dmg' : platform === 'linux' ? '.appimage' : '.exe';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const ghRes = await fetch(
        'https://api.github.com/repos/akakabdelmalek-svg/hyper-nova-navigator/releases/latest',
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'HyperNovaNavigator/1.0',
            Accept: 'application/vnd.github+json',
          },
        }
      );
      if (!ghRes.ok) {
        res.json({ available: false });
        return;
      }
      const data = (await ghRes.json()) as {
        tag_name?: string;
        assets?: Array<{ name?: string; browser_download_url?: string; size?: number }>;
      };
      const match = (data.assets || []).find(
        (a) => typeof a.name === 'string' && a.name.toLowerCase().endsWith(ext) && a.browser_download_url
      );
      if (!match || !match.browser_download_url) {
        res.json({ available: false });
        return;
      }
      res.json({
        available: true,
        downloadUrl: match.browser_download_url,
        fileName: match.name,
        version: data.tag_name || 'latest',
      });
    } catch {
      res.json({ available: false });
    } finally {
      clearTimeout(timeout);
    }
  });

  // Ensure unknown /api/* routes always return JSON instead of falling through to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Route API introuvable.' });
  });

  // Ensure Express middleware errors (e.g. body-parser JSON syntax/size errors) return JSON
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (req.path.startsWith('/api')) {
      const status = typeof (err as { status?: number })?.status === 'number' ? (err as { status: number }).status : 500;
      const message = err instanceof Error ? err.message : 'Erreur serveur API.';
      res.status(status).json({ error: message });
      return;
    }
    next(err);
  });

  return app;
}
