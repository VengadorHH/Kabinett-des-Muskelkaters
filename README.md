# Kabinett des Muskelkaters

Trainings-App fürs Handy: Pläne bauen, im Gym abarbeiten, auswerten.

## Einrichten

1. Alle Dateien aus diesem Ordner ins Repository laden (Add file → Upload files → Commit).
2. Settings → Pages → Source: "Deploy from a branch", Branch: `main`, Ordner `/ (root)` → Save.
3. Nach ein bis zwei Minuten läuft die Seite unter
   `https://vengadorhh.github.io/Kabinett-des-Muskelkaters/`
4. Link am Handy öffnen → Teilen-Menü → "Zum Home-Bildschirm".

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | die komplette App |
| `manifest.webmanifest` | Name, Icon, Vollbildmodus |
| `sw.js` | Offline-Betrieb |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Symbole |

## Daten

Pläne, Übungskatalog und Verlauf liegen ausschließlich im Speicher des Browsers
auf dem jeweiligen Gerät. Nichts wird hochgeladen. Sicherung und CSV-Export
findest du in der App unter *Pläne → Daten sichern & übertragen*.

## Aktualisieren

Neue `index.html` hochladen und in `sw.js` die Zeile `const VERSION = "muskelkater-v1"`
auf `-v2` ändern. Sonst zeigt das Handy weiter die alte Fassung aus dem Offline-Speicher.
