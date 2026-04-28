## Refactor Piani di Trattamento

Trasformazione del pannello "Piani" da blocco singolo a struttura clinica `Piano → Righe trattamento → Sedute → Prodotti previsti`.

### Decisioni chiave (confermate)

- **Titolo piano**: auto-generato come `Piano <dd/mm/yyyy> — <Trattamento1>, <Trattamento2>` (colonna `piano_trattamento.titolo` resta NOT NULL, popolata in scrittura).
- **Prodotti**: persistiti come JSONB sia su `piano_trattamento_voce.prodotti_previsti` sia su `seduta.prodotti_previsti` (copia per valore — nessuna mutazione condivisa).
- **Stato seduta**: nessuna nuova colonna; `completata=false` = "programmata", derivato in UI.
- **Consensi DB**: invariati. Riuso `puoEseguireTrattamento` / `has_consenso_valido`.

### 1. Migrazione DB (minimale)

Una sola migrazione SQL:

```sql
ALTER TABLE public.piano_trattamento_voce
  ADD COLUMN IF NOT EXISTS prodotti_previsti jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.seduta
  ADD COLUMN IF NOT EXISTS prodotti_previsti jsonb NOT NULL DEFAULT '[]'::jsonb;
```

Forma JSONB:
```json
[{ "nome": "Hyalual 1.8%", "quantita": 1, "trattamento_id": "uuid-opzionale" }]
```

Nessun cambio enum, nessuna nuova tabella, nessun trigger.

### 2. Mock prodotti (FASE 2)

Nuovo file `src/lib/prodotti-demo.ts`:
- Array statico `PRODOTTI_DEMO` con ~10 voci coerenti coi trattamenti già a DB (Vistabex, Hyalual 1.8%, filler vari, biostimolanti).
- Esportata anche una funzione di filtro per trattamento (anche se per ora ritorna tutto).
- Commento esplicito: "PLACEHOLDER — sostituire con tabella `prodotti` quando si introdurrà il magazzino".

### 3. Refactor `src/components/paziente/piani-panel.tsx`

#### Stato dialog "Nuovo piano"
Sostituire campi `titolo / tratId / numSedute / prezzo / note` con:

```ts
type RigaForm = {
  uid: string;                // uuid client-side per react key
  trattamento_id: string;     // obbligatorio
  numero_sedute: number;      // default da tipo trattamento
  prodotti: { uid: string; nome: string; quantita: number }[];
  consensoOk: boolean | null; // null = non ancora valutato
  consensoLoading: boolean;
};

const [righe, setRighe] = useState<RigaForm[]>([]);
```

#### UI dialog
- `Dialog` allargato a `max-w-2xl`, `max-h-[85vh]` con scroll.
- Bottone full-width `+ Aggiungi trattamento al piano` (apre nuova riga vuota).
- Per ogni riga, una `Card` interna con:
  - Header: `Select` trattamento (no "— Nessuno —"), bottone trash per rimuovere riga.
  - Riga 2: `Input number` "Sedute" + badge stato consenso + bottone "Firma consenso" (disabled se trattamento non scelto o consenso ok).
  - Sezione "Prodotti previsti": lista righe `[Select prodotto] [Input quantita step=0.1] [trash]` + bottone `+ Aggiungi prodotto`.
- Default `numero_sedute` calcolato `onChange` del trattamento:
  - `tipo === 'ciclo'` → `durata_ciclo_valore ?? 3`
  - altrimenti → `1`

#### Stato consenso inline
- `useEffect` dipendente da `riga.trattamento_id`: chiama `puoEseguireTrattamento(pazienteId, trattamento_id)` e popola `consensoOk` + tooltip motivi.
- Badge: `🟢 Consenso valido` / `🔴 Consenso mancante` / `…` durante loading.

#### Bottone "Firma consenso" per riga
- Apre il `SignatureSessionDialog` esistente in modalità "trattamento" passando `trattamentoId` della riga (riuso `firma-trattamento-launcher` come pattern di riferimento, **senza modificare** `signature-session-dialog`).
- Alla chiusura del dialog firma, ri-valutare `puoEseguireTrattamento` per quella riga.

