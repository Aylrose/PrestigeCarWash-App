export const COLORS = {
  bg: "#070B11",
  panel: "#0E1620",
  panel2: "#121C29",
  blue: "#1AA9E8",
  blueDeep: "#0A4A6E",
  chrome: "#C7CED6",
  chromeDark: "#5B6672",
  gold: "#E7B93F",
  green: "#33C58E",
  amber: "#F3B23A",
  red: "#E5534B",
  text: "#F3F6F9",
  textMuted: "#8DA0AF",
} as const;

export const ADMIN_PASSWORD = "";
export const TOTAL_QUESTIONS = 7;

export const nowISO = () => new Date().toISOString();

export const blankAnswers = () => ({
  accueil: null as number | null,
  lavage: null as string | null,
  lavageDetail: [] as string[],
  attente: null as string | null,
  lounge: null as number | null,
  qualitePrix: null as string | null,
  nps: null as string | null,
  commentaire: "",
});

export type Answers = ReturnType<typeof blankAnswers>;
