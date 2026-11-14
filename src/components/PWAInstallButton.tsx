import React, { useState } from 'react';
import { Download, X, Share2, MonitorSmartphone } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) return;
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Installer Hyper Nova Navigator sur votre appareil"
        className={`group flex items-center gap-1.5 rounded-md border border-cyan-500/45 bg-gradient-to-r from-[#0F1B33] to-[#131736] text-xs font-semibold text-cyan-100 hover:border-cyan-400 hover:shadow-[0_0_16px_-4px_rgba(34,211,238,0.65)] transition-all whitespace-nowrap shrink-0 ${
          compact ? 'h-8 px-2' : 'h-8 sm:h-9 px-2.5'
        }`}
      >
        <img
          src="/hyper-nova-logo.png"
          alt="Logo Hyper Nova"
          className="w-4 h-4 rounded-sm object-cover shrink-0 ring-1 ring-cyan-400/40"
        />
        <Download className="w-3.5 h-3.5 text-cyan-400 group-hover:translate-y-0.5 transition-transform shrink-0" />
        <span className={compact ? 'hidden sm:inline' : 'inline'}>Installer</span>
      </button>

      {showGuide && (
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
                    Installer Hyper Nova
                  </h3>
                  <p className="text-xs text-slate-400">
                    Application autonome hors-ligne avec icône Hyper Nova
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#070B14] space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2 font-semibold text-cyan-300">
                  <Share2 className="w-4 h-4" />
                  <span>Installation sur iPhone / iPad (Safari)</span>
                </div>
                <p>1. Appuyez sur le bouton <strong>Partager</strong> dans la barre Safari.</p>
                <p>2. Faites défiler et choisissez <strong>Sur l’écran d’accueil</strong>.</p>
                <p>3. Validez pour lancer Hyper Nova en plein écran.</p>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#070B14] space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2 font-semibold text-cyan-300">
                  <MonitorSmartphone className="w-4 h-4" />
                  <span>Installation sur Ordinateur / Android</span>
                </div>
                <p>
                  • Sur <strong>Chrome / Edge / Android</strong> : cliquez sur l’icône d’installation
                  dans la barre d’adresse (ou menu ⋮ → <em>Installer Hyper Nova Navigator</em>).
                </p>
                <p>
                  • Sur <strong>Firefox</strong> : utilisez <em>Menu → Ajouter à l’écran d’accueil</em>{' '}
                  sur mobile ou ouvrez l’URL dans Chrome/Edge pour créer le raccourci bureau natif.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full h-9 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-colors"
            >
              Compris
            </button>
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
