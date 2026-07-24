# Kabinett des Muskelkaters

Trainings-App fürs Handy: Pläne bauen, im Gym abarbeiten, Muskelverteilung und
Kraftentwicklung auswerten. Läuft als PWA komplett im Browser, ohne Server und
ohne Konto.

## Einrichten

1. Alle Dateien aus diesem Ordner ins Repository laden
   (**Add file → Upload files → Commit changes**).
2. **Settings → Pages** → Source: „Deploy from a branch", Branch `main`,
   Ordner `/ (root)` → **Save**.
3. Nach ein bis zwei Minuten läuft die Seite unter
   `https://vengadorhh.github.io/Kabinett-des-Muskelkaters/`
4. Link am Handy öffnen → Teilen-Menü → **Zum Home-Bildschirm**.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | die komplette App |
| `manifest.webmanifest` | Name, Icons, Vollbildmodus |
| `sw.js` | Offline-Betrieb und Cache |
| `icon-192.png`, `icon-512.png` | Homescreen-Symbole |
| `icon-maskable-512.png` | für Androids runde und eckige Zuschnitte |
| `apple-touch-icon.png` | iPhone, 180 px |

## Funktionen

- **Pläne** aus vier Blocktypen: Sätze, Einzelsätze mit Gewicht je Satz,
  Leiter (absteigende Wiederholungen) und Intervall mit automatischem Timer
- **Übungskatalog** mit Gerät, Standardwerten, Muskelanteilen, Bestwerten und
  Mehrfachfilter nach Muskelgruppen
- **Training** mit Stoppuhr je Block, Bildschirmsperre aus, Vibration beim
  Intervallwechsel
- **Bilanz**: Muskelverteilung als Kreisdiagramm über 7, 28 oder 90 Tage,
  dazu Kraftentwicklung je Übung als Kurve

## Daten

Pläne, Katalog und Verlauf liegen ausschließlich im Speicher des Browsers auf
dem jeweiligen Gerät. Nichts wird hochgeladen. Sicherung und CSV-Export unter
*Pläne → Daten sichern & übertragen*. Vor dem Löschen von Website-Daten unbedingt
sichern.

## Aktualisieren

Neue `index.html` hochladen und in `sw.js` die Zeile
`const VERSION = "muskelkater-v10"` hochzählen. Ohne die Änderung zeigt das
Handy weiter die alte Fassung aus dem Offline-Speicher. Danach App schließen
und zweimal neu öffnen.