#### Validazione + salvataggio
`creaPiano()` riscritto:
1. Blocca se `righe.length === 0` → toast `"Aggiungi almeno un trattamento al piano"`.
2. Blocca se qualche riga ha `trattamento_id` vuoto.
3. Warning (non blocco) se una riga ha `prodotti.length === 0` → `toast.warning`.
4. Calcola titolo auto: `` `Piano ${dd/mm/yyyy} — ${nomi.join(", ")}` ``.
5. `INSERT` su `piano_trattamento` con: `paziente_id`, `titolo`, `numero_sedute_previste = somma sedute righe`, `trattamento_id = null` (multi-trattamento), `created_by`.
6. Per ogni riga, `INSERT` su `piano_trattamento_voce`: `piano_id`, `trattamento_id`, `numero_sedute`, `prezzo_unitario=0`, `prezzo_riga=0`, `ordine=i`, `prodotti_previsti = JSON delle righe prodotti`.
7. Per ogni riga, generare N record `seduta` con: `piano_id`, `paziente_id`, `trattamento_id`, `voce_id`, `numero_seduta = 1..N`, `prodotti_previsti = copia JSON dalla voce` (deep clone per garantire indipendenza), `completata=false`.

Tutte le insert dentro un blocco try/catch con toast d'errore singolo. Nessuna transazione (Supabase JS non la supporta lato client) — accettiamo idempotenza best-effort, in errore mostriamo messaggio chiaro.

#### Visualizzazione piani esistenti (FASE 6 + FASE 9 backward compatibility)
Caricare anche `piano_trattamento_voce` (con il loro `prodotti_previsti`) accanto ai piani:

```ts
const [vociPerPiano, setVociPerPiano] = useState<Record<string, VoceConProdotti[]>>({});
```

Render espanso del piano:
- Se `voci.length > 0` → render multi-riga: per ogni voce mostra `Trattamento`, `N sedute (X completate)`, badge consenso (calcolato lazy on-expand), lista prodotti previsti.
- Se `voci.length === 0` (piani vecchi, "fallback semplice") → render attuale legacy basato su `piano.trattamento_id` + sedute, **senza crash**, senza sezione prodotti.

Mantenere bottoni esistenti `Aggiungi seduta` (resta valido, aggiunge a fine lista; per piani nuovi assocerà alla prima voce o richiede selezione voce — per ora lo lasciamo legato al `piano_id` come oggi).

### 4. Tipi TS

Aggiungere a `src/types/trattamenti.ts`:

```ts
export interface ProdottoPrevisto {
  nome: string;
  quantita: number;
  trattamento_id?: string | null;
}

export interface PianoVoce {
  id: string;
  piano_id: string;
  trattamento_id: string;
  pacchetto_id: string | null;
  numero_sedute: number;
  prezzo_unitario: number;
  prezzo_riga: number;
  ordine: number;
  prodotti_previsti: ProdottoPrevisto[];
  created_at: string;
}
```

E aggiungere `prodotti_previsti: ProdottoPrevisto[]` a `Seduta`. (Dopo la migrazione `src/integrations/supabase/types.ts` viene rigenerato in automatico, ma il tipo applicativo locale serve per i parsing JSON.)

### 5. Cosa NON cambia

- `signature-session-dialog.tsx`: invariato.
- `consensi-engine`, `access-guard`, RLS, RPC, triggers consensi: invariati.
- Nessuna nuova tabella, nessun magazzino, nessun collegamento a stock.
- `consensi-panel`, `anamnesi-panel`: invariati.

### 6. Diagramma flusso "Nuovo piano"

```text
[+ Aggiungi trattamento]
   │
   ▼
┌─────────────────────────────────────────┐
│ Riga 1                            [🗑]  │
│ Trattamento: [Filler XYZ        ▼]     │
│ Sedute: [1]    🟢 Consenso valido      │
│                       [Firma consenso] │
│ Prodotti previsti:                     │
│   • Hyalual 1.8%   qta [1.0]   [🗑]    │
│   • Filler XYZ     qta [1.0]   [🗑]    │
│   [+ Aggiungi prodotto]                │
└─────────────────────────────────────────┘
[+ Aggiungi trattamento]
                                 [Crea piano]
```

### 7. File toccati

- `supabase/migrations/<timestamp>_piano_voce_prodotti.sql` (nuovo)
- `src/lib/prodotti-demo.ts` (nuovo)
- `src/types/trattamenti.ts` (aggiunte tipi `ProdottoPrevisto`, `PianoVoce`, campo su `Seduta`)
- `src/components/paziente/piani-panel.tsx` (refactor profondo, dialog + render)

### 8. Rischi & mitigazioni

- **Race insert voci/sedute**: se l'insert sedute fallisce dopo le voci, il piano resta inconsistente. Mitigazione: log su console + toast `"Piano creato ma errore generazione sedute: riprovare aggiunta seduta manualmente"`. Accettabile perché la struttura voci basta per ricostruire.
- **Tipi Supabase rigenerati**: dopo migrazione i tipi auto-generati conterranno `prodotti_previsti: Json`. Casteremo localmente a `ProdottoPrevisto[]` con un parser difensivo.
- **Piani vecchi senza voci**: il blocco "fallback legacy" garantisce zero crash; verificato che `vociPerPiano[id] ?? []` produce render alternativo.
