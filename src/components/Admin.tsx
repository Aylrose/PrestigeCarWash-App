import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
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
import { BarChart3, RefreshCw, Download } from "lucide-react";
import { COLORS } from "@/lib/constants";
import { Chrome } from "@/components/ui";
import type { FeedbackRow } from "@/lib/supabase";

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

function periodFilter(
  period: string,
  custom: { from: string; to: string }
) {
  const now = new Date();
  const start = new Date(now);

  if (period === "jour") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "semaine") {
    start.setDate(now.getDate() - 7);
  } else if (period === "mois") {
    start.setMonth(now.getMonth() - 1);
  } else if (period === "custom" && custom.from) {
    return {
      from: new Date(custom.from),
      to: custom.to ? new Date(custom.to) : now,
    };
  } else {
    return null;
  }

  return {
    from: start,
    to: now,
  };
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

export function Admin({
  responses,
  onClose,
  onReset,
}: {
  responses: FeedbackRow[];
  onClose: () => void;
  onReset: () => void;
}) {
  const [period, setPeriod] = useState("mois");
  const [custom, setCustom] = useState({
    from: "",
    to: "",
  });

  const range = periodFilter(period, custom);

  const filtered = !range
    ? responses
    : responses.filter((r) => {
        const t = new Date(r.timestamp);

        return t >= range.from && t <= range.to;
      });

  const avg = (key: "accueil" | "lounge") => {
    const vals = filtered
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number");

    return vals.length
      ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
      : "–";
  };

  const npsOui = filtered.filter(
    (r) => r.nps === "oui"
  ).length;

  const npsTotal = filtered.filter(
    (r) => r.nps != null
  ).length;

  const npsRate = npsTotal
    ? Math.round((npsOui / npsTotal) * 100)
    : 0;

  const lavageData = [
    {
      name: "Impeccable",
      value: filtered.filter(
        (r) => r.lavage === "impeccable"
      ).length,
    },
    {
      name: "Plutôt satisfait",
      value: filtered.filter(
        (r) => r.lavage === "satisfait"
      ).length,
    },
    {
      name: "Insatisfait",
      value: filtered.filter(
        (r) => r.lavage === "insatisfait"
      ).length,
    },
  ];

  const attenteData = [
    {
      name: "Rapide",
      value: filtered.filter(
        (r) => r.attente === "rapide"
      ).length,
    },
    {
      name: "Un peu long",
      value: filtered.filter(
        (r) => r.attente === "peu_long"
      ).length,
    },
    {
      name: "Trop long",
      value: filtered.filter(
        (r) => r.attente === "trop_long"
      ).length,
    },
  ];

  const prixData = [
    {
      name: "Avantageux",
      value: filtered.filter(
        (r) => r.qualite_prix === "avantageux"
      ).length,
    },
    {
      name: "Correct",
      value: filtered.filter(
        (r) => r.qualite_prix === "correct"
      ).length,
    },
    {
      name: "Trop cher",
      value: filtered.filter(
        (r) => r.qualite_prix === "cher"
      ).length,
    },
  ];

  const byDay: Record<string, number> = {};

  filtered.forEach((r) => {
    const day = r.timestamp.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  });

  const trend = Object.entries(byDay)
    .sort()
    .map(([day, count]) => ({
      day: day.slice(5),
      count,
    }));

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

      const head = [
        [
          "Date",
          "Accueil",
          "Lavage",
          "Détails",
          "Attente",
          "Lounge",
          "Qualité/Prix",
          "Recommandation",
          "Commentaire",
        ],
      ];

      const body = filtered.map((r) => [
        new Date(r.timestamp).toLocaleString(
          "fr-FR"
        ),
        r.accueil ?? "",
        r.lavage ?? "",
        (r.lavage_detail || []).join(", "),
        r.attente ?? "",
        r.lounge ?? "",
        r.qualite_prix ?? "",
        r.nps ?? "",
        r.commentaire || "",
      ]);

      autoTable(doc, {
        head,
        body,
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

      // =====================================================
      // ANDROID / CAPACITOR
      // =====================================================

      if (Capacitor.isNativePlatform()) {
        const base64 = doc
          .output("datauristring")
          .split(",")[1];

        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
        });

        await Share.share({
          title: "Prestige Feedback",
          text: "Rapport PDF Prestige Feedback",
          url: result.uri,
          dialogTitle:
            "Partager ou enregistrer le PDF",
        });

        return;
      }

      // =====================================================
      // NAVIGATEUR / PC
      // =====================================================

      doc.save(fileName);
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

      const headers = [
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

      const rows = filtered.map((r) => [
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

      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        ...rows,
      ]);

      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        wb,
        ws,
        "Réponses"
      );

      const fileName = `prestige-feedback-${Date.now()}.xlsx`;

      // =====================================================
      // ANDROID / CAPACITOR
      // =====================================================

      if (Capacitor.isNativePlatform()) {
        const base64 = XLSX.write(wb, {
          bookType: "xlsx",
          type: "base64",
        });

        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents,
        });

        await Share.share({
          title: "Prestige Feedback",
          text: "Fichier Excel Prestige Feedback",
          url: result.uri,
          dialogTitle:
            "Partager ou enregistrer le fichier Excel",
        });

        return;
      }

      // =====================================================
      // NAVIGATEUR / PC
      // =====================================================

      XLSX.writeFile(wb, fileName);
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
              {filtered.length} réponse(s) sur la
              période sélectionnée
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
            onClick={onReset}
            style={btnGhost}
          >
            <RefreshCw
              size={14}
              style={{ marginRight: 6 }}
            />
            Réinitialiser
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
          value={avg("accueil")}
          color={COLORS.gold}
        />

        <StatCard
          label="Coffee Lounge (moy. /5)"
          value={avg("lounge")}
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
              .slice()
              .reverse()
              .slice(0, 12)
              .map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: COLORS.panel2,
                    color: COLORS.text,
                    fontSize: 14,
                  }}
                >
                  <div
                    style={{
                      color: COLORS.textMuted,
                      fontSize: 11,
                      marginBottom: 4,
                    }}
                  >
                    {new Date(
                      r.timestamp
                    ).toLocaleString("fr-FR")}
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
    </div>
  );
}