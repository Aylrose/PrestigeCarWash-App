import { afterEach, describe, expect, it, vi } from "vitest";
import { createSqlJsDriver } from "./sqljsDriver";
import { remoteRow, remoteRows, validInput } from "./fixtures";
import {
  createFeedbackRepository,
  FeedbackValidationError,
  META_SEED_IMPORT,
} from "@/lib/feedbackRepository";
import { LATEST_SCHEMA_VERSION } from "@/lib/db/schema";
import { importHistoricalSeed, loadBundledSeed, type SeedFile } from "@/lib/seedImport";
import { importLegacyOfflineFeedback, legacyItemToRow } from "@/lib/legacyOfflineImport";
import { buildBackup, parseBackup, BackupFormatError } from "@/lib/backup";
import { computeStats, filterResponses, periodRange, pdfRows, xlsxRows, PDF_HEAD, XLSX_HEADERS } from "@/lib/feedbackStats";

async function setup(bytes?: Uint8Array) {
  const driver = await createSqlJsDriver(bytes);
  const repo = createFeedbackRepository(driver);
  await repo.initialize();
  return { driver, repo };
}

/** Le fichier réel des 23 réponses n'est pas versionné : les tests qui l'utilisent sont ignorés s'il manque. */
const bundled = await loadBundledSeed();
const hasSeed = bundled != null;

