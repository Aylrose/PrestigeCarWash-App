import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type FeedbackRow = {
  id: string;
  sync_id: string;
  timestamp: string;
  accueil: number | null;
  lavage: string | null;
  lavage_detail: string[] | null;
  attente: string | null;
  lounge: number | null;
  qualite_prix: string | null;
  nps: string | null;
  commentaire: string | null;
};

export type FeedbackPayload = {
  sync_id: string;
  accueil: number | null;
  lavage: string | null;
  lavage_detail: string[];
  attente: string | null;
  lounge: number | null;
  qualite_prix: string | null;
  nps: string | null;
  commentaire: string;
};