import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null;
    hyperNovaDesktop?: { isDesktopApp?: boolean; platform?: string };
  }
}

function detectDesktopPlatform(): 'win' | 'mac' | 'linux' {
  if (typeof navigator === 'undefined') return 'win';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('linux')) return 'linux';
  return 'win';
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window !== 'undefined' ? window.__deferredPwaPrompt || null : null
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isDesktopApp =
      Boolean(window.hyperNovaDesktop?.isDesktopApp) ||
      window.navigator.userAgent.includes('Electron');
    const isStandalone =
      isDesktopApp ||
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    if (window.__deferredPwaPrompt) {
      setDeferredPrompt(window.__deferredPwaPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__deferredPwaPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      window.__deferredPwaPrompt = null;
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const promptEvt = deferredPrompt || window.__deferredPwaPrompt;
    if (!promptEvt) return false;
    await promptEvt.prompt();
    const { outcome } = await promptEvt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      window.__deferredPwaPrompt = null;
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const cacheOfflineBundle = useCallback(async () => {
    if (typeof window === 'undefined' || !('caches' in window)) return false;
    try {
      const cache = await caches.open('hyper-nova-program-v1');
      await cache.addAll([
        '/',
        '/manifest.webmanifest',
        '/pwa-192x192.png',
        '/pwa-512x512.png',
        '/hyper-nova-logo.png',
        '/apple-touch-icon.png',
        '/icon.svg',
      ]);
      return true;
    } catch {
      return false;
    }
  }, []);

  const downloadBestDesktopInstaller = useCallback(async (): Promise<{
    nativeBinary: boolean;
    fileName: string;
  }> => {
    const platform = detectDesktopPlatform();
    try {
      const res = await fetch(`/api/latest-installer?platform=${platform}`);
      const raw = await res.text();
      const data = JSON.parse(raw) as {
        available?: boolean;
        downloadUrl?: string;
        fileName?: string;
      };
      if (data.available && data.downloadUrl) {
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.download = data.fileName || 'Hyper-Nova-Navigator-Setup.exe';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return { nativeBinary: true, fileName: data.fileName || 'Hyper-Nova-Navigator-Setup.exe' };
      }
    } catch {
      // fallback to setup zip
    }

    const origin = encodeURIComponent(window.location.origin);
    const a = document.createElement('a');
    a.href = `/api/install-package?origin=${origin}`;
    a.download = 'Hyper-Nova-Navigator-Setup.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { nativeBinary: false, fileName: 'Hyper-Nova-Navigator-Setup.zip' };
  }, []);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
    cacheOfflineBundle,
    downloadBestDesktopInstaller,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
