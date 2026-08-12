import { useState } from "react";
import { Lock, X } from "lucide-react";
import { COLORS, ADMIN_PASSWORD } from "@/lib/constants";
import { Chrome } from "@/components/ui";

export function AdminLogin({ onAuth, onClose }: { onAuth: () => void; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (pwd === ADMIN_PASSWORD) onAuth();
    else setError(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ position: "relative" }}>
        <Chrome style={{ width: 380 }}>
          <div style={{ padding: 34, textAlign: "center" }}>
            <Lock size={30} color={COLORS.blue} style={{ marginBottom: 14 }} />
            <div style={{ color: COLORS.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Back-office</div>
            <div style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 22 }}>Accès réservé à la direction</div>
            <input
              type="password"
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setError(false); }}
              placeholder="Mot de passe"
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: `1px solid ${error ? COLORS.red : "rgba(255,255,255,0.15)"}`, background: COLORS.panel2, color: COLORS.text, marginBottom: 14, outline: "none" }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            {error && <div style={{ color: COLORS.red, fontSize: 13, marginBottom: 10 }}>Mot de passe incorrect.</div>}
            <button
              onClick={submit}
              style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: COLORS.blue, color: "#04141c", fontWeight: 700, cursor: "pointer" }}
            >
              Entrer
            </button>
            <div style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 14 }}>
              Démo : mot de passe <code></code>
            </div>
          </div>
        </Chrome>
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer" }}
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
