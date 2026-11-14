import React, { useState } from 'react';
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  ShieldCheck,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { ChatHandle } from '../types/nova';

interface AuthViewProps {
  user: User | null;
  myHandle: ChatHandle | null;
  authError: string | null;
  onClearError: () => void;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onEmailSignUp: (displayName: string, email: string, password: string) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignInRedirect: () => Promise<void>;
  onResendVerification: () => Promise<void>;
  onRefreshUser: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenChat?: () => void;
  onOpenProfile?: () => void;
  compact?: boolean;
}

export const AuthView: React.FC<AuthViewProps> = ({
  user,
  myHandle,
  authError,
  onClearError,
  onEmailSignIn,
  onEmailSignUp,
  onPasswordReset,
  onGoogleSignIn,
  onGoogleSignInRedirect,
  onResendVerification,
  onRefreshUser,
  onSignOut,
  onOpenChat,
  onOpenProfile,
  compact = false,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const activeError = localError || authError;

  const switchMode = (next: 'signin' | 'signup' | 'reset') => {
    setMode(next);
    setLocalError(null);
    setStatusMessage(null);
    onClearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setStatusMessage(null);
    onClearError();

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setLocalError('Veuillez saisir une adresse email valide.');
      return;
    }

    if (mode === 'reset') {
      setBusy(true);
      try {
        await onPasswordReset(cleanEmail);
        setStatusMessage(
          `Email de réinitialisation envoyé à ${cleanEmail}. Vérifiez votre boîte de réception (et les spams).`
        );
      } catch (err: unknown) {
        setLocalError(err instanceof Error ? err.message : 'Impossible d’envoyer l’email.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (password.length < 6) {
      setLocalError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (mode === 'signup') {
      if (!displayName.trim()) {
        setLocalError('Veuillez indiquer votre nom de pilote / pseudo.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Les deux mots de passe ne correspondent pas.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await onEmailSignIn(cleanEmail, password);
      } else {
        await onEmailSignUp(displayName.trim(), cleanEmail, password);
        setStatusMessage(
          'Compte créé ! Un email de vérification vient d’être envoyé pour activer toutes les fonctions communautaires.'
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message) {
        setLocalError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setLocalError(null);
    setStatusMessage(null);
    setBusy(true);
    try {
      await onResendVerification();
      setStatusMessage('Email de vérification renvoyé. Consultez votre boîte mail (ou spams).');
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Erreur lors de l’envoi.');
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshStatus = async () => {
    setLocalError(null);
    setStatusMessage(null);
    setBusy(true);
    try {
      await onRefreshUser();
      setStatusMessage('Statut du compte actualisé.');
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Impossible d’actualiser le compte.');
    } finally {
      setBusy(false);
    }
  };

  // Signed-in account management view
  if (user) {
    return (
      <div className={compact ? 'w-full' : 'h-full overflow-y-auto p-4 sm:p-8 flex items-center justify-center'}>
        <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-[#0D1320] p-6 sm:p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Pilote'}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-xl border border-cyan-500/40 object-cover shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center text-cyan-300 shrink-0">
                  <UserIcon className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-mono-tabular text-cyan-300 truncate">
                  {myHandle ? `@${myHandle.handle}` : 'Compte Hyper Nova connecté'}
                </div>
                <h1 className="font-display text-xl font-bold text-slate-100 truncate mt-0.5">
                  {myHandle?.displayName || user.displayName || user.email || 'Pilote Hyper Nova'}
                </h1>
                <div className="text-xs text-slate-400 truncate mt-0.5">{user.email}</div>
              </div>
            </div>
          </div>

          {/* Email verification notice if unverified */}
          {user.emailVerified ? (
            <div className="p-3.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 flex items-center gap-3 text-xs text-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Adresse email vérifiée · Accès complet à Nova Chat et Nova Jolt actif.</span>
            </div>
          ) : (
            <div className="p-4 rounded-lg border border-amber-500/40 bg-amber-500/10 space-y-3 text-xs">
              <div className="flex items-start gap-2.5 text-amber-200 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>Vérification email requise pour publier sur Nova Jolt & Nova Chat</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Ouvrez le lien de confirmation envoyé à <strong className="text-white">{user.email}</strong>, puis cliquez sur « J’ai vérifié ».
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRefreshStatus}
                  className="flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>J’ai vérifié, actualiser</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleResend}
                  className="h-9 px-3.5 rounded-md border border-slate-700 bg-[#080C15] text-slate-200 hover:border-cyan-400/60 transition-colors disabled:opacity-50"
                >
                  Renvoyer l’email
                </button>
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 flex items-center gap-2 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {activeError && (
            <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200">
              {activeError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
            {onOpenChat && (
              <button
                type="button"
                onClick={onOpenChat}
                className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-colors"
              >
                <span>{myHandle ? 'Ouvrir Nova Chat' : 'Créer mon @id Nova Chat'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-slate-700 bg-[#080C15] text-xs font-semibold text-slate-200 hover:border-cyan-400/50 transition-colors"
              >
                <span>Voir Profil & Niveaux</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-rose-500/35 bg-rose-500/10 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? 'w-full' : 'h-full overflow-y-auto p-4 sm:p-8 flex items-center justify-center'}>
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#0D1320] p-6 sm:p-7 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3.5">
          <img
            src="/hyper-nova-logo.png"
            alt="Logo Hyper Nova Navigator"
            className="w-11 h-11 rounded-xl object-cover border border-cyan-500/40 shrink-0"
          />
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-100">
              {mode === 'signin'
                ? 'Connexion Hyper Nova'
                : mode === 'signup'
                ? 'Créer un compte'
                : 'Mot de passe oublié'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Connectez-vous par email ou avec Google pour synchroniser votre profil, Nova Chat et Nova Jolt.
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg border border-slate-800 bg-[#080C15]">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className={`flex items-center justify-center gap-1.5 h-9 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              mode === 'signin'
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Se connecter</span>
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex items-center justify-center gap-1.5 h-9 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              mode === 'signup'
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>S’inscrire</span>
          </button>
        </div>

        {/* Email / Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <label className="block space-y-1.5 text-left">
              <span className="text-xs font-medium text-slate-300">Nom de pilote</span>
              <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-700 bg-[#080C15] focus-within:border-cyan-400">
                <UserIcon className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex : Malek Prime"
                  className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
              </div>
            </label>
          )}

          <label className="block space-y-1.5 text-left">
            <span className="text-xs font-medium text-slate-300">Adresse email</span>
            <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-700 bg-[#080C15] focus-within:border-cyan-400">
              <Mail className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pilote@exemple.com"
                className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </label>

          {mode !== 'reset' && (
            <label className="block space-y-1.5 text-left">
              <span className="text-xs font-medium text-slate-300">Mot de passe</span>
              <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-700 bg-[#080C15] focus-within:border-cyan-400">
                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </label>
          )}

          {mode === 'signup' && (
            <label className="block space-y-1.5 text-left">
              <span className="text-xs font-medium text-slate-300">Confirmer le mot de passe</span>
              <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-700 bg-[#080C15] focus-within:border-cyan-400">
                <KeyRound className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Retapez le mot de passe"
                  className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
              </div>
            </label>
          )}

          {mode === 'signin' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="text-[11px] text-cyan-300 hover:text-cyan-200 hover:underline"
              >
                Mot de passe oublié ?
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-[11px] text-cyan-300 hover:text-cyan-200 hover:underline"
              >
                ← Retour à la connexion
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-colors disabled:opacity-50"
          >
            {mode === 'signin' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>{busy ? 'Connexion...' : 'Se connecter'}</span>
              </>
            ) : mode === 'signup' ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{busy ? 'Création...' : 'Créer mon compte'}</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>{busy ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}</span>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <div className="flex-1 h-px bg-slate-800" />
          <span>ou</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        {/* Google Sign-In */}
        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setLocalError(null);
              onGoogleSignIn();
            }}
            className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-slate-700 bg-[#080C15] text-xs font-semibold text-slate-100 hover:border-cyan-400/60 hover:bg-[#0B1220] transition-colors disabled:opacity-50"
          >
            <span>Continuer avec Google</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setLocalError(null);
              onGoogleSignInRedirect();
            }}
            className="w-full h-8 px-3 rounded-lg text-[11px] text-slate-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
          >
            Connexion Google par redirection (si popup bloquée)
          </button>
        </div>

        {/* Success Message */}
        {statusMessage && (
          <div className="p-3.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 flex items-start gap-2.5 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Actionable Errors */}
        {activeError === 'UNAUTHORIZED_DOMAIN' ? (
          <div className="p-4 rounded-lg border border-amber-500/45 bg-amber-500/10 text-left space-y-2.5">
            <div className="text-xs font-bold text-amber-300">
              Domaine non autorisé pour Google Sign-In
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Ajoutez ce domaine dans{' '}
              <span className="font-semibold text-white">
                Firebase Console → Authentication → Settings → Authorized domains
              </span>
              , ou utilisez l’onglet <strong className="text-cyan-200">Email / Mot de passe</strong> ci-dessus :
            </p>
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-[#070B13] border border-slate-700">
              <code className="text-[11px] font-mono-tabular text-cyan-300 truncate">
                {currentHost}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(currentHost);
                  setCopiedDomain(true);
                  window.setTimeout(() => setCopiedDomain(false), 2000);
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 shrink-0"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedDomain ? 'Copié' : 'Copier'}</span>
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
        ) : activeError === 'EMAIL_PROVIDER_DISABLED' ? (
          <div className="p-4 rounded-lg border border-amber-500/45 bg-amber-500/10 text-left space-y-2">
            <div className="text-xs font-bold text-amber-300">
              Activez Email/Mot de passe dans Firebase Console
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Par défaut, seule la connexion Google est activée sur ce projet Firebase. Pour activer l’inscription par email :
            </p>
            <ol className="text-[11px] text-slate-300 list-decimal list-inside space-y-1">
              <li>Ouvrez <strong>Authentication → Sign-in method</strong> dans Firebase Console.</li>
              <li>Cliquez sur <strong>Email/Password</strong> → Activez <strong>Enable</strong> → <strong>Save</strong>.</li>
            </ol>
            <a
              href="https://console.firebase.google.com/project/gen-lang-client-0373523970/authentication/providers"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[11px] font-semibold text-amber-300 hover:underline"
            >
              Ouvrir Firebase Sign-in Providers →
            </a>
          </div>
        ) : activeError ? (
          <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200 text-left">
            {activeError}
          </div>
        ) : null}
      </div>
    </div>
  );
};
