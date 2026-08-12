const LOGO_SRC = "/WhatsApp_Image_2026-07-31_at_14.59.26.jpeg";

export function Logo({ size = 64 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 8px 22px rgba(0, 0, 0, 0.28)",
        lineHeight: 0,
        flexShrink: 0,
      }}
    >
      <img
        src={LOGO_SRC}
        alt="Prestige Car Wash"
        style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
      />
    </div>
  );
}
