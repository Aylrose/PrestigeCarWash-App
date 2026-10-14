import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { BarChart3, Download, Upload, Database, Search, Trash2, X } from "lucide-react";
import { COLORS } from "@/lib/constants";
import { Chrome } from "@/components/ui";
import type { FeedbackRow, ImportReport, MigrationStatus } from "@/lib/feedbackTypes";
import {
  deleteFeedback,
  exportBackup,
  getAllFeedback,
  getMigrationStatus,
  restoreBackup,
} from "@/lib/feedbackRepository";
import { backupFileName } from "@/lib/backup";
import {
  PDF_HEAD,
  XLSX_HEADERS,
  computeStats,
  filterResponses,
  formatDate,
  label,
  pdfRows,
  periodRange,
  xlsxRows,
} from "@/lib/feedbackStats";

const btnGhost: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.15)",
  color: COLORS.text,
  borderRadius: 999,
  padding: "9px 16px",
  fontSize: 13,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};

const btnPrimary: React.CSSProperties = {
  background: COLORS.blue,
  border: "none",
  color: "#04141c",
  fontWeight: 700,
  borderRadius: 999,
  padding: "9px 16px",
  fontSize: 13,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};

const btnDanger: React.CSSProperties = {
  ...btnGhost,
  borderColor: COLORS.red,
  color: COLORS.red,
};

const inputStyle: React.CSSProperties = {
  background: COLORS.panel2,
  border: "1px solid rgba(255,255,255,0.15)",
  color: COLORS.text,
  borderRadius: 999,
  padding: "8px 14px",
  fontSize: 13,
};

const chartTitle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 700,
  fontSize: 14,
};

const mutedText: React.CSSProperties = {
  color: COLORS.textMuted,
  fontSize: 12,
};

const IMPORT_STATUS_LABEL: Record<ImportReport["status"], string> = {
  never: "Jamais lancé",
  running: "En cours…",
  success: "Réussi",
  partial: "Partiel — à relancer",
  error: "Échec",
  interrupted: "Interrompu — à relancer",
};

const SOURCE_LABEL: Record<FeedbackRow["source"], string> = {
  local: "Saisie locale",
  supabase: "Historique (ancienne base Supabase)",
  legacy_offline: "Ancienne file hors ligne",
  backup: "Restaurée (sauvegarde)",
};

/**
 * Enregistre un fichier puis ouvre le partage (Android), ou le télécharge (navigateur).
 * `data` est en base64, sauf si `utf8` est vrai.
 */
