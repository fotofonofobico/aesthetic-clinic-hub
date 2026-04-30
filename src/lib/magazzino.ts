import { supabase } from "@/integrations/supabase/client";
import type {
  Fornitore,
  Lotto,
  Marca,
  ModalitaTracking,
  Movimento,
  Prodotto,
  ProdottoConDettagli,
  RigaConsumo,
} from "@/types/magazzino";

/**
 * Garantisce che il client supabase abbia una sessione utente attiva
 * e ritorna l'user.id. Se la sessione manca, tenta un refresh esplicito.
 * Necessario perché alcune RLS richiedono auth.uid() valorizzato.
 */
async function requireUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;
  const { data: r, error } = await supabase.auth.refreshSession();
  if (error || !r.session?.user) {
    throw new Error("Sessione scaduta — ricarica la pagina e rifai il login");
  }
  return r.session.user.id;
}

// ============================================================
// MARCHE
// ============================================================
export async function listMarche(soloAttive = true): Promise<Marca[]> {
  let q = supabase.from("prodotto_marca").select("*").order("nome", { ascending: true });
  if (soloAttive) q = q.eq("attiva", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Marca[];
}

export async function creaMarca(nome: string): Promise<Marca> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from("prodotto_marca")
    .insert({ nome: nome.trim(), created_by: uid })
    .select()
    .single();
  if (error) throw error;
  return data as Marca;
}

export async function disattivaMarca(id: string): Promise<void> {
  const { error } = await supabase.from("prodotto_marca").update({ attiva: false }).eq("id", id);
  if (error) throw error;
}

export async function riattivaMarca(id: string): Promise<void> {
  const { error } = await supabase.from("prodotto_marca").update({ attiva: true }).eq("id", id);
  if (error) throw error;
}

// ============================================================
// FORNITORI
// ============================================================
export async function listFornitori(soloAttivi = true): Promise<Fornitore[]> {
  let q = supabase.from("prodotto_fornitore").select("*").order("nome", { ascending: true });
  if (soloAttivi) q = q.eq("attivo", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Fornitore[];
}

export async function creaFornitore(input: {
  nome: string;
  contatti?: Fornitore["contatti"];
}): Promise<Fornitore> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from("prodotto_fornitore")
    .insert({ nome: input.nome.trim(), contatti: input.contatti ?? {}, created_by: uid })
    .select()
    .single();
  if (error) throw error;
  return data as Fornitore;
}

export async function aggiornaFornitore(
  id: string,
  patch: Partial<Pick<Fornitore, "nome" | "contatti" | "attivo">>,
): Promise<void> {
  const { error } = await supabase.from("prodotto_fornitore").update(patch).eq("id", id);
  if (error) throw error;
}

// ============================================================
// PRODOTTI
// ============================================================
export interface ListProdottiOptions {
  search?: string;
  modalita?: ModalitaTracking | null;
  marca_id?: string | null;
  includiStandby?: boolean;
  includiInattivi?: boolean;
}

export async function listProdotti(opt: ListProdottiOptions = {}): Promise<ProdottoConDettagli[]> {
  let q = supabase
    .from("prodotto")
    .select("*, marca:marca_id(*), fornitore:fornitore_id(*)")
    .order("nome", { ascending: true });

  if (!opt.includiInattivi) q = q.eq("attivo", true);
  if (!opt.includiStandby) q = q.neq("modalita_tracking", "standby");
  if (opt.modalita) q = q.eq("modalita_tracking", opt.modalita);
  if (opt.marca_id) q = q.eq("marca_id", opt.marca_id);
  if (opt.search && opt.search.trim()) q = q.ilike("nome", `%${opt.search.trim()}%`);

  const { data, error } = await q;
  if (error) throw error;

  // Aggrega quantità da lotti per ogni prodotto
  const prodotti = (data ?? []) as ProdottoConDettagli[];
  if (prodotti.length === 0) return prodotti;

  const ids = prodotti.map((p) => p.id);
  const { data: lotti, error: errL } = await supabase
    .from("prodotto_lotto")
    .select("prodotto_id, quantita_disponibile, data_scadenza")
    .in("prodotto_id", ids);
  if (errL) throw errL;

  const map = new Map<string, { qta: number; n: number; minScad: string | null }>();
  for (const l of lotti ?? []) {
    const cur = map.get(l.prodotto_id as string) ?? { qta: 0, n: 0, minScad: null };
    cur.qta += Number(l.quantita_disponibile ?? 0);
    if (Number(l.quantita_disponibile ?? 0) > 0) cur.n += 1;
    if (l.data_scadenza && (!cur.minScad || l.data_scadenza < cur.minScad)) {
      cur.minScad = l.data_scadenza as string;
    }
    map.set(l.prodotto_id as string, cur);
  }

  return prodotti.map((p) => ({
    ...p,
    qta_totale: map.get(p.id)?.qta ?? 0,
    num_lotti: map.get(p.id)?.n ?? 0,
    lotto_min_scadenza: map.get(p.id)?.minScad ?? null,
  }));
}

