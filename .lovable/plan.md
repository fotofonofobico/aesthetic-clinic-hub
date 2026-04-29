## Modulo Calendario — non invasivo

### Principio
Il calendario è un **layer di lettura aggiuntivo** sopra le entità esistenti + una **nuova entità isolata** (`evento_calendario`). Zero modifiche a `seduta`, `piano_trattamento`, `magazzino_movimento`, `prodotto_lotto`, `paziente_nota`. Nessun trigger nuovo sulle tabelle core.

---

### 1. Database — solo entità nuove

**Nuova tabella `evento_calendario`** (isolata, RLS standard operatore attivo):
- `id`, `created_at`, `updated_at`, `created_by`
- `titolo` (text, obbligatorio)
- `descrizione` (text, opzionale)
- `data_inizio` (timestamptz), `data_fine` (timestamptz, opzionale)
- `tutto_il_giorno` (boolean, default false)
- `tipo` enum: `promemoria | follow_up | attivita | altro`
- `paziente_id` (uuid, nullable — link soft, no FK cascade duro lato app)
- `seduta_id` (uuid, nullable — solo riferimento per follow-up generati)
- `colore` (text, opzionale)
- `completato` (boolean, default false)
- `sincronizza_diario` (boolean, default false) — flag manuale richiesto dall'utente
- `nota_diario_id` (uuid, nullable) — popolato se l'evento ha generato una nota

**Nuova tabella `calendario_preferenze`** (1 riga per utente):
- `user_id` (PK), `followup_auto_attivo` (bool default false), `followup_giorni_offset` (int default 7), `vista_default` (text: `settimana|giorno`)

**Nessuna modifica a tabelle esistenti.** Le scadenze lotti e le sedute si leggono via SELECT normali — non si toccano i loro schemi.

---

### 2. Sorgenti eventi (tutte aggregate client-side / via server function)

| Sorgente | Origine | Scrittura | Drag&drop |
|---|---|---|---|
| Sedute pianificate | `seduta.data_seduta` | read-only | NO (preparato per il futuro) |
| Promemoria/attività/eventi paziente | `evento_calendario` | full CRUD | SI |
| Follow-up auto | `evento_calendario` (tipo=follow_up) | generato opzionalmente | SI |
| Scadenze lotti | `prodotto_lotto.data_scadenza` | read-only | NO |

Una server function `getCalendarioEventi({ from, to, filtri })` ritorna l'array unificato già normalizzato (`{ id, source, titolo, start, end, color, paziente_id?, meta }`). Le pagine esistenti non la chiamano mai.

---

### 3. UI

**Nuova rotta `/calendario`** (`src/routes/_authenticated/calendario.tsx`):
- Vista **Settimana** (default) e **Giorno**, toggle in header
- Filtri: tipo evento (sedute/promemoria/follow-up/scadenze), paziente (search)
- Drag & drop SOLO eventi `evento_calendario` (sedute disabilitate con tooltip "Modifica dalla scheda paziente")
- Click su evento seduta → naviga a `/pazienti/$id` (no editing inline)
- Click su evento calendario → dialog edit (titolo, data, paziente opzionale, flag "sincronizza nel diario")
- Bottone "+ Nuovo evento" sempre visibile, nessun popup bloccante

**Widget dashboard** (`CalendarioWidget` in `dashboard.tsx`):
- Card compatta "Prossimi 7 giorni" con max 6 prossimi eventi
- Link "Apri calendario" → `/calendario`
- Skeleton di caricamento, nessun blocco se la query fallisce

**Componenti nuovi** (cartella isolata `src/components/calendario/`):
- `calendario-vista.tsx` — vista settimana/giorno con grid oraria
- `calendario-evento-card.tsx` — render singolo evento per tipo
- `evento-edit-dialog.tsx` — crea/modifica `evento_calendario`
- `calendario-widget.tsx` — widget dashboard
- `calendario-filtri.tsx` — barra filtri
- `use-calendario-eventi.ts` — hook che chiama la server function

