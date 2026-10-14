import { useState, useEffect, useRef } from "react";
import { Clock, Coffee, ThumbsUp, ThumbsDown, MessageSquare, Droplets, Gem, Wallet, Frown, Sparkles, Send, ChevronLeft } from "lucide-react";
import { COLORS, TOTAL_QUESTIONS, blankAnswers, type Answers } from "@/lib/constants";
import { Logo } from "@/components/Logo";
import { BigButton, ProgressDots, QuestionTitle, ScreenShell, StarPicker } from "@/components/ui";

/* ---------- Welcome ---------- */
export function ScreenWelcome({ onStart, onSecretTap }: { onStart: () => void; onSecretTap: () => void }) {
  return (
    <ScreenShell keyId="welcome">
      <div style={{ textAlign: "center" }}>
        <div style={{ marginBottom: 34, display: "flex", justifyContent: "center" }}>
          <div onClick={onSecretTap} style={{ cursor: "default" }}>
            <Logo size={120} />
          </div>
        </div>
        <p style={{ fontSize: 21, lineHeight: 1.6, color: COLORS.text, maxWidth: 560, margin: "0 auto 40px" }}>
          Bienvenue chez Prestige Car Wash. Parce que votre exigence est notre priorité,
          votre avis vaut de l'or. Prêtez-nous <strong>quelques secondes</strong> pour sublimer
          votre prochaine expérience.
        </p>
        <button
          onClick={onStart}
          className="pulse-btn"
          style={{
            border: "none",
            cursor: "pointer",
            borderRadius: 999,
            padding: "18px 42px",
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 0.5,
            color: "#04141c",
            background: `linear-gradient(135deg, ${COLORS.gold}, #fff3cf)`,
            boxShadow: "0 10px 40px rgba(231,185,63,0.35)",
          }}
        >
          Donner mon avis
        </button>
      </div>
    </ScreenShell>
  );
}

/* ---------- Q1 Accueil ---------- */
export function ScreenAccueil({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <ScreenShell keyId="s1">
      <QuestionTitle eyebrow="1 · Accueil & personnel" title="Comment évaluez-vous l'accueil et l'amabilité de notre équipe ?" />
      <StarPicker value={value} onChange={onChange} />
    </ScreenShell>
  );
}