export interface CreaProdottoInput {
  nome: string;
  tipologia?: string | null;
  marca_id?: string | null;
  fornitore_id?: string | null;
  unita_misura: string;
  costo_unitario_default?: number | null;
  soglia_minima?: number;
  modalita_tracking?: ModalitaTracking;
  note?: string | null;
}

export async function creaProdotto(input: CreaProdottoInput): Promise<Prodotto> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from("prodotto")
    .insert({
      nome: input.nome.trim(),
      tipologia: input.tipologia ?? null,
      marca_id: input.marca_id ?? null,
      fornitore_id: input.fornitore_id ?? null,
      unita_misura: input.unita_misura || "pz",
      costo_unitario_default: input.costo_unitario_default ?? null,
      soglia_minima: input.soglia_minima ?? 0,
      modalita_tracking: input.modalita_tracking ?? "solo_uso",
      note: input.note ?? null,
      created_by: uid,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Prodotto;
}

export async function aggiornaProdotto(
  id: string,
  patch: Partial<Omit<Prodotto, "id" | "created_at" | "updated_at" | "created_by">>,
): Promise<void> {
  const { error } = await supabase.from("prodotto").update(patch).eq("id", id);
  if (error) throw error;
}

export async function cambiaModalita(id: string, modalita: ModalitaTracking): Promise<void> {
  await aggiornaProdotto(id, { modalita_tracking: modalita });
}

export async function disattivaProdotto(id: string): Promise<void> {
  await aggiornaProdotto(id, { attivo: false });
}

/** Lista tipologie distinte già usate nei prodotti (per combobox) */
export async function listTipologie(): Promise<string[]> {
  const { data, error } = await supabase
    .from("prodotto")
    .select("tipologia")
    .not("tipologia", "is", null);
  if (error) throw error;
  const set = new Set<string>();
  for (const r of data ?? []) {
    const t = (r.tipologia as string | null)?.trim();
    if (t) set.add(t);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// ============================================================
// LOTTI
// ============================================================
export async function listLotti(opt: { prodotto_id?: string; includiEsauriti?: boolean } = {}): Promise<Lotto[]> {
  let q = supabase
    .from("prodotto_lotto")
    .select("*")
    .order("data_scadenza", { ascending: true, nullsFirst: false });
  if (opt.prodotto_id) q = q.eq("prodotto_id", opt.prodotto_id);
  if (!opt.includiEsauriti) q = q.gt("quantita_disponibile", 0);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Lotto[];
}

export async function listLottiPerProdotti(prodotto_ids: string[]): Promise<Lotto[]> {
  if (prodotto_ids.length === 0) return [];
  const { data, error } = await supabase
    .from("prodotto_lotto")
    .select("*")
    .in("prodotto_id", prodotto_ids)
    .gt("quantita_disponibile", 0)
    .order("data_scadenza", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Lotto[];
}

export interface CreaLottoInput {
  prodotto_id: string;
  numero_lotto: string;
  data_scadenza?: string | null;
  quantita: number;
  costo_unitario?: number | null;
  note?: string | null;
}

/** Crea lotto + movimento di carico */
export async function creaLotto(input: CreaLottoInput): Promise<Lotto> {
  const uid = await requireUserId();
  const { data, error } = await supabase
    .from("prodotto_lotto")
    .insert({
      prodotto_id: input.prodotto_id,
      numero_lotto: input.numero_lotto.trim(),
      data_scadenza: input.data_scadenza ?? null,
      quantita_iniziale: 0, // verrà aggiornata dal trigger sul carico
      quantita_disponibile: 0,
      costo_unitario: input.costo_unitario ?? null,
      note: input.note ?? null,
      created_by: uid,
    })
    .select()
    .single();
  if (error) throw error;

  // Movimento di carico
  const { error: errM } = await supabase.from("magazzino_movimento").insert({
    prodotto_id: input.prodotto_id,
    lotto_id: data.id,
    tipo: "carico",
    quantita: input.quantita,
    costo_unitario: input.costo_unitario ?? null,
    operatore_id: uid,
    note: "Carico iniziale lotto",
  });
  if (errM) throw errM;

  return data as Lotto;
}

export async function aggiungiCarico(
  lotto_id: string,
  prodotto_id: string,
  quantita: number,
  costo?: number | null,
): Promise<void> {
  const uid = await requireUserId();
  const { error } = await supabase.from("magazzino_movimento").insert({
    prodotto_id,
    lotto_id,
    tipo: "carico",
    quantita,
    costo_unitario: costo ?? null,
    operatore_id: uid,
    note: "Ricarico lotto esistente",
  });
  if (error) throw error;
}

export async function registraScaricoManuale(input: {
  lotto_id: string;
  prodotto_id: string;
  quantita: number;
  tipo: "scarico" | "scarto_scadenza";
  motivazione: string;
}): Promise<void> {
  const uid = await requireUserId();
  const { error } = await supabase.from("magazzino_movimento").insert({
    prodotto_id: input.prodotto_id,
    lotto_id: input.lotto_id,
    tipo: input.tipo,
    quantita: input.quantita,
    operatore_id: uid,
    motivazione: input.motivazione,
    note: input.tipo === "scarto_scadenza" ? "Scarto per scadenza" : "Scarico manuale",
  });
  if (error) throw error;
}

export async function rettificaInventario(input: {
  lotto_id: string;
  prodotto_id: string;
  quantita_attuale: number;
  quantita_reale: number;
  motivazione: string;
}): Promise<void> {
  if (input.motivazione.trim().length < 10) {
    throw new Error("Motivazione richiesta (almeno 10 caratteri)");
  }
  const delta = input.quantita_reale - input.quantita_attuale;
  if (delta === 0) return;
  const uid = await requireUserId();
  const { error } = await supabase.from("magazzino_movimento").insert({
    prodotto_id: input.prodotto_id,
    lotto_id: input.lotto_id,
    tipo: delta > 0 ? "rettifica_pos" : "rettifica_neg",
    quantita: Math.abs(delta),
    operatore_id: uid,
    motivazione: input.motivazione,
    note: `Inventario: da ${input.quantita_attuale} a ${input.quantita_reale}`,
  });
  if (error) throw error;
}

// ============================================================
// MOVIMENTI
// ============================================================
export interface ListMovimentiOptions {
  prodotto_id?: string;
  lotto_id?: string;
  paziente_id?: string;
  seduta_id?: string;
  tipo?: Movimento["tipo"];
  dal?: string;
  al?: string;
  limit?: number;
}

export async function listMovimenti(opt: ListMovimentiOptions = {}): Promise<Movimento[]> {
  let q = supabase
    .from("magazzino_movimento")
    .select("*")
    .order("data_movimento", { ascending: false })
    .limit(opt.limit ?? 500);
  if (opt.prodotto_id) q = q.eq("prodotto_id", opt.prodotto_id);
  if (opt.lotto_id) q = q.eq("lotto_id", opt.lotto_id);
  if (opt.paziente_id) q = q.eq("paziente_id", opt.paziente_id);
  if (opt.seduta_id) q = q.eq("seduta_id", opt.seduta_id);
  if (opt.tipo) q = q.eq("tipo", opt.tipo);
  if (opt.dal) q = q.gte("data_movimento", opt.dal);
  if (opt.al) q = q.lte("data_movimento", opt.al);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Movimento[];
}

// ============================================================
// CONSUMO SEDUTA (chiama RPC)
// ============================================================
export async function consumaSeduta(
  seduta_id: string,
  righe: RigaConsumo[],
): Promise<{ ok: boolean; warnings?: string[]; skipped?: boolean }> {
  // Per le righe con nuovo_lotto, prima crea il lotto, poi sostituisci con lotto_id
  const righeFinali: { prodotto_id: string; lotto_id: string | null; quantita: number }[] = [];
  for (const r of righe) {
    if (r.quantita <= 0) continue;
    if (r.nuovo_lotto) {
      const lotto = await creaLotto({
        prodotto_id: r.prodotto_id,
        numero_lotto: r.nuovo_lotto.numero_lotto,
        data_scadenza: r.nuovo_lotto.data_scadenza ?? null,
        quantita: r.quantita, // carico esattamente la qta che consumerò
        costo_unitario: r.nuovo_lotto.costo ?? null,
      });
      righeFinali.push({ prodotto_id: r.prodotto_id, lotto_id: lotto.id, quantita: r.quantita });
    } else {
      righeFinali.push({
        prodotto_id: r.prodotto_id,
        lotto_id: r.lotto_id ?? null,
        quantita: r.quantita,
      });
    }
  }

  const { data, error } = await supabase.rpc("magazzino_consuma_seduta", {
    _seduta_id: seduta_id,
    _righe: righeFinali as unknown as never,
  });
  if (error) throw error;
  return (data ?? { ok: true }) as { ok: boolean; warnings?: string[]; skipped?: boolean };
}

export async function ripristinaSeduta(seduta_id: string): Promise<void> {
  const { error } = await supabase.rpc("magazzino_ripristina_seduta", { _seduta_id: seduta_id });
  if (error) throw error;
}

// ============================================================
// DASHBOARD
// ============================================================
export interface DashboardData {
  valore_totale: number;
  in_scadenza: number;
  sotto_soglia: number;
  rettifiche_mese: number;
  top_usati: { prodotto_id: string; nome: string; totale: number }[];
}

export async function dashboardMagazzino(): Promise<DashboardData> {
  // Valore totale (solo prodotti tracciati)
  const { data: prodTrac, error: e1 } = await supabase
    .from("prodotto")
    .select("id, soglia_minima")
    .eq("modalita_tracking", "tracciato")
    .eq("attivo", true);
  if (e1) throw e1;
  const tracIds = (prodTrac ?? []).map((p) => p.id as string);

  let valore = 0;
  let inScadenza = 0;
  let sottoSoglia = 0;

  if (tracIds.length > 0) {
    const { data: lotti, error: e2 } = await supabase
      .from("prodotto_lotto")
      .select("prodotto_id, quantita_disponibile, costo_unitario, data_scadenza")
      .in("prodotto_id", tracIds)
      .gt("quantita_disponibile", 0);
    if (e2) throw e2;

    const ora = Date.now();
    const soglieMap = new Map<string, number>();
    for (const p of prodTrac ?? []) soglieMap.set(p.id as string, Number(p.soglia_minima ?? 0));
    const qtaPerProd = new Map<string, number>();

    for (const l of lotti ?? []) {
      const qta = Number(l.quantita_disponibile ?? 0);
      const costo = Number(l.costo_unitario ?? 0);
      valore += qta * costo;
      if (l.data_scadenza) {
        const diff = (new Date(l.data_scadenza).getTime() - ora) / (1000 * 60 * 60 * 24);
        if (diff < 30) inScadenza += 1;
      }
      qtaPerProd.set(
        l.prodotto_id as string,
        (qtaPerProd.get(l.prodotto_id as string) ?? 0) + qta,
      );
    }
    for (const [pid, qta] of qtaPerProd) {
      const s = soglieMap.get(pid) ?? 0;
      if (s > 0 && qta <= s) sottoSoglia += 1;
    }
  }

  // Rettifiche ultimo mese
  const meseFa = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: rettCount, error: e3 } = await supabase
    .from("magazzino_movimento")
    .select("id", { count: "exact", head: true })
    .in("tipo", ["rettifica_pos", "rettifica_neg"])
    .gte("data_movimento", meseFa);
  if (e3) throw e3;

  // Top usati 90gg (scarichi)
  const novantaFa = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: scarichi, error: e4 } = await supabase
    .from("magazzino_movimento")
    .select("prodotto_id, quantita")
    .eq("tipo", "scarico")
    .gte("data_movimento", novantaFa);
  if (e4) throw e4;

  const topMap = new Map<string, number>();
  for (const m of scarichi ?? []) {
    topMap.set(
      m.prodotto_id as string,
      (topMap.get(m.prodotto_id as string) ?? 0) + Number(m.quantita ?? 0),
    );
  }
  const topIds = Array.from(topMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let topUsati: DashboardData["top_usati"] = [];
  if (topIds.length > 0) {
    const { data: nomi, error: e5 } = await supabase
      .from("prodotto")
      .select("id, nome")
      .in("id", topIds.map((t) => t[0]));
    if (e5) throw e5;
    const nomeMap = new Map((nomi ?? []).map((n) => [n.id as string, n.nome as string]));
    topUsati = topIds.map(([pid, qta]) => ({
      prodotto_id: pid,
      nome: nomeMap.get(pid) ?? "?",
      totale: qta,
    }));
  }

  return {
    valore_totale: valore,
    in_scadenza: inScadenza,
    sotto_soglia: sottoSoglia,
    rettifiche_mese: rettCount ?? 0,
    top_usati: topUsati,
  };
}
