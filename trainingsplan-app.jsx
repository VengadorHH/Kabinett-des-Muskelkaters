import React, { useState, useEffect, useMemo, useRef } from "react";

const APP_VERSION = "v41";

/* ============ Tokens ============ */
const C = {
  beton: "#DCDFDB", panel: "#F4F5F2", tinte: "#15181B", grau: "#7C837E",
  linie: "#C3C7C2", rot: "#C8102E", blau: "#0B5FA5", gelb: "#D9A400",
  gruen: "#1E8449", chrom: "#8A9298", violett: "#5B3E8E",
};

const GRUPPEN = [
  { id: "core", name: "Core", farbe: C.rot },
  { id: "schulter", name: "Schulter", farbe: C.blau },
  { id: "arme", name: "Arme", farbe: C.chrom },
  { id: "ruecken", name: "Rücken", farbe: C.gruen },
  { id: "brust", name: "Brust", farbe: C.tuerkis },
  { id: "beine", name: "Beine", farbe: C.gelb },
  { id: "kardio", name: "Kardio", farbe: C.violett },
];
const leereMuskeln = () => Object.fromEntries(GRUPPEN.map((g) => [g.id, 0]));
const SEK_PRO_WDH = 3;
const GERAETE = ["Langhantel", "Kurzhantel", "Kettlebell", "Seilzug", "Maschine", "Körpergewicht",
  "Klimmzugstange", "Bank", "Matte", "Medizinball", "Schlitten", "Springseil", "Laufband", "Ergometer", "Crosstrainer"];

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;600&display=swap');
.d{font-family:Oswald,'Arial Narrow',sans-serif;letter-spacing:.04em}
.b{font-family:'IBM Plex Sans',system-ui,sans-serif}
.m{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
input,select,button,textarea{font-family:inherit}
input:focus-visible,button:focus-visible,select:focus-visible{outline:2px solid ${C.rot};outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

/* ============ Rechenkern ============ */
const zahl = (v) => (Number(v) || 0);
const leiterWdh = (b) => {
  return leiterRunden(b).reduce((a, r) => a + r, 0);
};
const gewichtStufen = (b) => {
  if (Array.isArray(b.stufenKg) && b.stufenKg.length) return b.stufenKg.map((x) => zahl(x));
  const stufen = [];
  const von = zahl(b.kgVon), bis = zahl(b.kgBis), schritt = Math.max(1, zahl(b.kgSchritt));
  if (bis >= von) for (let x = von; x <= bis && stufen.length < 60; x += schritt) stufen.push(x);
  else for (let x = von; x >= bis && stufen.length < 60; x -= schritt) stufen.push(x);
  return stufen;
};
const leiterRunden = (b) => {
  const r = [];
  const schritt = Math.max(1, zahl(b.schritt));
  for (let x = zahl(b.start); x >= zahl(b.ende) && r.length < 100; x -= schritt) r.push(x);
  return r;
};

/* Belastungssekunden einer Übung im geplanten Zustand */
const satzListe = (u) => (Array.isArray(u?.saetzeListe) ? u.saetzeListe : []);

/* Seitigkeit: "beid" | "jeSeite" (Zahl gilt pro Seite) | "lr1" (links+rechts = 1 Wdh) */
const SEITEN = [
  { id: "beid", name: "beidseitig" },
  { id: "jeSeite", name: "je Seite" },
  { id: "lr1", name: "links + rechts = 1" },
];
const einseitig = (u) => u?.seiten === "jeSeite" || u?.seiten === "lr1";
const seitenFaktor = (u) => (einseitig(u) ? 2 : 1);
const wdhText = (u, n) =>
  u?.seiten === "jeSeite" ? `${n} Wdh je Seite` : u?.seiten === "lr1" ? `${n} Wdh (L+R)` : `${n} Wdh`;

/* Haken: Bit 1 = links, Bit 2 = rechts. Alte Daten sind true/false. */
const hakenWert = (w) => (w === true ? 3 : w === false ? 0 : zahl(w));
const istFertig = (u, w) => (einseitig(u) ? (hakenWert(w) & 3) === 3 : hakenWert(w) > 0);
const hakenUm = (u, w, bit) => {
  if (!einseitig(u)) return istFertig(u, w) ? 0 : 3;
  return hakenWert(w) ^ bit;
};

function sekundenGeplant(block, u) {
  if (block.typ === "gewichtsleiter") return gewichtStufen(block).length * 30;
  if (block.typ === "laufband") return zahl(block.dauer);
  if (block.typ === "amrap") return zahl(block.dauer);
  if (block.typ === "einfach") return Math.max(1, zahl(block.runden)) * zahl(u.wdh) * SEK_PRO_WDH * seitenFaktor(u);
  if (block.typ === "einzel") return satzListe(u).reduce((a, sz) => a + zahl(sz.wdh) + (einseitig(u) ? zahl(sz.wdhR ?? sz.wdh) : 0), 0) * SEK_PRO_WDH;
  if (block.typ === "leiter") return leiterWdh(block) * SEK_PRO_WDH * seitenFaktor(u);
  if (block.typ === "intervall") return zahl(block.durchgaenge) * zahl(block.arbeit);
  if (u.messung === "zeit") return zahl(u.saetze) * zahl(u.dauer) * seitenFaktor(u);
  return zahl(u.saetze) * zahl(u.wdh) * SEK_PRO_WDH * seitenFaktor(u);
}

/* Verteilung: gemessene oder geplante Blockzeit auf die Muskelgruppen verteilen.
   Die Zeit eines Blocks wird nach dem geplanten Umfang seiner Übungen aufgeteilt. */
const geplantBlock = (b) => b?.typ === "laufband" ? zahl(b.dauer) : (b?.uebungen || []).reduce((a, u) => a + sekundenGeplant(b, u), 0);

function verteilung(bloecke, zeitFn) {
  const v = leereMuskeln();
  let gesamt = 0;
  (Array.isArray(bloecke) ? bloecke : []).forEach((b) => {
    if (!b.auswerten) return;
    const zeit = zahl(zeitFn(b));
    if (zeit <= 0) return;
    if (b.typ === "laufband") { v.kardio += zeit; gesamt += zeit; return; }
    const uebungen = b.uebungen || [];
    const gewicht = uebungen.map((u) => sekundenGeplant(b, u) || 1);
    const gsum = gewicht.reduce((a, x) => a + x, 0) || 1;
    uebungen.forEach((u, i) => {
      const anteil = (zeit * gewicht[i]) / gsum;
      const summe = GRUPPEN.reduce((a, g) => a + zahl(u.muskeln?.[g.id]), 0) || 1;
      GRUPPEN.forEach((g) => { v[g.id] += (anteil * zahl(u.muskeln?.[g.id])) / summe; });
    });
    gesamt += zeit;
  });
  return { v, gesamt };
}

const minuten = (sek) => `${Math.round(sek / 60)} min`;

/* ============ Export ============ */
const csvAus = (verlauf) => {
  const kopf = ["Datum", "Plan", "Dauer_min", "Arbeit_min", "Übung", "Gerät", "kg", "Wdh"].join(";");
  const zeilen = [kopf];
  (verlauf || []).forEach((e) => {
    const d = new Date(e.datum).toLocaleDateString("de-DE");
    const basis = [d, e.name, e.dauer, Math.round(zahl(e.sekunden) / 60)];
    if (!(e.leistung || []).length) zeilen.push([...basis, "", "", "", ""].join(";"));
    (e.leistung || []).forEach((l) =>
      (l.saetze || []).forEach((sz) => zeilen.push([...basis, l.name, l.geraet || "", sz.kg, sz.wdh].join(";")))
    );
  });
  return zeilen.join("\n");
};

const textAus = (e) => {
  const zeilen = [`${e.name} · ${new Date(e.datum).toLocaleDateString("de-DE")} · ${e.dauer} min`];
  (e.leistung || []).forEach((l) =>
    zeilen.push(`${l.name}: ${(l.saetze || []).map((sz) => `${sz.kg}×${sz.wdh}`).join(", ")}`)
  );
  return zeilen.join("\n");
};

/* ============ Übungen umsortieren und ergänzen ============ */
const rundenTyp = (b) => ["leiter", "intervall", "einfach"].includes(b?.typ);

const ausKatalog = (k, typ) => ({
  id: uid(), name: k.name, geraet: k.geraet || "", seiten: k.seiten || "beid", info: k.info || "", messung: "wdh",
  saetze: 3, wdh: k.wdh, dauer: 30, kg: k.kg, pause: 60,
  saetzeListe: typ === "einzel" ? [1, 2, 3].map(() => ({ id: uid(), kg: k.kg, wdh: k.wdh })) : [],
  muskeln: { ...leereMuskeln(), ...k.muskeln },
});

const leereUebung = (typ) => ({
  id: uid(), name: "", geraet: "", seiten: "beid", messung: "wdh", saetze: 3, wdh: 10, dauer: 30, kg: 0, pause: 60,
  saetzeListe: typ === "einzel" ? [{ id: uid(), kg: 0, wdh: 10 }] : [],
  muskeln: leereMuskeln(),
});

function uebungDazu(b, u) {
  const erl = Array.isArray(b.erledigt) ? b.erledigt : null;
  if (!erl) return { ...b, uebungen: [...b.uebungen, u] };
  if (rundenTyp(b)) return { ...b, uebungen: [...b.uebungen, u], erledigt: erl.map((r) => [...r, false]) };
  const frisch = b.typ === "einzel"
    ? (u.saetzeListe || []).map(() => false)
    : Array.from({ length: zahl(u.saetze) || 1 }, () => false);
  return { ...b, uebungen: [...b.uebungen, u], erledigt: [...erl, frisch] };
}

function uebungWeg(b, i) {
  const erl = Array.isArray(b.erledigt) ? b.erledigt : null;
  const uebungen = b.uebungen.filter((_, j) => j !== i);
  if (!erl) return { ...b, uebungen };
  return { ...b, uebungen, erledigt: rundenTyp(b) ? erl.map((r) => r.filter((_, j) => j !== i)) : erl.filter((_, j) => j !== i) };
}

function uebungSchieben(b, i, richtung) {
  const j = i + richtung;
  if (j < 0 || j >= b.uebungen.length) return b;
  const tausch = (arr) => { const a = [...arr]; const h = a[i]; a[i] = a[j]; a[j] = h; return a; };
  const erl = Array.isArray(b.erledigt) ? b.erledigt : null;
  return {
    ...b,
    uebungen: tausch(b.uebungen),
    ...(erl ? { erledigt: rundenTyp(b) ? erl.map(tausch) : tausch(erl) } : {}),
  };
}

/* ============ UI-Bausteine ============ */
const InfoKnopf = ({ text }) => {
  const [auf, setAuf] = useState(false);
  if (!text) return null;
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button onClick={(e) => { e.stopPropagation(); setAuf(!auf); }} aria-label="Beschreibung anzeigen" aria-expanded={auf}
        className="flex items-center justify-center shrink-0"
        style={{ minWidth: 30, minHeight: 30, borderRadius: "50%",
          border: `1px solid ${auf ? C.tinte : C.linie}`, background: auf ? C.tinte : "transparent",
          color: auf ? C.panel : C.grau, fontStyle: "italic", fontWeight: 700, fontSize: 14 }}>i</button>
      {auf && (
        <>
          <span onClick={() => setAuf(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <span style={{ position: "absolute", top: "115%", right: 0, zIndex: 41, width: 240,
            background: C.tinte, color: C.panel, padding: "10px 12px", borderRadius: 4,
            boxShadow: "0 6px 24px rgba(0,0,0,0.3)" }}
            className="b text-xs leading-snug">{text}</span>
        </>
      )}
    </span>
  );
};

const Stift = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" /><path d="M14.5 5.5l4 4" />
  </svg>
);
const Kopie = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const Auge = ({ zu }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
    {zu && <path d="M3 3l18 18" />}
  </svg>
);
const IconKnopf = ({ onClick, titel, aktiv, children }) => (
  <button onClick={onClick} aria-label={titel} title={titel} aria-pressed={aktiv}
    className="flex items-center justify-center shrink-0"
    style={{ minWidth: 44, minHeight: 40, border: `1px solid ${aktiv ? C.tinte : C.linie}`,
      background: aktiv ? C.tinte : "transparent", color: aktiv ? C.panel : C.tinte, borderRadius: 2 }}>
    {children}
  </button>
);
const StiftKnopf = ({ onClick, titel = "Bearbeiten" }) => (
  <IconKnopf onClick={onClick} titel={titel}><Stift /></IconKnopf>
);

const Btn = ({ children, ton = "still", klein, ...r }) => {
  const s = {
    voll: { background: C.tinte, color: C.panel, borderColor: C.tinte },
    still: { background: "transparent", color: C.tinte, borderColor: C.linie },
    rot: { background: C.rot, color: "#fff", borderColor: C.rot },
  }[ton];
  return (
    <button {...r} className={`d uppercase ${klein ? "text-xs px-3 py-2" : "text-sm px-4 py-3"} active:translate-y-px`}
      style={{ ...s, borderWidth: 1, borderStyle: "solid", borderRadius: 2 }}>{children}</button>
  );
};
const Feld = ({ className = "", ...p }) => (
  <input {...p} className={`m text-sm px-2 py-2 w-full ${className}`}
    style={{ background: C.panel, border: `1px solid ${C.linie}`, borderRadius: 2, color: C.tinte }} />
);
const Karte = ({ children, className = "" }) => (
  <div className={`p-3 ${className}`} style={{ background: C.panel, border: `1px solid ${C.linie}`, borderRadius: 2 }}>{children}</div>
);

/* ============ Auswertung (Signature) ============ */
function Kreis({ reihen, groesse = 128, beschriftet = true }) {
  const R = groesse / 2, rad = R - 1;
  const punkt = (winkel) => [R + rad * Math.cos(winkel), R + rad * Math.sin(winkel)];
  const gesamtP = reihen.reduce((a, x) => a + x.p, 0) || 1;

  let acc = -Math.PI / 2;
  const stuecke = [], schrift = [];
  reihen.forEach((s) => {
    const bogen = (s.p / gesamtP) * 2 * Math.PI;
    const bis = acc + bogen;
    if (s.p / gesamtP > 0.999) {
      stuecke.push(<circle key={s.id} cx={R} cy={R} r={rad} fill={s.farbe} />);
    } else {
      const [x1, y1] = punkt(acc), [x2, y2] = punkt(bis);
      stuecke.push(
        <path key={s.id} fill={s.farbe} stroke={C.panel} strokeWidth="1"
          d={`M ${R} ${R} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rad} ${rad} 0 ${bogen > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`} />
      );
    }
    if (beschriftet && s.p >= 8) {
      const mitte = acc + bogen / 2;
      schrift.push(
        <text key={s.id} x={R + 0.62 * rad * Math.cos(mitte)} y={R + 0.62 * rad * Math.sin(mitte) + 3.5}
          textAnchor="middle" fontSize="10" fontFamily="monospace" fill="#fff">{Math.round(s.p)}%</text>
      );
    }
    acc = bis;
  });

  return (
    <svg width={groesse} height={groesse} viewBox={`0 0 ${groesse} ${groesse}`} className="shrink-0" role="img" aria-label="Verteilung">
      {stuecke}
      {schrift}
      <circle cx={R} cy={R} r={rad} fill="none" stroke={C.tinte} strokeWidth="1" />
    </svg>
  );
}

function Auswertung({ v, gesamt, titel = "Muskelgewichtung", kompakt }) {
  if (!gesamt) return <p className="m text-xs" style={{ color: C.grau }}>Noch keine auswertbare Belastung.</p>;
  const reihen = GRUPPEN.map((g) => ({ ...g, sek: v[g.id], p: (v[g.id] / gesamt) * 100 }))
    .filter((r) => r.p >= 0.5).sort((a, b) => b.p - a.p);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h4 className="d uppercase text-sm">{titel}</h4>
        <span className="m text-[11px]" style={{ color: C.grau }}>{minuten(gesamt)} Arbeitszeit</span>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <Kreis reihen={reihen} groesse={kompakt ? 96 : 128} beschriftet={!kompakt} />
        <ul className="flex-1 min-w-0 space-y-1">
          {reihen.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <span className="shrink-0" style={{ width: 10, height: 10, background: r.farbe, display: "inline-block" }} />
              <span className="b text-xs flex-1 truncate">{r.name}</span>
              <span className="m text-xs">{Math.round(r.p)} %</span>
              {!kompakt && <span className="m text-[11px] w-12 text-right" style={{ color: C.grau }}>{minuten(r.sek)}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ============ Vorlage aus dem PDF ============ */
const m = (o) => ({ ...leereMuskeln(), ...o });
const uid = () => Math.random().toString(36).slice(2, 9);
const vorlageKettlebell = () => ({
  id: uid(), name: "Suffering Sunday", notiz: "Joint Mobility & Full Routine · Kettlebell · ca. 30 min",
  bloecke: [
    { id: uid(), typ: "einfach", name: "0 · Gelenk-Mobilisation", auswerten: false, runden: 1, uebungen: [
      { id: uid(), name: "Armkreisen & Thorax-Rotation", geraet: "Körpergewicht", seiten: "beid", messung: "wdh", saetze: 1, wdh: 10, dauer: 0, kg: 0, pause: 0, saetzeListe: [], muskeln: m({ schulter: 70, ruecken: 30 }) },
      { id: uid(), name: "Handgelenke kreisen", geraet: "Körpergewicht", seiten: "beid", messung: "zeit", saetze: 1, wdh: 0, dauer: 15, kg: 0, pause: 0, saetzeListe: [], muskeln: m({ arme: 100 }) },
      { id: uid(), name: "Hüftkreisen & Gate Openers", geraet: "Körpergewicht", seiten: "jeSeite", messung: "wdh", saetze: 1, wdh: 8, dauer: 0, kg: 0, pause: 0, saetzeListe: [], muskeln: m({ beine: 70, core: 30 }) },
      { id: uid(), name: "Kniekreisen & Fußgelenk-Rolls", geraet: "Körpergewicht", seiten: "jeSeite", messung: "wdh", saetze: 1, wdh: 8, dauer: 0, kg: 0, pause: 0, saetzeListe: [], muskeln: m({ beine: 100 }) },
    ]},
    { id: uid(), typ: "intervall", name: "1 · Warm-up: Tabata Cardio-Sprint", auswerten: true, arbeit: 20, pause: 10, durchgaenge: 2, satzpause: 10,
      hinweis: "20s Belastung / 10s Pause · 2 Durchgänge (8 Intervalle)", uebungen: [
      { id: uid(), name: "Spider Lunges", geraet: "Körpergewicht", seiten: "jeSeite", kg: 0, saetzeListe: [], muskeln: m({ beine: 55, core: 30, schulter: 15 }) },
      { id: uid(), name: "Mountain Climbers", geraet: "Körpergewicht", seiten: "beid", kg: 0, saetzeListe: [], muskeln: m({ core: 45, kardio: 35, schulter: 20 }) },
      { id: uid(), name: "Cross Body Climbers", geraet: "Körpergewicht", seiten: "beid", kg: 0, saetzeListe: [], muskeln: m({ core: 55, kardio: 30, schulter: 15 }) },
      { id: uid(), name: "Plank Tuck Jumps", geraet: "Körpergewicht", seiten: "beid", kg: 0, saetzeListe: [], muskeln: m({ kardio: 40, core: 35, beine: 25 }) },
    ]},
    { id: uid(), typ: "gewichtsleiter", name: "2 · Kraft: Schlitten-Leiter", auswerten: true,
      kgVon: 50, kgBis: 100, kgSchritt: 10, hinweis: "Jede Stufe ein Durchgang – Gewicht steigt in 10er-Schritten", uebungen: [
      { id: uid(), name: "Sled Pull", geraet: "Schlitten", seiten: "beid", messung: "wdh", saetze: 1, wdh: 1, dauer: 0, kg: 0, pause: 60, saetzeListe: [], muskeln: m({ beine: 40, ruecken: 30, core: 20, arme: 10 }) },
    ]},
    { id: uid(), typ: "standard", name: "3 · Hauptworkout: 15-Minute Core Burner", auswerten: true,
      hinweis: "3 Sätze à 30s Belastung / 30s Pause pro Übung", uebungen: [
      { id: uid(), name: "Dead Halos", geraet: "Kettlebell", seiten: "lr1", messung: "zeit", saetze: 3, wdh: 0, dauer: 30, kg: 8, pause: 30, saetzeListe: [], muskeln: m({ core: 60, schulter: 30, arme: 10 }) },
      { id: uid(), name: "Around the Slings", geraet: "Kettlebell", seiten: "lr1", messung: "zeit", saetze: 3, wdh: 0, dauer: 30, kg: 12, pause: 30, saetzeListe: [], muskeln: m({ core: 55, schulter: 30, arme: 15 }) },
      { id: uid(), name: "Grave Diggers", geraet: "Kettlebell", seiten: "lr1", messung: "zeit", saetze: 3, wdh: 0, dauer: 30, kg: 12, pause: 30, saetzeListe: [], muskeln: m({ core: 45, beine: 30, schulter: 25 }) },
      { id: uid(), name: "Tactical Transfers", geraet: "Kettlebell", seiten: "lr1", messung: "zeit", saetze: 3, wdh: 0, dauer: 30, kg: 12, pause: 30, saetzeListe: [], muskeln: m({ beine: 45, core: 40, ruecken: 15 }) },
      { id: uid(), name: "Dead Pullovers", geraet: "Kettlebell", seiten: "beid", messung: "zeit", saetze: 3, wdh: 0, dauer: 30, kg: 8, pause: 30, saetzeListe: [], muskeln: m({ core: 45, ruecken: 30, schulter: 25 }) },
    ]},
    { id: uid(), typ: "einfach", name: "4 · Cool-down", auswerten: false, runden: 1, uebungen: [
      { id: uid(), name: "Child's Pose", geraet: "Matte", seiten: "beid", messung: "zeit", saetze: 1, wdh: 0, dauer: 45, kg: 0, pause: 0, saetzeListe: [], muskeln: m({ ruecken: 60, schulter: 40 }) },
      { id: uid(), name: "Cobra Stretch", geraet: "Matte", seiten: "beid", messung: "zeit", saetze: 1, wdh: 0, dauer: 30, kg: 0, pause: 0, saetzeListe: [], muskeln: m({ core: 60, brust: 40 }) },
      { id: uid(), name: "Couch Stretch", geraet: "Matte", seiten: "jeSeite", messung: "zeit", saetze: 1, wdh: 0, dauer: 30, kg: 0, pause: 0, saetzeListe: [], muskeln: m({ beine: 100 }) },
      { id: uid(), name: "Schulter-Stretch", geraet: "Körpergewicht", seiten: "jeSeite", messung: "zeit", saetze: 1, wdh: 0, dauer: 20, kg: 0, pause: 0, saetzeListe: [], muskeln: m({ schulter: 70, arme: 30 }) },
    ]},
  ],
});

/* Alte oder unvollstaendige Plaene auf das aktuelle Format bringen */
function normPlan(p) {
  return {
    id: p?.id || uid(), name: p?.name || "", notiz: p?.notiz || "",
    bloecke: (Array.isArray(p?.bloecke) ? p.bloecke : []).map((b) => ({
      id: b?.id || uid(), typ: b?.typ || "standard", name: b?.name || "Block",
      auswerten: b?.auswerten !== false, hinweis: b?.hinweis || "",
      start: b?.start ?? 10, ende: b?.ende ?? 1, schritt: b?.schritt ?? 1, runden: b?.runden ?? 1,
      arbeit: b?.arbeit ?? 20, pause: b?.pause ?? 10, durchgaenge: b?.durchgaenge ?? 3, satzpause: b?.satzpause ?? 30,
      dauer: b?.dauer ?? 1200, stgVon: b?.stgVon ?? 0, stgBis: b?.stgBis ?? 0, tempo: b?.tempo ?? "",
      kgVon: b?.kgVon ?? 50, kgBis: b?.kgBis ?? 100, kgSchritt: b?.kgSchritt ?? 10,
      uebungen: (Array.isArray(b?.uebungen) ? b.uebungen : []).map((u) => ({
        id: u?.id || uid(), name: u?.name || "", geraet: u?.geraet || "", seiten: u?.seiten || "beid", info: u?.info || "", messung: u?.messung === "zeit" ? "zeit" : "wdh",
        saetze: u?.saetze ?? 3, wdh: u?.wdh ?? 10, dauer: u?.dauer ?? 30, kg: u?.kg ?? 0, pause: u?.pause ?? 60,
        saetzeListe: (Array.isArray(u?.saetzeListe) ? u.saetzeListe : []).map((sz) => ({
          id: sz?.id || uid(), kg: sz?.kg ?? 0, wdh: sz?.wdh ?? 10,
          kgR: sz?.kgR ?? null, wdhR: sz?.wdhR ?? null })),
        muskeln: { ...leereMuskeln(), ...(u?.muskeln || {}) },
      })),
    })),
  };
}

/* ============ Übungskatalog ============ */
const EINSEITIG = ["Spider Lunges", "Side Tilts", "Kettlebell Windmill", "Low Row (einseitig)", "Trizeps-Drücken einarmig",
  "Bird Dog", "Pallof Press", "Holzhacker", "Seitliche Rotation", "World's Greatest Stretch",
  "Incline DB Rows", "Ausfallschritte", "Turkish Get-up"];
const LINKS_RECHTS = ["Woodchop", "Around the World", "Plank Transfer", "Core Twist",
  "Dead Halos", "Around the Slings", "Grave Diggers", "Tactical Transfers"];
// Side Tilts: je Seite

const INFO_TEXTE = {
  "Spider Lunges": "Dynamisch und zügig. Fuß tief neben die Hand setzen, Hüfte öffnen.",
  "Mountain Climbers": "Sprint-Tempo. Knie explosiv unter der Brust durchziehen.",
  "Cross Body Climbers": "Knie über Kreuz zum gegenüberliegenden Ellbogen führen. Rumpf fest.",
  "Plank Tuck Jumps": "Aus der Plank mit beiden Füßen explosiv nach vorne springen und zurück.",
  "Dead Halos": "Auf dem Rücken (Dead-Bug-Position, Beine 90°). Kettlebell kontrolliert eng um den Kopf kreisen.",
  "Around the Slings": "Im aufrechten Stand. Kettlebell flüssig um die Hüfte kreisen und Hand wechseln.",
  "Grave Diggers": "Breiter Stand. Kettlebell tief an der Hüfte greifen und explosiv diagonal nach oben schaufeln.",
  "Tactical Transfers": "Tiefer Ausfallschritt/Kniebeuge. Kettlebell in flüssiger 8er-Form unter den Beinen durchgeben.",
  "Dead Pullovers": "Auf dem Rücken (unterer Rücken flach). Kettlebell gestreckt hinter den Kopf absenken und hochziehen.",
  "Figure 8": "Breiter Stand, Knie leicht gebeugt. Kettlebell in liegender Acht zwischen den Beinen durchführen.",
  "Kettlebell Windmill": "Kettlebell über Kopf gestreckt. Hüfte zur Seite schieben, mit geradem Arm zum Boden absenken.",
  "Goblet Squats": "Kettlebell vor der Brust halten. Tief in die Hocke, Rücken gerade, Knie nach außen.",
  "Woodchop": "Kettlebell diagonal von unten nach oben über die Schulter führen, aus der Rumpfdrehung.",
  "Around the World": "Kettlebell kontrolliert um die Hüfte kreisen, an der Rückseite die Hand wechseln.",
  "Kettlebell Swing": "Aus der Hüfte explosiv schwingen, nicht mit den Armen heben. Rumpf fest, Rücken gerade.",
  "Turkish Get-up": "Vom Liegen kontrolliert zum Stand, Kettlebell die ganze Zeit über Kopf gestreckt halten.",
  "Plank Transfer": "In der Plank ein Gewicht kontrolliert von einer Seite zur anderen schieben, Hüfte ruhig.",
  "Core Twist": "Aufrecht sitzend, Beine leicht angehoben. Gewicht kontrolliert von Seite zu Seite drehen.",
  "Hollow Hold Bicycle": "Unterer Rücken am Boden. Gegengleich Ellbogen zum Knie führen, Beine gestreckt.",
  "Plank": "Unterarmstütz, Körper eine Linie von Kopf bis Ferse. Bauch und Gesäß fest anspannen.",
  "Liegestütze": "Körper gerade, Hände unter den Schultern. Brust kontrolliert zum Boden, Ellbogen eng.",
  "Kurzhantel-Fliegende": "Auf der Bank, leicht gebeugte Arme. Hanteln im Bogen öffnen und über der Brust schließen.",
  "Kniebeuge": "Langhantel im Nacken. Tief in die Hocke, Knie über den Zehen, Rücken gerade.",
  "Kreuzheben": "Stange nah am Körper. Aus Hüfte und Beinen heben, Rücken die ganze Zeit gerade.",
  "Klimmzüge": "Über Schulterbreite greifen. Kontrolliert hochziehen bis Kinn über die Stange, langsam ablassen.",
  "Langhantelrudern": "Oberkörper vorgebeugt, Rücken gerade. Stange zum Bauch ziehen, Schulterblätter zusammen.",
  "Ausfallschritte": "Großer Schritt nach vorn, hinteres Knie Richtung Boden. Oberkörper aufrecht.",
  "Arm- & Schulterkreisen": "Arme gestreckt große Kreise ziehen, vorwärts und rückwärts. Schultern locker.",
  "World's Greatest Stretch": "Ausfallschritt, ein Ellbogen zum Boden, dann Brustkorb zur Decke öffnen.",
  "Deep Squat to Hamstring": "In die tiefe Hocke, dann Beine strecken und Gesäß nach oben schieben.",
  "Bird Dog": "Vierfüßlerstand. Gegengleich Arm und Bein strecken, Rumpf stabil, Rücken gerade.",
  "Jumping Jacks": "Hampelmann. Arme und Beine gleichzeitig öffnen und schließen, gleichmäßiges Tempo.",
  "Bankdrücken (LH)": "Flach auf der Bank. Stange kontrolliert zur Brust, dann kraftvoll nach oben drücken.",
  "Schrägbankdrücken (KH)": "Schrägbank. Hanteln von der oberen Brust nach oben drücken, Handgelenke stabil.",
  "Butterfly (Maschine)": "Aufrecht sitzen, Arme leicht gebeugt. Polster kontrolliert vor der Brust zusammenführen.",
  "Cable Flys": "Aufrecht, leicht vorgebeugt. Seile im Bogen vor der Brust zusammenführen, Spannung halten.",
  "Überzüge (KH)": "Quer auf der Bank. Hantel gestreckt hinter den Kopf absenken und zurückziehen.",
  "Trizeps-Drücken einarmig": "Ellbogen fixiert am Körper. Seil einarmig nach unten strecken, oben halten.",
  "Trizeps-Seil": "Ellbogen eng am Körper. Seil nach unten drücken und am Ende auseinanderziehen.",
  "Trizeps Überkopf": "Seil hinter dem Kopf. Arme nach oben strecken, Ellbogen zeigen nach vorn.",
  "Schulterdrücken (LH)": "Stange von der oberen Brust über Kopf drücken. Rumpf fest, kein Hohlkreuz.",
  "Incline DB Rows": "Bäuchlings auf der Schrägbank. Hanteln zum Körper ziehen, Schulterblätter zusammen.",
  "Low Row (einseitig)": "Am Seilzug sitzend, einarmig zum Bauch ziehen. Oberkörper stabil, nicht mitdrehen.",
  "Pull Down": "Griff über Schulterbreite. Zur oberen Brust ziehen, Schulterblätter nach unten.",
  "Face Pulls": "Seil auf Gesichtshöhe zum Kopf ziehen, Ellbogen hoch, Schulterblätter zusammen.",
  "Bizeps-Curls": "Ellbogen am Körper fixiert. Hanteln kontrolliert hochrollen, oben kurz halten.",
  "Incline Laying Curls": "Zurückgelehnt auf der Schrägbank. Arme hängen, Hanteln nur aus dem Bizeps curlen.",
  "Farmer Walk": "Schwere Gewichte seitlich tragen. Aufrecht gehen, Schultern zurück, Rumpf fest.",
  "Russian Twist": "Sitzend, Beine angehoben. Gewicht von Seite zu Seite drehen, Rumpf angespannt.",
  "Side Tilts": "Aufrecht stehen, Kettlebell seitlich. Oberkörper zur Gewichtseite neigen und aufrichten.",
  "Cable Crunches": "Vor dem Seilzug knien. Aus dem Bauch heraus einrollen, Hüfte bleibt fixiert.",
  "Holzhacker": "Gewicht diagonal von oben nach unten führen, wie beim Holzhacken. Aus dem Rumpf.",
  "Seitliche Rotation": "Aufrecht, Arme gestreckt. Gewicht kontrolliert zur Seite drehen, Hüfte stabil.",
  "Pallof Press": "Seitlich zum Seilzug. Griff vor der Brust nach vorn strecken, Rotation aktiv verhindern.",
  "Hyperextensions": "Auf dem Gerät, Oberkörper absenken und mit geradem Rücken wieder aufrichten.",
  "Medizinball Situps": "Rückenlage, Ball hinter dem Kopf. Aufrichten und Ball nach vorn führen.",
  "Flutter Kicks": "Rückenlage, Beine gestreckt knapp über dem Boden. Schnell auf und ab bewegen.",
  "Sledge Pull": "Schlitten am Gurt oder Seil ziehen. Tief bleiben, aus Beinen und Rücken arbeiten.",
  "Crosstrainer": "Gleichmäßiger Lauf, Arme aktiv mitnehmen. Tempo nach Zielvorgabe halten.",
  "Springseil": "Locker aus den Handgelenken springen, kleine Sprünge, gleichmäßiger Rhythmus.",
  "Burpees": "Aus dem Stand in den Stütz, Liegestütz, zurück und explosiv hochspringen.",
  "Bergsprint / Steigung": "Laufband mit Steigung, zügiges Tempo. Aufrecht laufen, Arme aktiv.",
};

const katalogStart = () => [
  ["Figure 8", "Kettlebell", 12, 10, { core: 50, beine: 30, ruecken: 20 }],
  ["Kettlebell Windmill", "Kettlebell", 12, 10, { schulter: 45, core: 40, beine: 15 }],
  ["Goblet Squats", "Kettlebell", 12, 10, { beine: 70, core: 20, ruecken: 10 }],
  ["Woodchop", "Kettlebell", 12, 10, { core: 60, schulter: 25, beine: 15 }],
  ["Around the World", "Kettlebell", 12, 10, { core: 50, schulter: 30, arme: 20 }],
  ["Kettlebell Swing", "Kettlebell", 16, 15, { beine: 45, ruecken: 30, core: 25 }],
  ["Turkish Get-up", "Kettlebell", 12, 5, { core: 40, schulter: 35, beine: 25 }],
  ["Plank Transfer", "Kettlebell", 12, 10, { core: 60, schulter: 25, arme: 15 }],
  ["Core Twist", "Kettlebell", 8, 20, { core: 90, arme: 10 }],
  ["Hollow Hold Bicycle", "Körpergewicht", 0, 20, { core: 100 }],
  ["Plank", "Matte", 0, 45, { core: 85, schulter: 15 }],
  ["Liegestütze", "Körpergewicht", 0, 12, { brust: 55, arme: 25, schulter: 15, core: 5 }],
  ["Kurzhantel-Fliegende", "Kurzhantel", 12, 12, { brust: 85, schulter: 15 }],
  ["Kniebeuge", "Langhantel", 80, 8, { beine: 75, core: 15, ruecken: 10 }],
  ["Kreuzheben", "Langhantel", 100, 5, { ruecken: 45, beine: 40, core: 15 }],
  ["Klimmzüge", "Klimmzugstange", 0, 8, { ruecken: 60, arme: 30, core: 10 }],
  ["Langhantelrudern", "Langhantel", 60, 10, { ruecken: 70, arme: 20, core: 10 }],
  ["Ausfallschritte", "Kurzhantel", 20, 12, { beine: 80, core: 20 }],
  ["Arm- & Schulterkreisen", "Körpergewicht", 0, 30, { schulter: 75, ruecken: 20, arme: 5 }],
  ["World's Greatest Stretch", "Matte", 0, 10, { beine: 45, core: 25, ruecken: 20, schulter: 10 }],
  ["Deep Squat to Hamstring", "Körpergewicht", 0, 10, { beine: 75, ruecken: 20, core: 5 }],
  ["Bird Dog", "Matte", 0, 10, { core: 55, ruecken: 20, beine: 15, schulter: 10 }],
  ["Jumping Jacks", "Körpergewicht", 0, 60, { kardio: 100 }],
  ["Bankdrücken (LH)", "Langhantel", 50, 10, { brust: 65, schulter: 20, arme: 15 }],
  ["Schrägbankdrücken (KH)", "Kurzhantel", 35, 10, { brust: 60, schulter: 25, arme: 15 }],
  ["Butterfly (Maschine)", "Maschine", 60, 10, { brust: 85, schulter: 15 }],
  ["Cable Flys", "Seilzug", 30, 10, { brust: 85, schulter: 15 }],
  ["Überzüge (KH)", "Kurzhantel", 30, 10, { brust: 40, ruecken: 40, arme: 20 }],
  ["Trizeps-Drücken einarmig", "Seilzug", 20, 10, { arme: 85, schulter: 15 }],
  ["Trizeps-Seil", "Seilzug", 40, 12, { arme: 90, schulter: 10 }],
  ["Trizeps Überkopf", "Seilzug", 30, 12, { arme: 90, schulter: 10 }],
  ["Schulterdrücken (LH)", "Langhantel", 30, 10, { schulter: 65, arme: 25, core: 10 }],
  ["Incline DB Rows", "Kurzhantel", 25, 10, { ruecken: 70, arme: 20, schulter: 10 }],
  ["Low Row (einseitig)", "Seilzug", 55, 10, { ruecken: 70, arme: 20, core: 10 }],
  ["Pull Down", "Maschine", 100, 10, { ruecken: 65, arme: 25, schulter: 10 }],
  ["Face Pulls", "Seilzug", 35, 12, { schulter: 60, ruecken: 30, arme: 10 }],
  ["Bizeps-Curls", "Kurzhantel", 12.5, 10, { arme: 90, schulter: 10 }],
  ["Incline Laying Curls", "Kurzhantel", 15, 8, { arme: 95, schulter: 5 }],
  ["Farmer Walk", "Kurzhantel", 50, 40, { arme: 30, ruecken: 30, core: 25, beine: 15 }],
  ["Russian Twist", "Kurzhantel", 10, 20, { core: 90, arme: 10 }],
  ["Side Tilts", "Kettlebell", 12, 12, { core: 90, ruecken: 10 }],
  ["Spider Lunges", "Körpergewicht", 0, 10, { beine: 55, core: 30, schulter: 15 }],
  ["Mountain Climbers", "Körpergewicht", 0, 30, { core: 45, kardio: 35, schulter: 20 }],
  ["Cross Body Climbers", "Körpergewicht", 0, 30, { core: 55, kardio: 30, schulter: 15 }],
  ["Plank Tuck Jumps", "Körpergewicht", 0, 15, { kardio: 40, core: 35, beine: 25 }],
  ["Dead Halos", "Kettlebell", 8, 10, { core: 60, schulter: 30, arme: 10 }],
  ["Around the Slings", "Kettlebell", 12, 12, { core: 55, schulter: 30, arme: 15 }],
  ["Grave Diggers", "Kettlebell", 12, 12, { core: 45, beine: 30, schulter: 25 }],
  ["Tactical Transfers", "Kettlebell", 12, 10, { beine: 45, core: 40, ruecken: 15 }],
  ["Dead Pullovers", "Kettlebell", 8, 12, { core: 45, ruecken: 30, schulter: 25 }],
  ["Cable Crunches", "Seilzug", 80, 15, { core: 100 }],
  ["Holzhacker", "Seilzug", 40, 10, { core: 70, schulter: 20, ruecken: 10 }],
  ["Seitliche Rotation", "Seilzug", 25, 10, { core: 85, schulter: 15 }],
  ["Pallof Press", "Seilzug", 25, 10, { core: 85, schulter: 15 }],
  ["Hyperextensions", "Maschine", 0, 15, { ruecken: 70, beine: 30 }],
  ["Medizinball Situps", "Medizinball", 0, 15, { core: 100 }],
  ["Flutter Kicks", "Matte", 0, 30, { core: 100 }],
  ["Sledge Pull", "Schlitten", 10, 10, { beine: 40, ruecken: 30, core: 20, arme: 10 }],
  ["Crosstrainer", "Crosstrainer", 0, 300, { kardio: 80, beine: 20 }],
  ["Springseil", "Springseil", 0, 60, { kardio: 70, beine: 20, schulter: 10 }],
  ["Burpees", "Körpergewicht", 0, 10, { kardio: 55, beine: 20, ruecken: 15, schulter: 10 }],
  ["Bergsprint / Steigung", "Laufband", 0, 30, { kardio: 60, beine: 40 }],
].map(([name, geraet, kg, wdh, mus]) => ({
  id: uid(), name, geraet, kg, wdh, muskeln: m(mus),
  seiten: EINSEITIG.includes(name) ? "jeSeite" : LINKS_RECHTS.includes(name) ? "lr1" : "beid",
  info: INFO_TEXTE[name] || "",
}));

/* ============ App ============ */
export default function App() {
  const [tab, setTab] = useState("plaene");
  const [plaene, setPlaene] = useState([]);
  const [verlauf, setVerlauf] = useState([]);
  const [katalog, setKatalog] = useState([]);
  const [geplant, setGeplant] = useState([]);
  const [laden, setLaden] = useState(true);
  const [hinweis, setHinweis] = useState(null);
  const [offen, setOffen] = useState(null);
  const [session, setSession] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await window.storage.get("plaene2");
        const d = p ? JSON.parse(p.value) : null;
        setPlaene(Array.isArray(d) && d.length ? d.map(normPlan) : [vorlageKettlebell()]);
      } catch { setPlaene([vorlageKettlebell()]); }
      try {
        const v = await window.storage.get("verlauf2");
        const d = v ? JSON.parse(v.value) : null;
        setVerlauf(Array.isArray(d) ? d : []);
      } catch { setVerlauf([]); }
      try {
        const k = await window.storage.get("katalog2");
        const d = k ? JSON.parse(k.value) : null;
        setKatalog(Array.isArray(d) && d.length ? d : katalogStart());
      } catch { setKatalog(katalogStart()); }
      try {
        const g = await window.storage.get("geplant2");
        const d = g ? JSON.parse(g.value) : null;
        setGeplant(Array.isArray(d) ? d : d?.planId ? [d] : []);
      } catch { setGeplant([]); }
      try {
        const l = await window.storage.get("laufend");
        const d = l ? JSON.parse(l.value) : null;
        if (d && Array.isArray(d.bloecke)) { setSession(d); setTab("training"); }
      } catch {}
      setLaden(false);
    })();
  }, []);

  useEffect(() => {
    if (laden) return;
    (async () => {
      try {
        if (session) await window.storage.set("laufend", JSON.stringify(session));
        else await window.storage.delete("laufend");
      } catch {}
    })();
  }, [session, laden]);

  const sichern = async (key, wert, setter) => {
    setter(wert);
    try { await window.storage.set(key, JSON.stringify(wert)); setHinweis(null); }
    catch { setHinweis("Speichern klappt gerade nicht – Änderungen gelten nur für diese Sitzung."); }
  };

  /* Rotierendes Auto-Backup: bei jeder Änderung an Plänen/Katalog/Verlauf einen
     datierten Snapshot ablegen, höchstens einen pro Tag, die letzten 7 behalten. */
  useEffect(() => {
    if (laden) return;
    (async () => {
      try {
        const tag = new Date().toISOString().slice(0, 10);
        const schluessel = `backup:${tag}`;
        await window.storage.set(schluessel, JSON.stringify({
          version: 2, exportiert: new Date().toISOString(), plaene, verlauf, katalog,
        }));
        const liste = await window.storage.list("backup:");
        const keys = (liste?.keys || []).sort();
        for (const k of keys.slice(0, Math.max(0, keys.length - 7))) {
          await window.storage.delete("backup:" + k.replace(/^backup:/, ""));
        }
      } catch {}
    })();
  }, [plaene, verlauf, katalog, laden]);
  const planSichern = (p) => sichern("plaene2", plaene.some((x) => x.id === p.id) ? plaene.map((x) => (x.id === p.id ? p : x)) : [...plaene, p], setPlaene);
  const planWeg = (id) => sichern("plaene2", plaene.filter((p) => p.id !== id), setPlaene);
  const planKopieren = (p) => {
    const kopie = {
      ...p, id: uid(), name: `${p.name || "Ohne Namen"} (Kopie)`,
      bloecke: (p.bloecke || []).map((b) => ({
        ...b, id: uid(),
        uebungen: (b.uebungen || []).map((u) => ({
          ...u, id: uid(),
          saetzeListe: (u.saetzeListe || []).map((sz) => ({ ...sz, id: uid() })),
          muskeln: { ...u.muskeln },
        })),
      })),
    };
    planSichern(kopie);
    setOffen(kopie);
  };
  const katalogSichern = (k) => sichern("katalog2", k, setKatalog);

  // Trägt fehlende Beschreibungen per Übungsname nach – im Katalog und in allen Plänen.
  const infoNachtragen = () => {
    const quelle = {};
    katalogStart().forEach((k) => { if (k.info) quelle[k.name] = k.info; });
    const erg = (u) => (u.info ? u : (quelle[u.name] ? { ...u, info: quelle[u.name] } : u));
    const neuerKatalog = (katalog || []).map(erg);
    const neuePlaene = (plaene || []).map((p) => ({
      ...p, bloecke: (p.bloecke || []).map((b) => ({ ...b, uebungen: (b.uebungen || []).map(erg) })),
    }));
    sichern("katalog2", neuerKatalog, setKatalog);
    sichern("plaene2", neuePlaene, setPlaene);
  };
  const merkliste = Array.isArray(geplant) ? geplant : geplant?.planId ? [geplant] : [];
  const vormerken = (planId, datum) => {
    const drin = merkliste.some((x) => x.planId === planId);
    const neu = drin
      ? merkliste.map((x) => (x.planId === planId ? { ...x, datum: datum ?? x.datum } : x))
      : [...merkliste, { planId, datum: datum || "" }];
    sichern("geplant2", neu, setGeplant);
  };
  const merkWeg = (planId) => sichern("geplant2", merkliste.filter((x) => x.planId !== planId), setGeplant);
  const backupsLesen = async () => {
    try {
      const liste = await window.storage.list("backup:");
      const keys = (liste?.keys || []).sort().reverse();
      const raus = [];
      for (const k of keys) {
        try { const v = await window.storage.get(k); raus.push({ key: k, ...JSON.parse(v.value) }); } catch {}
      }
      return raus;
    } catch { return []; }
  };
  const einspielen = (text) => {
    const d = JSON.parse(text);
    if (!d || !Array.isArray(d.plaene)) throw new Error("Format passt nicht");
    sichern("plaene2", d.plaene.map(normPlan), setPlaene);
    sichern("verlauf2", Array.isArray(d.verlauf) ? d.verlauf : [], setVerlauf);
    if (Array.isArray(d.katalog)) sichern("katalog2", d.katalog, setKatalog);
  };

  return (
    <div className="b min-h-screen" style={{ background: C.beton, color: C.tinte }}>
      <style>{FONTS}</style>
      {!session && (
        <header className="px-4 pt-5 pb-3 sticky top-0 z-20" style={{ borderBottom: `2px solid ${C.tinte}`, background: C.beton }}>
          <div>
            <h1 className="d text-2xl uppercase leading-none">
              Kabinett des Muskelkaters
              <span className="m text-[11px] align-top ml-1" style={{ color: C.grau }}>{APP_VERSION}</span>
            </h1>
            <span className="m text-[11px] block mt-1" style={{ color: C.grau }}>
              {plaene.length} Pläne · {verlauf.length} Einheiten
            </span>
          </div>
          <nav className="flex gap-1 mt-4">
            {[["plaene", "Pläne"], ["uebungen", "Übungen"], ["training", "Training"], ["verlauf", "Bilanz"]].map(([k, l]) => (
              <button key={k} onClick={() => { setTab(k); setOffen(null); }} className="d uppercase text-sm px-2 py-2 flex-1"
                style={{ background: tab === k ? C.tinte : "transparent", color: tab === k ? C.panel : C.grau,
                  border: `1px solid ${tab === k ? C.tinte : C.linie}`, borderRadius: 2 }}>{l}</button>
            ))}
          </nav>
        </header>
      )}

      {hinweis && <p className="m text-xs px-4 py-2" style={{ background: C.rot, color: "#fff" }}>{hinweis}</p>}

      <main className="px-4 py-4 pb-24 max-w-xl mx-auto">
        {laden ? <p className="m text-sm" style={{ color: C.grau }}>Lade …</p>
          : session ? <Einheit session={session} setSession={setSession} katalog={katalog}
              beenden={(e) => {
                sichern("verlauf2", [e, ...verlauf].slice(0, 300), setVerlauf);
                merkWeg(e.planId);
                setSession(null); setTab("verlauf");
              }} />
          : offen ? <Editor plan={offen} katalog={katalog} katalogSichern={katalogSichern}
              sichern={(p) => { planSichern(p); setOffen(null); }} zurueck={() => setOffen(null)}
              weg={plaene.some((x) => x.id === offen.id) ? () => { planWeg(offen.id); setOffen(null); } : null}
              kopieren={plaene.some((x) => x.id === offen.id) ? planKopieren : null} />
          : tab === "plaene" ? <Plaene plaene={plaene} bearbeiten={setOffen} verlauf={verlauf} merkliste={merkliste} vormerken={vormerken} merkWeg={merkWeg}
              vorlage={() => planSichern(vorlageKettlebell())} sicherung={{ plaene, verlauf, katalog }} einspielen={einspielen} backupsLesen={backupsLesen} />
          : tab === "uebungen" ? <Katalog katalog={katalog} sichern={katalogSichern} verlauf={verlauf} infoNachtragen={infoNachtragen} />
          : tab === "training" ? <Start plaene={plaene} starten={setSession} zuPlaenen={() => setTab("plaene")} merkliste={merkliste} vormerken={vormerken} merkWeg={merkWeg} verlauf={verlauf} />
          : <Bilanz verlauf={verlauf} />}
      </main>
    </div>
  );
}

