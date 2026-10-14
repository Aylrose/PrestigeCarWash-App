import type { NewFeedback } from "@/lib/feedbackTypes";

export const validInput = (over: Partial<NewFeedback> = {}): NewFeedback => ({
  accueil: 5,
  lavage: "impeccable",
  lavage_detail: [],
  attente: "rapide",
  lounge: 4,
  qualite_prix: "correct",
  nps: "oui",
  commentaire: "Très bon service",
  ...over,
});

/** Ligne telle que renvoyée par PostgREST pour la table prestige_feedback. */
export const remoteRow = (n: number, over: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  timestamp: `2026-08-${String((n % 28) + 1).padStart(2, "0")}T10:15:30.123456+00:00`,
  accueil: (n % 5) + 1,
  lavage: n % 3 === 0 ? "insatisfait" : "impeccable",
  lavage_detail: n % 3 === 0 ? ["jantes", "interieur"] : null,
  attente: "peu_long",
  lounge: null,
  qualite_prix: "avantageux",
  nps: n % 2 ? "oui" : "non",
  commentaire: n % 4 === 0 ? null : `Commentaire n°${n} — éàç`,
  sync_id: n % 2 ? `11111111-0000-4000-8000-${String(n).padStart(12, "0")}` : null,
  ...over,
});

export const remoteRows = (count: number) => Array.from({ length: count }, (_, i) => remoteRow(i + 1));
