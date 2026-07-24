# KdM – Kabinett des Muskelkaters

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
   Auf dem Homescreen erscheint sie als **KdM**.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | die komplette App |
| `manifest.webmanifest` | Name, Icons, Vollbildmodus |
| `sw.js` | Offline-Betrieb und Cache |
| `icon-192.png`, `icon-512.png` | Homescreen-Symbole |
| `icon-maskable-512.png` | für Androids runde und eckige Zuschnitte |
| `apple-touch-icon.png` | iPhone, 180 px |

## Was die App kann

**Pläne** aus fünf Blocktypen: Sätze, Einzelsätze mit Gewicht je Satz, Leiter
mit absteigenden Wiederholungen, Intervall mit automatischem Timer, sowie
Zirkel/Warm-up. Pläne lassen sich kopieren und als Vorlage weiterverwenden.

**Lebenszyklus**: Plan anlegen → fürs nächste Training vormerken (mehrere
möglich, mit Termin) → starten → beim Abschluss wandert die Einheit in die
Bilanz und die Vormerkung löst sich.

**Übungskatalog** mit Gerät, Standardwerten, Muskelanteilen, Bestwerten samt
Datum und Mehrfachfilter nach Muskelgruppen.

**Training**: Stoppuhr je Block, Bildschirm bleibt an, Vibration beim
Intervallwechsel, Block währenddessen umsortier- und erweiterbar.

**Bilanz**: Muskelverteilung als Kreisdiagramm über 7, 28 oder 90 Tage, dazu
Kraftentwicklung je Übung als Kurve.

## Daten

Pläne, Katalog und Verlauf liegen ausschließlich im Speicher des Browsers auf
dem jeweiligen Gerät. Nichts wird hochgeladen. Sicherung und CSV-Export unter
*Pläne → Daten sichern & übertragen*. Vor dem Löschen von Website-Daten
unbedingt sichern.

## Aktualisieren

Neue `index.html` hochladen und in `sw.js` die Zeile
`const VERSION = "muskelkater-v15"` hochzählen. Ohne diese Änderung zeigt das
Handy weiter die alte Fassung aus dem Offline-Speicher. Danach App schließen
und zweimal neu öffnen. Ändert sich der Name oder das Icon, muss die
Verknüpfung auf dem Homescreen gelöscht und neu angelegt werden.