/* ============ Planliste ============ */
const datumZeit = (iso) => {
  try { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
};

function Daten({ sicherung, einspielen, backupsLesen }) {
  const [auf, setAuf] = useState(false);
  const [text, setText] = useState("");
  const [csv, setCsv] = useState("");
  const [meldung, setMeldung] = useState(null);
  const [backups, setBackups] = useState(null);
  const dateiRef = useRef(null);
  const json = JSON.stringify({ version: 2, exportiert: new Date().toISOString(), ...sicherung }, null, 1);
  const stand = () => `${(sicherung.plaene || []).length} Pläne · ${(sicherung.verlauf || []).length} Einheiten · ${(sicherung.katalog || []).length} Übungen`;

  const dateiname = () => `kdm-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  const download = (name, inhalt, typ) => {
    try {
      const url = URL.createObjectURL(new Blob([inhalt], { type: typ }));
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
      return true;
    } catch { return false; }
  };

  const alsDatei = () => setMeldung(
    download(dateiname(), json, "application/json")
      ? "Backup-Datei erstellt – landet in deinem Download-Ordner. Von dort nach Google Drive verschieben."
      : "Download ging nicht – nimm „Teilen“ oder „Text kopieren“.");

  const teilen = async () => {
    const datei = new File([json], dateiname(), { type: "application/json" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [datei] })) {
        await navigator.share({ files: [datei], title: "KdM Backup" });
        setMeldung("Zum Teilen geöffnet – wähl Google Drive oder Dateien."); return;
      }
      if (navigator.share) { await navigator.share({ title: "KdM Backup", text: json }); return; }
      throw new Error("kein Teilen");
    } catch { setMeldung("Teilen nicht verfügbar – nimm „Als Datei speichern“."); }
  };

  const dateiGewaehlt = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { einspielen(await f.text()); setMeldung("Backup-Datei eingespielt."); }
    catch { setMeldung("Die Datei ließ sich nicht lesen – ist es ein KdM-Backup?"); }
    e.target.value = "";
  };

  const laden = () => {
    try { einspielen(text); setMeldung("Sicherung eingespielt."); setText(""); }
    catch { setMeldung("Das war keine gültige Sicherung. Bitte den kompletten Text einfügen."); }
  };
  const kopieren = async () => {
    try { await navigator.clipboard.writeText(json); setMeldung("Sicherung in der Zwischenablage."); }
    catch { setMeldung("Kopieren ging nicht – nutz „Als Datei speichern“."); }
  };
  const backupsZeigen = async () => {
    const b = await backupsLesen();
    setBackups(b);
    if (!b.length) setMeldung("Noch keine automatischen Backups vorhanden.");
  };

  return (
    <div className="mt-8">
      <button onClick={() => setAuf(!auf)} className="d uppercase text-xs" style={{ color: C.grau }}>
        {auf ? "▾" : "▸"} Daten sichern & wiederherstellen
      </button>
      {auf && (
        <Karte className="mt-2">
          <p className="b text-xs" style={{ color: C.grau }}>
            Deine Daten liegen im Speicher dieses Geräts und überstehen App-Updates.
            Für Gerätewechsel oder Sicherheit: als Datei speichern und in Google Drive ablegen.
          </p>
          <p className="m text-[11px] mt-1" style={{ color: C.tinte }}>Aktuell: {stand()}</p>

          <p className="d uppercase text-[11px] mt-4 mb-1" style={{ color: C.grau }}>Sichern</p>
          <div className="flex flex-wrap gap-2">
            <Btn klein ton="voll" onClick={alsDatei}>Als Datei speichern</Btn>
            <Btn klein onClick={teilen}>An Drive teilen</Btn>
            <Btn klein onClick={kopieren}>Text kopieren</Btn>
          </div>

          <p className="d uppercase text-[11px] mt-4 mb-1" style={{ color: C.grau }}>Wiederherstellen</p>
          <div className="flex flex-wrap gap-2">
            <Btn klein ton="voll" onClick={() => dateiRef.current?.click()}>Aus Datei laden</Btn>
            <Btn klein onClick={backupsZeigen}>Auto-Backups</Btn>
          </div>
          <input ref={dateiRef} type="file" accept="application/json,.json" onChange={dateiGewaehlt} style={{ display: "none" }} />

          {backups && backups.length > 0 && (
            <ul className="mt-2 space-y-1">
              {backups.map((b) => (
                <li key={b.key} className="flex items-center gap-2 p-2"
                  style={{ background: C.beton, border: `1px solid ${C.linie}`, borderRadius: 2 }}>
                  <span className="m text-[11px] flex-1" style={{ color: C.grau }}>
                    {datumZeit(b.exportiert)} · {(b.plaene || []).length}P · {(b.verlauf || []).length}E
                  </span>
                  <Btn klein onClick={() => {
                    try { einspielen(JSON.stringify(b)); setMeldung(`Backup vom ${datumZeit(b.exportiert)} eingespielt.`); }
                    catch { setMeldung("Dieses Backup ließ sich nicht laden."); }
                  }}>Laden</Btn>
                </li>
              ))}
            </ul>
          )}

          {meldung && <p className="m text-[11px] mt-3" style={{ background: C.beton, padding: 8, borderRadius: 2 }}>{meldung}</p>}

          <details className="mt-4">
            <summary className="m text-[11px]" style={{ color: C.grau }}>Trainings als Tabelle (CSV)</summary>
            <div className="flex flex-wrap gap-2 mt-2">
              <Btn klein onClick={() => setMeldung(
                download(`kdm-trainings-${new Date().toISOString().slice(0, 10)}.csv`, "\ufeff" + csvAus(sicherung.verlauf), "text/csv;charset=utf-8")
                  ? "CSV-Datei erstellt." : "Download ging nicht.")}>Als CSV speichern</Btn>
              <Btn klein onClick={() => { setCsv(csvAus(sicherung.verlauf)); }}>Anzeigen</Btn>
            </div>
            {csv && (
              <textarea readOnly value={csv} rows={6} onFocus={(e) => e.target.select()}
                className="m text-[10px] w-full mt-2 p-2"
                style={{ background: C.beton, border: `1px solid ${C.linie}`, borderRadius: 2 }} />
            )}
          </details>

          <details className="mt-2">
            <summary className="m text-[11px]" style={{ color: C.grau }}>Text manuell einfügen / anzeigen</summary>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
              placeholder="Sicherungstext hier einfügen"
              className="m text-[11px] w-full mt-2 p-2"
              style={{ background: C.beton, border: `1px solid ${C.linie}`, borderRadius: 2 }} />
            <Btn klein onClick={laden} disabled={!text.trim()}>Text einspielen</Btn>
            <textarea readOnly value={json} rows={5} onFocus={(e) => e.target.select()}
              className="m text-[10px] w-full mt-2 p-2"
              style={{ background: C.beton, border: `1px solid ${C.linie}`, borderRadius: 2 }} />
          </details>
        </Karte>
      )}
    </div>
  );
}

const planHistorie = (verlauf, p) => {
  const treffer = (verlauf || []).filter((e) => (e.planId ? e.planId === p.id : e.name === p.name));
  return { anzahl: treffer.length, letzte: treffer[0]?.datum || null };
};
const datumKurz = (d) => new Date(d).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

function Plaene({ plaene, bearbeiten, vorlage, sicherung, einspielen, verlauf, merkliste, vormerken, merkWeg, backupsLesen }) {
  const neu = () => bearbeiten({ id: uid(), name: "", notiz: "", bloecke: [] });
  return (
    <div>
      <p className="m text-[11px] mb-2" style={{ color: C.grau }}>Vorlagen</p>
      <div className="flex flex-wrap gap-2">
        <Btn ton="voll" onClick={neu}>+ Neuer Plan</Btn>
        <Btn onClick={vorlage}>Vorlage: Suffering Sunday</Btn>
      </div>
      <ul className="mt-4 space-y-2">
        {plaene.map((p) => {
          const bl = Array.isArray(p.bloecke) ? p.bloecke : [];
          const hist = planHistorie(verlauf, p);
          const eintrag = merkliste.find((x) => x.planId === p.id);
          const { v, gesamt } = verteilung(bl, geplantBlock);
          return (
            <li key={p.id}><Karte>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="d text-xl uppercase leading-tight">{p.name || "Ohne Namen"}</h3>
                  <p className="m text-[11px]" style={{ color: C.grau }}>
                    {bl.length} Blöcke · {bl.reduce((a, b) => a + (b.uebungen?.length || 0), 0)} Übungen
                  </p>
                  <p className="m text-[11px]" style={{ color: C.grau }}>
                    {hist.anzahl > 0
                      ? `${hist.anzahl}× absolviert · zuletzt ${datumKurz(hist.letzte)}`
                      : "noch nie absolviert"}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <StiftKnopf onClick={() => bearbeiten(p)} titel="Plan bearbeiten" />
                </div>
              </div>
              <div className="mt-2">
                {eintrag
                  ? <div className="flex items-center gap-2 px-2 py-2" style={{ background: C.gruen, color: "#fff", borderRadius: 2 }}>
                      <span className="d uppercase text-xs flex-1">
                        Vorgemerkt{eintrag.datum ? ` für ${datumKurz(eintrag.datum)}` : ""}
                      </span>
                      <button className="d uppercase text-[11px] px-2 py-1"
                        style={{ border: "1px solid #fff", borderRadius: 2 }}
                        onClick={() => merkWeg(p.id)}>lösen</button>
                    </div>
                  : <Btn klein onClick={() => vormerken(p.id)}>Vormerken</Btn>}
              </div>
              <div className="mt-3"><Auswertung v={v} gesamt={gesamt} titel="Geplante Gewichtung" /></div>
            </Karte></li>
          );
        })}
      </ul>
      <Daten sicherung={sicherung} einspielen={einspielen} backupsLesen={backupsLesen} />
    </div>
  );
}

/* ============ Editor ============ */
function Editor({ plan, sichern: save, zurueck, weg, kopieren, katalog, katalogSichern }) {
  const [p, setP] = useState(plan);
  const [sicher, setSicher] = useState(false);
  const [meldung, setMeldungRaw] = useState(null);
  const setMeldung = (m) => setMeldungRaw(m);
  useEffect(() => {
    if (!meldung) return;
    const t = setTimeout(() => setMeldungRaw(null), 2500);
    return () => clearTimeout(t);
  }, [meldung]);
  const upd = (f, w) => setP({ ...p, [f]: w });
  const updBlock = (id, neu) => setP({ ...p, bloecke: p.bloecke.map((b) => (b.id === id ? neu : b)) });
  const blockSchieben = (i, richtung) => {
    const j = i + richtung;
    if (j < 0 || j >= p.bloecke.length) return;
    const arr = [...p.bloecke];
    const h = arr[i]; arr[i] = arr[j]; arr[j] = h;
    setP({ ...p, bloecke: arr });
  };
  const addBlock = (typ) => setP({ ...p, bloecke: [...p.bloecke, {
    id: uid(), typ,
    name: typ === "leiter" ? "Leiter" : typ === "intervall" ? "Intervall"
      : typ === "einzel" ? "Einzelsätze" : typ === "einfach" ? "Zirkel"
      : typ === "laufband" ? "Laufband" : "Block",
    auswerten: true, start: 10, ende: 1, schritt: 1, runden: 1, arbeit: 20, pause: 10, durchgaenge: 3, satzpause: 30,
    dauer: 1200, steigung: 0, tempo: "", uebungen: [] }] });
  const { v, gesamt } = verteilung(p.bloecke, geplantBlock);

  return (
    <div>
      <h2 className="d text-2xl uppercase">Plan bearbeiten</h2>
      <Feld className="mt-3" value={p.name} onChange={(e) => upd("name", e.target.value)} placeholder="Name des Plans" />
      <Feld className="mt-2" value={p.notiz || ""} onChange={(e) => upd("notiz", e.target.value)} placeholder="Notiz, z. B. Gewichtsvorgabe" />

      <div className="mt-4"><Karte><Auswertung v={v} gesamt={gesamt} titel="Gewichtung dieses Plans" /></Karte></div>

      <div className="mt-4 space-y-3">
        {p.bloecke.map((b, bi) => (
          <BlockEditor key={b.id} b={b} katalog={katalog} katalogSichern={katalogSichern} upd={(n) => updBlock(b.id, n)}
            hoch={bi > 0 ? () => blockSchieben(bi, -1) : null}
            runter={bi < p.bloecke.length - 1 ? () => blockSchieben(bi, 1) : null}
            weg={() => setP({ ...p, bloecke: p.bloecke.filter((x) => x.id !== b.id) })} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Btn klein onClick={() => addBlock("standard")}>+ Sätze-Block</Btn>
        <Btn klein onClick={() => addBlock("einzel")}>+ Einzelsätze</Btn>
        <Btn klein onClick={() => addBlock("einfach")}>+ Zirkel / Warm-up</Btn>
        <Btn klein onClick={() => addBlock("laufband")}>+ Laufband</Btn>
        <Btn klein onClick={() => addBlock("amrap")}>+ AMRAP</Btn>
        <Btn klein onClick={() => addBlock("gewichtsleiter")}>+ Gewichtsleiter</Btn>
        <Btn klein onClick={() => addBlock("leiter")}>+ Leiter</Btn>
        <Btn klein onClick={() => addBlock("intervall")}>+ Intervall</Btn>
      </div>
      <div className="mt-6" style={{ borderTop: `1px solid ${C.linie}`, paddingTop: 16 }}>
        <div className="flex items-center gap-2">
          <Btn ton="voll" onClick={() => { save(p); setMeldung("Plan gesichert."); }}>Plan sichern</Btn>
          {kopieren && (
            <Btn onClick={() => { kopieren(p); setMeldung("Als neue Kopie gespeichert."); }}>
              <span className="flex items-center justify-center gap-2"><Kopie /> Als Kopie</span>
            </Btn>
          )}
          <div className="flex-1" />
          <button onClick={zurueck} aria-label="Zurück" title="Zurück"
            className="flex items-center justify-center shrink-0"
            style={{ minWidth: 44, minHeight: 40, border: `1px solid ${C.linie}`, borderRadius: 2, color: C.tinte }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
        {meldung && (
          <p className="m text-[11px] mt-2 text-center px-3 py-2"
            style={{ background: C.gruen, color: "#fff", borderRadius: 2 }}>{meldung}</p>
        )}
        {weg && (
          <button onClick={() => setSicher(true)} className="d uppercase text-xs mt-4"
            style={{ color: C.rot }}>Plan löschen</button>
        )}
      </div>
      {sicher && (
        <Karte className="mt-3">
          <p className="b text-sm">„{p.name || "Ohne Namen"}“ wirklich löschen?</p>
          <p className="m text-[11px] mt-1" style={{ color: C.grau }}>
            Bereits absolvierte Einheiten bleiben in der Bilanz erhalten.
          </p>
          <div className="flex gap-2 mt-3">
            <Btn klein ton="rot" onClick={weg}>Ja, löschen</Btn>
            <Btn klein onClick={() => setSicher(false)}>Abbrechen</Btn>
          </div>
        </Karte>
      )}
    </div>
  );
}

function BlockEditor({ b, upd, weg, hoch, runter, katalog, katalogSichern }) {
  const [auf, setAuf] = useState(false);
  const [waehlen, setWaehlen] = useState(false);
  const addU = () => upd(uebungDazu(b, leereUebung(b.typ)));
  const updU = (id, n) => upd({ ...b, uebungen: b.uebungen.map((u) => (u.id === id ? n : u)) });

  return (
    <Karte>
      <div className="flex items-center gap-2">
        <button onClick={hoch} disabled={!hoch} aria-label="Block nach oben"
          className="d text-base" style={{ minWidth: 34, minHeight: 40, border: `1px solid ${C.linie}`, borderRadius: 2, color: hoch ? C.tinte : C.linie }}>▲</button>
        <button onClick={runter} disabled={!runter} aria-label="Block nach unten"
          className="d text-base" style={{ minWidth: 34, minHeight: 40, border: `1px solid ${C.linie}`, borderRadius: 2, color: runter ? C.tinte : C.linie }}>▼</button>
        <Feld value={b.name} onChange={(e) => upd({ ...b, name: e.target.value })} />
        <button onClick={weg} className="d text-sm px-2 py-2" style={{ color: C.rot }} aria-label="Block löschen">✕</button>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="m text-[11px] uppercase" style={{ color: C.grau }}>
          {b.typ === "leiter" ? "Leiter" : b.typ === "intervall" ? "Intervall" : b.typ === "einzel" ? "Einzelsätze" : b.typ === "einfach" ? "Zirkel / Warm-up" : b.typ === "laufband" ? "Laufband" : b.typ === "amrap" ? "AMRAP" : b.typ === "gewichtsleiter" ? "Gewichtsleiter" : "Sätze"}
        </span>
        <label className="b text-xs flex items-center gap-2">
          <input type="checkbox" checked={b.auswerten} onChange={(e) => upd({ ...b, auswerten: e.target.checked })} />
          zählt in die Auswertung
        </label>
      </div>

      {b.typ === "leiter" && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[["start", "von Wdh"], ["ende", "bis Wdh"], ["schritt", "Schritt"]].map(([f, l]) => (
            <div key={f}><label className="m text-[10px] block mb-1" style={{ color: C.grau }}>{l}</label>
              <Feld type="number" inputMode="numeric" value={b[f]} onChange={(e) => upd({ ...b, [f]: e.target.value })} /></div>
          ))}
          <p className="m text-[11px] col-span-3" style={{ color: C.grau }}>
            {leiterRunden(b).length} Runden · {leiterWdh(b)} Wdh je Übung
          </p>
        </div>
      )}
      {b.typ === "einfach" && (
        <div className="mt-2">
          <label className="m text-[10px] block mb-1" style={{ color: C.grau }}>Runden (1 = Warm-up, mehr = Zirkel)</label>
          <Feld type="number" inputMode="numeric" value={b.runden ?? 1}
            onChange={(e) => upd({ ...b, runden: e.target.value })} />
        </div>
      )}
      {b.typ === "laufband" && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div><label className="m text-[10px] block mb-1" style={{ color: C.grau }}>Minuten</label>
            <Feld type="number" inputMode="numeric" value={Math.round(zahl(b.dauer) / 60)}
              onChange={(e) => upd({ ...b, dauer: zahl(e.target.value) * 60 })} /></div>
          <div><label className="m text-[10px] block mb-1" style={{ color: C.grau }}>Zieltempo km/h</label>
            <Feld type="number" inputMode="decimal" value={b.tempo ?? ""}
              onChange={(e) => upd({ ...b, tempo: e.target.value })} /></div>
          <div><label className="m text-[10px] block mb-1" style={{ color: C.grau }}>Zielsteigung von %</label>
            <Feld type="number" inputMode="decimal" value={b.stgVon ?? 0}
              onChange={(e) => upd({ ...b, stgVon: Math.min(15, Math.max(0, zahl(e.target.value))) })} /></div>
          <div><label className="m text-[10px] block mb-1" style={{ color: C.grau }}>bis % (max 15)</label>
            <Feld type="number" inputMode="decimal" value={b.stgBis ?? 0}
              onChange={(e) => upd({ ...b, stgBis: Math.min(15, Math.max(0, zahl(e.target.value))) })} /></div>
        </div>
      )}
      {b.typ === "gewichtsleiter" && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div><label className="m text-[10px] block mb-1" style={{ color: C.grau }}>Start kg</label>
            <Feld type="number" inputMode="decimal" value={b.kgVon ?? 50}
              onChange={(e) => upd({ ...b, kgVon: e.target.value, stufenKg: null })} /></div>
          <div><label className="m text-[10px] block mb-1" style={{ color: C.grau }}>Ziel kg</label>
            <Feld type="number" inputMode="decimal" value={b.kgBis ?? 100}
              onChange={(e) => upd({ ...b, kgBis: e.target.value, stufenKg: null })} /></div>
          <div><label className="m text-[10px] block mb-1" style={{ color: C.grau }}>Schritt kg</label>
            <Feld type="number" inputMode="decimal" value={b.kgSchritt ?? 10}
              onChange={(e) => upd({ ...b, kgSchritt: e.target.value, stufenKg: null })} /></div>
          <p className="m text-[11px] col-span-3" style={{ color: C.grau }}>
            {gewichtStufen(b).length} Stufen: {gewichtStufen(b).join(" · ")} kg
          </p>
        </div>
      )}
      {b.typ === "amrap" && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div><label className="m text-[10px] block mb-1" style={{ color: C.grau }}>Zeit (Minuten)</label>
            <Feld type="number" inputMode="numeric" value={Math.round(zahl(b.dauer) / 60)}
              onChange={(e) => upd({ ...b, dauer: zahl(e.target.value) * 60 })} /></div>
          <p className="m text-[11px] self-end pb-2" style={{ color: C.grau }}>So viele Runden wie möglich in der Zeit.</p>
        </div>
      )}
      {b.typ === "intervall" && (
        <div className="grid grid-cols-4 gap-2 mt-2">
          {[["arbeit", "Arbeit s"], ["pause", "Pause s"], ["durchgaenge", "Sets"], ["satzpause", "Satzp. s"]].map(([f, l]) => (
            <div key={f}><label className="m text-[10px] block mb-1" style={{ color: C.grau }}>{l}</label>
              <Feld type="number" inputMode="numeric" value={b[f]} onChange={(e) => upd({ ...b, [f]: e.target.value })} /></div>
          ))}
        </div>
      )}

      {b.typ !== "laufband" && (
        <button onClick={() => setAuf(!auf)} className="d uppercase text-xs mt-3" style={{ color: C.grau }}>
          {auf ? "▾" : "▸"} {b.uebungen.length} Übungen
        </button>
      )}
      {auf && (
        <div className="mt-2 space-y-3">
          {b.uebungen.map((u, i) => (
            <UebungEditor key={u.id} u={u} i={i} typ={b.typ} upd={(n) => updU(u.id, n)}
              katalogSichern={katalogSichern} katalog={katalog}
              hoch={i > 0 ? () => upd(uebungSchieben(b, i, -1)) : null}
              runter={i < b.uebungen.length - 1 ? () => upd(uebungSchieben(b, i, 1)) : null}
              weg={() => upd(uebungWeg(b, i))} />
          ))}
          <div className="flex gap-2">
            <Btn klein ton="voll" onClick={() => setWaehlen(!waehlen)}>{waehlen ? "Hinzufügen zu" : "Aus Katalog"}</Btn>
            <Btn klein onClick={addU}>Neue Übung</Btn>
          </div>
          {waehlen && <Auswahl katalog={katalog} nehmen={(k) => upd(uebungDazu(b, ausKatalog(k, b.typ)))} />}
        </div>
      )}
    </Karte>
  );
}

function Auswahl({ katalog, nehmen }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(null);
  const treffer = (katalog || []).filter((k) =>
    k.name.toLowerCase().includes(q.toLowerCase()) && (!filter || zahl(k.muskeln?.[filter]) > 0)
  );
  return (
    <div className="p-2" style={{ background: C.beton, border: `1px solid ${C.linie}`, borderRadius: 2 }}>
      <Feld value={q} onChange={(e) => setQ(e.target.value)} placeholder="Übung suchen" />
      <div className="flex flex-wrap gap-1 mt-2">
        {GRUPPEN.map((g) => (
          <button key={g.id} onClick={() => setFilter(filter === g.id ? null : g.id)}
            className="d uppercase text-[11px] px-2 py-1"
            style={{ background: filter === g.id ? g.farbe : "transparent", color: filter === g.id ? "#fff" : C.grau,
              border: `1px solid ${filter === g.id ? g.farbe : C.linie}`, borderRadius: 2 }}>{g.name}</button>
        ))}
      </div>
      <ul className="mt-2 max-h-64 overflow-auto space-y-1">
        {treffer.length === 0 && <li className="b text-xs py-2" style={{ color: C.grau }}>Nichts gefunden.</li>}
        {treffer.map((k) => (
          <li key={k.id}>
            <button onClick={() => nehmen(k)} className="w-full text-left p-2 flex items-center gap-2"
              style={{ background: C.panel, border: `1px solid ${C.linie}`, borderRadius: 2 }}>
              <span className="flex-1 min-w-0">
                <span className="b text-sm block truncate">{k.name}</span>
                {k.geraet && <span className="m text-[11px] block" style={{ color: C.grau }}>{k.geraet}</span>}
              </span>
              <Streifen muskeln={k.muskeln} />
              <span className="d text-lg" style={{ color: C.grau }}>+</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Streifen({ muskeln }) {
  const summe = GRUPPEN.reduce((a, g) => a + zahl(muskeln?.[g.id]), 0) || 1;
  return (
    <span className="flex h-2 shrink-0" style={{ width: 56, border: `1px solid ${C.linie}` }}>
      {GRUPPEN.map((g) => {
        const w = (zahl(muskeln?.[g.id]) / summe) * 100;
        return w > 0.5 ? <span key={g.id} style={{ width: `${w}%`, background: g.farbe }} /> : null;
      })}
    </span>
  );
}

function MuskelBalken({ muskeln }) {
  const summe = GRUPPEN.reduce((a, g) => a + zahl(muskeln?.[g.id]), 0);
  if (summe <= 0) return <p className="m text-[11px]" style={{ color: C.grau }}>keine Anteile hinterlegt</p>;
  const reihen = GRUPPEN.map((g) => ({ ...g, p: (zahl(muskeln?.[g.id]) / summe) * 100 })).filter((r) => r.p >= 0.5).sort((a, b) => b.p - a.p);
  return (
    <div>
      <div className="flex h-3" style={{ border: `1px solid ${C.tinte}` }}>
        {reihen.map((r) => <div key={r.id} style={{ width: `${r.p}%`, background: r.farbe }} title={`${r.name} ${Math.round(r.p)} %`} />)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
        {reihen.map((r) => (
          <span key={r.id} className="m text-[11px] flex items-center gap-1" style={{ color: C.grau }}>
            <span style={{ width: 8, height: 8, background: r.farbe, display: "inline-block" }} />{r.name} {Math.round(r.p)} %
          </span>
        ))}
      </div>
    </div>
  );
}

function MuskelFelder({ muskeln, on }) {
  const [edit, setEdit] = useState(false);
  const summe = GRUPPEN.reduce((a, g) => a + zahl(muskeln?.[g.id]), 0);
  return (
    <div>
      <div className="flex items-center justify-between mt-3 mb-1">
        <p className="m text-[10px]" style={{ color: C.grau }}>
          Muskelanteile{edit && summe > 0 ? ` (normiert auf 100 %, aktuell ${summe})` : ""}
        </p>
        <button onClick={() => setEdit(!edit)} className="d uppercase text-[11px]" style={{ color: C.grau }}>
          {edit ? "fertig" : "ändern"}
        </button>
      </div>
      {edit ? (
        <div className="grid grid-cols-3 gap-2">
          {GRUPPEN.map((g) => (
            <div key={g.id}>
              <label className="m text-[10px] flex items-center gap-1 mb-1">
                <span style={{ width: 8, height: 8, background: g.farbe, display: "inline-block" }} />{g.name}
              </label>
              <Feld type="number" inputMode="numeric" value={muskeln?.[g.id] ?? 0}
                onChange={(e) => on({ ...leereMuskeln(), ...muskeln, [g.id]: e.target.value })} />
            </div>
          ))}
        </div>
      ) : (
        <MuskelBalken muskeln={muskeln} />
      )}
    </div>
  );
}

/* ============ Katalogseite ============ *//* ============ Katalogseite ============ */
function Katalog({ katalog, sichern, verlauf, infoNachtragen }) {
  const rekorde = useMemo(() => {
    const map = {};
    (verlauf || []).forEach((e) => {
      (e.leistung || []).forEach((l) => {
        const best = (l.saetze || []).reduce((a, sz) => {
          const kg = zahl(sz.kg);
          if (kg > a.kg || (kg === a.kg && zahl(sz.wdh) > a.wdh)) return { kg, wdh: zahl(sz.wdh) };
          return a;
        }, { kg: 0, wdh: 0 });
        if (best.kg <= 0) return;
        const da = map[l.name];
        if (!da || best.kg > da.kg || (best.kg === da.kg && new Date(e.datum) < new Date(da.datum))) {
          map[l.name] = { kg: best.kg, wdh: best.wdh, datum: e.datum };
        }
      });
    });
    return map;
  }, [verlauf]);
  const prText = (name) => {
    const r = rekorde[name];
    if (!r) return null;
    return `PR ${r.kg} kg × ${r.wdh} · ${new Date(r.datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}`;
  };

  const [q, setQ] = useState("");
  const [offen, setOffen] = useState(null);
  const [sicher, setSicher] = useState(false);
  const [filter, setFilter] = useState([]);
  const [modus, setModus] = useState("beliebig");

  const anteil = (k, id) => {
    const summe = GRUPPEN.reduce((a, g) => a + zahl(k.muskeln?.[g.id]), 0) || 1;
    return (zahl(k.muskeln?.[id]) / summe) * 100;
  };
  const trefferAnteil = (k) => filter.reduce((a, id) => a + anteil(k, id), 0);
  const passt = (k) => {
    if (!filter.length) return true;
    return modus === "alle"
      ? filter.every((id) => anteil(k, id) > 0)
      : filter.some((id) => anteil(k, id) > 0);
  };
  const liste = (katalog || [])
    .filter((k) => k.name.toLowerCase().includes(q.toLowerCase()) && passt(k))
    .sort((a, b) => (filter.length ? trefferAnteil(b) - trefferAnteil(a) : a.name.localeCompare(b.name, "de")));

  const speichern = (k) => {
    sichern((katalog || []).some((x) => x.id === k.id) ? katalog.map((x) => (x.id === k.id ? k : x)) : [...(katalog || []), k]);
    setOffen(null);
  };

  if (offen) return (
    <div>
      <h2 className="d text-2xl uppercase">Übung</h2>
      {sicher && (
        <Karte className="mt-3">
          <p className="b text-sm">„{offen.name}“ wirklich aus dem Katalog löschen?</p>
          <p className="m text-[11px] mt-1" style={{ color: C.grau }}>Pläne, in denen sie schon steckt, bleiben unverändert.</p>
          <div className="flex gap-2 mt-3">
            <Btn klein ton="rot" onClick={() => { sichern((katalog || []).filter((x) => x.id !== offen.id)); setSicher(false); setOffen(null); }}>Ja, löschen</Btn>
            <Btn klein onClick={() => setSicher(false)}>Abbrechen</Btn>
          </div>
        </Karte>
      )}
      <Feld className="mt-3" value={offen.name} onChange={(e) => setOffen({ ...offen, name: e.target.value })} placeholder="Name" />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Num l="Standard kg" v={offen.kg} on={(x) => setOffen({ ...offen, kg: x })} />
        <Num l="Standard Wdh / Sek" v={offen.wdh} on={(x) => setOffen({ ...offen, wdh: x })} />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <GeraetFeld v={offen.geraet} on={(x) => setOffen({ ...offen, geraet: x })} />
        <SeitenFeld v={offen.seiten} on={(x) => setOffen({ ...offen, seiten: x })} />
      </div>
      <Karte className="mt-3">
        {prText(offen.name)
          ? <>
              <p className="d uppercase text-sm">Bestleistung</p>
              <p className="m text-2xl mt-1" style={{ color: C.gruen }}>{rekorde[offen.name].kg} kg × {rekorde[offen.name].wdh}</p>
              <p className="m text-[11px]" style={{ color: C.grau }}>
                aufgestellt am {new Date(rekorde[offen.name].datum).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            </>
          : <p className="m text-[11px]" style={{ color: C.grau }}>Noch kein Rekord – der kommt aus deinen abgeschlossenen Trainings.</p>}
      </Karte>
      <MuskelFelder muskeln={offen.muskeln} on={(mus) => setOffen({ ...offen, muskeln: mus })} />
      <div className="flex flex-wrap gap-2 mt-4">
        <Btn ton="voll" onClick={() => speichern(offen)} disabled={!offen.name.trim()}>Sichern</Btn>
        <Btn onClick={() => { setSicher(false); setOffen(null); }}>Zurück</Btn>
        {(katalog || []).some((x) => x.id === offen.id) && (
          <Btn ton="rot" onClick={() => setSicher(true)}>Löschen</Btn>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex gap-2">
        <Feld value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen" />
        <Btn ton="voll" klein onClick={() => setOffen({ id: uid(), name: "", geraet: "", seiten: "beid", kg: 0, wdh: 10, muskeln: leereMuskeln() })}>+ Neu</Btn>
      </div>
      <div className="flex flex-wrap gap-2 mt-1">
        {katalogStart().some((k) => !(katalog || []).some((x) => x.name === k.name)) && (
          <Btn klein onClick={() => sichern([...(katalog || []), ...katalogStart().filter((k) => !(katalog || []).some((x) => x.name === k.name))])}>
            Fehlende Standardübungen ergänzen
          </Btn>
        )}
        <Btn klein onClick={infoNachtragen}>Beschreibungen nachtragen</Btn>
      </div>
      <div className="flex flex-wrap gap-1 mt-3">
        {GRUPPEN.map((g) => {
          const an = filter.includes(g.id);
          return (
            <button key={g.id} onClick={() => setFilter(an ? filter.filter((x) => x !== g.id) : [...filter, g.id])}
              aria-pressed={an} className="d uppercase text-xs px-3 py-2"
              style={{ background: an ? g.farbe : "transparent", color: an ? "#fff" : C.grau,
                border: `1px solid ${an ? g.farbe : C.linie}`, borderRadius: 2 }}>
              {g.name}
            </button>
          );
        })}
      </div>

      {filter.length > 1 && (
        <div className="flex gap-1 mt-2">
          {[["beliebig", "eine reicht"], ["alle", "alle nötig"]].map(([k, l]) => (
            <button key={k} onClick={() => setModus(k)} className="d uppercase text-[11px] px-3 py-2 flex-1"
              style={{ background: modus === k ? C.tinte : "transparent", color: modus === k ? C.panel : C.grau,
                border: `1px solid ${modus === k ? C.tinte : C.linie}`, borderRadius: 2 }}>{l}</button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <p className="m text-[11px] flex-1" style={{ color: C.grau }}>
          {liste.length} von {(katalog || []).length} Übungen
          {filter.length > 0 && " · nach Anteil sortiert"}
        </p>
        {filter.length > 0 && <Btn klein onClick={() => setFilter([])}>Filter zurücksetzen</Btn>}
      </div>
      <ul className="mt-3 space-y-2">
        {liste.map((k) => (
          <li key={k.id}><Karte>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="d text-lg uppercase truncate">{k.name}</h3>
                <span className="m text-[11px] block" style={{ color: C.grau }}>
                  {k.geraet ? `${k.geraet} · ` : ""}{zahl(k.kg) > 0 ? `${k.kg} kg · ` : ""}{wdhText(k, k.wdh)}
                </span>
                {filter.length > 0 && (
                  <span className="m text-[11px] block">
                    {filter.map((id) => {
                      const g = GRUPPEN.find((x) => x.id === id);
                      return `${g.name} ${Math.round(anteil(k, id))} %`;
                    }).join(" · ")}
                  </span>
                )}
                {prText(k.name) && (
                  <span className="m text-[11px] block" style={{ color: C.gruen }}>{prText(k.name)}</span>
                )}
              </div>
              <Streifen muskeln={k.muskeln} />
              <StiftKnopf onClick={() => setOffen(k)} titel="Übung bearbeiten" />
            </div>
          </Karte></li>
        ))}
      </ul>
    </div>
  );
}

function UebungEditor({ u, i, typ, upd, weg, hoch, runter, katalog, katalogSichern }) {
  return (
    <div className="p-2" style={{ border: `1px solid ${C.linie}`, borderRadius: 2 }}>
      <div className="flex items-center gap-2">
        <span className="d text-base" style={{ color: C.grau }}>{String(i + 1).padStart(2, "0")}</span>
        <Feld value={u.name} onChange={(e) => upd({ ...u, name: e.target.value })} placeholder="Übung" />
        <button onClick={hoch} disabled={!hoch} className="d text-sm px-1" aria-label="nach oben"
          style={{ color: hoch ? C.tinte : C.linie }}>▲</button>
        <button onClick={runter} disabled={!runter} className="d text-sm px-1" aria-label="nach unten"
          style={{ color: runter ? C.tinte : C.linie }}>▼</button>
        <button onClick={weg} className="d text-xs px-2" style={{ color: C.rot }} aria-label="Übung löschen">✕</button>
      </div>

      {typ === "einzel" && (
        <div className="mt-2">
          <p className="m text-[10px] mb-1" style={{ color: C.grau }}>Sätze einzeln planen</p>
          {satzListe(u).map((sz, si) => (
            <div key={sz.id} className="flex items-center gap-2 mt-1">
              <span className="m text-xs shrink-0" style={{ width: 18, color: C.grau }}>{si + 1}</span>
              <Feld type="number" inputMode="decimal" value={sz.kg}
                onChange={(e) => upd({ ...u, saetzeListe: satzListe(u).map((x, j) => (j === si ? { ...x, kg: e.target.value } : x)) })} />
              <span className="m text-xs shrink-0" style={{ color: C.grau }}>kg</span>
              <Feld type="number" inputMode="numeric" value={sz.wdh}
                onChange={(e) => upd({ ...u, saetzeListe: satzListe(u).map((x, j) => (j === si ? { ...x, wdh: e.target.value } : x)) })} />
              <span className="m text-xs shrink-0" style={{ color: C.grau }}>Wdh</span>
              <button onClick={() => upd({ ...u, saetzeListe: satzListe(u).filter((_, j) => j !== si) })}
                className="d text-xs px-1" style={{ color: C.rot }} aria-label={`Satz ${si + 1} löschen`}>✕</button>
            </div>
          ))}
          <div className="mt-2">
            <Btn klein onClick={() => {
              const letzt = satzListe(u)[satzListe(u).length - 1];
              upd({ ...u, saetzeListe: [...satzListe(u), { id: uid(), kg: letzt?.kg ?? u.kg ?? 0, wdh: letzt?.wdh ?? 10 }] });
            }}>+ Satz</Btn>
          </div>
        </div>
      )}

      {(typ === "einfach" || typ === "amrap") && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Num l="Wdh je Runde" v={u.wdh} on={(x) => upd({ ...u, wdh: x })} />
          <Num l="kg (optional)" v={u.kg} on={(x) => upd({ ...u, kg: x })} />
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 mt-2">
        {typ === "standard" && (
          <>
            <Num l="Sätze" v={u.saetze} on={(x) => upd({ ...u, saetze: x })} />
            {u.messung === "zeit"
              ? <Num l="Sek" v={u.dauer} on={(x) => upd({ ...u, dauer: x })} />
              : <Num l="Wdh" v={u.wdh} on={(x) => upd({ ...u, wdh: x })} />}
            <Num l="Pause s" v={u.pause} on={(x) => upd({ ...u, pause: x })} />
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <GeraetFeld v={u.geraet} on={(x) => upd({ ...u, geraet: x })} />
        {(typ === "standard" || typ === "leiter" || typ === "intervall")
          ? <Num l="kg" v={u.kg} on={(x) => upd({ ...u, kg: x })} />
          : <SeitenFeld v={u.seiten} on={(x) => upd({ ...u, seiten: x })} />}
      </div>
      {(typ === "standard" || typ === "leiter" || typ === "intervall") && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <SeitenFeld v={u.seiten} on={(x) => upd({ ...u, seiten: x })} />
        </div>
      )}
      {typ === "standard" && (
        <label className="b text-xs flex items-center gap-2 mt-2">
          <input type="checkbox" checked={u.messung === "zeit"} onChange={(e) => upd({ ...u, messung: e.target.checked ? "zeit" : "wdh" })} />
          nach Zeit statt Wiederholungen
        </label>
      )}

      <div className="mt-2">
        <label className="m text-[10px] block mb-1" style={{ color: C.grau }}>Beschreibung (optional, erscheint als i-Info)</label>
        <textarea value={u.info || ""} onChange={(e) => upd({ ...u, info: e.target.value })} rows={2}
          placeholder="z. B. Kettlebell kontrolliert eng um den Kopf kreisen"
          className="b text-sm w-full px-2 py-2"
          style={{ background: C.beton, border: `1px solid ${C.linie}`, borderRadius: 2 }} />
      </div>
      <MuskelFelder muskeln={u.muskeln} on={(mus) => upd({ ...u, muskeln: mus })} />

      {katalogSichern && u.name.trim() && !(katalog || []).some((k) => k.name === u.name) && (
        <button className="d uppercase text-[11px] mt-2" style={{ color: C.grau }}
          onClick={() => katalogSichern([...(katalog || []), { id: uid(), name: u.name, geraet: u.geraet || "", seiten: u.seiten || "beid", kg: u.kg, wdh: u.wdh, muskeln: u.muskeln }])}>
          + in den Katalog übernehmen
        </button>
      )}
    </div>
  );
}
const GeraetFeld = ({ v, on }) => (
  <div>
    <label className="m text-[10px] block mb-1" style={{ color: C.grau }}>Gerät</label>
    <select value={v || ""} onChange={(e) => on(e.target.value)}
      className="m text-sm px-2 py-2 w-full"
      style={{ background: C.panel, border: `1px solid ${C.linie}`, borderRadius: 2, color: C.tinte, minHeight: 44 }}>
      <option value="">— kein Gerät —</option>
      {GERAETE.map((g) => <option key={g} value={g}>{g}</option>)}
      {v && !GERAETE.includes(v) && <option value={v}>{v}</option>}
    </select>
  </div>
);
const SeitenFeld = ({ v, on }) => (
  <div>
    <label className="m text-[10px] block mb-1" style={{ color: C.grau }}>Zählweise</label>
    <select value={v || "beid"} onChange={(e) => on(e.target.value)}
      className="m text-sm px-2 py-2 w-full"
      style={{ background: C.panel, border: `1px solid ${C.linie}`, borderRadius: 2, color: C.tinte, minHeight: 44 }}>
      {SEITEN.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
    </select>
  </div>
);
const Num = ({ l, v, on }) => (
  <div><label className="m text-[10px] block mb-1" style={{ color: C.grau }}>{l}</label>
    <Feld type="number" inputMode="decimal" value={v} onChange={(e) => on(e.target.value)} /></div>
);

/* ============ Training starten ============ */
function Start({ plaene, starten, zuPlaenen, merkliste, vormerken, merkWeg, verlauf }) {
  const [alle, setAlle] = useState(false);

  const los = (p) => starten({
    planId: p.id, name: p.name, start: null, gelaufen: 0, aktivSeit: null,
    bloecke: p.bloecke.map((b) => ({
      ...b,
      zeit: 0,
      amrapRunden: 0,
      erledigt: b.typ === "laufband" || b.typ === "amrap"
        ? []
        : b.typ === "gewichtsleiter"
        ? gewichtStufen(b).map(() => 0)
        : b.typ === "einzel"
        ? b.uebungen.map((u) => satzListe(u).map(() => false))
        : b.typ === "leiter"
        ? leiterRunden(b).map(() => b.uebungen.map(() => false))
        : b.typ === "einfach"
        ? Array.from({ length: Math.max(1, zahl(b.runden)) }, () => b.uebungen.map(() => false))
        : b.typ === "intervall"
        ? Array.from({ length: zahl(b.durchgaenge) }, () => b.uebungen.map(() => false))
        : b.uebungen.map((u) => Array.from({ length: zahl(u.saetze) || 1 }, () => false)),
    })),
  });

  if (!plaene.length) return (
    <div><p className="b text-sm mb-3" style={{ color: C.grau }}>Für ein Training brauchst du erst einen Plan.</p>
      <Btn ton="voll" onClick={zuPlaenen}>Plan anlegen</Btn></div>
  );

  const warteschlange = merkliste
    .map((x) => ({ ...x, plan: plaene.find((p) => p.id === x.planId) }))
    .filter((x) => x.plan)
    .sort((a, b) => (a.datum || "9999").localeCompare(b.datum || "9999"));
  const rest = plaene.filter((p) => !warteschlange.some((x) => x.planId === p.id));

  return (
    <div>
      {warteschlange.length > 0 ? (
        <>
          <p className="d uppercase text-sm mb-2" style={{ color: C.grau }}>
            Vorgemerkt · {warteschlange.length} {warteschlange.length === 1 ? "Plan" : "Pläne"}
          </p>
          <ul className="space-y-3">
            {warteschlange.map((x, i) => (
              <li key={x.planId}><Karte>
                <div className="flex items-baseline gap-2">
                  <span className="d text-2xl" style={{ color: C.grau }}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="d text-2xl uppercase leading-none">{x.plan.name || "Ohne Namen"}</h2>
                    <p className="m text-[11px] mt-1" style={{ color: C.grau }}>
                      {x.plan.bloecke.map((b) => b.name).join(" · ")}
                    </p>
                  </div>
                </div>
                <button onClick={() => los(x.plan)} className="d uppercase text-xl w-full mt-3"
                  style={{ minHeight: 72, background: C.gruen, color: "#fff", border: `1px solid ${C.gruen}`, borderRadius: 2 }}>
                  Training starten
                </button>
                <div className="flex items-center gap-2 mt-2">
                  <label className="m text-[11px]" style={{ color: C.grau }}>Termin</label>
                  <input type="date" value={x.datum || ""} onChange={(e) => vormerken(x.planId, e.target.value)}
                    className="m text-xs px-2 py-2 flex-1"
                    style={{ background: C.beton, border: `1px solid ${C.linie}`, borderRadius: 2 }} />
                  <Btn klein onClick={() => merkWeg(x.planId)}>Lösen</Btn>
                </div>
              </Karte></li>
            ))}
          </ul>
        </>
      ) : (
        <p className="b text-sm mb-3" style={{ color: C.grau }}>
          Nichts vorgemerkt. Wähl einen Plan – oder merk dir im Reiter „Pläne“ welche vor.
        </p>
      )}

      {warteschlange.length > 0 && rest.length > 0 && (
        <button onClick={() => setAlle(!alle)} className="d uppercase text-xs mt-4" style={{ color: C.grau }}>
          {alle ? "▾" : "▸"} anderen Plan starten
        </button>
      )}

      {(warteschlange.length === 0 || alle) && (
        <ul className="space-y-2 mt-2">
          {rest.map((p) => {
            const hist = planHistorie(verlauf, p);
            return (
              <li key={p.id}>
                <button onClick={() => los(p)} className="w-full text-left p-4"
                  style={{ background: C.panel, border: `1px solid ${C.linie}`, borderRadius: 2 }}>
                  <span className="d text-xl uppercase">{p.name || "Ohne Namen"}</span>
                  <span className="m text-[11px] block" style={{ color: C.grau }}>
                    {hist.anzahl > 0 ? `zuletzt ${datumKurz(hist.letzte)}` : "noch nie absolviert"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ============ Laufende Einheit ============ */
const uhr = (sek) => {
  const g = Math.max(0, Math.floor(sek));
  const h = Math.floor(g / 3600), min = Math.floor(g / 60) % 60, sk = g % 60;
  return `${h ? h + ":" : ""}${String(min).padStart(2, "0")}:${String(sk).padStart(2, "0")}`;
};

/* Abgehakte Sätze einer Einheit für die Kraftauswertung sammeln */
function leistungAus(session) {
  const raus = [];
  (session.bloecke || []).forEach((bl) => {
    const block = bl.name || "Block";
    if (bl.typ === "laufband") {
      if (bl.fertig) raus.push({ block, name: bl.name || "Laufband", geraet: "Laufband", info: `${Math.round(zahl(bl.dauer) / 60)} min`, saetze: [] });
      return;
    }
    if (bl.typ === "amrap") {
      if (zahl(bl.amrapRunden) > 0) raus.push({ block, name: bl.name || "AMRAP", geraet: "", info: `${bl.amrapRunden} Runden`, saetze: [] });
      return;
    }
    (bl.uebungen || []).forEach((u, ui) => {
      const saetze = [];
      if (bl.typ === "einzel") {
        satzListe(u).forEach((sz, si) => {
          const w = hakenWert(((bl.erledigt || [])[ui] || [])[si]);
          if (einseitig(u)) {
            if (w & 1) saetze.push({ kg: zahl(sz.kg), wdh: zahl(sz.wdh), seite: "L" });
            if (w & 2) saetze.push({ kg: zahl(sz.kgR ?? sz.kg), wdh: zahl(sz.wdhR ?? sz.wdh), seite: "R" });
          } else if (w > 0) {
            saetze.push({ kg: zahl(sz.kg), wdh: zahl(sz.wdh) });
          }
        });
      } else if (bl.typ === "leiter") {
        leiterRunden(bl).forEach((wdh, ri) => {
          if (istFertig(u, ((bl.erledigt || [])[ri] || [])[ui])) saetze.push({ kg: zahl(u.kg), wdh });
        });
      } else if (bl.typ === "gewichtsleiter") {
        if (ui === 0) gewichtStufen(bl).forEach((kg, ri) => {
          if (hakenWert((bl.erledigt || [])[ri]) > 0) saetze.push({ kg, wdh: 1 });
        });
      } else if (bl.typ === "einfach") {
        const n = ((bl.erledigt || []).filter((row) => istFertig(u, (row || [])[ui]))).length;
        for (let k = 0; k < n; k++) saetze.push({ kg: zahl(u.kg), wdh: zahl(u.wdh) });
      } else if (bl.typ === "intervall") {
        const n = (bl.erledigt || []).filter((d) => istFertig(u, (d || [])[ui])).length;
        for (let k = 0; k < n; k++) saetze.push({ kg: zahl(u.kg), wdh: 0, info: `${zahl(bl.arbeit)} s` });
      } else if (bl.typ === "standard") {
        const n = ((bl.erledigt || [])[ui] || []).filter((x) => istFertig(u, x)).length;
        for (let k = 0; k < n; k++) {
          saetze.push(u.messung === "zeit"
            ? { kg: zahl(u.kg), wdh: 0, info: `${zahl(u.dauer)} s` }
            : { kg: zahl(u.kg), wdh: zahl(u.wdh) });
        }
      }
      if (saetze.length) raus.push({ block, name: u.name, geraet: u.geraet || "", saetze });
    });
  });
  return raus;
}

function Einheit({ session, setSession, beenden, katalog }) {
  const [jetzt, setJetzt] = useState(Date.now());
  const [bi, setBi] = useState(0);
  const [fertigAn, setFertigAn] = useState(false);

  const gelaufen = zahl(session.gelaufen) + (session.start ? (jetzt - session.start) / 1000 : 0);
  const laeuft = !!session.start;

  useEffect(() => {
    if (!session.start) return;
    setJetzt(Date.now());
    const t = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session.start]);

  /* Bildschirm bleibt an, solange eine Trainingseinheit offen ist.
     Android gibt die Sperre beim Wegschalten frei – daher bei Rückkehr neu anfordern. */
  useEffect(() => {
    let sperre = null;
    let abgemeldet = false;
    const anfordern = async () => {
      try {
        if (!abgemeldet && navigator.wakeLock && document.visibilityState === "visible") {
          sperre = await navigator.wakeLock.request("screen");
          sperre.addEventListener("release", () => { sperre = null; });
        }
      } catch {}
    };
    const beiSichtbar = () => { if (document.visibilityState === "visible") anfordern(); };
    anfordern();
    document.addEventListener("visibilitychange", beiSichtbar);
    return () => {
      abgemeldet = true;
      document.removeEventListener("visibilitychange", beiSichtbar);
      try { sperre && sperre.release(); } catch {}
    };
  }, []);

  /* Laufende Zeit dem gerade offenen Block gutschreiben */
  const einbuchen = (basis, index) => {
    if (!basis.aktivSeit) return basis.bloecke;
    const sek = (Date.now() - basis.aktivSeit) / 1000;
    return basis.bloecke.map((b, i) => (i === index ? { ...b, zeit: zahl(b.zeit) + sek } : b));
  };

  const starten = () => setSession({ ...session, start: Date.now(), aktivSeit: Date.now() });
  const anhalten = () => setSession({ ...session, bloecke: einbuchen(session, bi), start: null, aktivSeit: null, gelaufen });
  const wechseln = (neu) => {
    setSession({ ...session, bloecke: einbuchen(session, bi), aktivSeit: session.start ? Date.now() : null });
    setBi(neu); setFertigAn(false);
  };
  const [neuBlock, setNeuBlock] = useState(false);
  const blockDazu = (typ) => {
    const b = {
      id: uid(), typ,
      name: typ === "leiter" ? "Leiter" : typ === "intervall" ? "Intervall"
        : typ === "einzel" ? "Einzelsätze" : typ === "einfach" ? "Zirkel"
        : typ === "laufband" ? "Laufband" : typ === "amrap" ? "AMRAP"
      : typ === "gewichtsleiter" ? "Gewichtsleiter" : "Block",
      auswerten: true, start: 10, ende: 1, schritt: 1, runden: 1, arbeit: 20, pause: 10,
      durchgaenge: 3, satzpause: 30, dauer: 1200, stgVon: 0, stgBis: 0, tempo: "", zeit: 0, amrapRunden: 0,
      kgVon: 50, kgBis: 100, kgSchritt: 10,
      erledigt: [],
      uebungen: typ === "laufband"
        ? [{ id: uid(), name: "Laufen", geraet: "Laufband", seiten: "beid", messung: "zeit",
             saetze: 1, wdh: 0, dauer: 1200, kg: 0, pause: 0, saetzeListe: [],
             muskeln: { ...leereMuskeln(), kardio: 80, beine: 20 } }]
        : typ === "gewichtsleiter"
        ? [{ id: uid(), name: "Sled Pull", geraet: "Schlitten", seiten: "beid", messung: "wdh",
             saetze: 1, wdh: 1, dauer: 0, kg: 0, pause: 60, saetzeListe: [],
             muskeln: { ...leereMuskeln(), beine: 40, ruecken: 30, core: 20, arme: 10 } }]
        : [],
    };
    setSession({ ...session, bloecke: [...session.bloecke, b] });
    setBi(session.bloecke.length);
    setNeuBlock(false);
  };

  const setBlock = (i, neu) => {
    const startet = !session.start && !zahl(session.gelaufen);
    setSession({
      ...session,
      start: startet ? Date.now() : session.start,
      aktivSeit: startet ? Date.now() : session.aktivSeit,
      bloecke: session.bloecke.map((x, j) => (j === i ? neu : x)),
    });
  };

  /* Blöcke inklusive der Sekunden, die im offenen Block gerade laufen */
  const bloeckeJetzt = session.bloecke.map((b, i) =>
    i === bi && session.aktivSeit ? { ...b, zeit: zahl(b.zeit) + (jetzt - session.aktivSeit) / 1000 } : b
  );
  const blockZeit = (i) => zahl(bloeckeJetzt[i]?.zeit);
  const { v, gesamt } = verteilung(bloeckeJetzt, (b) => zahl(b.zeit));

  const blockFertig = (bl) => {
    if (bl.typ === "laufband") return !!bl.fertig;
    if (bl.typ === "amrap") return zahl(bl.amrapRunden) > 0;
    const erl = bl.erledigt || [];
    if (!erl.length) return false;
    if (bl.typ === "gewichtsleiter") return erl.some((x) => hakenWert(x) > 0);
    return rundenTyp(bl)
      ? erl.every((r) => (r || []).every((x, j) => istFertig(bl.uebungen[j], x)))
      : erl.every((r, i) => (r || []).every((x) => istFertig(bl.uebungen[i], x)));
  };
  const b = session.bloecke[Math.min(bi, session.bloecke.length - 1)];
  const letzter = bi >= session.bloecke.length - 1;

  return (
    <div>
      {/* Kopf bleibt beim Scrollen stehen */}
      <div className="sticky -mx-4 px-4 pt-2 pb-3 z-10" style={{ top: 0, background: C.beton, borderBottom: `2px solid ${C.tinte}` }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <span className="m text-5xl leading-none block">{uhr(gelaufen)}</span>
            <span className="b text-sm block mt-1 truncate" style={{ color: C.grau }}>
              {session.name} · Block {uhr(blockZeit(bi))}
            </span>
          </div>
          <button onClick={laeuft ? anhalten : starten} className="d uppercase text-lg"
            style={{ minWidth: 108, minHeight: 64, background: laeuft ? C.rot : C.gruen, color: "#fff",
              border: `2px solid ${laeuft ? C.rot : C.gruen}`, borderRadius: 2 }}>
            {laeuft ? "Stopp" : gelaufen > 0 ? "Weiter" : "Start"}
          </button>
        </div>
        <div className="flex gap-1 mt-2">
          {session.bloecke.map((x, i) => (
            <button key={x.id} onClick={() => wechseln(i)} className="flex-1 d uppercase text-xs py-2 truncate"
              style={{ background: i === bi ? C.tinte : blockFertig(x) ? C.gruen : "transparent",
                color: i === bi || blockFertig(x) ? C.panel : C.grau,
                border: `1px solid ${i === bi ? C.tinte : C.linie}`, borderRadius: 2 }}>
              <span className="block truncate">{x.name}</span>
              <span className="m text-[9px] block opacity-80">{uhr(blockZeit(i))}</span>
            </button>
          ))}
        </div>
      </div>

      {b && (
        <div className="mt-4">
          {b.hinweis && <p className="b text-sm mb-2" style={{ color: C.grau }}>{b.hinweis}</p>}
          {b.typ === "laufband" ? <LaufbandLauf key={b.id} b={b} upd={(n) => setBlock(bi, n)} />
            : b.typ === "amrap" ? <AmrapLauf key={b.id} b={b} upd={(n) => setBlock(bi, n)} />
            : b.typ === "gewichtsleiter" ? <GewichtLauf key={b.id} b={b} upd={(n) => setBlock(bi, n)} />
            : b.typ === "einfach" ? <EinfachLauf key={b.id} b={b} upd={(n) => setBlock(bi, n)} />
            : b.typ === "einzel" ? <EinzelLauf key={b.id} b={b} upd={(n) => setBlock(bi, n)} />
            : b.typ === "leiter" ? <LeiterLauf key={b.id} b={b} upd={(n) => setBlock(bi, n)} />
            : b.typ === "intervall" ? <IntervallLauf key={b.id} b={b} upd={(n) => setBlock(bi, n)} />
            : <SaetzeLauf key={b.id} b={b} upd={(n) => setBlock(bi, n)} />}
          {b.typ !== "laufband" && b.typ !== "amrap" && <BlockAnpassen b={b} upd={(n) => setBlock(bi, n)} katalog={katalog} />}
        </div>
      )}

      <div className="mt-6">
        <button onClick={() => setNeuBlock(!neuBlock)} className="d uppercase text-xs" style={{ color: C.grau }}>
          {neuBlock ? "▾" : "▸"} Block zur Einheit hinzufügen
        </button>
        {neuBlock && (
          <div className="flex flex-wrap gap-2 mt-2">
            {[["standard", "Sätze"], ["einzel", "Einzelsätze"], ["leiter", "Leiter"],
              ["intervall", "Intervall"], ["einfach", "Zirkel"], ["laufband", "Laufband"], ["amrap", "AMRAP"], ["gewichtsleiter", "Gewichtsleiter"]].map(([t, l]) => (
              <Btn klein key={t} onClick={() => blockDazu(t)}>{l}</Btn>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        {bi > 0 && <Btn onClick={() => wechseln(bi - 1)}>◂ Zurück</Btn>}
        {!letzter
          ? <button onClick={() => wechseln(bi + 1)} className="d uppercase text-lg flex-1"
              style={{ minHeight: 60, background: C.tinte, color: C.panel, border: `1px solid ${C.tinte}`, borderRadius: 2 }}>
              Nächster Block ▸
            </button>
          : <button onClick={() => setFertigAn(true)} className="d uppercase text-lg flex-1"
              style={{ minHeight: 60, background: C.tinte, color: C.panel, border: `1px solid ${C.tinte}`, borderRadius: 2 }}>
              Einheit abschließen
            </button>}
      </div>

      {fertigAn && (
        <div className="mt-4"><Karte>
          <Auswertung v={v} gesamt={gesamt} titel="Das hast du bewegt" />
          <p className="b text-sm mt-3" style={{ color: C.grau }}>{uhr(gelaufen)} auf der Uhr.</p>
          <button className="d uppercase text-xs mt-2" style={{ color: C.grau }}
            onClick={() => { try { navigator.clipboard.writeText(textAus({
              name: session.name, datum: new Date().toISOString(), dauer: Math.round(gelaufen / 60), leistung: leistungAus(session) })); } catch {} }}>
            Einheit als Text kopieren
          </button>
          <div className="flex gap-2 mt-3">
            <Btn ton="voll" onClick={() => beenden({
              id: uid(), planId: session.planId, name: session.name, datum: new Date().toISOString(),
              dauer: Math.round(gelaufen / 60), sekundenGesamt: Math.round(gelaufen),
              sekunden: Math.round(gesamt), verteilung: v, leistung: leistungAus(session),
              bloecke: bloeckeJetzt.filter((b) => zahl(b.zeit) > 0).map((b) => ({ name: b.name, zeit: Math.round(zahl(b.zeit)) })),
            })}>Speichern</Btn>
            <Btn onClick={() => setFertigAn(false)}>Weiter trainieren</Btn>
          </div>
        </Karte></div>
      )}

      <div className="mt-6"><Btn onClick={() => setSession(null)}>Einheit verwerfen</Btn></div>
    </div>
  );
}

/* Häkchen: beidseitig ein Feld, einseitig je eins für L und R */
function Haken({ u, wert, um, hoch = 56 }) {
  const w = hakenWert(wert);
  if (!einseitig(u)) {
    const an = istFertig(u, wert);
    return (
      <button onClick={() => um(3)} aria-label="erledigt" aria-pressed={an} className="d text-2xl shrink-0"
        style={{ minWidth: 60, minHeight: hoch, background: an ? C.gruen : "transparent",
          color: an ? "#fff" : C.grau, border: `2px solid ${an ? C.gruen : C.linie}`, borderRadius: 2 }}>✓</button>
    );
  }
  return (
    <span className="flex gap-1 shrink-0">
      {[["L", 1], ["R", 2]].map(([l, bit]) => {
        const an = (w & bit) === bit;
        return (
          <button key={l} onClick={() => um(bit)} aria-label={`Seite ${l}`} aria-pressed={an}
            className="d text-lg" style={{ minWidth: 46, minHeight: hoch, background: an ? C.gruen : "transparent",
              color: an ? "#fff" : C.grau, border: `2px solid ${an ? C.gruen : C.linie}`, borderRadius: 2 }}>{l}</button>
        );
      })}
    </span>
  );
}

function BlockAnpassen({ b, upd, katalog }) {
  const [auf, setAuf] = useState(false);
  const [waehlen, setWaehlen] = useState(false);

  return (
    <div className="mt-5">
      <button onClick={() => setAuf(!auf)} className="d uppercase text-xs" style={{ color: C.grau }}>
        {auf ? "▾" : "▸"} Block anpassen
      </button>
      {auf && (
        <Karte className="mt-2">
          <ul className="space-y-1">
            {b.uebungen.map((u, i) => (
              <li key={u.id}>
              <div className="flex items-center gap-1">
                <span className="b text-sm flex-1 truncate">{u.name || "Ohne Namen"}</span>
                <button onClick={() => upd(uebungSchieben(b, i, -1))} disabled={i === 0} aria-label="nach oben"
                  className="d text-base" style={{ minWidth: 40, minHeight: 40, border: `1px solid ${C.linie}`,
                    borderRadius: 2, color: i === 0 ? C.linie : C.tinte }}>▲</button>
                <button onClick={() => upd(uebungSchieben(b, i, 1))} disabled={i === b.uebungen.length - 1} aria-label="nach unten"
                  className="d text-base" style={{ minWidth: 40, minHeight: 40, border: `1px solid ${C.linie}`,
                    borderRadius: 2, color: i === b.uebungen.length - 1 ? C.linie : C.tinte }}>▼</button>
                <button onClick={() => upd(uebungWeg(b, i))} aria-label="Übung entfernen"
                  className="d text-base" style={{ minWidth: 40, minHeight: 40, border: `1px solid ${C.linie}`,
                    borderRadius: 2, color: C.rot }}>✕</button>
              </div>
              <div className="mt-1">
                <select value={u.geraet || ""} onChange={(e) => upd({ ...b, uebungen: b.uebungen.map((x, j) => (j === i ? { ...x, geraet: e.target.value } : x)) })}
                  className="m text-xs px-2 py-2 w-full"
                  style={{ background: C.beton, border: `1px solid ${C.linie}`, borderRadius: 2, color: C.tinte }}>
                  <option value="">— Gerät wählen —</option>
                  {GERAETE.map((g) => <option key={g} value={g}>{g}</option>)}
                  {u.geraet && !GERAETE.includes(u.geraet) && <option value={u.geraet}>{u.geraet}</option>}
                </select>
              </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 mt-3">
            <Btn klein ton="voll" onClick={() => setWaehlen(!waehlen)}>{waehlen ? "Liste schließen" : "Aus Katalog"}</Btn>
            <Btn klein onClick={() => upd(uebungDazu(b, { ...leereUebung(b.typ), name: "Neue Übung" }))}>Neue Übung</Btn>
          </div>
          {waehlen && (
            <div className="mt-2">
              <Auswahl katalog={katalog} nehmen={(k) => { upd(uebungDazu(b, ausKatalog(k, b.typ))); setWaehlen(false); }} />
            </div>
          )}
          <p className="m text-[11px] mt-3" style={{ color: C.grau }}>
            Gilt nur für diese Einheit – dein Plan bleibt, wie er ist.
          </p>
        </Karte>
      )}
    </div>
  );
}

function GewichtLauf({ b, upd }) {
  const basis = gewichtStufen(b);
  const schritt = Math.max(1, zahl(b.kgSchritt) || 10);
  // stufenKg speichert die (ggf. angepassten) Ist-Gewichte; ab Start = berechnete Leiter
  const stufen = (Array.isArray(b.stufenKg) && b.stufenKg.length === basis.length)
    ? b.stufenKg.map((x) => zahl(x)) : basis;
  const erl = Array.isArray(b.erledigt) ? b.erledigt : [];
  const [r0, setR] = useState(0);
  const r = Math.min(r0, Math.max(0, stufen.length - 1));
  const fertig = (i) => hakenWert(erl[i]) > 0;
  const stufeFertig = fertig(r);
  const gemacht = stufen.filter((_, i) => fertig(i)).length;

  const setStatus = (i, an) => {
    const arr = stufen.map((_, j) => (j === i ? (an ? 3 : 0) : hakenWert(erl[j] ?? 0)));
    upd({ ...b, erledigt: arr });
  };
  // ab aktueller Stufe alle folgenden um delta*schritt verschieben, davor unverändert
  const verschieben = (delta) => {
    const neu = stufen.map((kg, j) => (j >= r ? zahl(kg) + delta * schritt : kg));
    upd({ ...b, stufenKg: neu });
  };
  // eine weitere Stufe obendrauf, Schrittweite über der letzten
  const stufeDazu = () => {
    const neu = [...stufen, zahl(stufen[stufen.length - 1]) + schritt];
    upd({ ...b, stufenKg: neu, erledigt: [...stufen.map((_, j) => hakenWert(erl[j] ?? 0)), 0] });
    setR(stufen.length);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <button onClick={() => setR(Math.max(0, r - 1))} disabled={r === 0} className="d text-xl"
          style={{ minWidth: 52, minHeight: 88, border: `1px solid ${C.linie}`, borderRadius: 2, color: r === 0 ? C.linie : C.tinte }}>◂</button>
        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => verschieben(-1)} aria-label={`${schritt} kg weniger`} className="d text-2xl"
              style={{ minWidth: 46, minHeight: 46, border: `1px solid ${C.linie}`, borderRadius: 2, color: C.grau }}>−</button>
            <span className="d" style={{ fontSize: 60, lineHeight: 1, color: stufeFertig ? C.gruen : C.tinte }}>{stufen[r]}</span>
            <button onClick={() => verschieben(1)} aria-label={`${schritt} kg mehr`} className="d text-2xl"
              style={{ minWidth: 46, minHeight: 46, border: `1px solid ${C.linie}`, borderRadius: 2, color: C.grau }}>+</button>
          </div>
          <span className="b text-sm block mt-1" style={{ color: C.grau }}>kg · Stufe {r + 1} von {stufen.length}</span>
        </div>
        <button onClick={() => setR(Math.min(stufen.length - 1, r + 1))} disabled={r >= stufen.length - 1} className="d text-xl"
          style={{ minWidth: 52, minHeight: 88, border: `1px solid ${C.linie}`, borderRadius: 2, color: r >= stufen.length - 1 ? C.linie : C.tinte }}>▸</button>
      </div>

      <div className="flex gap-1 mt-2 flex-wrap justify-center">
        {stufen.map((kg, i) => (
          <span key={i} className="m text-[11px] px-2 py-1"
            style={{ background: fertig(i) ? C.gruen : i === r ? C.tinte : "transparent",
              color: fertig(i) || i === r ? "#fff" : C.grau,
              border: `1px solid ${fertig(i) ? C.gruen : i === r ? C.tinte : C.linie}`, borderRadius: 2 }}>{kg}</span>
        ))}
      </div>

      {b.uebungen.length > 0 && (
        <p className="m text-xs mt-3 text-center" style={{ color: C.grau }}>
          {b.uebungen.map((u) => u.name).join(" · ")}
        </p>
      )}

      <button
        onClick={() => {
          setStatus(r, !stufeFertig);
          if (!stufeFertig && r < stufen.length - 1) setTimeout(() => setR(r + 1), 250);
        }}
        className="d uppercase text-xl w-full mt-3"
        style={{ minHeight: 84, background: stufeFertig ? C.linie : C.gruen, color: "#fff",
          border: `1px solid ${stufeFertig ? C.linie : C.gruen}`, borderRadius: 2 }}>
        {stufeFertig ? "erledigt ✓ – zurücknehmen" : `${stufen[r]} kg abschließen`}
      </button>

      <button onClick={stufeDazu} className="d uppercase text-sm w-full mt-2"
        style={{ minHeight: 48, background: "transparent", color: C.tinte,
          border: `1px dashed ${C.linie}`, borderRadius: 2 }}>
        + Stufe ({zahl(stufen[stufen.length - 1]) + schritt} kg)
      </button>

      <p className="m text-[11px] mt-2 text-center" style={{ color: C.grau }}>
        {gemacht} von {stufen.length} Stufen geschafft · −/+ hebt ab hier um {schritt} kg
      </p>
    </div>
  );
}

function LaufbandLauf({ b, upd }) {
  const ziel = zahl(b.dauer);
  const [rest, setRest] = useState(ziel);
  const [laeuft, setLaeuft] = useState(false);
  const fertig = !!b.fertig;
  const spanne = zahl(b.stgBis) > zahl(b.stgVon);
  const steigungText = zahl(b.stgVon) > 0 || zahl(b.stgBis) > 0
    ? `${b.stgVon}${spanne ? `–${b.stgBis}` : ""} %` : "frei";

  useEffect(() => {
    if (!laeuft) return;
    if (rest <= 0) {
      setLaeuft(false);
      upd({ ...b, fertig: true });
      try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch {}
      return;
    }
    const t = setTimeout(() => setRest((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [rest, laeuft]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 text-center" style={{ background: C.panel, border: `1px solid ${C.linie}`, borderRadius: 2 }}>
          <span className="d text-3xl leading-none">{steigungText}</span>
          <span className="m text-[11px] block mt-1" style={{ color: C.grau }}>Zielsteigung</span>
        </div>
        <div className="p-3 text-center" style={{ background: C.panel, border: `1px solid ${C.linie}`, borderRadius: 2 }}>
          <span className="d text-3xl leading-none">{zahl(b.tempo) > 0 ? b.tempo : "frei"}</span>
          <span className="m text-[11px] block mt-1" style={{ color: C.grau }}>Zieltempo km/h</span>
        </div>
      </div>

      <div className="p-4 text-center mt-2" style={{ background: fertig ? C.gruen : C.tinte, color: fertig ? "#fff" : C.panel, border: `1px solid ${C.tinte}`, borderRadius: 2 }}>
        <span className="d uppercase text-sm">{fertig ? "geschafft" : laeuft ? "läuft" : "bereit"}</span>
        <div className="m leading-none my-1" style={{ fontSize: 72 }}>{uhr(rest)}</div>
        <span className="m text-[11px]" style={{ color: fertig ? "#fff" : C.linie }}>von {uhr(ziel)}</span>
      </div>

      <div className="flex gap-2 mt-2">
        <button onClick={() => setLaeuft(!laeuft)} disabled={fertig} className="d uppercase text-lg flex-1"
          style={{ minHeight: 64, background: fertig ? C.linie : laeuft ? C.rot : C.gruen, color: "#fff",
            border: `2px solid ${fertig ? C.linie : laeuft ? C.rot : C.gruen}`, borderRadius: 2 }}>
          {laeuft ? "Stopp" : rest < ziel ? "Weiter" : "Start"}
        </button>
        <Btn onClick={() => { setLaeuft(false); setRest(ziel); upd({ ...b, fertig: false }); }}>Zurücksetzen</Btn>
      </div>
      {!fertig && (
        <button onClick={() => { setLaeuft(false); upd({ ...b, fertig: true }); }}
          className="d uppercase text-xs mt-2" style={{ color: C.grau }}>
          als erledigt markieren
        </button>
      )}
    </div>
  );
}

function AmrapLauf({ b, upd }) {
  const runden = zahl(b.amrapRunden);
  return (
    <div>
      <div className="p-4 text-center" style={{ background: C.tinte, color: C.panel, border: `2px solid ${C.tinte}`, borderRadius: 2 }}>
        <span className="d uppercase text-sm">AMRAP · {Math.round(zahl(b.dauer) / 60)} min</span>
        <div className="d leading-none my-1" style={{ fontSize: 72 }}>{runden}</div>
        <span className="m text-[11px]" style={{ color: C.linie }}>abgeschlossene Runden</span>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => upd({ ...b, amrapRunden: runden + 1 })} className="d uppercase text-2xl flex-1"
          style={{ minHeight: 84, background: C.gruen, color: "#fff", border: `1px solid ${C.gruen}`, borderRadius: 2 }}>
          + Runde
        </button>
        <button onClick={() => upd({ ...b, amrapRunden: Math.max(0, runden - 1) })} className="d uppercase text-lg"
          style={{ minWidth: 72, minHeight: 84, border: `1px solid ${C.linie}`, borderRadius: 2 }}>
          −
        </button>
      </div>
      {b.uebungen.length > 0 && (
        <ul className="mt-4 space-y-1">
          <li className="m text-[11px]" style={{ color: C.grau }}>Eine Runde umfasst:</li>
          {b.uebungen.map((u) => (
            <li key={u.id} className="flex justify-between b text-sm py-1" style={{ borderBottom: `1px solid ${C.linie}` }}>
              <span className="truncate">{u.name}</span>
              <span className="m text-xs shrink-0" style={{ color: C.grau }}>
                {wdhText(u, u.wdh)}{zahl(u.kg) > 0 && ` · ${u.kg} kg`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EinfachLauf({ b, upd }) {
  const runden = Math.max(1, zahl(b.runden));
  const erl = Array.isArray(b.erledigt) ? b.erledigt : [];
  const [r0, setR] = useState(0);
  const r = Math.min(r0, runden - 1);
  const reihe = erl[r] || b.uebungen.map(() => false);
  const um = (ui, bit) => upd({ ...b, erledigt: erl.map((row, i) => (i === r ? row.map((x, j) => (j === ui ? hakenUm(b.uebungen[ui], x, bit) : x)) : row)) });
  const fertig = b.uebungen.length > 0 && reihe.every((x, j) => istFertig(b.uebungen[j], x));

  return (
    <div>
      {runden > 1 && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => setR(Math.max(0, r - 1))} disabled={r === 0} className="d text-xl"
              style={{ minWidth: 56, minHeight: 64, border: `1px solid ${C.linie}`, borderRadius: 2, color: r === 0 ? C.linie : C.tinte }}>◂</button>
            <div className="flex-1 text-center">
              <span className="d text-4xl leading-none" style={{ color: fertig ? C.gruen : C.tinte }}>{r + 1}</span>
              <span className="b text-sm block" style={{ color: C.grau }}>von {runden} Runden</span>
            </div>
            <button onClick={() => setR(Math.min(runden - 1, r + 1))} disabled={r >= runden - 1} className="d text-xl"
              style={{ minWidth: 56, minHeight: 64, border: `1px solid ${C.linie}`, borderRadius: 2, color: r >= runden - 1 ? C.linie : C.tinte }}>▸</button>
          </div>
          <div className="flex h-2 mt-2 gap-px">
            {Array.from({ length: runden }, (_, i) => (
              <div key={i} className="flex-1" style={{ background: b.uebungen.length && (erl[i] || []).every((x, j) => istFertig(b.uebungen[j], x)) ? C.gruen : i === r ? C.tinte : C.linie }} />
            ))}
          </div>
        </>
      )}

      <ul className="mt-3 space-y-2">
        {b.uebungen.map((u, ui) => {
          const an = istFertig(u, reihe[ui]);
          return (
            <li key={u.id}>
              <div className="flex items-center gap-2 p-3"
                style={{ minHeight: 68, background: an ? C.gruen : C.panel,
                  border: `1px solid ${an ? C.gruen : C.linie}`, borderRadius: 2 }}>
                <span className="flex-1 min-w-0">
                  <span className="d text-xl uppercase block truncate" style={{ color: an ? "#fff" : C.tinte }}>{u.name}</span>
                  <span className="m text-xs block" style={{ color: an ? C.linie : C.grau }}>
                    {wdhText(u, u.wdh)}{zahl(u.kg) > 0 && ` · ${u.kg} kg`}{u.geraet && ` · ${u.geraet}`}
                  </span>
                </span>
                <InfoKnopf text={u.info} />
                <Haken u={u} wert={reihe[ui]} um={(bit) => um(ui, bit)} hoch={52} />
              </div>
            </li>
          );
        })}
      </ul>

      {runden > 1 && fertig && r < runden - 1 && (
        <button onClick={() => setR(r + 1)} className="d uppercase text-lg w-full mt-3"
          style={{ minHeight: 60, background: C.tinte, color: C.panel, border: `1px solid ${C.tinte}`, borderRadius: 2 }}>
          Runde fertig → Runde {r + 2}
        </button>
      )}
    </div>
  );
}

function EinzelLauf({ b, upd }) {
  const erl = Array.isArray(b.erledigt) ? b.erledigt : [];
  const setSatz = (ui, si, feld, wert) => upd({
    ...b, uebungen: b.uebungen.map((u, i) => (i !== ui ? u : {
      ...u, saetzeListe: satzListe(u).map((sz, j) => (j === si ? { ...sz, [feld]: wert } : sz)) })),
  });
  const um = (ui, si, bit) => upd({
    ...b, erledigt: erl.map((r, i) => (i === ui ? r.map((x, j) => (j === si ? hakenUm(b.uebungen[ui], x, bit) : x)) : r)),
  });
  const satzWeg = (ui, si) => upd({
    ...b,
    uebungen: b.uebungen.map((u, i) => (i !== ui ? u : { ...u, saetzeListe: satzListe(u).filter((_, j) => j !== si) })),
    erledigt: erl.map((r, i) => (i === ui ? r.filter((_, j) => j !== si) : r)),
  });
  const satzDazu = (ui) => {
    const liste = satzListe(b.uebungen[ui]);
    const letzt = liste[liste.length - 1];
    upd({
      ...b,
      uebungen: b.uebungen.map((u, i) => (i !== ui ? u : {
        ...u, saetzeListe: [...liste, { id: uid(), kg: letzt?.kg ?? 0, wdh: letzt?.wdh ?? 10,
          kgR: letzt?.kgR ?? null, wdhR: letzt?.wdhR ?? null }] })),
      erledigt: erl.map((r, i) => (i === ui ? [...r, 0] : r)),
    });
  };

  const feld = (wert, aria, on) => (
    <input type="number" inputMode="decimal" value={wert} onChange={(e) => on(e.target.value)} aria-label={aria}
      className="m text-base px-2 w-full"
      style={{ minHeight: 50, background: C.beton, border: `1px solid ${C.linie}`, borderRadius: 2 }} />
  );

  return (
    <ul className="space-y-3">
      {b.uebungen.map((u, ui) => {
        const zwei = einseitig(u);
        return (
          <li key={u.id}><Karte>
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="d text-xl uppercase leading-tight flex items-center gap-2">{u.name}<InfoKnopf text={u.info} /></h4>
              <span className="m text-xs shrink-0" style={{ color: C.grau }}>
                {zwei ? "je Seite" : ""}{u.geraet && `${zwei ? " · " : ""}${u.geraet}`}
              </span>
            </div>
            <ul className="mt-2 space-y-3">
              {satzListe(u).map((sz, si) => {
                const w = hakenWert((erl[ui] || [])[si]);
                return (
                  <li key={sz.id} style={{ borderTop: si ? `1px solid ${C.linie}` : "none", paddingTop: si ? 10 : 0 }}>
                    <div className="flex items-center gap-2">
                      <span className="d text-base shrink-0" style={{ width: 16, color: C.grau }}>{si + 1}</span>
                      <span className="flex-1 flex items-center gap-1">
                        {zwei && <span className="d text-sm shrink-0" style={{ width: 14, color: C.grau }}>L</span>}
                        {feld(sz.kg, `Gewicht Satz ${si + 1}`, (x) => setSatz(ui, si, "kg", x))}
                        <span className="m text-xs shrink-0" style={{ color: C.grau }}>kg</span>
                        {feld(sz.wdh, `Wiederholungen Satz ${si + 1}`, (x) => setSatz(ui, si, "wdh", x))}
                        <span className="m text-xs shrink-0" style={{ color: C.grau }}>Wdh</span>
                      </span>
                      {zwei
                        ? <button onClick={() => um(ui, si, 1)} aria-label="links erledigt" aria-pressed={(w & 1) === 1}
                            className="d text-lg shrink-0"
                            style={{ minWidth: 50, minHeight: 50, background: (w & 1) ? C.gruen : "transparent",
                              color: (w & 1) ? "#fff" : C.grau, border: `2px solid ${(w & 1) ? C.gruen : C.linie}`, borderRadius: 2 }}>✓</button>
                        : <>
                            <button onClick={() => um(ui, si, 3)} aria-label={`Satz ${si + 1} erledigt`} aria-pressed={w > 0}
                              className="d text-2xl shrink-0"
                              style={{ minWidth: 52, minHeight: 50, background: w > 0 ? C.gruen : "transparent",
                                color: w > 0 ? "#fff" : C.grau, border: `2px solid ${w > 0 ? C.gruen : C.linie}`, borderRadius: 2 }}>✓</button>
                            <button onClick={() => satzWeg(ui, si)} aria-label={`Satz ${si + 1} entfernen`}
                              className="d text-lg shrink-0"
                              style={{ minWidth: 38, minHeight: 50, color: C.rot, border: `1px solid ${C.linie}`, borderRadius: 2 }}>✕</button>
                          </>}
                    </div>

                    {zwei && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="d text-base shrink-0" style={{ width: 16 }} />
                        <span className="flex-1 flex items-center gap-1">
                          <span className="d text-sm shrink-0" style={{ width: 14, color: C.grau }}>R</span>
                          {feld(sz.kgR ?? sz.kg, `Gewicht rechts Satz ${si + 1}`, (x) => setSatz(ui, si, "kgR", x))}
                          <span className="m text-xs shrink-0" style={{ color: C.grau }}>kg</span>
                          {feld(sz.wdhR ?? sz.wdh, `Wiederholungen rechts Satz ${si + 1}`, (x) => setSatz(ui, si, "wdhR", x))}
                          <span className="m text-xs shrink-0" style={{ color: C.grau }}>Wdh</span>
                        </span>
                        <button onClick={() => um(ui, si, 2)} aria-label="rechts erledigt" aria-pressed={(w & 2) === 2}
                          className="d text-lg shrink-0"
                          style={{ minWidth: 50, minHeight: 50, background: (w & 2) ? C.gruen : "transparent",
                            color: (w & 2) ? "#fff" : C.grau, border: `2px solid ${(w & 2) ? C.gruen : C.linie}`, borderRadius: 2 }}>✓</button>
                        <button onClick={() => satzWeg(ui, si)} aria-label={`Satz ${si + 1} entfernen`}
                          className="d text-lg shrink-0"
                          style={{ minWidth: 38, minHeight: 50, color: C.rot, border: `1px solid ${C.linie}`, borderRadius: 2 }}>✕</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <button onClick={() => satzDazu(ui)} className="d uppercase text-xs mt-3" style={{ color: C.grau }}>+ Satz dazu</button>
          </Karte></li>
        );
      })}
    </ul>
  );
}

function SaetzeLauf({ b, upd }) {
  const erl = Array.isArray(b.erledigt) ? b.erledigt : [];
  const um = (ui, bit) => upd({
    ...b, erledigt: erl.map((r, i) => (i === ui ? r.map((x) => hakenUm(b.uebungen[ui], x, bit)) : r)),
  });
  return (
    <ul className="space-y-2">
      {b.uebungen.map((u, ui) => {
        const wert = (erl[ui] || []).reduce((a2, x) => (istFertig(u, x) ? hakenWert(x) : a2 & hakenWert(x)), 3);
        const alle = (erl[ui] || []).length > 0 && (erl[ui] || []).every((x) => istFertig(u, x));
        return (
          <li key={u.id}>
            <div className="flex items-center gap-2 p-3"
              style={{ minHeight: 72, background: alle ? C.gruen : C.panel,
                border: `1px solid ${alle ? C.gruen : C.linie}`, borderRadius: 2 }}>
              <span className="flex-1 min-w-0">
                <span className="d text-xl uppercase block truncate" style={{ color: alle ? "#fff" : C.tinte }}>{u.name}</span>
                <span className="m text-xs block" style={{ color: alle ? C.linie : C.grau }}>
                  {zahl(u.saetze) > 1 ? `${u.saetze} × ` : ""}
                  {u.messung === "zeit" ? `${u.dauer} s` : wdhText(u, u.wdh)}
                  {zahl(u.kg) > 0 && ` · ${u.kg} kg`}{u.geraet && ` · ${u.geraet}`}
                </span>
              </span>
              <InfoKnopf text={u.info} />
              <Haken u={u} wert={(erl[ui] || [])[0]} um={(bit) => um(ui, bit)} hoch={52} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function LeiterLauf({ b, upd }) {
  const runden = leiterRunden(b);
  const erl = Array.isArray(b.erledigt) ? b.erledigt : [];
  const [r0, setR] = useState(0);
  const r = Math.min(r0, Math.max(0, runden.length - 1));
  const fertig = (i) => (erl[i] || []).length > 0 && (erl[i] || []).every((x, j) => istFertig(b.uebungen[j], x));
  const setzen = (an) => upd({ ...b, erledigt: erl.map((row, i) => (i === r ? row.map(() => (an ? 3 : 0)) : row)) });

  return (
    <div>
      <div className="flex items-center gap-2">
        <button onClick={() => setR(Math.max(0, r - 1))} disabled={r === 0} className="d text-xl"
          style={{ minWidth: 56, minHeight: 72, border: `1px solid ${C.linie}`, borderRadius: 2, color: r === 0 ? C.linie : C.tinte }}>◂</button>
        <div className="flex-1 text-center py-1">
          <span className="d text-6xl leading-none" style={{ color: fertig(r) ? C.gruen : C.tinte }}>{runden[r]}</span>
          <span className="b text-sm block" style={{ color: C.grau }}>Wdh je Übung · Runde {r + 1} von {runden.length}</span>
        </div>
        <button onClick={() => setR(Math.min(runden.length - 1, r + 1))} disabled={r >= runden.length - 1} className="d text-xl"
          style={{ minWidth: 56, minHeight: 72, border: `1px solid ${C.linie}`, borderRadius: 2, color: r >= runden.length - 1 ? C.linie : C.tinte }}>▸</button>
      </div>

      <div className="flex h-2 mt-2 gap-px">
        {runden.map((_, i) => (
          <div key={i} className="flex-1" style={{ background: fertig(i) ? C.gruen : i === r ? C.tinte : C.linie }} />
        ))}
      </div>

      {fertig(r) ? (
        <div className="mt-3">
          <div className="p-3 text-center" style={{ background: C.gruen, color: "#fff", borderRadius: 2 }}>
            <span className="d uppercase text-lg">Runde {runden[r]} erledigt</span>
          </div>
          <div className="flex gap-2 mt-2">
            {r < runden.length - 1 && (
              <button onClick={() => setR(r + 1)} className="d uppercase text-lg flex-1"
                style={{ minHeight: 60, background: C.tinte, color: C.panel, border: `1px solid ${C.tinte}`, borderRadius: 2 }}>
                Weiter zu {runden[r + 1]} Wdh ▸
              </button>
            )}
            <Btn klein onClick={() => setzen(false)}>Zurücknehmen</Btn>
          </div>
        </div>
      ) : (
        <button onClick={() => { setzen(true); if (r < runden.length - 1) setTimeout(() => setR(r + 1), 600); }}
          className="d uppercase text-xl w-full mt-4"
          style={{ minHeight: 76, background: C.tinte, color: C.panel, border: `1px solid ${C.tinte}`, borderRadius: 2 }}>
          Runde erledigt ✓
        </button>
      )}

      <ul className="mt-4 space-y-1">
        {b.uebungen.map((u, ui) => (
          <li key={u.id} className="flex items-baseline gap-2 py-2" style={{ borderBottom: `1px solid ${C.linie}` }}>
            <span className="d text-base shrink-0" style={{ color: C.grau, width: 26 }}>{String(ui + 1).padStart(2, "0")}</span>
            <span className="flex-1 min-w-0">
              <span className="d text-lg uppercase block truncate">{u.name}</span>
              <span className="m text-xs" style={{ color: C.grau }}>
                {wdhText(u, runden[r])}{zahl(u.kg) > 0 && ` · ${u.kg} kg`}{u.geraet && ` · ${u.geraet}`}
              </span>
            </span>
            <InfoKnopf text={u.info} />
          </li>
        ))}
      </ul>
    </div>
  );
}

let audioCtx = null;
const tonSpielen = (frequenz, dauer, typ = "sine", laut = 0.25) => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = typ;
    osc.frequency.value = frequenz;
    gain.gain.setValueAtTime(laut, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dauer);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dauer);
  } catch {}
};
const pieps = () => tonSpielen(880, 0.15, "square", 0.2);
const gong = () => { tonSpielen(523, 0.5, "sine", 0.3); setTimeout(() => tonSpielen(784, 0.4, "sine", 0.25), 60); };

function IntervallLauf({ b, upd }) {
  const folge = useMemo(() => {
    const f = [];
    for (let d = 0; d < zahl(b.durchgaenge); d++) {
      b.uebungen.forEach((u, ui) => {
        f.push({ art: "arbeit", sek: zahl(b.arbeit), name: u.name, d, ui });
        const letzte = ui === b.uebungen.length - 1;
        const sek = letzte ? zahl(b.satzpause) : zahl(b.pause);
        if (sek > 0 && !(letzte && d === zahl(b.durchgaenge) - 1)) f.push({ art: "pause", sek, name: letzte ? "Satzpause" : "Wechsel", d, ui });
      });
    }
    return f;
  }, [b.durchgaenge, b.arbeit, b.pause, b.satzpause, b.uebungen]);

  const [i, setI] = useState(0);
  const [rest, setRest] = useState(folge[0]?.sek || 0);
  const [laeuft, setLaeuft] = useState(false);
  const [resetFrage, setResetFrage] = useState(false);
  const [ton, setTon] = useState(true);
  const schritt = folge[i];
  const naechster = folge[i + 1];

  const weiter = () => {
    if (schritt?.art === "arbeit") {
      upd({ ...b, erledigt: (Array.isArray(b.erledigt) ? b.erledigt : []).map((row, d) => (d === schritt.d ? row.map((x, j) => (j === schritt.ui ? 3 : x)) : row)) });
    }
    if (i < folge.length - 1) { setI(i + 1); setRest(folge[i + 1].sek); }
    else { setLaeuft(false); setRest(0); }
    try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(150); } catch {}
  };

  useEffect(() => {
    if (!laeuft) return;
    if (rest <= 0) { if (ton) gong(); weiter(); return; }
    if (ton && (rest === 3 || rest === 2 || rest === 1)) pieps();
    const t = setTimeout(() => setRest((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [rest, laeuft]);

  const arbeit = schritt?.art === "arbeit";
  return (
    <div>
      <div className="p-5 text-center" style={{ background: arbeit ? C.tinte : C.panel, color: arbeit ? C.panel : C.tinte, border: `2px solid ${C.tinte}`, borderRadius: 2 }}>
        <span className="d uppercase text-xl block">{schritt ? schritt.name : "Durch"}</span>
        <div className="m leading-none my-1" style={{ fontSize: 88 }}>{rest}</div>
        <span className="b text-sm block" style={{ color: arbeit ? C.linie : C.grau }}>
          {schritt ? `Set ${schritt.d + 1} von ${b.durchgaenge}` : "alle Durchgänge fertig"}
          {naechster && ` · danach ${naechster.name}`}
        </span>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={() => { if (ton && !audioCtx) tonSpielen(1, 0.01, "sine", 0.0001); setLaeuft(!laeuft); }} className="d uppercase text-lg flex-1"
          style={{ minHeight: 64, background: laeuft ? C.rot : C.gruen, color: "#fff",
            border: `2px solid ${laeuft ? C.rot : C.gruen}`, borderRadius: 2 }}>
          {laeuft ? "Stopp" : "Start"}
        </button>
        <button onClick={weiter} className="d uppercase text-lg"
          style={{ minWidth: 88, minHeight: 64, border: `1px solid ${C.linie}`, borderRadius: 2 }}>Weiter ▸</button>
        <button onClick={() => { setTon(!ton); if (!ton) pieps(); }} aria-label={ton ? "Ton aus" : "Ton an"}
          aria-pressed={ton} title={ton ? "Ton aus" : "Ton an"}
          style={{ minWidth: 56, minHeight: 64, border: `1px solid ${ton ? C.tinte : C.linie}`,
            background: ton ? C.tinte : "transparent", color: ton ? C.panel : C.grau, borderRadius: 2 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ margin: "0 auto" }}>
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            {ton ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></> : <path d="M23 9l-6 6M17 9l6 6" />}
          </svg>
        </button>
      </div>
      {resetFrage ? (
        <div className="mt-2 p-3" style={{ background: C.panel, border: `1px solid ${C.linie}`, borderRadius: 2 }}>
          <p className="b text-sm">Timer und alle abgehakten Runden dieses Blocks zurücksetzen?</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => {
                setI(0); setRest(folge[0]?.sek || 0); setLaeuft(false);
                upd({ ...b, erledigt: Array.from({ length: zahl(b.durchgaenge) }, () => b.uebungen.map(() => 0)) });
                setResetFrage(false);
              }} className="d uppercase text-xs px-3 py-2" style={{ background: C.rot, color: "#fff", border: `1px solid ${C.rot}`, borderRadius: 2 }}>
              Ja, zurücksetzen
            </button>
            <button onClick={() => setResetFrage(false)} className="d uppercase text-xs px-3 py-2"
              style={{ border: `1px solid ${C.linie}`, borderRadius: 2 }}>Abbrechen</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setResetFrage(true)} className="d uppercase text-xs mt-2" style={{ color: C.grau }}>
          ↺ Block zurücksetzen
        </button>
      )}
      <ul className="mt-3 space-y-2">
        {b.uebungen.map((u, ui) => (
          <li key={u.id} className="flex items-center gap-2">
            <span className="b text-base flex-1 truncate" style={{ fontWeight: schritt?.ui === ui && arbeit ? 600 : 400 }}>{u.name}</span>
            {(Array.isArray(b.erledigt) ? b.erledigt : []).map((d, di) => (
              <span key={di} style={{ width: 16, height: 16, background: istFertig(u, (d || [])[ui]) ? C.gruen : C.linie, display: "inline-block" }} />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============ Kraftentwicklung ============ */
function Kurve({ punkte, farbe = C.rot, einheit = "kg" }) {
  const W = 300, H = 110, pad = 26;
  const werte = punkte.map((p) => p.wert);
  const max = Math.max(...werte), min = Math.min(...werte);
  const spanne = max - min || Math.max(1, max * 0.1);
  const x = (i) => pad + (punkte.length < 2 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (punkte.length - 1));
  const y = (w) => H - 20 - ((w - (min - spanne * 0.15)) / (spanne * 1.3)) * (H - 40);
  const tag = (d) => new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-2" role="img" aria-label="Verlauf">
      <line x1={pad} y1={H - 20} x2={W - pad} y2={H - 20} stroke={C.linie} strokeWidth="1" />
      {punkte.length > 1 && (
        <polyline fill="none" stroke={farbe} strokeWidth="2"
          points={punkte.map((p, i) => `${x(i)},${y(p.wert)}`).join(" ")} />
      )}
      {punkte.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.wert)} r="3.5" fill={p.wert >= max ? farbe : C.panel} stroke={farbe} strokeWidth="2" />
      ))}
      <text x={pad} y={12} fontSize="10" fill={C.grau} fontFamily="monospace">{max} {einheit}</text>
      <text x={pad} y={H - 6} fontSize="9" fill={C.grau} fontFamily="monospace">{tag(punkte[0].datum)}</text>
      {punkte.length > 1 && (
        <text x={W - pad} y={H - 6} fontSize="9" fill={C.grau} fontFamily="monospace" textAnchor="end">
          {tag(punkte[punkte.length - 1].datum)}
        </text>
      )}
    </svg>
  );
}

function Bestwerte({ verlauf }) {
  const [art, setArt] = useState("kg");
  const [auf, setAuf] = useState(null);

  const proUebung = {};
  [...verlauf].reverse().forEach((e) => {
    (e.leistung || []).forEach((l) => {
      const maxKg = l.saetze.reduce((a, sz) => Math.max(a, zahl(sz.kg)), 0);
      const maxVol = l.saetze.reduce((a, sz) => Math.max(a, zahl(sz.kg) * zahl(sz.wdh)), 0);
      const bester = l.saetze.reduce((a, sz) => (zahl(sz.kg) * zahl(sz.wdh) > zahl(a.kg) * zahl(a.wdh) ? sz : a), { kg: 0, wdh: 0 });
      if (!proUebung[l.name]) proUebung[l.name] = { name: l.name, geraet: l.geraet, eintraege: [] };
      proUebung[l.name].eintraege.push({ datum: e.datum, maxKg, maxVol, bester });
    });
  });
  const liste = Object.values(proUebung)
    .filter((u) => u.eintraege.some((x) => x.maxKg > 0))
    .sort((a, b) => new Date(b.eintraege[b.eintraege.length - 1].datum) - new Date(a.eintraege[a.eintraege.length - 1].datum));

  if (!liste.length) return (
    <p className="b text-sm" style={{ color: C.grau }}>
      Noch keine Gewichte erfasst. Sobald du Sätze mit Gewicht abhakst, erscheinen hier deine Bestwerte.
    </p>
  );

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {[["kg", "Max. Gewicht"], ["vol", "Bester Satz"]].map(([k, l]) => (
          <button key={k} onClick={() => setArt(k)} className="d uppercase text-xs px-3 py-2 flex-1"
            style={{ background: art === k ? C.tinte : "transparent", color: art === k ? C.panel : C.grau,
              border: `1px solid ${art === k ? C.tinte : C.linie}`, borderRadius: 2 }}>{l}</button>
        ))}
      </div>
      <ul className="space-y-2">
        {liste.map((u) => {
          const punkte = u.eintraege.map((x) => ({ datum: x.datum, wert: art === "kg" ? x.maxKg : Math.round(x.maxVol) }));
          const best = Math.max(...punkte.map((x) => x.wert));
          const letzt = punkte[punkte.length - 1];
          const vor = punkte.length > 1 ? punkte[punkte.length - 2].wert : null;
          const diff = vor === null ? null : letzt.wert - vor;
          const letzterSatz = u.eintraege[u.eintraege.length - 1].bester;
          return (
            <li key={u.name}><Karte>
              <button onClick={() => setAuf(auf === u.name ? null : u.name)} className="w-full text-left">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="d text-lg uppercase truncate">{u.name}</h3>
                    <span className="m text-[11px]" style={{ color: C.grau }}>
                      zuletzt {letzterSatz.kg} kg × {letzterSatz.wdh} · {u.eintraege.length} Einheiten
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="m text-xl block">{best}{art === "kg" ? " kg" : ""}</span>
                    {diff !== null && (
                      <span className="m text-[11px]" style={{ color: diff > 0 ? C.gruen : diff < 0 ? C.rot : C.grau }}>
                        {diff > 0 ? "▲ +" : diff < 0 ? "▼ " : "= "}{diff !== 0 ? Math.abs(diff) : ""}
                      </span>
                    )}
                  </div>
                </div>
              </button>
              {auf === u.name && <Kurve punkte={punkte} einheit={art === "kg" ? "kg" : ""} />}
            </Karte></li>
          );
        })}
      </ul>
    </div>
  );
}

/* ============ Bilanz ============ */
function Bilanz({ verlauf }) {
  const [tage, setTage] = useState(28);
  const [ansicht, setAnsicht] = useState("muskeln");
  const [offen, setOffen] = useState(null);
  const gefiltert = verlauf.filter((e) => Date.now() - new Date(e.datum).getTime() < tage * 864e5);
  const v = leereMuskeln();
  let gesamt = 0;
  gefiltert.forEach((e) => { GRUPPEN.forEach((g) => { v[g.id] += zahl(e.verteilung?.[g.id]); }); gesamt += zahl(e.sekunden); });

  if (!verlauf.length) return <p className="b text-sm" style={{ color: C.grau }}>Hier landet deine Bilanz, sobald du eine Einheit beendest.</p>;
  const reihen = GRUPPEN.map((g) => ({ ...g, p: gesamt ? (v[g.id] / gesamt) * 100 : 0 })).sort((a, b) => b.p - a.p);
  const schwach = reihen.filter((r) => r.p < 8);

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {[["muskeln", "Muskeln"], ["kraft", "Kraft"]].map(([k, l]) => (
          <button key={k} onClick={() => setAnsicht(k)} className="d uppercase text-sm px-3 py-2 flex-1"
            style={{ background: ansicht === k ? C.tinte : "transparent", color: ansicht === k ? C.panel : C.grau,
              border: `1px solid ${ansicht === k ? C.tinte : C.linie}`, borderRadius: 2 }}>{l}</button>
        ))}
      </div>
      {ansicht === "kraft" ? <Bestwerte verlauf={verlauf} /> : (
      <div>
      <div className="flex gap-1 mb-3">
        {[7, 28, 90].map((t) => (
          <button key={t} onClick={() => setTage(t)} className="d uppercase text-xs px-3 py-2 flex-1"
            style={{ background: tage === t ? C.tinte : "transparent", color: tage === t ? C.panel : C.grau, border: `1px solid ${tage === t ? C.tinte : C.linie}`, borderRadius: 2 }}>
            {t} Tage
          </button>
        ))}
      </div>
      <Karte>
        <Auswertung v={v} gesamt={gesamt} titel={`${gefiltert.length} Einheiten`} />
        {gesamt > 0 && schwach.length > 0 && (
          <p className="b text-xs mt-3" style={{ color: C.grau }}>
            Kaum adressiert: {schwach.map((s) => s.name).join(", ")}. Wenn das nicht Absicht ist, nimm dafür einen Block in den nächsten Plan.
          </p>
        )}
      </Karte>
      <ul className="mt-3 space-y-2">
        {gefiltert.map((e) => {
          const g = zahl(e.sekunden);
          const auf = offen === e.id;
          const nachBlock = {};
          (e.leistung || []).forEach((l) => {
            const k = l.block || "Übungen";
            if (!nachBlock[k]) nachBlock[k] = [];
            nachBlock[k].push(l);
          });
          const bloeckeDetail = Object.keys(nachBlock).map((block) => [block, nachBlock[block]]);
          return (
            <li key={e.id}><Karte>
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="d text-lg uppercase">{e.name}</h3>
                  <span className="m text-[11px]" style={{ color: C.grau }}>
                    {new Date(e.datum).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" })}
                  </span>
                </div>
                <IconKnopf onClick={() => setOffen(auf ? null : e.id)} aktiv={auf}
                  titel={auf ? "Details schließen" : "Details anzeigen"}><Auge zu={auf} /></IconKnopf>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <Kreis groesse={54} beschriftet={false}
                  reihen={GRUPPEN.map((gr) => ({ ...gr, p: g ? (zahl(e.verteilung?.[gr.id]) / g) * 100 : 0 })).filter((x) => x.p > 0.5)} />
                <div className="min-w-0 flex-1">
                  <p className="m text-xs" style={{ color: C.grau }}>{minuten(g)} gewertet · {e.dauer} min gesamt</p>
                  {(e.bloecke || []).length > 0 && (
                    <p className="m text-[11px] mt-1" style={{ color: C.grau }}>
                      {e.bloecke.map((b) => `${b.name} ${Math.round(b.zeit / 60)}′`).join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              {auf && (
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.linie}` }}>
                  {(e.leistung || []).length === 0 ? (
                    <p className="m text-[11px]" style={{ color: C.grau }}>
                      Für diese Einheit sind keine Übungsdetails gespeichert.
                    </p>
                  ) : (
                    bloeckeDetail.map(([block, liste]) => (
                      <div key={block} className="mb-3">
                        <p className="d uppercase text-xs mb-1" style={{ color: C.grau, borderBottom: `1px solid ${C.linie}` }}>{block}</p>
                        <ul className="space-y-2">
                          {liste.map((l, li) => (
                            <li key={li} className="flex justify-between items-baseline gap-2">
                              <span className="min-w-0">
                                <span className="d text-sm uppercase block truncate">{l.name}</span>
                                {l.geraet && <span className="m text-[10px]" style={{ color: C.grau }}>{l.geraet}</span>}
                              </span>
                              <span className="m text-[11px] text-right shrink-0" style={{ color: C.grau }}>
                                {l.info
                                  ? l.info
                                  : (l.saetze || []).map((s) =>
                                      `${s.seite ? s.seite + " " : ""}${s.kg > 0 ? s.kg + "×" : ""}${s.wdh || s.info || ""}`
                                    ).join(", ")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Karte></li>
          );
        })}
      </ul>
      </div>
      )}
    </div>
  );
}
