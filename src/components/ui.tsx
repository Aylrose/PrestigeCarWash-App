import { COLORS } from "@/lib/constants";

export function Chrome({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 22,
        padding: 2,
        background: `linear-gradient(135deg, ${COLORS.chrome}, ${COLORS.chromeDark} 45%, ${COLORS.chrome})`,
        ...style,
      }}
    >
      <div style={{ borderRadius: 20, background: COLORS.panel, height: "100%" }}>{children}</div>
    </div>
  );
}

export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === step ? 26 : 9,
            height: 9,
            borderRadius: 5,
            transition: "all .35s ease",
            background: i <= step ? COLORS.blue : "rgba(255,255,255,0.15)",
          }}
        />
      ))}
    </div>
  );
}

type Tone = "blue" | "green" | "amber" | "red" | "neutral";

export function BigButton({
  onClick, children, tone = "blue", selected, style,
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: Tone;
  selected?: boolean;
  style?: React.CSSProperties;
}) {
  const tones: Record<Tone, [string, string]> = {
    blue: [COLORS.blue, "#0d84b8"],
    green: ["#38D89A", "#1c9d6c"],
    amber: ["#F6C453", "#c98f1c"],
    red: ["#F0776F", "#c53f37"],
    neutral: ["#2a3b47", "#16232c"],
  };
  const [c1, c2] = tones[tone];
  return (
    <button
      onClick={onClick}
      style={{
        cursor: "pointer",
        border: selected ? `3px solid ${COLORS.text}` : "3px solid transparent",
        borderRadius: 20,
        padding: "26px 18px",
        fontSize: 22,
        fontWeight: 700,
        color: "#fff",
        background: `linear-gradient(160deg, ${c1}, ${c2})`,
        boxShadow: selected ? `0 0 0 4px rgba(255,255,255,0.08)` : "0 8px 24px rgba(0,0,0,0.35)",
        transform: selected ? "translateY(-2px)" : "none",
        transition: "all .18s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function StarPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useStateValue(0);
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || value || 0) >= n;
        return (
          <button
            key={n}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              transform: active ? "scale(1.12)" : "scale(1)",
              transition: "transform .15s ease",
            }}
          >
            <Star size={54} fill={active ? COLORS.gold : "none"} color={active ? COLORS.gold : COLORS.chromeDark} strokeWidth={1.5} />
          </button>
        );
      })}
    </div>
  );
}

import { useState } from "react";
import { Star } from "lucide-react";

function useStateValue(initial: number) {
  return useState(initial);
}

export function ScreenShell({ children, keyId }: { children: React.ReactNode; keyId: string }) {
  return (
    <div
      key={keyId}
      style={{
        width: "100%",
        maxWidth: 760,
        animation: "slideIn .45s cubic-bezier(.2,.8,.2,1)",
      }}
    >
      {children}
    </div>
  );
}

export function QuestionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 34 }}>
      <div style={{ color: COLORS.blue, fontSize: 13, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>
        {eyebrow}
      </div>
      <div style={{ fontSize: 27, fontWeight: 700, color: COLORS.text, lineHeight: 1.35 }}>{title}</div>
    </div>
  );
}