Libreria drag&drop: `@dnd-kit/core` (già leggera, no dipendenze pesanti tipo fullcalendar). Niente librerie calendar pre-fatte → controllo totale UX e zero stili invasivi.

---

### 4. Sincronizzazione diario (manuale con flag)

- Nel dialog evento: checkbox **"Crea/aggiorna nota nel diario paziente"** (visibile solo se `paziente_id` impostato)
- Su salvataggio con flag attivo: server function inserisce/aggiorna riga in `paziente_nota` (tipo `clinica`, `auto_generata=true`) e salva l'`id` in `evento_calendario.nota_diario_id`
- Su unflag o delete evento: la nota collegata viene eliminata (solo se `auto_generata=true` e creata dal calendario)
- Le note esistenti del diario **non** diventano automaticamente eventi (decisione utente)

---

### 5. Follow-up automatici (opt-in)

- Disattivati di default in `calendario_preferenze`
- Quando attivi: alla creazione di una nota con `seduta_id` (post-completamento), una server function `creaFollowupSePrevisto` crea un `evento_calendario` tipo `follow_up` a `data_seduta + N giorni`
- **Non chiamata da trigger DB** → invocata esplicitamente da un piccolo hook lato client dopo il completamento seduta, in `try/catch` silenzioso. Se fallisce, la seduta è già salvata.
- Toggle nelle preferenze utente (pagina `/calendario` → menu impostazioni)

---

### 6. Architettura per future estensioni (preparata, non attiva)

- La server function di update evento accetta un parametro `target` (oggi solo `evento_calendario`). Quando in futuro si vorrà spostare sedute, basterà aggiungere `seduta` come target con conferma + log in `seduta_modifica`.
- Tabella `seduta_modifica` esiste già → il futuro audit del drag su sedute riusa quella infrastruttura.

---

### 7. Sicurezza & performance

- RLS su `evento_calendario` e `calendario_preferenze`: pattern identico alle altre tabelle (`is_active_operator`)
- Query calendario range-bound (sempre con `data_inizio between from and to`) + indici su `data_inizio`, `paziente_id`
- Widget dashboard: query separata limit 6, non bloccante
- Nessun import nei file di `sedute-panel`, `piani-panel`, `consumo-step`, `magazzino`, `paziente-tab` → isolamento garantito

---

### 8. Cosa NON faccio (per esplicito rispetto del principio)

- Nessuna modifica a `seduta`, `piano_trattamento`, `prodotto_lotto`, `paziente_nota`, `magazzino_movimento`
- Nessun trigger DB nuovo sulle tabelle core
- Nessuna multi-sede (non esiste oggi nel progetto — verificato)
- Nessun blocco UX: tutti gli alert calendario sono toast informativi
- Nessun cambio ai flussi consensi/foto/baseline appena costruiti

---

### File previsti

**Nuovi:**
- `supabase/migrations/<ts>_calendario.sql` (2 tabelle + RLS + indici)
- `src/types/calendario.ts`
- `src/lib/calendario.ts` (helpers normalizzazione eventi)
- `src/server/calendario.functions.ts` (server functions: get/create/update/delete + follow-up)
- `src/components/calendario/*` (5 componenti elencati sopra)
- `src/hooks/use-calendario-eventi.ts`
- `src/routes/_authenticated/calendario.tsx`

**Modificati (minimi, additivi):**
- `src/routes/_authenticated/dashboard.tsx` → aggiunta `<CalendarioWidget />` + link
- `package.json` → aggiunta `@dnd-kit/core` e `@dnd-kit/sortable`
- `src/components/paziente/sedute-panel.tsx` → SOLO una chiamata `try/catch` a `creaFollowupSePrevisto` dopo completamento (zero modifiche al flusso esistente, fallimento silenzioso)

Pronto a procedere appena approvi.