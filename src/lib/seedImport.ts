import { META_SEED_IMPORT, type FeedbackRepository } from "@/lib/feedbackRepository";
import { emptyReport, type ImportReport } from "@/lib/feedbackTypes";

/**
 * Données historiques : les 23 réponses de l'ancienne table Supabase `prestige_feedback`,
 * extraites une fois pour toutes le 13/10/2026 dans src/data/supabaseSeed.json et livrées
 * avec l'application. Elles sont écrites dans SQLite au premier lancement, sans réseau.
 * L'application n'a plus aucun lien avec Supabase.
 *
 * Ce fichier contient des commentaires de clients : il n'est PAS versionné (.gitignore).
 * S'il est absent lors de la compilation, l'intégration est simplement ignorée
 * (et retentée au lancement suivant d'une version qui le contient).
 */

export type SeedFile = { source: string; exportedAt: string; count: number; rows: unknown[] };

// import.meta.glob ne produit pas d'erreur de compilation si le fichier n'existe pas.
const seedModules = import.meta.glob<{ default: SeedFile }>("../data/supabaseSeed.json");

export const loadBundledSeed = async (): Promise<SeedFile | null> => {
  const load = Object.values(seedModules)[0];
  return load ? (await load()).default : null;
};

export async function importHistoricalSeed(
  repo: FeedbackRepository,
  load: () => Promise<SeedFile | null> = loadBundledSeed
): Promise<ImportReport> {
  const report: ImportReport = { ...emptyReport(), status: "running", startedAt: new Date().toISOString() };
  try {
    const seed = await load();
    if (!seed) {
      // Rien à intégrer dans cette version : on ne marque pas l'étape comme faite.
      return { ...emptyReport(), status: "never" };
    }
    if (!Array.isArray(seed.rows) || seed.rows.length !== seed.count) {
      throw new Error(`Fichier de données historiques incohérent (${seed.rows?.length} ligne(s) pour ${seed.count} annoncée(s)).`);
    }
    report.remoteCount = seed.count;
    // Une seule transaction ; les réponses déjà présentes ou supprimées volontairement sont ignorées.
    Object.assign(report, await repo.importRows(seed.rows, "supabase"));
    report.status = report.invalid || report.missingAfterImport ? "partial" : "success";
  } catch (error) {
    report.status = "error";
    report.errors.push(error instanceof Error ? error.message : String(error));
  }
  report.finishedAt = new Date().toISOString();
  await repo.saveImportReport(META_SEED_IMPORT, report);
  return report;
}
