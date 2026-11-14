import React, { useState, useEffect } from 'react';
import {
  Plus,
  Play,
  Heart,
  MessageSquare,
  ExternalLink,
  Download,
  Trash2,
  Search,
  Gamepad2,
  Code2,
  X,
  LogIn,
  Upload,
  FolderOpen,
  FileCode,
  File as FileIcon,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ChatHandle, GameComment, IndieGame } from '../types/nova';

interface NovaJoltProps {
  user: User | null;
  myHandle: ChatHandle | null;
  onSignIn: () => Promise<void>;
  onOpenChatModule: () => void;
  onLaunchHtmlGame: (title: string, htmlCode: string) => void;
  onLaunchPackageGame: (title: string, iframeUrl: string) => void;
  onAwardXp: (amount: number, achievementKey?: string) => void;
}

interface PendingGameFile {
  path: string;
  file: File;
  size: number;
}

interface PackageManifest {
  packageId: string;
  entryFile: string | null;
  totalBytes: number;
  fileCount: number;
  files: Array<{ path: string; size: number; mimeType: string }>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

function encodePathSegments(relPath: string): string {
  return relPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

async function readDroppedEntries(dataTransfer: DataTransfer): Promise<PendingGameFile[]> {
  const results: PendingGameFile[] = [];

  const traverseEntry = async (entry: FileSystemEntry, prefix = ''): Promise<void> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      await new Promise<void>((resolve) => {
        fileEntry.file(
          (file) => {
            const relPath = prefix ? `${prefix}/${file.name}` : file.name;
            results.push({ path: relPath, file, size: file.size });
            resolve();
          },
          () => resolve()
        );
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
      const readAll = async (): Promise<FileSystemEntry[]> => {
        const all: FileSystemEntry[] = [];
        while (true) {
          const batch = await new Promise<FileSystemEntry[]>((resolve) => {
            reader.readEntries(
              (entries) => resolve(entries),
              () => resolve([])
            );
          });
          if (batch.length === 0) break;
          all.push(...batch);
        }
        return all;
      };
      const entries = await readAll();
      for (const child of entries) {
        await traverseEntry(child, nextPrefix);
      }
    }
  };

  const items = Array.from(dataTransfer.items || []);
  const entries = items
    .map((it) => (typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => e !== null);

  if (entries.length > 0) {
    for (const entry of entries) {
      await traverseEntry(entry);
    }
    return results;
  }

  for (const file of Array.from(dataTransfer.files || [])) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    results.push({ path: rel, file, size: file.size });
  }
  return results;
}

const GENRES: Array<'Tous' | IndieGame['genre']> = [
  'Tous',
  'Action',
  'Sci-Fi',
  'RPG',
  'Puzzle',
  'Arcade',
  'Course',
];

const COVER_THEMES: Record<string, string> = {
  cyan: 'from-cyan-600/35 via-slate-900 to-[#080C15]',
  violet: 'from-violet-600/35 via-slate-900 to-[#080C15]',
  emerald: 'from-emerald-600/35 via-slate-900 to-[#080C15]',
  amber: 'from-amber-600/35 via-slate-900 to-[#080C15]',
  rose: 'from-rose-600/35 via-slate-900 to-[#080C15]',
};

const STARTER_ARCADE_HTML = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; background: #050811; color: #e2e8f0; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
  canvas { border: 1px solid #06b6d4; border-radius: 8px; background: radial-gradient(circle at center, #0b1426 0%, #050811 100%); }
  .hud { display: flex; gap: 24px; margin-bottom: 10px; font-weight: 700; font-size: 14px; letter-spacing: 0.05em; }
  .hint { margin-top: 8px; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="hud">
    <span>SCORE : <span id="score">0</span></span>
    <span>VIES : <span id="lives">3</span></span>
  </div>
  <canvas id="c" width="540" height="360"></canvas>
  <div class="hint">Flèches Gauche / Droite pour piloter · Espace pour tirer</div>
<script>
  const c = document.getElementById('c'), ctx = c.getContext('2d');
  let player = { x: 250, y: 320, w: 36, h: 16 };
  let bullets = [], enemies = [], score = 0, lives = 3, keys = {};
  onkeydown = e => { keys[e.code] = true; if (e.code === 'Space') bullets.push({ x: player.x + 18, y: player.y }); };
  onkeyup = e => keys[e.code] = false;
  setInterval(() => { if (lives > 0) enemies.push({ x: Math.random() * 500 + 10, y: -20, r: 12, s: 1.5 + Math.random() * 1.5 }); }, 800);
  function loop() {
    ctx.clearRect(0, 0, c.width, c.height);
    if (lives <= 0) {
      ctx.fillStyle = '#f43f5e'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('GAME OVER · SCORE ' + score, c.width / 2, c.height / 2);
      return;
    }
    if (keys.ArrowLeft && player.x > 10) player.x -= 5;
    if (keys.ArrowRight && player.x < c.width - player.w - 10) player.x += 5;
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath(); ctx.moveTo(player.x + 18, player.y); ctx.lineTo(player.x + 36, player.y + 18); ctx.lineTo(player.x, player.y + 18); ctx.fill();
    bullets = bullets.filter(b => b.y > -10);
    bullets.forEach(b => { b.y -= 7; ctx.fillStyle = '#facc15'; ctx.fillRect(b.x - 2, b.y, 4, 10); });
    enemies.forEach((en, ei) => {
      en.y += en.s;
      ctx.fillStyle = '#a855f7'; ctx.beginPath(); ctx.arc(en.x, en.y, en.r, 0, Math.PI * 2); ctx.fill();
      bullets.forEach((b, bi) => {
        if (Math.hypot(b.x - en.x, b.y - en.y) < en.r + 4) {
          enemies.splice(ei, 1); bullets.splice(bi, 1); score += 100;
          document.getElementById('score').textContent = score;
        }
      });
      if (en.y > c.height) { enemies.splice(ei, 1); lives--; document.getElementById('lives').textContent = lives; }
    });
    requestAnimationFrame(loop);
  }
  loop();
</script>
</body>
</html>`;

export const NovaJolt: React.FC<NovaJoltProps> = ({
  user,
  myHandle,
  onSignIn,
  onOpenChatModule,
  onLaunchHtmlGame,
  onLaunchPackageGame,
  onAwardXp,
}) => {
  const [games, setGames] = useState<IndieGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [genreFilter, setGenreFilter] = useState<'Tous' | IndieGame['genre']>('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');

  // Publish Modal State
  const [publishOpen, setPublishOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState<IndieGame['genre']>('Arcade');
  const [playType, setPlayType] = useState<IndieGame['playType']>('file_bundle');
  const [gameUrl, setGameUrl] = useState('');
  const [htmlCode, setHtmlCode] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingGameFile[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [coverTheme, setCoverTheme] = useState('cyan');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ sent: number; total: number } | null>(null);
  const filePickerRef = React.useRef<HTMLInputElement | null>(null);
  const folderPickerRef = React.useRef<HTMLInputElement | null>(null);
  const htmlFilePickerRef = React.useRef<HTMLInputElement | null>(null);

  // Selected Game Detail Drawer
  const [selectedGame, setSelectedGame] = useState<IndieGame | null>(null);
  const [selectedManifest, setSelectedManifest] = useState<PackageManifest | null>(null);
  const [likedByMe, setLikedByMe] = useState(false);
  const [comments, setComments] = useState<GameComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');

  // Load community games in real time
  useEffect(() => {
    const path = 'indie_games';
    const q = query(
      collection(db, path),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(60)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: IndieGame[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<IndieGame, 'id'>),
        }));
        setGames(items);
        setLoading(false);
        if (selectedGame) {
          const updated = items.find((g) => g.id === selectedGame.id);
          if (updated) setSelectedGame(updated);
        }
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load selected game like status & comments
  useEffect(() => {
    if (!selectedGame) return;

    const commentsPath = `indie_games/${selectedGame.id}/comments`;
    const unsubComments = onSnapshot(
      query(
        collection(db, commentsPath),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        limit(40)
      ),
      (snap) => {
        setComments(
          snap.docs.map((d) => {
            const data = d.data();
            const ts = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
            return {
              id: d.id,
              authorUid: data.authorUid,
              authorHandle: data.authorHandle,
              text: data.text,
              time: ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, commentsPath)
    );

    if (user) {
      getDoc(doc(db, `indie_games/${selectedGame.id}/likes`, user.uid))
        .then((snap) => setLikedByMe(snap.exists()))
        .catch(() => setLikedByMe(false));
    } else {
      setLikedByMe(false);
    }

    if (selectedGame.playType === 'file_bundle' && selectedGame.packageId) {
      fetch(`/api/game-packages/${encodeURIComponent(selectedGame.packageId)}/manifest`)
        .then(async (res) => {
          if (!res.ok) return null;
          const raw = await res.text();
          try {
            return JSON.parse(raw) as PackageManifest;
          } catch {
            return null;
          }
        })
        .then((data: PackageManifest | null) => setSelectedManifest(data))
        .catch(() => setSelectedManifest(null));
    } else {
      setSelectedManifest(null);
    }

    return () => unsubComments();
  }, [selectedGame?.id, selectedGame?.playType, selectedGame?.packageId, user]);

  const addSelectedFiles = (incoming: PendingGameFile[]) => {
    if (incoming.length === 0) return;
    setPendingFiles((prev) => {
      const map = new Map<string, PendingGameFile>();
      for (const item of prev) map.set(item.path, item);
      for (const item of incoming) map.set(item.path, item);
      return Array.from(map.values());
    });
    setPublishError(null);
    if (!title.trim()) {
      const firstPath = incoming[0].path;
      const topFolder = firstPath.includes('/')
        ? firstPath.split('/')[0]
        : firstPath.replace(/\.[^/.]+$/, '');
      if (topFolder.length >= 2) {
        setTitle(topFolder.slice(0, 60));
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const mapped: PendingGameFile[] = files.map((file) => {
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      return { path: rel, file, size: file.size };
    });
    addSelectedFiles(mapped);
    e.target.value = '';
  };

  const handleHtmlFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setHtmlCode(text.slice(0, 100000));
    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^/.]+$/, '').slice(0, 60));
    }
    e.target.value = '';
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !myHandle) return;
    if (title.trim().length < 2 || tagline.trim().length < 2 || description.trim().length < 5) {
      setPublishError('Veuillez remplir le titre, le slogan et la description (5 caractères min).');
      return;
    }
    if (playType === 'html5_code' && !htmlCode.trim()) {
      setPublishError('Ajoutez du code HTML5/JS ou cliquez sur "Charger un mini-jeu Spatial".');
      return;
    }
    if (playType === 'file_bundle' && pendingFiles.length === 0) {
      setPublishError('Sélectionnez au moins un fichier ou un dossier complet à publier.');
      return;
    }
    if ((playType === 'web_url' || playType === 'download_url') && !gameUrl.trim()) {
      setPublishError('Veuillez fournir une URL valide pour votre jeu.');
      return;
    }

    const totalSize = pendingFiles.reduce((sum, item) => sum + item.size, 0);

    setPublishError(null);
    setPublishing(true);
    setUploadProgress(playType === 'file_bundle' ? { sent: 0, total: pendingFiles.length } : null);
    try {
      let packageId = '';
      let entryFile = '';
      let filesCount = 0;
      let totalSizeBytes = 0;
      let filesPreview = '';

      if (playType === 'file_bundle') {
        const parseJsonResponse = async (res: Response, fallbackMsg: string) => {
          const raw = await res.text();
          try {
            return JSON.parse(raw) as Record<string, unknown>;
          } catch {
            throw new Error(`${fallbackMsg} (HTTP ${res.status})`);
          }
        };

        const initRes = await fetch('/api/game-packages/init', { method: 'POST' });
        const initData = await parseJsonResponse(initRes, 'Échec d’initialisation du dossier.');
        if (!initRes.ok || !initData.packageId) {
          throw new Error(String(initData.error || 'Échec d’initialisation du dossier.'));
        }

        const pkgId = String(initData.packageId);
        let sentCount = 0;
        let cursor = 0;
        const concurrency = 4;

        const worker = async () => {
          while (cursor < pendingFiles.length) {
            const idx = cursor++;
            const item = pendingFiles[idx];
            const uploadRes = await fetch(
              `/api/game-packages/${encodeURIComponent(pkgId)}/file`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/octet-stream',
                  'x-nova-file-path': encodeURIComponent(item.path),
                },
                body: item.file,
              }
            );
            if (!uploadRes.ok) {
              const rawErr = await uploadRes.text().catch(() => '');
              let parsedErr = '';
              try {
                parsedErr = String((JSON.parse(rawErr) as { error?: unknown })?.error || '');
              } catch {
                // ignore HTML error text
              }
              throw new Error(parsedErr || `Échec d’envoi pour ${item.path} (HTTP ${uploadRes.status})`);
            }
            sentCount++;
            setUploadProgress({ sent: sentCount, total: pendingFiles.length });
          }
        };

        await Promise.all(
          Array.from({ length: Math.min(concurrency, pendingFiles.length) }, () => worker())
        );

        const finRes = await fetch(
          `/api/game-packages/${encodeURIComponent(pkgId)}/finalize`,
          { method: 'POST' }
        );
        const uploadData = await parseJsonResponse(finRes, 'Échec de finalisation du dossier.');
        if (!finRes.ok) {
          throw new Error(String(uploadData.error || 'Échec de finalisation du dossier.'));
        }

        packageId = String(uploadData.packageId || pkgId);
        entryFile = String(uploadData.entryFile || '');
        filesCount = Number(uploadData.fileCount || pendingFiles.length);
        totalSizeBytes = Number(uploadData.totalBytes || totalSize);
        filesPreview = pendingFiles
          .slice(0, 30)
          .map((f) => `${f.path} (${formatBytes(f.size)})`)
          .join('\n')
          .slice(0, 1950);
      }

      const path = 'indie_games';
      await addDoc(collection(db, path), {
        title: title.trim().slice(0, 80),
        tagline: tagline.trim().slice(0, 140),
        description: description.trim().slice(0, 2000),
        genre,
        playType,
        gameUrl: gameUrl.trim().slice(0, 500),
        htmlCode: playType === 'html5_code' ? htmlCode.slice(0, 100000) : '',
        packageId,
        entryFile,
        filesCount,
        totalSizeBytes,
        filesPreview,
        coverTheme,
        authorUid: user.uid,
        authorHandle: myHandle.handle,
        likesCount: 0,
        playsCount: 0,
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTitle('');
      setTagline('');
      setDescription('');
      setGameUrl('');
      setHtmlCode('');
      setPendingFiles([]);
      setPublishOpen(false);
      onAwardXp(80, 'publish_game');
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Erreur lors de la publication.');
    } finally {
      setPublishing(false);
      setUploadProgress(null);
    }
  };

  const handlePlayGame = async (game: IndieGame) => {
    if (user) {
      try {
        await updateDoc(doc(db, 'indie_games', game.id), {
          playsCount: game.playsCount + 1,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `indie_games/${game.id}`);
      }
    }
    onAwardXp(35, 'play_game');

    if (game.playType === 'html5_code' && game.htmlCode) {
      onLaunchHtmlGame(game.title, game.htmlCode);
    } else if (game.playType === 'file_bundle' && game.packageId) {
      if (game.entryFile) {
        onLaunchPackageGame(
          game.title,
          `/api/game-packages/${encodeURIComponent(game.packageId)}/play/${encodePathSegments(game.entryFile)}`
        );
      } else {
        window.open(
          `/api/game-packages/${encodeURIComponent(game.packageId)}/archive.zip`,
          '_blank',
          'noopener,noreferrer'
        );
      }
    } else if (game.gameUrl) {
      window.open(game.gameUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleToggleLike = async (game: IndieGame) => {
    if (!user) {
      await onSignIn();
      return;
    }
    const gameRef = doc(db, 'indie_games', game.id);
    const likeRef = doc(db, `indie_games/${game.id}/likes`, user.uid);

    try {
      const batch = writeBatch(db);
      if (likedByMe) {
        batch.delete(likeRef);
        batch.update(gameRef, {
          likesCount: Math.max(0, game.likesCount - 1),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(likeRef, {
          uid: user.uid,
          createdAt: serverTimestamp(),
        });
        batch.update(gameRef, {
          likesCount: game.likesCount + 1,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setLikedByMe(!likedByMe);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `indie_games/${game.id}/likes/${user.uid}`);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !myHandle || !selectedGame || !commentDraft.trim()) return;
    const path = `indie_games/${selectedGame.id}/comments`;
    try {
      await addDoc(collection(db, path), {
        authorUid: user.uid,
        authorHandle: myHandle.handle,
        text: commentDraft.trim().slice(0, 600),
        isPublic: true,
        createdAt: serverTimestamp(),
      });
      setCommentDraft('');
      onAwardXp(10);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    try {
      await deleteDoc(doc(db, 'indie_games', gameId));
      setSelectedGame(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `indie_games/${gameId}`);
    }
  };

  const filteredGames = games
    .filter((g) => (genreFilter === 'Tous' ? true : g.genre === genreFilter))
    .filter((g) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        g.title.toLowerCase().includes(q) ||
        g.authorHandle.toLowerCase().includes(q) ||
        g.tagline.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (sortBy === 'popular' ? b.likesCount + b.playsCount - (a.likesCount + a.playsCount) : 0));

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-100">
            Nova Jolt — Plateforme Jeux Indépendants
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Publiez vos propres jeux HTML5, builds Web ou liens téléchargeables, et jouez aux créations de la communauté.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {!user ? (
            <button
              type="button"
              onClick={onSignIn}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Se connecter pour publier</span>
            </button>
          ) : !myHandle ? (
            <button
              type="button"
              onClick={onOpenChatModule}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-violet-500 text-white text-xs font-bold hover:bg-violet-400 transition-colors"
            >
              <span>Créer votre ID (@nom) pour publier</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPublishOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Publier un jeu</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {GENRES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenreFilter(g)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                genreFilter === g
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'bg-[#0D1320] border border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-slate-800 bg-[#080C15] flex-1 sm:flex-initial min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un jeu ou @créateur..."
              className="bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none w-full sm:w-48 min-w-0"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular')}
            className="h-9 px-2.5 rounded-md border border-slate-800 bg-[#0D1320] text-xs text-slate-200 shrink-0"
          >
            <option value="recent">Plus récents</option>
            <option value="popular">Plus populaires</option>
          </select>
        </div>
      </div>

      {/* Games Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-64 rounded-xl border border-slate-800 bg-[#0D1320] animate-pulse" />
          ))}
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="p-12 rounded-xl border border-slate-800 bg-[#0D1320] text-center space-y-3">
          <Gamepad2 className="w-10 h-10 text-cyan-400 mx-auto" />
          <h2 className="font-display text-lg font-bold text-slate-100">
            Aucun jeu publié dans cette catégorie
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Soyez le premier créateur à publier un jeu HTML5 jouable dans le navigateur ou un lien vers votre projet !
          </p>
          {user && myHandle && (
            <button
              type="button"
              onClick={() => setPublishOpen(true)}
              className="mt-2 px-4 py-2 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-colors"
            >
              Publier le premier jeu
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGames.map((game) => (
            <article
              key={game.id}
              className="rounded-xl border border-slate-800 bg-[#0D1320] overflow-hidden flex flex-col hover:border-cyan-500/45 transition-colors"
            >
              <div
                onClick={() => setSelectedGame(game)}
                className={`h-36 p-4 bg-gradient-to-br ${
                  COVER_THEMES[game.coverTheme] || COVER_THEMES.cyan
                } flex flex-col justify-between cursor-pointer border-b border-slate-800/80`}
              >
                <div className="flex items-center justify-between text-xs font-mono-tabular text-slate-300">
                  <span>{game.genre}</span>
                  <span>
                    {game.playType === 'html5_code'
                      ? 'HTML5 Direct'
                      : game.playType === 'file_bundle'
                      ? `Dossier (${game.filesCount || 1} fich.)`
                      : game.playType === 'web_url'
                      ? 'Web'
                      : 'Téléchargement'}
                  </span>
                </div>
                <h2 className="font-display text-xl font-bold text-slate-100 truncate">
                  {game.title}
                </h2>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <div className="text-xs font-mono-tabular text-cyan-300">
                    par @{game.authorHandle}
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 line-clamp-2">{game.tagline}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-3 text-xs font-mono-tabular text-slate-400">
                    <span>{game.playsCount} parties</span>
                    <span>·</span>
                    <span>{game.likesCount} j’aime</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedGame(game)}
                      className="px-2.5 py-1.5 rounded border border-slate-700 text-xs text-slate-200 hover:border-slate-500 transition-colors"
                    >
                      Fiche
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePlayGame(game)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      <span>Jouer</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* PUBLISH GAME MODAL */}
      {publishOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handlePublishSubmit}
            className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-[#0B101C] p-4 sm:p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="font-display text-xl font-bold text-slate-100">
                Publier un jeu sur Nova Jolt
              </h2>
              <button
                type="button"
                onClick={() => setPublishOpen(false)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-300">Titre du jeu</span>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ex: Star Interceptor DX"
                  className="w-full h-10 px-3 rounded-md border border-slate-700 bg-[#060910] text-sm text-slate-100"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-300">Genre</span>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value as IndieGame['genre'])}
                  className="w-full h-10 px-3 rounded-md border border-slate-700 bg-[#060910] text-sm text-slate-100"
                >
                  {GENRES.filter((g) => g !== 'Tous').map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">Slogan court</span>
              <input
                type="text"
                required
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="ex: Shooter arcade nerveux dans le secteur Nova-9"
                className="w-full h-10 px-3 rounded-md border border-slate-700 bg-[#060910] text-sm text-slate-100"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">Description & contrôles</span>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Expliquez le gameplay, les touches et l’objectif..."
                className="w-full p-3 rounded-md border border-slate-700 bg-[#060910] text-sm text-slate-100"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-300">Format du jeu</span>
                <select
                  value={playType}
                  onChange={(e) => setPlayType(e.target.value as IndieGame['playType'])}
                  className="w-full h-10 px-3 rounded-md border border-slate-700 bg-[#060910] text-sm text-slate-100"
                >
                  <option value="file_bundle">Fichiers ou Dossier complet (PC)</option>
                  <option value="html5_code">Jeu HTML5/JS jouable dans le navigateur</option>
                  <option value="web_url">Lien Web Playable (URL)</option>
                  <option value="download_url">Lien de téléchargement (Build)</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-300">Couleur de jaquette</span>
                <select
                  value={coverTheme}
                  onChange={(e) => setCoverTheme(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-700 bg-[#060910] text-sm text-slate-100"
                >
                  <option value="cyan">Cyan Électrique</option>
                  <option value="violet">Violet Cosmique</option>
                  <option value="emerald">Émeraude Matrix</option>
                  <option value="amber">Ambre Solaires</option>
                  <option value="rose">Hyper Drive Rose</option>
                </select>
              </label>
            </div>

            {playType === 'file_bundle' ? (
              <div className="space-y-3">
                <input
                  ref={filePickerRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <input
                  ref={folderPickerRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                  {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingFiles(true);
                  }}
                  onDragLeave={() => setIsDraggingFiles(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsDraggingFiles(false);
                    const dropped = await readDroppedEntries(e.dataTransfer);
                    addSelectedFiles(dropped);
                  }}
                  className={`p-5 rounded-lg border-2 border-dashed transition-colors text-center space-y-3 ${
                    isDraggingFiles
                      ? 'border-cyan-400 bg-cyan-500/10'
                      : 'border-slate-700 bg-[#060910]'
                  }`}
                >
                  <Upload className="w-7 h-7 text-cyan-400 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-200">
                      Ajoutez autant de dossiers et de fichiers que vous voulez (sans taille maximale)
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Jeux HTML5/JS (avec index.html, CSS, sprites, sons, vidéos 3D), archives .zip, builds ou ressources — ajoutez plusieurs dossiers à la suite !
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => filePickerRef.current?.click()}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                    >
                      <FileIcon className="w-3.5 h-3.5" />
                      <span>Ajouter des fichiers</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => folderPickerRef.current?.click()}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-violet-500/40 bg-violet-500/10 text-xs font-semibold text-violet-200 hover:bg-violet-500/20"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Ajouter un dossier</span>
                    </button>
                  </div>
                </div>

                {uploadProgress && (
                  <div className="p-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 space-y-1.5">
                    <div className="flex justify-between text-xs font-mono-tabular text-cyan-200">
                      <span>Envoi en cours (flux direct)...</span>
                      <span>
                        {uploadProgress.sent} / {uploadProgress.total} fichiers
                      </span>
                    </div>
                    <div className="h-2 rounded bg-slate-900 overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 transition-all duration-150"
                        style={{
                          width: `${Math.round((uploadProgress.sent / Math.max(1, uploadProgress.total)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {pendingFiles.length > 0 && (
                  <div className="p-3.5 rounded-lg border border-slate-800 bg-[#080C15] space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="font-mono-tabular text-cyan-300">
                        {pendingFiles.length} fichier(s) ·{' '}
                        {formatBytes(pendingFiles.reduce((s, f) => s + f.size, 0))} (Illimité)
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingFiles([])}
                        className="text-rose-300 hover:underline text-[11px]"
                      >
                        Tout retirer
                      </button>
                    </div>
                    {pendingFiles.some((f) => /\.(html|htm)$/i.test(f.path)) && (
                      <div className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-2.5 py-1.5">
                        Point d’entrée HTML détecté : ce dossier sera directement jouable dans un onglet Hyper Nova !
                      </div>
                    )}
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {pendingFiles.slice(0, 120).map((item) => (
                        <div
                          key={item.path}
                          className="flex items-center justify-between gap-3 text-[11px] font-mono-tabular text-slate-300 py-0.5 border-b border-slate-800/60 last:border-0"
                        >
                          <span className="truncate">{item.path}</span>
                          <span className="text-slate-500 shrink-0">{formatBytes(item.size)}</span>
                        </div>
                      ))}
                      {pendingFiles.length > 120 && (
                        <div className="text-[11px] text-slate-400 pt-1">
                          ... et {pendingFiles.length - 120} autres fichiers prêts à l’envoi.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : playType === 'html5_code' ? (
              <div className="space-y-2">
                <input
                  ref={htmlFilePickerRef}
                  type="file"
                  accept=".html,.htm"
                  className="hidden"
                  onChange={handleHtmlFileImport}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">
                    Code HTML5 / Canvas / JS complet
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => htmlFilePickerRef.current?.click()}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-violet-500/40 bg-violet-500/10 text-[11px] text-violet-200 hover:bg-violet-500/20"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>Importer un fichier .html</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHtmlCode(STARTER_ARCADE_HTML);
                        if (!title) setTitle('Nova Star Shooter');
                        if (!tagline) setTagline('Mini-jeu arcade spatial jouable directement dans Hyper Nova');
                        if (!description) setDescription('Détruisez les drones violets avec la barre espace et déplacez le vaisseau avec les flèches.');
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-cyan-500/40 bg-cyan-500/10 text-[11px] text-cyan-200 hover:bg-cyan-500/20"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Charger un mini-jeu Spatial</span>
                    </button>
                  </div>
                </div>
                <textarea
                  rows={5}
                  value={htmlCode}
                  onChange={(e) => setHtmlCode(e.target.value)}
                  placeholder="<!doctype html>..."
                  className="w-full p-3 rounded-md border border-slate-700 bg-[#060910] text-xs font-mono-tabular text-cyan-200"
                />
              </div>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-300">URL du jeu ou téléchargement</span>
                <input
                  type="url"
                  required
                  value={gameUrl}
                  onChange={(e) => setGameUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-10 px-3 rounded-md border border-slate-700 bg-[#060910] text-sm font-mono-tabular text-slate-100"
                />
              </label>
            )}

            {publishError && (
              <div className="p-3 rounded-md border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200">
                {publishError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setPublishOpen(false)}
                className="px-4 py-2 rounded-md border border-slate-700 text-xs text-slate-300 hover:text-slate-100"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={publishing}
                className="px-5 py-2 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 disabled:opacity-50"
              >
                {publishing ? 'Publication...' : 'Publier maintenant'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GAME DETAIL MODAL (Likes, Comments, Play, Delete) */}
      {selectedGame && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-[#0B101C]">
            <div
              className={`p-4 sm:p-6 bg-gradient-to-br ${
                COVER_THEMES[selectedGame.coverTheme] || COVER_THEMES.cyan
              } border-b border-slate-800 flex items-start justify-between gap-4`}
            >
              <div className="min-w-0">
                <div className="text-xs font-mono-tabular text-cyan-300">
                  {selectedGame.genre} · Créé par @{selectedGame.authorHandle}
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-100 mt-1 break-words">
                  {selectedGame.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">{selectedGame.tagline}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGame(null)}
                className="p-1.5 rounded bg-black/30 text-slate-300 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handlePlayGame(selectedGame)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-colors"
                  >
                    {selectedGame.playType === 'html5_code' ||
                    (selectedGame.playType === 'file_bundle' && selectedGame.entryFile) ? (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Jouer dans Hyper Nova</span>
                      </>
                    ) : selectedGame.playType === 'download_url' || selectedGame.playType === 'file_bundle' ? (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Télécharger</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        <span>Ouvrir le jeu</span>
                      </>
                    )}
                  </button>

                  {selectedGame.playType === 'file_bundle' && selectedGame.packageId && (
                    <a
                      href={`/api/game-packages/${encodeURIComponent(selectedGame.packageId)}/archive.zip`}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-md border border-violet-500/40 bg-violet-500/15 text-xs font-semibold text-violet-200 hover:bg-violet-500/25 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger le dossier (.zip)</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleToggleLike(selectedGame)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-md border text-xs font-semibold transition-colors ${
                      likedByMe
                        ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-rose-400/50'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${likedByMe ? 'fill-rose-400 text-rose-400' : ''}`} />
                    <span className="font-mono-tabular">{selectedGame.likesCount}</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono-tabular text-slate-400">
                  <span>{selectedGame.playsCount} parties jouées</span>
                  {user && selectedGame.authorUid === user.uid && (
                    <button
                      type="button"
                      onClick={() => handleDeleteGame(selectedGame.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-rose-500/40 text-rose-300 hover:bg-rose-500/15"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-800 bg-[#080C15] text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {selectedGame.description}
              </div>

              {selectedGame.playType === 'file_bundle' && selectedGame.packageId && (
                <div className="p-4 rounded-lg border border-slate-800 bg-[#080C15] space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-semibold text-slate-200">
                      <FolderOpen className="w-4 h-4 text-cyan-400" />
                      <span>
                        Fichiers publiés ({selectedGame.filesCount || selectedManifest?.fileCount || 0})
                      </span>
                    </div>
                    {typeof selectedGame.totalSizeBytes === 'number' && selectedGame.totalSizeBytes > 0 && (
                      <span className="font-mono-tabular text-slate-400">
                        {formatBytes(selectedGame.totalSizeBytes)}
                      </span>
                    )}
                  </div>

                  {selectedManifest && selectedManifest.files.length > 0 ? (
                    <div className="max-h-44 overflow-y-auto divide-y divide-slate-800/80 border border-slate-800/80 rounded bg-[#05080F]">
                      {selectedManifest.files.map((f) => (
                        <div
                          key={f.path}
                          className="px-3 py-1.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="font-mono-tabular text-slate-300 truncate">{f.path}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono-tabular text-slate-500">{formatBytes(f.size)}</span>
                            <a
                              href={`/api/game-packages/${encodeURIComponent(
                                selectedGame.packageId || ''
                              )}/play/${encodePathSegments(f.path)}?download=1`}
                              className="text-cyan-300 hover:underline"
                            >
                              Télécharger
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : selectedGame.filesPreview ? (
                    <pre className="text-[11px] font-mono-tabular text-slate-400 whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {selectedGame.filesPreview}
                    </pre>
                  ) : null}
                </div>
              )}

              {/* Comments Section */}
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span>Avis & Commentaires ({comments.length})</span>
                </div>

                {user && myHandle ? (
                  <form onSubmit={handlePostComment} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder={`Commenter en tant que @${myHandle.handle}...`}
                      className="flex-1 min-w-0 h-9 px-3 rounded-md border border-slate-700 bg-[#060910] text-xs text-slate-100"
                    />
                    <button
                      type="submit"
                      disabled={!commentDraft.trim()}
                      className="h-9 px-3 sm:px-4 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 disabled:opacity-40 shrink-0"
                    >
                      Publier
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-slate-500">
                    Connectez-vous avec votre compte Nova Chat pour laisser un commentaire.
                  </p>
                )}

                <div className="space-y-2.5 max-h-52 overflow-y-auto">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-lg border border-slate-800/90 bg-[#080C15] text-xs"
                    >
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="font-mono-tabular font-semibold text-cyan-300">
                          @{c.authorHandle}
                        </span>
                        <span className="font-mono-tabular">{c.time}</span>
                      </div>
                      <p className="text-slate-200">{c.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
