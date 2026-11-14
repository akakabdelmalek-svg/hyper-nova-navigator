import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  Video,
  Send,
  Users,
  Lock,
  EyeOff,
  PhoneOff,
  Mic,
  MicOff,
  UserPlus,
  LogIn,
  LogOut,
  Copy,
  Check,
  Search,
  Trash2,
  ArrowLeftRight,
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
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ChatHandle, ChatMessageItem, ContactEntry, DirectMessageRoom } from '../types/nova';

interface NovaChatProps {
  user: User | null;
  myHandle: ChatHandle | null;
  handleLoading: boolean;
  authError?: string | null;
  streamerMode: boolean;
  onSignIn: () => Promise<void>;
  onSignInRedirect?: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onRegisterHandle: (handle: string, displayName: string, color: string) => Promise<void>;
  onAwardXp: (amount: number, achievementKey?: string) => void;
}

const ANIMATED_EMOJIS = ['🚀', '⚡', '🔥', '👑', '🎮'];
const AVATAR_COLORS = ['#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#3B82F6'];

export const NovaChat: React.FC<NovaChatProps> = ({
  user,
  myHandle,
  handleLoading,
  authError,
  streamerMode,
  onSignIn,
  onSignInRedirect,
  onSignOut,
  onRegisterHandle,
  onAwardXp,
}) => {
  // Handle registration form
  const [newHandleInput, setNewHandleInput] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerBusy, setRegisterBusy] = useState(false);

  // Add friend by ID (handle) as Private or Squad
  const [friendHandleInput, setFriendHandleInput] = useState('');
  const [contactCategory, setContactCategory] = useState<'private' | 'squad'>('private');
  const [friendStatusMsg, setFriendStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [addingFriend, setAddingFriend] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Channels, Contacts, DM Rooms, Messages
  const [activeTarget, setActiveTarget] = useState<{
    kind: 'squad' | 'dm';
    id: string;
    title: string;
    subtitle: string;
  }>({
    kind: 'squad',
    id: 'squad',
    title: 'Squad Nova Prime',
    subtitle: 'Canal communautaire temps réel',
  });

  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [dmRooms, setDmRooms] = useState<DirectMessageRoom[]>([]);
  const [publicHandles, setPublicHandles] = useState<ChatHandle[]>([]);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [activeCall, setActiveCall] = useState<{ mode: 'voice' | 'video'; channelName: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const [mobilePane, setMobilePane] = useState<'channels' | 'chat'>('channels');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (user?.displayName && !newDisplayName) {
      setNewDisplayName(user.displayName.slice(0, 32));
    }
  }, [user, newDisplayName]);

  // Listen to Contacts, DM Rooms, and Directory when signed in & handle registered
  useEffect(() => {
    if (!user || !myHandle) return;

    const contactsPath = `users/${user.uid}/contacts`;
    const unsubContacts = onSnapshot(
      query(collection(db, contactsPath), where('ownerUid', '==', user.uid)),
      (snap) => {
        const list: ContactEntry[] = snap.docs.map((d) => d.data() as ContactEntry);
        setContacts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, contactsPath)
    );

    const dmRoomsPath = 'dm_rooms';
    const unsubRooms = onSnapshot(
      query(collection(db, dmRoomsPath), where('participants', 'array-contains', user.uid)),
      (snap) => {
        const list: DirectMessageRoom[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DirectMessageRoom, 'id'>),
        }));
        setDmRooms(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, dmRoomsPath)
    );

    const handlesPath = 'handles';
    const unsubHandles = onSnapshot(
      query(collection(db, handlesPath), where('isPublic', '==', true), limit(20)),
      (snap) => {
        const list: ChatHandle[] = snap.docs
          .map((d) => d.data() as ChatHandle)
          .filter((h) => h.uid !== user.uid);
        setPublicHandles(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, handlesPath)
    );

    return () => {
      unsubContacts();
      unsubRooms();
      unsubHandles();
    };
  }, [user, myHandle]);

  // Listen to Active Conversation Messages (no composite index required — chronological sort in JS)
  useEffect(() => {
    if (!user || !myHandle) return;

    if (activeTarget.kind === 'squad') {
      const path = 'squad_messages';
      const q = query(
        collection(db, path),
        where('isPublic', '==', true),
        limit(200)
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs
            .map((d) => ({ id: d.id, data: d.data() }))
            .filter(({ data }) => (data.channelId || 'squad') === activeTarget.id)
            .sort((a, b) => {
              const ta = a.data.createdAt?.toMillis ? a.data.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
              const tb = b.data.createdAt?.toMillis ? b.data.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
              return ta - tb;
            })
            .slice(-80)
            .map(({ id, data }) => {
              const ts = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
              return {
                id,
                senderUid: data.senderUid,
                senderHandle: data.senderHandle,
                avatarColor: data.avatarColor,
                text: data.text,
                emojiReaction: data.emojiReaction,
                time: ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              } as ChatMessageItem;
            });
          setMessages(items);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, path)
      );
      return () => unsub();
    } else {
      const path = `dm_rooms/${activeTarget.id}/messages`;
      const q = query(
        collection(db, path),
        where('participants', 'array-contains', user.uid),
        limit(200)
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs
            .map((d) => ({ id: d.id, data: d.data() }))
            .sort((a, b) => {
              const ta = a.data.createdAt?.toMillis ? a.data.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
              const tb = b.data.createdAt?.toMillis ? b.data.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
              return ta - tb;
            })
            .slice(-80)
            .map(({ id, data }) => {
              const ts = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
              return {
                id,
                senderUid: data.senderUid,
                senderHandle: data.senderHandle,
                avatarColor: data.avatarColor,
                text: data.text,
                emojiReaction: data.emojiReaction,
                time: ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              } as ChatMessageItem;
            });
          setMessages(items);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, path)
      );
      return () => unsub();
    }
  }, [user, myHandle, activeTarget]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClaimAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newHandleInput.trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_-]{3,24}$/.test(cleaned)) {
      setRegisterError('ID invalide : utilisez 3 à 24 caractères (lettres minuscules, chiffres, _ ou -).');
      return;
    }
    if (!newDisplayName.trim()) {
      setRegisterError('Veuillez indiquer un nom d’affichage.');
      return;
    }
    setRegisterError(null);
    setRegisterBusy(true);
    try {
      await onRegisterHandle(cleaned, newDisplayName.trim().slice(0, 40), selectedColor);
    } catch (err: unknown) {
      setRegisterError(err instanceof Error ? err.message : 'Erreur lors de la création de votre ID.');
    } finally {
      setRegisterBusy(false);
    }
  };

  const openOrCreateDmWithContact = async (targetUid: string, targetHandle: string, targetDisplay: string) => {
    if (!user || !myHandle) return;
    const sortedUids = [user.uid, targetUid].sort();
    const roomId = `${sortedUids[0]}_${sortedUids[1]}`;
    const roomRef = doc(db, 'dm_rooms', roomId);

    try {
      const existingRoom = await getDoc(roomRef);
      if (!existingRoom.exists()) {
        const sortedHandles =
          sortedUids[0] === user.uid
            ? [myHandle.handle, targetHandle]
            : [targetHandle, myHandle.handle];
        await setDoc(roomRef, {
          participants: sortedUids,
          participantHandles: sortedHandles,
          lastMessage: 'Canal privé ouvert',
          updatedAt: serverTimestamp(),
        });
      }
      setActiveTarget({
        kind: 'dm',
        id: roomId,
        title: `${targetDisplay} (@${targetHandle})`,
        subtitle: `Discussion directe · ID @${targetHandle}`,
      });
      setMobilePane('chat');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `dm_rooms/${roomId}`);
    }
  };

  const handleAddFriendById = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !myHandle) return;
    const normalized = friendHandleInput.trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_-]{3,24}$/.test(normalized)) {
      setFriendStatusMsg({ type: 'err', text: 'Format ID invalide (3–24 caractères a-z, 0-9, _, -).' });
      return;
    }
    if (normalized === myHandle.handle) {
      setFriendStatusMsg({ type: 'err', text: 'Vous ne pouvez pas vous ajouter vous-même.' });
      return;
    }

    setAddingFriend(true);
    setFriendStatusMsg(null);
    try {
      const targetDoc = await getDoc(doc(db, 'handles', normalized));
      if (!targetDoc.exists()) {
        setFriendStatusMsg({ type: 'err', text: `Aucun compte trouvé avec l’ID "@${normalized}".` });
        return;
      }
      const target = targetDoc.data() as ChatHandle;

      const contactRef = doc(db, `users/${user.uid}/contacts`, target.uid);
      const batch = writeBatch(db);
      batch.set(contactRef, {
        ownerUid: user.uid,
        contactUid: target.uid,
        contactHandle: target.handle,
        displayName: target.displayName,
        avatarColor: target.avatarColor,
        category: contactCategory,
        addedAt: serverTimestamp(),
      });
      await batch.commit();

      setFriendHandleInput('');
      setFriendStatusMsg({
        type: 'ok',
        text: `@${target.handle} ajouté (${contactCategory === 'squad' ? 'Squad' : 'Privé'}) !`,
      });
      onAwardXp(20, 'social_pilot');
      await openOrCreateDmWithContact(target.uid, target.handle, target.displayName);
      window.setTimeout(() => setFriendStatusMsg(null), 3500);
    } catch (err) {
      setFriendStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erreur lors de l’ajout du contact.',
      });
    } finally {
      setAddingFriend(false);
    }
  };

  const handleDeleteContact = async (contactUid: string, contactHandle: string) => {
    if (!user) return;
    const path = `users/${user.uid}/contacts/${contactUid}`;
    try {
      await deleteDoc(doc(db, path));
      const roomId = [user.uid, contactUid].sort().join('_');
      if (activeTarget.kind === 'dm' && activeTarget.id === roomId) {
        setActiveTarget({
          kind: 'squad',
          id: 'squad',
          title: 'Squad Nova Prime',
          subtitle: 'Canal communautaire temps réel',
        });
      }
      setFriendStatusMsg({ type: 'ok', text: `@${contactHandle} effacé des contacts.` });
      window.setTimeout(() => setFriendStatusMsg(null), 2500);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleToggleContactCategory = async (c: ContactEntry) => {
    if (!user) return;
    const nextCat = c.category === 'squad' ? 'private' : 'squad';
    const path = `users/${user.uid}/contacts/${c.contactUid}`;
    try {
      await updateDoc(doc(db, path), { category: nextCat });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !myHandle || !draft.trim()) return;
    const text = draft.trim().slice(0, 1000);
    setDraft('');

    if (activeTarget.kind === 'squad') {
      const path = 'squad_messages';
      try {
        await addDoc(collection(db, path), {
          channelId: activeTarget.id,
          senderUid: user.uid,
          senderHandle: myHandle.handle,
          avatarColor: myHandle.avatarColor,
          text,
          isPublic: true,
          createdAt: serverTimestamp(),
        });
        onAwardXp(5);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    } else {
      const roomRef = doc(db, 'dm_rooms', activeTarget.id);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) return;
      const roomData = roomSnap.data() as DirectMessageRoom;
      const msgRef = doc(collection(db, `dm_rooms/${activeTarget.id}/messages`));

      try {
        const batch = writeBatch(db);
        batch.set(msgRef, {
          senderUid: user.uid,
          senderHandle: myHandle.handle,
          avatarColor: myHandle.avatarColor,
          text,
          participants: roomData.participants,
          createdAt: serverTimestamp(),
        });
        batch.update(roomRef, {
          lastMessage: text.slice(0, 200),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        onAwardXp(10, 'social_pilot');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `dm_rooms/${activeTarget.id}/messages`);
      }
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user || !myHandle) return;
    const docPath =
      activeTarget.kind === 'squad'
        ? `squad_messages/${messageId}`
        : `dm_rooms/${activeTarget.id}/messages/${messageId}`;
    try {
      await updateDoc(doc(db, docPath), { emojiReaction: emoji });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    }
  };

  // Gate 1: Sign in required for Nova Chat Account
  if (!user) {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
    return (
      <div className="h-full flex items-center justify-center p-6 overflow-y-auto">
        <div className="max-w-md w-full p-7 rounded-xl border border-slate-800 bg-[#0D1320] text-center space-y-5">
          <div className="w-12 h-12 mx-auto rounded-xl border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center text-cyan-300">
            <Users className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-slate-100">
              Compte Nova Chat
            </h1>
            <p className="text-sm text-slate-400">
              Connectez-vous pour obtenir votre identifiant unique (@id), ajouter des amis par leur nom/ID et discuter en temps réel.
            </p>
          </div>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onSignIn}
              className="w-full flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-cyan-500 text-slate-950 text-sm font-bold hover:bg-cyan-400 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Se connecter avec Google</span>
            </button>
            {onSignInRedirect && (
              <button
                type="button"
                onClick={onSignInRedirect}
                className="w-full h-9 px-4 rounded-lg border border-slate-700 bg-[#080C15] text-xs font-medium text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200 transition-colors"
              >
                Connexion alternative (redirection)
              </button>
            )}
          </div>

          {authError === 'UNAUTHORIZED_DOMAIN' ? (
            <div className="p-4 rounded-lg border border-amber-500/45 bg-amber-500/10 text-left space-y-2.5">
              <div className="text-xs font-bold text-amber-300">
                Domaine Vercel non autorisé dans Firebase Auth
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Pour activer la connexion Google sur ce déploiement, ajoutez ce domaine dans{' '}
                <span className="font-semibold text-white">
                  Firebase Console → Authentication → Settings → Authorized domains
                </span>{' '}
                :
              </p>
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-[#070B13] border border-slate-700">
                <code className="text-[11px] font-mono-tabular text-cyan-300 truncate">
                  {currentHost}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(currentHost);
                    setCopiedId(true);
                    window.setTimeout(() => setCopiedId(false), 2000);
                  }}
                  className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 shrink-0"
                >
                  {copiedId ? 'Copié !' : 'Copier'}
                </button>
              </div>
              <a
                href="https://console.firebase.google.com/project/gen-lang-client-0373523970/authentication/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[11px] font-semibold text-amber-300 hover:underline"
              >
                Ouvrir Firebase Authorized Domains →
              </a>
            </div>
          ) : authError ? (
            <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200 text-left">
              {authError}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (handleLoading) {
    return (
      <div className="h-full flex items-center justify-center text-sm font-mono-tabular text-cyan-300">
        Chargement de votre compte Nova Chat...
      </div>
    );
  }

  // Gate 2: Claim Unique Chat ID (Handle)
  if (!myHandle) {
    return (
      <div className="h-full flex items-center justify-center p-6 overflow-y-auto">
        <form
          onSubmit={handleClaimAccount}
          className="max-w-md w-full p-7 rounded-xl border border-slate-800 bg-[#0D1320] space-y-5"
        >
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-slate-100">
              Créer votre ID Nova Chat
            </h1>
            <p className="text-xs text-slate-400">
              Cet identifiant unique permet à n’importe quel joueur de vous retrouver et vous ajouter en un clic.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Votre ID unique (nom de compte)</span>
            <div className="flex items-center h-10 px-3 rounded-md border border-slate-700 bg-[#080C15] focus-within:border-cyan-400">
              <span className="text-cyan-400 font-mono-tabular text-sm mr-1">@</span>
              <input
                type="text"
                required
                value={newHandleInput}
                onChange={(e) => setNewHandleInput(e.target.value.toLowerCase())}
                placeholder="ex: malek_prime"
                className="w-full bg-transparent text-sm font-mono-tabular text-slate-100 placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Nom affiché</span>
            <input
              type="text"
              required
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="ex: Malek"
              className="w-full h-10 px-3 rounded-md border border-slate-700 bg-[#080C15] text-sm text-slate-100 focus:outline-none focus:border-cyan-400"
            />
          </label>

          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-300 block">Couleur d’avatar</span>
            <div className="flex items-center gap-2.5">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  style={{ backgroundColor: color }}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    selectedColor === color ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {registerError && (
            <div className="p-3 rounded-md border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200">
              {registerError}
            </div>
          )}

          <button
            type="submit"
            disabled={registerBusy}
            className="w-full h-11 rounded-lg bg-cyan-500 text-slate-950 text-sm font-bold hover:bg-cyan-400 disabled:opacity-50 transition-colors"
          >
            {registerBusy ? 'Enregistrement...' : 'Activer mon compte Chat'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Channel & Contacts Sidebar */}
      <aside
        className={`${
          mobilePane === 'channels' ? 'flex w-full' : 'hidden'
        } md:flex md:w-64 lg:w-72 shrink-0 border-r border-slate-800/80 bg-[#090D16] flex-col`}
      >
        {/* Own Account Header */}
        <div className="p-4 border-b border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display text-base font-bold text-slate-100 truncate">
                {myHandle.displayName}
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(myHandle.handle);
                  setCopiedId(true);
                  window.setTimeout(() => setCopiedId(false), 2000);
                }}
                className="flex items-center gap-1.5 text-xs font-mono-tabular text-cyan-300 hover:text-cyan-200 mt-0.5"
              >
                <span>ID : @{myHandle.handle}</span>
                {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              title="Déconnexion"
              className="p-2 rounded-md border border-slate-800 text-slate-400 hover:text-slate-100 hover:border-slate-600 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add friend by ID (name) as Private or Squad */}
          <form onSubmit={handleAddFriendById} className="space-y-2">
            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-md border border-slate-800 bg-[#060910]">
              <button
                type="button"
                onClick={() => setContactCategory('private')}
                className={`py-1 rounded text-[11px] font-semibold transition-colors ${
                  contactCategory === 'private'
                    ? 'bg-violet-500/25 text-violet-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Contact Privé
              </button>
              <button
                type="button"
                onClick={() => setContactCategory('squad')}
                className={`py-1 rounded text-[11px] font-semibold transition-colors ${
                  contactCategory === 'squad'
                    ? 'bg-cyan-500/25 text-cyan-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Contact Squad
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 flex-1 h-8 px-2.5 rounded-md border border-slate-800 bg-[#060910] focus-within:border-cyan-400">
                <Search className="w-3 h-3 text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={friendHandleInput}
                  onChange={(e) => setFriendHandleInput(e.target.value)}
                  placeholder="Ajouter un ID (@nom)..."
                  className="w-full bg-transparent text-xs font-mono-tabular text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={addingFriend || !friendHandleInput.trim()}
                title="Ajouter par ID"
                className="flex items-center justify-center w-8 h-8 rounded-md bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-40 transition-colors shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            </div>
            {friendStatusMsg && (
              <div
                className={`text-[11px] ${
                  friendStatusMsg.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {friendStatusMsg.text}
              </div>
            )}
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {/* Public Squad Channels */}
          <div>
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Canaux Publics
            </div>
            <div className="space-y-1">
              {[
                { id: 'squad', title: 'Squad Nova Prime', subtitle: 'Canal communautaire temps réel' },
                { id: 'dev', title: 'Hyper Nova Dev', subtitle: 'Partage de code & jeux HTML5' },
              ].map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setActiveTarget({ kind: 'squad', ...ch });
                    setMobilePane('chat');
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center gap-2 transition-colors ${
                    activeTarget.kind === 'squad' && activeTarget.id === ch.id
                      ? 'bg-cyan-500/15 text-cyan-200 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{ch.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Squad Contacts */}
          <div>
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Contacts Squad ({contacts.filter((c) => c.category === 'squad').length})
            </div>
            {contacts.filter((c) => c.category === 'squad').length === 0 ? (
              <p className="px-2 text-xs text-slate-500">Aucun contact Squad.</p>
            ) : (
              <div className="space-y-1">
                {contacts
                  .filter((c) => c.category === 'squad')
                  .map((c) => {
                    const roomId = [user.uid, c.contactUid].sort().join('_');
                    const isActive = activeTarget.kind === 'dm' && activeTarget.id === roomId;
                    return (
                      <div
                        key={c.contactUid}
                        className={`group flex items-center justify-between gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                          isActive
                            ? 'bg-cyan-500/15 text-cyan-200 font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            openOrCreateDmWithContact(c.contactUid, c.contactHandle, c.displayName)
                          }
                          className="flex items-center gap-2 min-w-0 flex-1 text-left"
                        >
                          <Users className="w-3.5 h-3.5 shrink-0" style={{ color: c.avatarColor }} />
                          <span className="truncate">
                            {streamerMode ? 'Membre Squad' : `${c.displayName} (@${c.contactHandle})`}
                          </span>
                        </button>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleContactCategory(c)}
                            title="Déplacer vers Contacts Privés"
                            className="p-1 rounded text-slate-500 hover:text-violet-300 transition-colors"
                          >
                            <ArrowLeftRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteContact(c.contactUid, c.contactHandle)}
                            title="Effacer ce contact"
                            aria-label={`Effacer ${c.contactHandle}`}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Private Contacts */}
          <div>
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Contacts Privés ({contacts.filter((c) => c.category !== 'squad').length})
            </div>
            {contacts.filter((c) => c.category !== 'squad').length === 0 ? (
              <p className="px-2 text-xs text-slate-500">
                Ajoutez un ami par son @ID ci-dessus.
              </p>
            ) : (
              <div className="space-y-1">
                {contacts
                  .filter((c) => c.category !== 'squad')
                  .map((c) => {
                    const roomId = [user.uid, c.contactUid].sort().join('_');
                    const isActive = activeTarget.kind === 'dm' && activeTarget.id === roomId;
                    return (
                      <div
                        key={c.contactUid}
                        className={`group flex items-center justify-between gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                          isActive
                            ? 'bg-violet-500/15 text-violet-200 font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            openOrCreateDmWithContact(c.contactUid, c.contactHandle, c.displayName)
                          }
                          className="flex items-center gap-2 min-w-0 flex-1 text-left"
                        >
                          <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: c.avatarColor }} />
                          <span className="truncate">
                            {streamerMode ? 'Ami masqué' : `${c.displayName} (@${c.contactHandle})`}
                          </span>
                        </button>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleContactCategory(c)}
                            title="Déplacer vers Contacts Squad"
                            className="p-1 rounded text-slate-500 hover:text-cyan-300 transition-colors"
                          >
                            <ArrowLeftRight className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteContact(c.contactUid, c.contactHandle)}
                            title="Effacer ce contact"
                            aria-label={`Effacer ${c.contactHandle}`}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Incoming DM Rooms from players who added you */}
          {dmRooms.length > 0 && (
            <div>
              <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Messages Directs ({dmRooms.length})
              </div>
              <div className="space-y-1">
                {dmRooms.map((room) => {
                  const otherHandle =
                    room.participantHandles.find((h) => h !== myHandle.handle) || room.participantHandles[0];
                  const isActive = activeTarget.kind === 'dm' && activeTarget.id === room.id;
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => {
                        setActiveTarget({
                          kind: 'dm',
                          id: room.id,
                          title: `@${otherHandle}`,
                          subtitle: `Discussion directe · ID @${otherHandle}`,
                        });
                        setMobilePane('chat');
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors ${
                        isActive
                          ? 'bg-violet-500/15 text-violet-200 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="truncate">
                        {streamerMode ? 'Conversation privée' : `@${otherHandle}`}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {streamerMode ? 'Masqué' : room.lastMessage}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Discoverable Registered Accounts */}
          {publicHandles.length > 0 && (
            <div>
              <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Joueurs en Ligne
              </div>
              <div className="space-y-1">
                {publicHandles.map((h) => (
                  <button
                    key={h.handle}
                    type="button"
                    onClick={() => setFriendHandleInput(h.handle)}
                    className="w-full text-left px-2.5 py-1.5 rounded text-xs text-slate-400 hover:text-cyan-200 hover:bg-slate-800/40 flex items-center justify-between transition-colors"
                  >
                    <span className="truncate">{streamerMode ? 'Joueur' : h.displayName}</span>
                    <span className="font-mono-tabular text-[11px] text-slate-500">@{h.handle}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Conversation Stage */}
      <div
        className={`${
          mobilePane === 'chat' ? 'flex w-full' : 'hidden'
        } md:flex flex-1 flex-col min-w-0 bg-[#070A11]`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-6 py-3 border-b border-slate-800/80 bg-[#0B101B]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobilePane('channels')}
              className="md:hidden px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-xs font-semibold text-cyan-300 shrink-0"
            >
              ← Canaux
            </button>
            <div className="min-w-0">
              <div className="font-display text-sm sm:text-base font-bold text-slate-100 truncate">
                {streamerMode && activeTarget.kind === 'dm'
                  ? 'Conversation Privée Masquée'
                  : activeTarget.title}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-400 truncate">{activeTarget.subtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveCall({ mode: 'voice', channelName: activeTarget.title })}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-xs font-medium text-slate-200 hover:border-cyan-400/60 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Appel vocal</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCall({ mode: 'video', channelName: activeTarget.title })}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-xs font-medium text-slate-200 hover:border-violet-400/60 transition-colors"
            >
              <Video className="w-3.5 h-3.5 text-violet-400" />
              <span className="hidden sm:inline">Appel vidéo</span>
            </button>
          </div>
        </div>

        {activeCall && (
          <div className="mx-3 sm:mx-6 mt-3 sm:mt-4 p-3 sm:p-4 rounded-lg border border-cyan-500/40 bg-[#0D1626] flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                {activeCall.mode === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  {activeCall.mode === 'video' ? 'Appel vidéo actif' : 'Canal vocal actif'} ·{' '}
                  {streamerMode ? 'Protégé' : activeCall.channelName}
                </div>
                <div className="text-xs font-mono-tabular text-emerald-400">
                  Latence 9 ms · Opus HD 96 kbps
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="p-2 rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
                aria-label="Couper le micro"
              >
                {muted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
              </button>
              <button
                type="button"
                onClick={() => setActiveCall(null)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 transition-colors"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Raccrocher</span>
              </button>
            </div>
          </div>
        )}

        {streamerMode && activeTarget.kind === 'dm' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <EyeOff className="w-10 h-10 text-violet-400 mb-3" />
            <h2 className="font-display text-lg font-bold text-slate-100">Mode Streamer Actif</h2>
            <p className="text-sm text-slate-400 max-w-md mt-1">
              Les messages privés sont masqués automatiquement pour protéger votre stream.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 text-xs text-slate-500">
                Aucun message pour le moment. Envoyez le premier message !
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.senderUid === user.uid;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <span className="font-semibold font-mono-tabular" style={{ color: msg.avatarColor }}>
                      @{msg.senderHandle}
                    </span>
                    <span>·</span>
                    <span className="font-mono-tabular">{msg.time}</span>
                  </div>
                  <div
                    className={`max-w-[85%] sm:max-w-lg px-3.5 sm:px-4 py-2.5 rounded-lg border text-sm break-words ${
                      isMe
                        ? 'bg-cyan-500/15 border-cyan-500/35 text-slate-100'
                        : 'bg-[#0D1320] border-slate-800 text-slate-200'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {msg.emojiReaction && (
                      <span className="text-sm animate-bounce">{msg.emojiReaction}</span>
                    )}
                    {ANIMATED_EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => handleReaction(msg.id, em)}
                        className="text-xs opacity-45 hover:opacity-100 hover:scale-125 transition-all px-1"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        <form
          onSubmit={handleSendMessage}
          className="p-2.5 sm:p-4 border-t border-slate-800/80 bg-[#0B101B] flex items-center gap-2 sm:gap-2.5"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Envoyer un message en tant que @${myHandle.handle}...`}
            className="flex-1 min-w-0 h-10 px-3 sm:px-3.5 rounded-md border border-slate-800 bg-[#060910] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex items-center gap-1.5 h-10 px-3 sm:px-4 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Envoyer</span>
          </button>
        </form>
      </div>
    </div>
  );
};
