import React, { useState } from 'react';
import { Download, X, Share2, CheckCircle2, PackageCheck, Terminal } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    install,
    cacheOfflineBundle,
    downloadDesktopInstaller,
  } = usePWAInstall();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [cachedOffline, setCachedOffline] = useState(false);
  const [packageDownloaded, setPackageDownloaded] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallAll = async () => {
    setInstalling(true);
    const cached = await cacheOfflineBundle();
    setCachedOffline(cached);

    if (isInstallable) {
      await install();
      setInstalling(false);
      return;
    }

    if (isIOS) {
      setInstalling(false);
      setShowStatusModal(true);
      return;
    }

    // Download cross-platform desktop setup bundle when native browser prompt isn't supported (e.g. Firefox)
    downloadDesktopInstaller();
    setPackageDownloaded(true);
    setInstalling(false);
    setShowStatusModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallAll}
        disabled={installing}
        title="Installer Hyper Nova Navigator en application autonome"
        className={`group flex items-center gap-1.5 rounded-md border border-cyan-500/45 bg-gradient-to-r from-[#0F1B33] to-[#131736] text-xs font-semibold text-cyan-100 hover:border-cyan-400 hover:shadow-[0_0_16px_-4px_rgba(34,211,238,0.65)] transition-all whitespace-nowrap shrink-0 disabled:opacity-60 ${
          compact ? 'h-8 px-2' : 'h-8 sm:h-9 px-2.5'
        }`}
      >
        <img
          src="/hyper-nova-logo.png"
          alt="Logo Hyper Nova"
          className="w-4 h-4 rounded-sm object-cover shrink-0 ring-1 ring-cyan-400/40"
        />
        <Download className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-y-0.5 transition-transform shrink-0" />
        <span className={compact ? 'hidden sm:inline' : 'inline'}>
          {installing ? 'Installation...' : 'Installer'}
        </span>
      </button>

      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-[#0B101C] p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="Hyper Nova"
                  className="w-12 h-12 rounded-xl object-cover ring-1 ring-cyan-400/50 shrink-0"
                />
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-100">
                    Installer Hyper Nova Navigator
                  </h3>
                  <p className="text-xs text-slate-400">
                    Application autonome avec logo officiel
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="p-1.5 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cachedOffline && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-xs text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Application et ressources mises en cache local dans votre navigateur.</span>
              </div>
            )}

            {isIOS ? (
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#070B14] space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2 font-semibold text-cyan-300">
                  <Share2 className="w-4 h-4" />
                  <span>Ajouter sur l’écran d’accueil (iPhone / iPad)</span>
                </div>
                <p>1. Appuyez sur <strong>Partager</strong> dans Safari.</p>
                <p>2. Sélectionnez <strong>Sur l’écran d’accueil</strong> pour créer l’app Hyper Nova.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-lg border border-slate-800 bg-[#070B14] space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2 font-semibold text-cyan-300">
                    <PackageCheck className="w-4 h-4" />
                    <span>
                      {packageDownloaded
                        ? 'Paquet Hyper-Nova-Navigator-Setup.zip téléchargé'
                        : 'Installation rapide PC / Mac / Linux'}
                    </span>
                  </div>
                  <p className="text-slate-400">
                    Par sécurité, un site web ne peut pas exécuter un <code className="text-slate-200">.exe</code> directement depuis le navigateur. Deux options :
                  </p>
                  <p>
                    • <strong>Via le ZIP téléchargé</strong> : extrayez <code className="text-cyan-200">Hyper-Nova-Navigator-Setup.zip</code> et double-cliquez sur <strong className="text-slate-100">Install-Hyper-Nova-Windows.bat</strong> (ou <code className="text-slate-200">.command</code> / <code className="text-slate-200">.sh</code>) pour créer l’icône Bureau et ouvrir en fenêtre autonome.
                  </p>
                  <p>
                    • <strong>Installation 1-clic native</strong> : ouvrez ce site dans <strong>Chrome</strong> ou <strong>Edge</strong> et cliquez sur <em>Installer</em>.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-violet-500/30 bg-violet-500/10 space-y-1.5 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5 font-semibold text-violet-200">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Compiler un vrai programme .exe indépendant (comme Firefox)</span>
                  </div>
                  <p className="text-slate-400">
                    Le dossier <code className="text-violet-200">desktop/</code> du projet génère un installeur autonome Electron (<code className="text-violet-200">Hyper Nova Navigator Setup.exe</code>) sans aucun navigateur requis :
                  </p>
                  <code className="block p-2 rounded bg-[#050811] text-cyan-200 font-mono-tabular">
                    cd desktop &amp;&amp; npm install &amp;&amp; npm run build:win
                  </code>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              {!isIOS && (
                <button
                  type="button"
                  onClick={downloadDesktopInstaller}
                  className="flex-1 h-9 rounded-md border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 text-xs font-semibold hover:bg-cyan-500/20 transition-colors"
                >
                  Retélécharger (.zip)
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="flex-1 h-9 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-600/95 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      <span>Mode hors-ligne — Données locales en cache actives</span>
    </div>
  );
};
