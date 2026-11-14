# Hyper Nova Navigator — Application de bureau autonome (.exe / .dmg / .AppImage)

Ce dossier génère un **véritable installeur natif indépendant** (comme l'installeur de Firefox : assistant d'installation Windows `.exe`, raccourci Bureau/Menu Démarrer, fenêtre totalement autonome sans dépendre de Chrome, Edge ou Firefox).

## Générer l'installeur Windows (`Hyper Nova Navigator Setup 1.0.0.exe`)

Sur un PC Windows (avec Node.js installé) :

```bash
cd desktop
npm install
npm run build:win
```

L'installeur **`Hyper Nova Navigator Setup 1.0.0.exe`** sera généré dans `desktop/release/`.

## Lancer en mode bureau sans compiler

```bash
cd desktop
npm install
npm start
```

## Autres plateformes

- macOS (`.dmg`) : `npm run build:mac`
- Linux (`.AppImage`) : `npm run build:linux`