async function saveAndShare(opts: {
  fileName: string;
  data: string;
  utf8?: boolean;
  text: string;
  dialogTitle: string;
  browserDownload: () => void;
}) {
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: opts.fileName,
      data: opts.data,
      directory: Directory.Documents,
      ...(opts.utf8 ? { encoding: Encoding.UTF8 } : {}),
    });

    await Share.share({
      title: "Prestige Feedback",
      text: opts.text,
      url: result.uri,
      dialogTitle: opts.dialogTitle,
    });
    return;
  }

  opts.browserDownload();
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <Chrome>
      <div style={{ padding: "20px 22px" }}>
        <div
          style={{
            color: COLORS.textMuted,
            fontSize: 12,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: color || COLORS.text,
          }}
        >
          {value}
        </div>

        {sub && (
          <div
            style={{
              color: COLORS.textMuted,
              fontSize: 12,
              marginTop: 4,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </Chrome>
  );
}

function DetailField({ name, value }: { name: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={mutedText}>{name}</div>
      <div style={{ color: COLORS.text, fontSize: 14, wordBreak: "break-word" }}>{value === "" || value == null ? "—" : value}</div>
    </div>
  );
}

function DetailModal({
  row,
  onClose,
  onDelete,
  deleting,
}: {
  row: FeedbackRow;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
        <Chrome>
          <div style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={chartTitle}>Détail de la réponse</div>
              <button onClick={onClose} style={{ ...btnGhost, padding: 6 }} aria-label="Fermer">
                <X size={16} />
              </button>
            </div>

            <DetailField name="Date" value={formatDate(row.timestamp)} />
            <DetailField name="Accueil" value={row.accueil != null ? `${row.accueil} / 5` : ""} />
            <DetailField name="Lavage" value={label(row.lavage)} />
            <DetailField name="Détails lavage" value={(row.lavage_detail || []).map(label).join(", ")} />
            <DetailField name="Attente" value={label(row.attente)} />
            <DetailField name="Coffee Lounge" value={row.lounge != null ? `${row.lounge} / 5` : ""} />
            <DetailField name="Qualité / prix" value={label(row.qualite_prix)} />
            <DetailField name="Recommandation" value={label(row.nps)} />
            <DetailField name="Commentaire" value={row.commentaire} />
            <DetailField name="Origine" value={SOURCE_LABEL[row.source]} />
            <DetailField name="Identifiant" value={<span style={{ fontFamily: "monospace", fontSize: 12 }}>{row.id}</span>} />

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={onDelete} disabled={deleting} style={{ ...btnDanger, opacity: deleting ? 0.5 : 1 }}>
                <Trash2 size={14} style={{ marginRight: 6 }} />
                {deleting ? "Suppression…" : "Supprimer cette réponse"}
              </button>
            </div>
          </div>
        </Chrome>
      </div>
    </div>
  );
}

export function Admin({ onClose }: { onClose: () => void }) {
  const [responses, setResponses] = useState<FeedbackRow[]>([]);
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "backup" | "restore" | "delete">(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [selected, setSelected] = useState<FeedbackRow | null>(null);
  const [search, setSearch] = useState("");
  const [listLimit, setListLimit] = useState(50);
  const fileInput = useRef<HTMLInputElement>(null);

  const [period, setPeriod] = useState("mois");
  const [custom, setCustom] = useState({
    from: "",
    to: "",
  });

  // Les données affichées proviennent exclusivement de la base SQLite locale.
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [rows, st] = await Promise.all([getAllFeedback(), getMigrationStatus()]);
      setResponses(rows);
      setStatus(st);
    } catch (error) {
      console.error("Erreur lors du chargement des réponses :", error);
      setLoadError(
        `Impossible de lire la base locale : ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const range = periodRange(period, custom);
  const filtered = filterResponses(responses, range, search);

  const {
    avgAccueil,
    avgLounge,
    npsOui,
    npsTotal,
    npsRate,
    lavageData,
    attenteData,
    prixData,
    trend,
  } = computeStats(filtered);

  const PIE_COLORS = [
    COLORS.green,
    COLORS.blue,
    COLORS.red,
  ];

  // =========================================================
  // EXPORT PDF
  // =========================================================

  const exportPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (
        await import("jspdf-autotable")
      ).default;

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      // Charger le logo
      const logo = new Image();

      logo.src =
        "/WhatsApp_Image_2026-07-31_at_14.59.26.jpeg";

      await new Promise<void>((resolve, reject) => {
        logo.onload = () => resolve();
        logo.onerror = () =>
          reject(
            new Error("Impossible de charger le logo")
          );
      });

      // Ajouter le logo
      doc.addImage(
        logo,
        "JPEG",
        40,
        20,
        70,
        70
      );

      // Titre
      doc.setFontSize(16);

      doc.text(
        "Prestige Feedback — Réponses",
        125,
        45
      );

      // Nombre de réponses + date
      doc.setFontSize(10);

      doc.text(
        `${filtered.length} réponse(s) — ${new Date().toLocaleString(
          "fr-FR"
        )}`,
        125,
        63
      );

      autoTable(doc, {
        head: [PDF_HEAD],
        body: pdfRows(filtered),
        startY: 105,
        styles: {
          fontSize: 8,
          cellPadding: 4,
        },
        headStyles: {
          fillColor: [26, 169, 232],
        },
        columnStyles: {
          8: {
            cellWidth: 200,
          },
        },
      });

      const fileName = `prestige-feedback-${Date.now()}.pdf`;

      await saveAndShare({
        fileName,
        data: doc.output("datauristring").split(",")[1],
        text: "Rapport PDF Prestige Feedback",
        dialogTitle: "Partager ou enregistrer le PDF",
        browserDownload: () => doc.save(fileName),
      });
    } catch (error) {
      console.error(
        "Erreur export PDF :",
        error
      );

      alert(
        "Impossible de générer le PDF."
      );
    }
  };

  // =========================================================
  // EXPORT EXCEL
  // =========================================================

  const exportXLSX = async () => {
    try {
      const XLSX = await import("xlsx");

      const ws = XLSX.utils.aoa_to_sheet([
        XLSX_HEADERS,
        ...xlsxRows(filtered),
      ]);

      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        wb,
        ws,
        "Réponses"
      );

      const fileName = `prestige-feedback-${Date.now()}.xlsx`;

      await saveAndShare({
        fileName,
        data: Capacitor.isNativePlatform()
          ? XLSX.write(wb, { bookType: "xlsx", type: "base64" })
          : "",
        text: "Fichier Excel Prestige Feedback",
        dialogTitle: "Partager ou enregistrer le fichier Excel",
        browserDownload: () => XLSX.writeFile(wb, fileName),
      });
    } catch (error) {
      console.error(
        "Erreur export Excel :",
        error
      );

      alert(
        "Impossible de générer le fichier Excel."
      );
    }
  };

  // =========================================================
  // SAUVEGARDE / RESTAURATION / IMPORT / SUPPRESSION
  // =========================================================

  const handleBackup = async () => {
    setBusy("backup");
    setNotice(null);
    try {
      const backup = await exportBackup();
      const json = JSON.stringify(backup, null, 2);
      const fileName = backupFileName();
      await saveAndShare({
        fileName,
        data: json,
        utf8: true,
        text: "Sauvegarde complète Prestige Feedback",
        dialogTitle: "Enregistrer la sauvegarde en lieu sûr",
        browserDownload: () => {
          const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        },
      });
      setNotice({ kind: "ok", text: `Sauvegarde créée : ${backup.count} réponse(s) (${fileName}).` });
    } catch (error) {
      console.error("Erreur sauvegarde :", error);
      setNotice({ kind: "error", text: `Échec de la sauvegarde : ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setBusy(null);
    }
  };

  const handleRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy("restore");
    setNotice(null);
    try {
      const result = await restoreBackup(await file.text());
      setNotice({
        kind: result.invalid || result.missingAfterImport ? "error" : "ok",
        text:
          `Restauration : ${result.fetched} réponse(s) dans le fichier, ${result.inserted} ajoutée(s), ` +
          `${result.alreadyPresent} déjà présente(s)` +
          (result.invalid ? `, ${result.invalid} invalide(s) : ${result.errors.join(" ; ")}` : "") +
          (result.missingAfterImport ? `, ${result.missingAfterImport} non retrouvée(s) après écriture` : "") +
          ".",
      });
      await load();
    } catch (error) {
      console.error("Erreur restauration :", error);
      setNotice({ kind: "error", text: `Restauration impossible : ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleDelete = async (row: FeedbackRow) => {
    if (!window.confirm(`Supprimer définitivement la réponse du ${formatDate(row.timestamp)} ?`)) return;
    setBusy("delete");
    try {
      const removed = await deleteFeedback(row.id);
      setSelected(null);
      setNotice(removed
        ? { kind: "ok", text: "Réponse supprimée." }
        : { kind: "error", text: "Cette réponse n'existe plus dans la base locale." });
      await load();
    } catch (error) {
      setNotice({ kind: "error", text: `Suppression impossible : ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setBusy(null);
    }
  };

  const hist = status?.historicalImport;
  const legacy = status?.legacyOfflineImport;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        fontFamily: "system-ui, sans-serif",
        padding: "28px 30px 60px",
      }}
    >
      {/* HEADER */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <BarChart3
            color={COLORS.blue}
            size={26}
          />

          <div>
            <div
              style={{
                color: COLORS.text,
                fontWeight: 800,
                fontSize: 20,
              }}
            >
              Tableau de bord — Prestige Feedback
            </div>

            <div
              style={{
                color: COLORS.textMuted,
                fontSize: 12,
              }}
            >
              {loading
                ? "Chargement des données locales…"
                : `${filtered.length} réponse(s) sur la période sélectionnée · ${responses.length} au total sur l'appareil`}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={onClose}
            style={btnGhost}
          >
            Retour au kiosque
          </button>

          <button
            onClick={exportPDF}
            style={btnPrimary}
          >
            <Download
              size={14}
              style={{ marginRight: 6 }}
            />
            PDF
          </button>

          <button
            onClick={exportXLSX}
            style={btnPrimary}
          >
            <Download
              size={14}
              style={{ marginRight: 6 }}
            />
            Excel (.xlsx)
          </button>
        </div>
      </div>

      {loadError && (
        <div role="alert" style={{ marginBottom: 18, padding: "12px 16px", borderRadius: 12, background: "rgba(229,83,75,0.15)", border: `1px solid ${COLORS.red}`, color: COLORS.text, fontSize: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span>{loadError}</span>
          <button onClick={() => void load()} style={btnGhost}>Réessayer</button>
        </div>
      )}

      {notice && (
        <div role="status" style={{ marginBottom: 18, padding: "12px 16px", borderRadius: 12, background: notice.kind === "ok" ? "rgba(51,197,142,0.12)" : "rgba(229,83,75,0.15)", border: `1px solid ${notice.kind === "ok" ? COLORS.green : COLORS.red}`, color: COLORS.text, fontSize: 14, display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} style={{ ...btnGhost, padding: 4, border: "none" }} aria-label="Fermer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* FILTRES */}

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 22,
          flexWrap: "wrap",
        }}
      >
        {[
          ["jour", "Aujourd'hui"],
          ["semaine", "7 derniers jours"],
          ["mois", "30 derniers jours"],
          ["all", "Tout"],
          ["custom", "Personnalisé"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            style={{
              ...btnGhost,
              background:
                period === k
                  ? "rgba(26,169,232,0.18)"
                  : "transparent",
              borderColor:
                period === k
                  ? COLORS.blue
                  : "rgba(255,255,255,0.15)",
            }}
          >
            {label}
          </button>
        ))}

        {period === "custom" && (
          <>
            <input
              type="date"
              value={custom.from}
              onChange={(e) =>
                setCustom((c) => ({
                  ...c,
                  from: e.target.value,
                }))
              }
              style={inputStyle}
            />

            <input
              type="date"
              value={custom.to}
              onChange={(e) =>
                setCustom((c) => ({
                  ...c,
                  to: e.target.value,
                }))
              }
              style={inputStyle}
            />
          </>
        )}

        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 360 }}>
          <Search size={14} color={COLORS.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (commentaire, réponse, date…)"
            style={{ ...inputStyle, width: "100%", paddingLeft: 32 }}
          />
        </div>
      </div>

      {/* STATISTIQUES */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard
          label="Taux de recommandation"
          value={`${npsRate}%`}
          sub={`${npsOui}/${npsTotal} recommandent`}
          color={
            npsRate >= 70
              ? COLORS.green
              : npsRate >= 40
              ? COLORS.amber
              : COLORS.red
          }
        />

        <StatCard
          label="Accueil (moy. /5)"
          value={avgAccueil}
          color={COLORS.gold}
        />

        <StatCard
          label="Coffee Lounge (moy. /5)"
          value={avgLounge}
          color={COLORS.gold}
        />

        <StatCard
          label="Lavage impeccable"
          value={`${lavageData[0].value}`}
          sub={`sur ${filtered.length}`}
          color={COLORS.green}
        />
      </div>

      {/* GRAPHIQUES */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
        }}
      >
        {/* LAVAGE */}

        <Chrome>
          <div
            style={{
              padding: 18,
              height: 280,
            }}
          >
            <div style={chartTitle}>
              Qualité du lavage
            </div>

            <ResponsiveContainer
              width="100%"
              height="85%"
            >
              <PieChart>
                <Pie
                  data={lavageData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {lavageData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={PIE_COLORS[i]}
                    />
                  ))}
                </Pie>

                <Tooltip />

                <Legend
                  wrapperStyle={{
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Chrome>

        {/* ATTENTE */}

        <Chrome>
          <div
            style={{
              padding: 18,
              height: 280,
            }}
          >
            <div style={chartTitle}>
              Délai d'attente
            </div>

            <ResponsiveContainer
              width="100%"
              height="85%"
            >
              <BarChart data={attenteData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.08)"
                />

                <XAxis
                  dataKey="name"
                  stroke={COLORS.textMuted}
                  fontSize={12}
                />

                <YAxis
                  stroke={COLORS.textMuted}
                  fontSize={12}
                  allowDecimals={false}
                />

                <Tooltip />

                <Bar
                  dataKey="value"
                  fill={COLORS.blue}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Chrome>

        {/* QUALITE PRIX */}

        <Chrome>
          <div
            style={{
              padding: 18,
              height: 280,
            }}
          >
            <div style={chartTitle}>
              Rapport qualité / prix
            </div>

            <ResponsiveContainer
              width="100%"
              height="85%"
            >
              <BarChart data={prixData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.08)"
                />

                <XAxis
                  dataKey="name"
                  stroke={COLORS.textMuted}
                  fontSize={12}
                />

                <YAxis
                  stroke={COLORS.textMuted}
                  fontSize={12}
                  allowDecimals={false}
                />

                <Tooltip />

                <Bar
                  dataKey="value"
                  fill={COLORS.gold}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Chrome>

        {/* VOLUME */}

        <Chrome>
          <div
            style={{
              padding: 18,
              height: 280,
            }}
          >
            <div style={chartTitle}>
              Volume de réponses
            </div>

            <ResponsiveContainer
              width="100%"
              height="85%"
            >
              <LineChart data={trend}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.08)"
                />

                <XAxis
                  dataKey="day"
                  stroke={COLORS.textMuted}
                  fontSize={12}
                />

                <YAxis
                  stroke={COLORS.textMuted}
                  fontSize={12}
                  allowDecimals={false}
                />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={COLORS.blue}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Chrome>
      </div>

      {/* COMMENTAIRES */}

      <Chrome className="mt">
        <div style={{ padding: 20 }}>
          <div style={chartTitle}>
            Derniers commentaires
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              maxHeight: 260,
              overflowY: "auto",
              marginTop: 10,
            }}
          >
            {filtered
              .filter((r) => r.commentaire)
              .slice(0, 12)
              .map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelected(r)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: COLORS.panel2,
                    color: COLORS.text,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      color: COLORS.textMuted,
                      fontSize: 11,
                      marginBottom: 4,
                    }}
                  >
                    {formatDate(r.timestamp)}
                  </div>

                  {r.commentaire}
                </div>
              ))}

            {filtered.filter(
              (r) => r.commentaire
            ).length === 0 && (
              <div
                style={{
                  color: COLORS.textMuted,
                  fontSize: 14,
                }}
              >
                Aucun commentaire sur cette période.
              </div>
            )}
          </div>
        </div>
      </Chrome>

      {/* LISTE DES RÉPONSES */}

      <div style={{ marginTop: 18 }}>
        <Chrome>
          <div style={{ padding: 20 }}>
            <div style={chartTitle}>
              Réponses ({filtered.length})
            </div>
            <div style={{ ...mutedText, marginTop: 4, marginBottom: 10 }}>
              Touchez une réponse pour voir le détail ou la supprimer.
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {filtered.slice(0, listLimit).map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  style={{
                    textAlign: "left",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: COLORS.panel2,
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: COLORS.text,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "grid",
                    gridTemplateColumns: "minmax(130px, auto) 1fr",
                    gap: 12,
                  }}
                >
                  <span style={{ color: COLORS.textMuted }}>{formatDate(r.timestamp)}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Accueil {r.accueil ?? "–"}/5 · {label(r.lavage) || "–"} · {label(r.attente) || "–"} · Lounge {r.lounge ?? "–"}/5 · Reco. {label(r.nps) || "–"}
                    {r.commentaire ? ` · « ${r.commentaire} »` : ""}
                  </span>
                </button>
              ))}

              {!loading && filtered.length === 0 && (
                <div style={{ color: COLORS.textMuted, fontSize: 14 }}>
                  Aucune réponse ne correspond aux filtres.
                </div>
              )}

              {filtered.length > listLimit && (
                <button onClick={() => setListLimit((n) => n + 50)} style={{ ...btnGhost, justifyContent: "center" }}>
                  Afficher plus ({filtered.length - listLimit} restante(s))
                </button>
              )}
            </div>
          </div>
        </Chrome>
      </div>

      {/* DONNÉES LOCALES, MIGRATION ET SAUVEGARDE */}

      <div style={{ marginTop: 18 }}>
        <Chrome>
          <div style={{ padding: 20 }}>
            <div style={{ ...chartTitle, display: "flex", alignItems: "center", gap: 8 }}>
              <Database size={16} color={COLORS.blue} /> Données locales (SQLite)
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 12 }}>
              <div style={{ color: COLORS.text, fontSize: 13, lineHeight: 1.7 }}>
                <div><strong>{status?.localCount ?? "…"}</strong> réponse(s) enregistrée(s) sur l'appareil</div>
                {status && (
                  <div style={mutedText}>
                    {status.countsBySource.local} saisie(s) locale(s) · {status.countsBySource.supabase} historique(s) · {status.countsBySource.legacy_offline} de l'ancienne file hors ligne · {status.countsBySource.backup} restaurée(s)
                  </div>
                )}
                <div style={mutedText}>Schéma v{status?.schemaVersion ?? "…"}</div>
              </div>

              <div style={{ color: COLORS.text, fontSize: 13, lineHeight: 1.7 }}>
                {hist && hist.status !== "never" && (
                  <div>
                    Données historiques : <strong>{IMPORT_STATUS_LABEL[hist.status]}</strong>
                    <div style={mutedText}>
                      {hist.inserted} intégrée(s) sur {hist.remoteCount ?? hist.fetched}
                      {hist.alreadyPresent ? `, ${hist.alreadyPresent} déjà présente(s)` : ""}
                      {hist.skippedDeleted ? `, ${hist.skippedDeleted} supprimée(s) volontairement` : ""}
                      {hist.errors.length ? ` — ${hist.errors.join(" ")}` : ""}
                    </div>
                  </div>
                )}
                {legacy && legacy.status !== "never" && (
                  <div style={mutedText}>
                    Ancienne file hors ligne : {IMPORT_STATUS_LABEL[legacy.status]} ({legacy.fetched} trouvée(s), {legacy.inserted} ajoutée(s))
                    {legacy.errors.length ? ` — ${legacy.errors.join(" ")}` : ""}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <button onClick={handleBackup} disabled={busy != null || loading} style={{ ...btnGhost, opacity: busy ? 0.5 : 1 }}>
                <Download size={14} style={{ marginRight: 6 }} />
                {busy === "backup" ? "Sauvegarde…" : "Sauvegarde complète (JSON)"}
              </button>
              <button onClick={() => fileInput.current?.click()} disabled={busy != null || loading} style={{ ...btnGhost, opacity: busy ? 0.5 : 1 }}>
                <Upload size={14} style={{ marginRight: 6 }} />
                {busy === "restore" ? "Restauration…" : "Restaurer une sauvegarde"}
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={(e) => void handleRestoreFile(e.target.files?.[0])}
              />
            </div>

            <div style={{ ...mutedText, marginTop: 14, lineHeight: 1.6 }}>
              ⚠️ Les réponses sont stockées uniquement sur cet appareil. Elles sont perdues si l'application est
              désinstallée, si ses données sont effacées ou si l'appareil est perdu. Faites régulièrement une
              sauvegarde complète (JSON) et conservez-la hors de la tablette. Les exports PDF et Excel servent à la
              consultation et ne remplacent pas cette sauvegarde.
            </div>
          </div>
        </Chrome>
      </div>

      {selected && (
        <DetailModal
          row={selected}
          onClose={() => setSelected(null)}
          onDelete={() => void handleDelete(selected)}
          deleting={busy === "delete"}
        />
      )}
    </div>
  );
}
