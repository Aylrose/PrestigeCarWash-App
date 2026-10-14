import type { FeedbackRow } from "@/lib/feedbackTypes";

/** Logique de filtrage, de recherche et de statistiques du tableau de bord (fonctions pures). */

export type Period = "jour" | "semaine" | "mois" | "all" | "custom";

/** "YYYY-MM-DD" interprété en heure locale (et non UTC). */
function localDate(value: string, endOfDay: boolean): Date {
  const [y, m, d] = value.split("-").map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function periodRange(
  period: string,
  custom: { from: string; to: string },
  now: Date = new Date()
): { from: Date; to: Date } | null {
  const start = new Date(now);

  if (period === "jour") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "semaine") {
    start.setDate(now.getDate() - 7);
  } else if (period === "mois") {
    start.setMonth(now.getMonth() - 1);
  } else if (period === "custom" && custom.from) {
    return {
      from: localDate(custom.from, false),
      to: custom.to ? localDate(custom.to, true) : now,
    };
  } else {
    return null;
  }

  return { from: start, to: now };
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const LABELS: Record<string, string> = {
  impeccable: "Impeccable",
  satisfait: "Plutôt satisfait",
  insatisfait: "Insatisfait",
  rapide: "Rapide",
  peu_long: "Un peu long",
  trop_long: "Trop long",
  avantageux: "Avantageux",
  correct: "Correct",
  cher: "Trop cher",
  oui: "Oui",
  non: "Non",
  carrosserie: "Carrosserie",
  interieur: "Intérieur",
  jantes: "Jantes",
};

export const label = (v: string | null | undefined) => (v == null ? "" : LABELS[v] ?? v);

export const formatDate = (iso: string) => new Date(iso).toLocaleString("fr-FR");

/** Recherche plein texte (insensible à la casse et aux accents). */
export function matchesSearch(r: FeedbackRow, query: string): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  const haystack = [
    r.id,
    r.commentaire ?? "",
    r.lavage ?? "",
    label(r.lavage),
    r.attente ?? "",
    label(r.attente),
    r.qualite_prix ?? "",
    label(r.qualite_prix),
    r.nps ?? "",
    ...(r.lavage_detail ?? []).flatMap((d) => [d, label(d)]),
    formatDate(r.timestamp),
    r.timestamp,
  ].join(" ");
  return normalize(haystack).includes(q);
}

export function filterResponses(
  responses: FeedbackRow[],
  range: { from: Date; to: Date } | null,
  query = ""
): FeedbackRow[] {
  return responses.filter((r) => {
    if (range) {
      const t = new Date(r.timestamp);
      if (t < range.from || t > range.to) return false;
    }
    return matchesSearch(r, query);
  });
}

const countWhere = (rows: FeedbackRow[], pred: (r: FeedbackRow) => boolean) => rows.filter(pred).length;

export function computeStats(filtered: FeedbackRow[]) {
  const avg = (key: "accueil" | "lounge") => {
    const vals = filtered.map((r) => r[key]).filter((v): v is number => typeof v === "number");
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "–";
  };

  const npsOui = countWhere(filtered, (r) => r.nps === "oui");
  const npsTotal = countWhere(filtered, (r) => r.nps != null);
  const npsRate = npsTotal ? Math.round((npsOui / npsTotal) * 100) : 0;

  const lavageData = [
    { name: "Impeccable", value: countWhere(filtered, (r) => r.lavage === "impeccable") },
    { name: "Plutôt satisfait", value: countWhere(filtered, (r) => r.lavage === "satisfait") },
    { name: "Insatisfait", value: countWhere(filtered, (r) => r.lavage === "insatisfait") },
  ];
  const attenteData = [
    { name: "Rapide", value: countWhere(filtered, (r) => r.attente === "rapide") },
    { name: "Un peu long", value: countWhere(filtered, (r) => r.attente === "peu_long") },
    { name: "Trop long", value: countWhere(filtered, (r) => r.attente === "trop_long") },
  ];
  const prixData = [
    { name: "Avantageux", value: countWhere(filtered, (r) => r.qualite_prix === "avantageux") },
    { name: "Correct", value: countWhere(filtered, (r) => r.qualite_prix === "correct") },
    { name: "Trop cher", value: countWhere(filtered, (r) => r.qualite_prix === "cher") },
  ];

  const byDay: Record<string, number> = {};
  filtered.forEach((r) => {
    const day = r.timestamp.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  });
  const trend = Object.entries(byDay)
    .sort()
    .map(([day, count]) => ({ day: day.slice(5), count }));

  return {
    avgAccueil: avg("accueil"),
    avgLounge: avg("lounge"),
    npsOui,
    npsTotal,
    npsRate,
    lavageData,
    attenteData,
    prixData,
    trend,
  };
}

/* ---------- Lignes d'export (consultation : PDF / Excel) ---------- */

export const PDF_HEAD = [
  "Date",
  "Accueil",
  "Lavage",
  "Détails",
  "Attente",
  "Lounge",
  "Qualité/Prix",
  "Recommandation",
  "Commentaire",
];

export function pdfRows(rows: FeedbackRow[]) {
  return rows.map((r) => [
    formatDate(r.timestamp),
    r.accueil ?? "",
    r.lavage ?? "",
    (r.lavage_detail || []).join(", "),
    r.attente ?? "",
    r.lounge ?? "",
    r.qualite_prix ?? "",
    r.nps ?? "",
    r.commentaire || "",
  ]);
}

export const XLSX_HEADERS = [
  "id",
  "date",
  "accueil",
  "lavage",
  "lavage_detail",
  "attente",
  "lounge",
  "qualite_prix",
  "recommandation",
  "commentaire",
];

export function xlsxRows(rows: FeedbackRow[]) {
  return rows.map((r) => [
    r.id,
    r.timestamp,
    r.accueil ?? "",
    r.lavage ?? "",
    (r.lavage_detail || []).join("|"),
    r.attente ?? "",
    r.lounge ?? "",
    r.qualite_prix ?? "",
    r.nps ?? "",
    r.commentaire || "",
  ]);
}