/** Fichier de données historiques de test (même format que src/data/supabaseSeed.json). */
const seedOf = (rows: unknown[], count = rows.length) => async (): Promise<SeedFile> => ({
  source: "test",
  exportedAt: "2026-10-13T00:00:00.000Z",
  count,
  rows,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("1. Initialisation SQLite", () => {
  it("crée le schéma et enregistre sa version", async () => {
    const { repo, driver } = await setup();
    const tables = await driver.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    expect(tables.map((t) => t.name)).toEqual(expect.arrayContaining(["app_meta", "feedback", "deleted_feedback"]));
    expect((await repo.getMigrationStatus()).schemaVersion).toBe(LATEST_SCHEMA_VERSION);
  });

  it("est idempotente (ré-initialisation sans perte)", async () => {
    const { repo } = await setup();
    await repo.create(validInput());
    await repo.initialize();
    await repo.initialize();
    expect(await repo.count()).toBe(1);
  });
});

describe("2. Création et lecture", () => {
  it("enregistre une réponse et la relit à l'identique", async () => {
    const { repo } = await setup();
    const input = validInput({ lavage: "insatisfait", lavage_detail: ["carrosserie", "jantes"], commentaire: "Jantes sales — à revoir" });
    const created = await repo.create(input);

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.sync_id).toBe(created.id);
    expect(created.source).toBe("local");
    expect(await repo.getById(created.id)).toEqual(created);
    expect(created).toMatchObject({
      accueil: 5,
      lavage: "insatisfait",
      lavage_detail: ["carrosserie", "jantes"],
      attente: "rapide",
      lounge: 4,
      qualite_prix: "correct",
      nps: "oui",
      commentaire: "Jantes sales — à revoir",
    });
    expect(new Date(created.timestamp).toISOString()).toBe(created.timestamp);
  });

  it("refuse une réponse invalide sans rien écrire", async () => {
    const { repo } = await setup();
    await expect(repo.create(validInput({ accueil: null }))).rejects.toBeInstanceOf(FeedbackValidationError);
    await expect(repo.create(validInput({ nps: "peut-être" }))).rejects.toBeInstanceOf(FeedbackValidationError);
    await expect(repo.create(validInput({ lavage_detail: ["moteur"] }))).rejects.toBeInstanceOf(FeedbackValidationError);
    await expect(repo.create(validInput({ commentaire: "x".repeat(2001) }))).rejects.toBeInstanceOf(FeedbackValidationError);
    expect(await repo.count()).toBe(0);
  });

  it("signale un échec d'écriture (aucune confirmation, rien d'écrit)", async () => {
    const { repo, driver } = await setup();
    driver.failNextMatching(/INSERT INTO feedback/);
    await expect(repo.create(validInput())).rejects.toThrow(/Échec simulé/);
    expect(await repo.count()).toBe(0);
  });

  it("génère des identifiants uniques", async () => {
    const { repo } = await setup();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add((await repo.create(validInput())).id);
    expect(ids.size).toBe(50);
  });
});

describe("3. Fermeture et réouverture", () => {
  it("retrouve les données après fermeture de la base", async () => {
    const { repo, driver } = await setup();
    const a = await repo.create(validInput({ commentaire: "persistant" }));
    await repo.importRows(remoteRows(3), "supabase");
    const bytes = driver.exportBytes();
    await driver.close();

    const reopened = await setup(bytes);
    expect(await reopened.repo.count()).toBe(4);
    expect(await reopened.repo.getById(a.id)).toEqual(a);
  });
});

describe("4-7. Réponses historiques Supabase livrées avec l'application", () => {
  it.skipIf(!hasSeed)("le fichier livré contient les 23 réponses récupérées, toutes valides et uniques", async () => {
    const seed = bundled!;
    expect(seed.count).toBe(23);
    expect(seed.rows.length).toBe(23);
    const ids = seed.rows.map((r) => (r as { id: string }).id);
    expect(new Set(ids).size).toBe(23);
  });

  it.skipIf(!hasSeed)("intègre les 23 réponses à l'identique (ids, dates, valeurs)", async () => {
    const { repo } = await setup();
    const report = await importHistoricalSeed(repo);
    expect(report).toMatchObject({ status: "success", remoteCount: 23, fetched: 23, inserted: 23, invalid: 0, missingAfterImport: 0 });
    expect(await repo.count()).toBe(23);

    for (const r of bundled!.rows as Record<string, unknown>[]) {
      expect(await repo.getById(r.id as string)).toEqual({ ...r, source: "supabase" });
    }
    expect((await repo.getImportReport(META_SEED_IMPORT)).status).toBe("success");
  });

  it.skipIf(!hasSeed)("5. une seconde intégration ne crée aucun doublon", async () => {
    const { repo } = await setup();
    await importHistoricalSeed(repo);
    const again = await importHistoricalSeed(repo);
    expect(again).toMatchObject({ status: "success", inserted: 0, alreadyPresent: 23 });
    expect(await repo.count()).toBe(23);
  });

  it.skipIf(!hasSeed)("conserve les réponses déjà saisies localement", async () => {
    const { repo } = await setup();
    const local = await repo.create(validInput());
    await importHistoricalSeed(repo);
    expect(await repo.count()).toBe(24);
    expect(await repo.getById(local.id)).toEqual(local);
  });

  it("dédoublonne par sync_id avec l'ancienne file hors ligne", async () => {
    const { repo } = await setup();
    const remote = remoteRow(7); // sync_id non nul
    await importLegacyOfflineFeedback(repo, async () => [
      { localId: 1, sync_id: remote.sync_id as string, createdAt: "2026-08-08T10:15:30.000Z", status: "synced", accueil: 3, lavage: "impeccable", lavage_detail: [], attente: "peu_long", lounge: null, qualite_prix: "avantageux", nps: "oui", commentaire: "x" },
    ]);
    const report = await importHistoricalSeed(repo, seedOf([remote]));
    expect(report).toMatchObject({ inserted: 0, alreadyPresent: 1 });
    expect(await repo.count()).toBe(1);
  });

  it("6. échec pendant l'écriture : ROLLBACK complet, données locales conservées", async () => {
    const { repo, driver } = await setup();
    await repo.importRows(remoteRows(10), "supabase");
    driver.failNextMatching(/INSERT INTO feedback/, 2); // 110 nouvelles lignes = 3 INSERT, le 2e échoue
    const report = await importHistoricalSeed(repo, seedOf(remoteRows(120)));
    expect(report.status).toBe("error");
    expect(report.errors[0]).toMatch(/Échec simulé/);
    expect(await repo.count()).toBe(10);

    const retry = await importHistoricalSeed(repo, seedOf(remoteRows(120)));
    expect(retry).toMatchObject({ status: "success", inserted: 110 });
  });

  it("fichier absent de la compilation : rien n'est écrit et l'étape sera retentée", async () => {
    const { repo } = await setup();
    const report = await importHistoricalSeed(repo, async () => null);
    expect(report.status).toBe("never");
    expect(await repo.count()).toBe(0);
    expect((await repo.getImportReport(META_SEED_IMPORT)).status).toBe("never");
  });

  it("6. fichier incohérent : refus sans rien écrire", async () => {
    const { repo } = await setup();
    const report = await importHistoricalSeed(repo, seedOf(remoteRows(4), 5));
    expect(report.status).toBe("error");
    expect(report.errors[0]).toMatch(/incohérent/);
    expect(await repo.count()).toBe(0);
  });

  it("rejette les lignes invalides sans bloquer les autres", async () => {
    const { repo } = await setup();
    const rows = [remoteRow(1), { ...remoteRow(2), timestamp: "pas une date" }, { ...remoteRow(3), id: null }];
    const report = await importHistoricalSeed(repo, seedOf(rows));
    expect(report).toMatchObject({ status: "partial", inserted: 1, invalid: 2 });
  });

  it.skipIf(!hasSeed)("12. aucune connexion réseau n'est utilisée", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchSpy);
    const { repo } = await setup();
    expect((await importHistoricalSeed(repo)).status).toBe("success");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("Ancienne file hors ligne (IndexedDB / Dexie)", () => {
  it("récupère les réponses pending et synced, une seule fois", async () => {
    const { repo } = await setup();
    const items = [
      { localId: 1, sync_id: "aaaaaaaa-0000-4000-8000-000000000001", createdAt: "2026-08-20T08:00:00.000Z", status: "pending", accueil: 4, lavage: "satisfait", lavage_detail: [], attente: "rapide", lounge: 5, qualite_prix: "correct", nps: "oui", commentaire: "" },
      { localId: 2, sync_id: "aaaaaaaa-0000-4000-8000-000000000002", createdAt: "2026-08-21T08:00:00.000Z", status: "synced", accueil: 2, lavage: "insatisfait", lavage_detail: ["jantes"], attente: "trop_long", lounge: 1, qualite_prix: "cher", nps: "non", commentaire: "Bof" },
    ];
    const r1 = await importLegacyOfflineFeedback(repo, async () => items);
    expect(r1).toMatchObject({ status: "success", fetched: 2, inserted: 2 });
    const r2 = await importLegacyOfflineFeedback(repo, async () => items);
    expect(r2).toMatchObject({ status: "success", inserted: 0, alreadyPresent: 2 });

    const row = await repo.getById(items[1].sync_id);
    expect(row).toEqual({ ...legacyItemToRow(items[1]), source: "legacy_offline" });
    expect(row?.timestamp).toBe("2026-08-21T08:00:00.000Z");
  });
});

describe("8-10. Tableau de bord : données combinées, statistiques, filtres, suppression", () => {
  it("affiche ensemble les réponses importées et locales, sans doublon, triées par date", async () => {
    const { repo } = await setup();
    await repo.importRows(remoteRows(5), "supabase");
    const local = await repo.create(validInput());
    await repo.importRows(remoteRows(5), "supabase"); // second passage : aucun doublon

    const all = await repo.getAll();
    expect(all.length).toBe(6);
    expect(all[0].id).toBe(local.id); // la plus récente en premier
    const times = all.map((r) => Date.parse(r.timestamp));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(new Set(all.map((r) => r.source))).toEqual(new Set(["local", "supabase"]));

    const status = await repo.getMigrationStatus();
    expect(status.localCount).toBe(6);
    expect(status.countsBySource).toMatchObject({ local: 1, supabase: 5 });
  });

  it("calcule les statistiques à partir des données locales", async () => {
    const { repo } = await setup();
    await repo.create(validInput({ accueil: 5, lounge: 4, nps: "oui", lavage: "impeccable", attente: "rapide", qualite_prix: "avantageux" }));
    await repo.create(validInput({ accueil: 2, lounge: 2, nps: "non", lavage: "insatisfait", attente: "trop_long", qualite_prix: "cher" }));
    await repo.create(validInput({ accueil: 4, lounge: 3, nps: "oui", lavage: "satisfait", attente: "rapide", qualite_prix: "correct" }));
    const s = computeStats(await repo.getAll());
    expect(s).toMatchObject({ avgAccueil: "3.7", avgLounge: "3.0", npsOui: 2, npsTotal: 3, npsRate: 67 });
    expect(s.lavageData.map((d) => d.value)).toEqual([1, 1, 1]);
    expect(s.attenteData.map((d) => d.value)).toEqual([2, 0, 1]);
    expect(s.prixData.map((d) => d.value)).toEqual([1, 1, 1]);
    expect(s.trend.reduce((a, d) => a + d.count, 0)).toBe(3);
  });

  it("filtre par période et par recherche (insensible aux accents)", async () => {
    const { repo } = await setup();
    await repo.importRows(
      [
        remoteRow(1, { timestamp: "2026-10-01T09:00:00+00:00", commentaire: "Accueil très chaleureux" }),
        remoteRow(2, { timestamp: "2026-10-12T09:00:00+00:00", commentaire: "Intérieur pas propre" }),
        remoteRow(3, { timestamp: "2026-09-01T09:00:00+00:00", commentaire: null }),
      ],
      "supabase"
    );
    const all = await repo.getAll();
    const now = new Date("2026-10-13T12:00:00Z");
    expect(filterResponses(all, periodRange("semaine", { from: "", to: "" }, now)).length).toBe(1);
    expect(filterResponses(all, periodRange("mois", { from: "", to: "" }, now)).length).toBe(2);
    expect(filterResponses(all, periodRange("all", { from: "", to: "" }, now)).length).toBe(3);
    expect(filterResponses(all, periodRange("custom", { from: "2026-09-01", to: "2026-10-01" }, now)).length).toBe(2);
    // "interieur" : commentaire de la n°2 (avec accent) + détail lavage de la n°3
    expect(filterResponses(all, null, "interieur").map((r) => r.id).sort()).toEqual([remoteRow(2).id, remoteRow(3).id]);
    expect(filterResponses(all, null, "CHALEUREUX").length).toBe(1);
    expect(filterResponses(all, null, "insatisfait").length).toBe(1); // remoteRow(3) : lavage insatisfait
  });

  it("supprime une réponse ; un nouvel import ne la fait pas réapparaître", async () => {
    const { repo } = await setup();
    const rows = remoteRows(3);
    await repo.importRows(rows, "supabase");
    expect(await repo.delete(rows[0].id)).toBe(true);
    expect(await repo.getById(rows[0].id)).toBeNull();
    expect(await repo.delete(rows[0].id)).toBe(false);

    const report = await importHistoricalSeed(repo, seedOf(rows));
    expect(report).toMatchObject({ status: "success", inserted: 0, alreadyPresent: 2, skippedDeleted: 1 });
    expect(await repo.count()).toBe(2);
  });
});

describe("11. Exports PDF et Excel", () => {
  it("génère un fichier Excel lisible contenant toutes les lignes filtrées", async () => {
    const { repo } = await setup();
    await repo.importRows(remoteRows(3), "supabase");
    const rows = await repo.getAll();
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([XLSX_HEADERS, ...xlsxRows(rows)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Réponses");
    const b64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });

    const back = XLSX.read(b64, { type: "base64" });
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(back.Sheets["Réponses"]);
    expect(data.length).toBe(3);
    expect(data.map((d) => d.id).sort()).toEqual(rows.map((r) => r.id).sort());
    const r3 = data.find((d) => d.id === remoteRow(3).id)!;
    expect(r3.lavage_detail).toBe("jantes|interieur");
    expect(r3.date).toBe(remoteRow(3).timestamp);
  });

  it("génère un PDF avec le tableau des réponses", async () => {
    const { repo } = await setup();
    await repo.importRows(remoteRows(25), "supabase");
    const rows = await repo.getAll();
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.text("Prestige Feedback — Réponses", 125, 45);
    autoTable(doc, { head: [PDF_HEAD], body: pdfRows(rows), startY: 105, columnStyles: { 8: { cellWidth: 200 } } });
    const out = doc.output("arraybuffer");
    expect(new TextDecoder().decode(new Uint8Array(out).slice(0, 5))).toBe("%PDF-");
    expect(pdfRows(rows).length).toBe(25);
  });
});

describe("Sauvegarde / restauration JSON", () => {
  it("restaure à l'identique dans une base vide, puis sans doublon", async () => {
    const a = await setup();
    await a.repo.importRows(remoteRows(10), "supabase");
    await a.repo.create(validInput({ commentaire: "local" }));
    const backup = buildBackup(await a.repo.getAll(), 1);
    const text = JSON.stringify(backup);

    const b = await setup();
    const r1 = await b.repo.importRows(parseBackup(text), "backup", { includeDeleted: true });
    expect(r1).toMatchObject({ fetched: 11, inserted: 11, invalid: 0, missingAfterImport: 0 });
    expect(await b.repo.getAll()).toEqual(await a.repo.getAll()); // sources d'origine conservées
    const r2 = await b.repo.importRows(parseBackup(text), "backup", { includeDeleted: true });
    expect(r2).toMatchObject({ inserted: 0, alreadyPresent: 11 });
  });

  it("une restauration réintègre une réponse supprimée par erreur", async () => {
    const { repo } = await setup();
    await repo.importRows(remoteRows(2), "supabase");
    const text = JSON.stringify(buildBackup(await repo.getAll(), 1));
    await repo.delete(remoteRow(1).id);
    const r = await repo.importRows(parseBackup(text), "backup", { includeDeleted: true });
    expect(r.inserted).toBe(1);
    expect(await repo.count()).toBe(2);
  });

  it("refuse les fichiers au mauvais format", () => {
    expect(() => parseBackup("pas du json")).toThrow(BackupFormatError);
    expect(() => parseBackup(JSON.stringify({ format: "autre", version: 1, feedback: [] }))).toThrow(BackupFormatError);
    expect(() => parseBackup(JSON.stringify({ format: "prestigecarwash-feedback-backup", version: 99, feedback: [] }))).toThrow(BackupFormatError);
    expect(() =>
      parseBackup(JSON.stringify({ format: "prestigecarwash-feedback-backup", version: 1, count: 3, feedback: [{}] }))
    ).toThrow(/incomplète/);
  });
});

describe("12. Mode avion", () => {
  it("l'enregistrement d'une réponse n'effectue aucun appel réseau", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("réseau indisponible")));
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("navigator", { onLine: false });
    const { repo } = await setup();
    const saved = await repo.create(validInput());
    expect(await repo.getById(saved.id)).toEqual(saved);
    expect((await repo.getAll()).length).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
