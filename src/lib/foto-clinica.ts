import { supabase } from "@/integrations/supabase/client";
import type {
  FotoClinica,
  FotoMomento,
  PianoFotoStatoRow,
} from "@/types/foto-clinica";

const BUCKET = "foto-cliniche";

async function requireUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;
  const { data: r, error } = await supabase.auth.refreshSession();
  if (error || !r.session?.user) {
    throw new Error("Sessione scaduta — ricarica la pagina e rifai il login");
  }
  return r.session.user.id;
}

function buildPath(paziente_id: string, piano_id: string, file: File) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const rand = Math.random().toString(36).slice(2);
  const ts = Date.now();
  return `${paziente_id}/${piano_id}/${ts}-${rand}.${ext}`;
}

export async function uploadFoto(input: {
  paziente_id: string;
  piano_id: string;
  seduta_id?: string | null;
  momento: FotoMomento;
  zona?: string | null;
  data_scatto: string; // YYYY-MM-DD
  note?: string | null;
  file: File;
}): Promise<FotoClinica> {
  const uid = await requireUserId();
  const path = buildPath(input.paziente_id, input.piano_id, input.file);

  const up = await supabase.storage.from(BUCKET).upload(path, input.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: input.file.type || "image/jpeg",
  });
  if (up.error) throw up.error;

  const { data, error } = await supabase
    .from("foto_clinica")
    .insert({
      paziente_id: input.paziente_id,
      piano_id: input.piano_id,
      seduta_id: input.seduta_id ?? null,
      momento: input.momento,
      zona: input.zona ?? null,
      storage_path: path,
      data_scatto: input.data_scatto,
      note: input.note ?? null,
      created_by: uid,
    })
    .select("*")
    .single();

  if (error) {
    // rollback storage
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return data as unknown as FotoClinica;
}

export async function listFotoByPiano(piano_id: string): Promise<FotoClinica[]> {
  const { data, error } = await supabase
    .from("foto_clinica")
    .select("*")
    .eq("piano_id", piano_id)
    .order("data_scatto", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FotoClinica[];
}

export async function listFotoByPaziente(paziente_id: string): Promise<FotoClinica[]> {
  const { data, error } = await supabase
    .from("foto_clinica")
    .select("*")
    .eq("paziente_id", paziente_id)
    .order("data_scatto", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as FotoClinica[];
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteFoto(foto: FotoClinica): Promise<void> {
  const { error } = await supabase.from("foto_clinica").delete().eq("id", foto.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([foto.storage_path]);
}

export async function listStatoPiani(piano_ids: string[]): Promise<Record<string, PianoFotoStatoRow>> {
  if (piano_ids.length === 0) return {};
  const { data, error } = await supabase
    .from("piano_foto_stato")
    .select("*")
    .in("piano_id", piano_ids);
  if (error) throw error;
  const map: Record<string, PianoFotoStatoRow> = {};
  for (const r of (data ?? []) as unknown as PianoFotoStatoRow[]) {
    map[r.piano_id] = r;
  }
  return map;
}

export async function getStatoPiano(piano_id: string): Promise<PianoFotoStatoRow | null> {
  const { data, error } = await supabase
    .from("piano_foto_stato")
    .select("*")
    .eq("piano_id", piano_id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PianoFotoStatoRow) ?? null;
}

export async function marcaNonEseguibile(piano_id: string, motivazione: string): Promise<void> {
  await requireUserId();
  const { error } = await supabase.rpc("piano_foto_marca_non_eseguibile", {
    _piano_id: piano_id,
    _motivazione: motivazione,
  });
  if (error) throw error;
}

export async function riapriPiano(piano_id: string): Promise<void> {
  await requireUserId();
  const { error } = await supabase.rpc("piano_foto_riapri", { _piano_id: piano_id });
  if (error) throw error;
}