/* ---------- Q2 Lavage ---------- */
export function ScreenLavage({
  value, detail, onChange, onDetail,
}: {
  value: string | null;
  detail: string[];
  onChange: (v: string) => void;
  onDetail: (k: string) => void;
}) {
  const options = [
    { key: "impeccable", label: "Tout à fait (impeccable)", tone: "green" as const },
    { key: "satisfait", label: "Plutôt satisfait", tone: "blue" as const },
    { key: "insatisfait", label: "Insatisfait", tone: "red" as const },
  ];
  const details = [
    { key: "carrosserie", label: "Carrosserie" },
    { key: "interieur", label: "Intérieur" },
    { key: "jantes", label: "Jantes" },
  ];
  return (
    <ScreenShell keyId="s2">
      <QuestionTitle eyebrow="2 · Qualité du lavage" title="Êtes-vous satisfait(e) de la propreté finale de votre véhicule ?" />
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        {options.map((o) => (
          <BigButton key={o.key} tone={o.tone} selected={value === o.key} onClick={() => onChange(o.key)} style={{ flex: "1 1 200px", minWidth: 180 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
              <Droplets size={22} /> {o.label}
            </div>
          </BigButton>
        ))}
      </div>
      {value === "insatisfait" && (
        <div style={{ marginTop: 22, animation: "slideIn .3s ease" }}>
          <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 14, marginBottom: 10 }}>
            Précisez, si vous le souhaitez :
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {details.map((d) => {
              const active = detail.includes(d.key);
              return (
                <button
                  key={d.key}
                  onClick={() => onDetail(d.key)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 999,
                    border: `2px solid ${active ? COLORS.blue : "rgba(255,255,255,0.15)"}`,
                    background: active ? "rgba(26,169,232,0.15)" : "transparent",
                    color: COLORS.text,
                    cursor: "pointer",
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </ScreenShell>
  );
}

/* ---------- Q3 Attente ---------- */
export function ScreenAttente({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const opts = [
    { key: "rapide", label: "Rapide / conforme", tone: "green" as const },
    { key: "peu_long", label: "Un peu long", tone: "amber" as const },
    { key: "trop_long", label: "Trop long", tone: "red" as const },
  ];
  return (
    <ScreenShell keyId="s3">
      <QuestionTitle eyebrow="3 · Délai d'attente" title="Le délai d'attente vous a-t-il semblé raisonnable ?" />
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        {opts.map((o) => (
          <BigButton key={o.key} tone={o.tone} selected={value === o.key} onClick={() => onChange(o.key)} style={{ flex: "1 1 200px", minWidth: 180 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
              <Clock size={22} /> {o.label}
            </div>
          </BigButton>
        ))}
      </div>
    </ScreenShell>
  );
}

/* ---------- Q4 Lounge ---------- */
export function ScreenLounge({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <ScreenShell keyId="s4">
      <QuestionTitle eyebrow="4 · Coffee lounge" title="Comment évaluez-vous votre expérience au Coffee Lounge (cadre, ambiance, boissons) ?" />
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18, color: COLORS.blue }}>
        <Coffee size={30} />
      </div>
      <StarPicker value={value} onChange={onChange} />
    </ScreenShell>
  );
}

/* ---------- Q5 Qualité/Prix ---------- */
export function ScreenQualitePrix({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const opts = [
    { key: "avantageux", label: "Très avantageux", icon: Gem, tone: "green" as const },
    { key: "correct", label: "Correct", icon: Wallet, tone: "blue" as const },
    { key: "cher", label: "Trop cher", icon: Frown, tone: "red" as const },
  ];
  return (
    <ScreenShell keyId="s5">
      <QuestionTitle eyebrow="5 · Rapport qualité / prix" title="Comment jugez-vous le rapport qualité/prix de nos services ?" />
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        {opts.map((o) => (
          <BigButton key={o.key} tone={o.tone} selected={value === o.key} onClick={() => onChange(o.key)} style={{ flex: "1 1 200px", minWidth: 180 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
              <o.icon size={22} /> {o.label}
            </div>
          </BigButton>
        ))}
      </div>
    </ScreenShell>
  );
}

/* ---------- Q6 NPS ---------- */
export function ScreenNPS({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <ScreenShell keyId="s6">
      <QuestionTitle eyebrow="6 · Recommandation" title="Recommanderiez-vous Prestige Car Wash à vos proches ?" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <BigButton tone="green" selected={value === "oui"} onClick={() => onChange("oui")}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
            <ThumbsUp size={22} /> Oui, avec plaisir !
          </div>
        </BigButton>
        <BigButton tone="red" selected={value === "non"} onClick={() => onChange("non")}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
            <ThumbsDown size={22} /> Non, pas pour le moment
          </div>
        </BigButton>
      </div>
    </ScreenShell>
  );
}

/* ---------- Q7 Commentaire ---------- */
export function ScreenCommentaire({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <ScreenShell keyId="s7">
      <QuestionTitle eyebrow="7 · Le mot de la fin" title="Une suggestion ou un commentaire pour nous aider à nous améliorer ?" />
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, color: COLORS.blue }}>
        <MessageSquare size={26} />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Votre message (facultatif)…"
        rows={5}
        style={{
          width: "100%",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.15)",
          background: COLORS.panel2,
          color: COLORS.text,
          fontSize: 17,
          padding: 18,
          resize: "none",
          outline: "none",
        }}
      />
    </ScreenShell>
  );
}

/* ---------- Thanks ---------- */
export function ScreenThanks() {
  return (
    <ScreenShell keyId="thanks">
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div
            style={{
              width: 96, height: 96, borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.green}, #0e8a5f)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "popIn .5s cubic-bezier(.2,.9,.3,1.4)",
            }}
          >
            <Sparkles size={44} color="#fff" />
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.text, marginBottom: 10 }}>Merci infiniment !</div>
        <p style={{ color: COLORS.textMuted, fontSize: 17, maxWidth: 460, margin: "0 auto" }}>
          Votre retour a été bien transmis à la direction. Toute l'équipe de Prestige Car Wash
          vous souhaite une excellente route.
        </p>
      </div>
    </ScreenShell>
  );
}

/* ---------- Kiosk controller ---------- */
export function Kiosk({ onSubmit, onOpenAdmin }: {
  /** Résout une fois la réponse écrite en base locale ; rejette en cas d'échec. */
  onSubmit: (a: Answers) => Promise<void>;
  onOpenAdmin: () => void;
}) {
  const [screen, setScreen] = useState(0);
  const [answers, setAnswers] = useState<Answers>(blankAnswers());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goNext = () => setScreen((s) => Math.min(s + 1, 8));
  const goBack = () => setScreen((s) => Math.max(s - 1, 0));

  // L'écran de remerciement n'apparaît qu'après une écriture réussie.
  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(answers);
      setScreen(8);
    } catch (error) {
      console.error("Impossible d'enregistrer le questionnaire :", error);
      setSaveError("Votre avis n'a pas pu être enregistré. Merci de réessayer ou de prévenir un membre de l'équipe.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (screen === 8) {
      resetTimer.current = setTimeout(() => {
        setAnswers(blankAnswers());
        setScreen(0);
      }, 5000);
      return () => { if (resetTimer.current) clearTimeout(resetTimer.current); };
    }
  }, [screen]);

  const toggleDetail = (key: string) =>
    setAnswers((a) => ({
      ...a,
      lavageDetail: a.lavageDetail.includes(key)
        ? a.lavageDetail.filter((d) => d !== key)
        : [...a.lavageDetail, key],
    }));

  const handleSecretTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => (tapCount.current = 0), 1200);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      onOpenAdmin();
    }
  };

  const canNext = () => {
    switch (screen) {
      case 1: return answers.accueil != null;
      case 2: return answers.lavage != null;
      case 3: return answers.attente != null;
      case 4: return answers.lounge != null;
      case 5: return answers.qualitePrix != null;
      case 6: return answers.nps != null;
      case 7: return true;
      default: return true;
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(circle at 50% 0%, #0d1a24 0%, ${COLORS.bg} 55%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        position: "relative",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <style>{`
        @keyframes slideIn { from { opacity:0; transform: translateX(28px);} to {opacity:1; transform:translateX(0);} }
        @keyframes popIn { from { opacity:0; transform: scale(.6);} to {opacity:1; transform:scale(1);} }
        @keyframes pulse { 0%,100% { box-shadow: 0 10px 40px rgba(231,185,63,0.35);} 50% { box-shadow: 0 10px 55px rgba(231,185,63,0.65);} }
        .pulse-btn { animation: pulse 2.2s ease-in-out infinite; }
        .pulse-btn:active { transform: scale(0.97); }
      `}</style>

      <div
        onClick={handleSecretTap}
        style={{ position: "absolute", top: 22, left: 28, opacity: screen === 0 ? 0 : 0.9, cursor: "default" }}
      >
        <Logo size={44} />
      </div>

      {screen > 0 && screen < 8 && (
        <div style={{ position: "absolute", top: 26, right: 28 }}>
          <span style={{ color: COLORS.textMuted, fontSize: 13, letterSpacing: 2 }}>
            {screen} / {TOTAL_QUESTIONS}
          </span>
        </div>
      )}

      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {screen > 0 && screen < 8 && <ProgressDots step={screen - 1} total={TOTAL_QUESTIONS} />}

        {screen === 0 && <ScreenWelcome onStart={goNext} onSecretTap={handleSecretTap} />}
        {screen === 1 && <ScreenAccueil value={answers.accueil} onChange={(v) => setAnswers((a) => ({ ...a, accueil: v }))} />}
        {screen === 2 && (
          <ScreenLavage
            value={answers.lavage}
            detail={answers.lavageDetail}
            onChange={(v) => setAnswers((a) => ({ ...a, lavage: v }))}
            onDetail={toggleDetail}
          />
        )}
        {screen === 3 && <ScreenAttente value={answers.attente} onChange={(v) => setAnswers((a) => ({ ...a, attente: v }))} />}
        {screen === 4 && <ScreenLounge value={answers.lounge} onChange={(v) => setAnswers((a) => ({ ...a, lounge: v }))} />}
        {screen === 5 && <ScreenQualitePrix value={answers.qualitePrix} onChange={(v) => setAnswers((a) => ({ ...a, qualitePrix: v }))} />}
        {screen === 6 && <ScreenNPS value={answers.nps} onChange={(v) => setAnswers((a) => ({ ...a, nps: v }))} />}
        {screen === 7 && <ScreenCommentaire value={answers.commentaire} onChange={(v) => setAnswers((a) => ({ ...a, commentaire: v }))} />}
        {screen === 8 && <ScreenThanks />}

        {screen === 7 && saveError && (
          <div role="alert" style={{ marginTop: 22, maxWidth: 760, width: "100%", padding: "12px 16px", borderRadius: 12, background: "rgba(229,83,75,0.15)", border: `1px solid ${COLORS.red}`, color: COLORS.text, fontSize: 14 }}>
            {saveError}
          </div>
        )}

        {screen > 0 && screen < 8 && (
          <div style={{ display: "flex", gap: 14, marginTop: 34, width: "100%", maxWidth: 760, justifyContent: "space-between" }}>
            <button
              onClick={goBack}
              disabled={saving}
              style={{
                background: "none", border: "1px solid rgba(255,255,255,0.15)", color: COLORS.textMuted,
                borderRadius: 999, padding: "12px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <ChevronLeft size={18} /> Retour
            </button>
            <button
              onClick={screen === 7 ? finish : goNext}
              disabled={!canNext() || saving}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "12px 32px",
                fontWeight: 700,
                fontSize: 16,
                color: "#04141c",
                cursor: canNext() ? "pointer" : "not-allowed",
                opacity: canNext() ? 1 : 0.35,
                background: `linear-gradient(135deg, ${COLORS.blue}, #62d3ff)`,
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {screen === 7 ? (<><Send size={16} /> {saving ? "Enregistrement…" : "Terminer & Soumettre"}</>) : "Suivant"}
            </button>
          </div>
        )}

        {screen === 8 && (
          <div style={{ marginTop: 18, color: COLORS.textMuted, fontSize: 13 }}>
            Réinitialisation automatique dans quelques secondes…
          </div>
        )}
      </div>
    </div>
  );
}
