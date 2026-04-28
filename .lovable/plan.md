## Refactor Piano: prezzo+sconto, zone, modifica, alert consenso, auto-stato

Iterazione sul `PianiPanel` con migrazione DB minimale. La sezione "Sedute" come esecuzione reale è esplicitamente rimandata a un turno successivo.

### 1. Migrazione DB

Una sola migrazione SQL:

```sql
-- Sconto e prezzo finale piano
ALTER TABLE public.piano_trattamento
  ADD COLUMN IF NOT EXISTS sconto_tipo text NOT NULL DEFAULT 'nessuno'
    CHECK (sconto_tipo IN ('nessuno','euro','percento')),
  ADD COLUMN IF NOT EXISTS sconto_valore numeric NOT NULL DEFAULT 0;
-- prezzo_totale e prezzo_finale già esistenti vengono ricalcolati lato client

-- Zone trattate sulla riga
ALTER TABLE public.piano_trattamento_voce
  ADD COLUMN IF NOT EXISTS zone jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Forma: ["glabella","zampe gallina","zona custom"]

-- Trigger: quando tutte le sedute di un piano sono completata=true,
-- imposta piano.stato='completato'. Se il piano è 'completato' e una
-- seduta torna a completata=false, riporta a 'attivo'.
CREATE OR REPLACE FUNCTION public.piano_auto_stato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  pid uuid := COALESCE(NEW.piano_id, OLD.piano_id);
  tot int;
  done int;
  cur_stato piano_stato;
BEGIN
  SELECT stato INTO cur_stato FROM piano_trattamento WHERE id = pid;
  IF cur_stato IN ('sospeso','annullato') THEN RETURN NEW; END IF;
  SELECT count(*), count(*) FILTER (WHERE completata) INTO tot, done
    FROM seduta WHERE piano_id = pid;
  IF tot > 0 AND done = tot THEN
    UPDATE piano_trattamento SET stato='completato' WHERE id=pid AND stato<>'completato';
  ELSIF cur_stato = 'completato' AND done < tot THEN
    UPDATE piano_trattamento SET stato='attivo' WHERE id=pid;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seduta_piano_auto_stato ON public.seduta;
CREATE TRIGGER trg_seduta_piano_auto_stato
AFTER INSERT OR UPDATE OF completata OR DELETE ON public.seduta
FOR EACH ROW EXECUTE FUNCTION public.piano_auto_stato();
```

### 2. Costanti zone (`src/lib/zone-trattamento.ts` — nuovo)

Array `ZONE_PREDEFINITE` con: glabella, fronte, zampe di gallina, sopracciglia, palpebre, naso, labbra, solco nasogenieno, marionette, zigomi, mento, ovale viso, collo, décolleté, mani, addome, fianchi, glutei, cosce, braccia.

### 3. Tipi (`src/types/trattamenti.ts`)

- Aggiungere a `PianoTrattamento`: `sconto_tipo: "nessuno"|"euro"|"percento"`, `sconto_valore: number`, `prezzo_finale: number | null`.
- Aggiungere a `PianoVoce`: `zone: string[]`.

### 4. Helper prezzo (`src/lib/piano-prezzo.ts` — nuovo)

```ts
export function calcolaTotaleRighe(righe: { trattamento_id: string; numero_sedute: number }[],
                                   trattamenti: Trattamento[]): number
export function applicaSconto(totale: number, tipo: "nessuno"|"euro"|"percento",
                              valore: number): { sconto: number; finale: number }
```

### 5. Refactor `src/components/paziente/piani-panel.tsx`

#### Form `RigaForm`

```ts
type RigaForm = {
  uid; trattamento_id; numero_sedute;
  prodotti: { uid; prodotto_id; quantita: number /* SOLO INTERI step=1 */ }[];
  zone: string[];                  // chip selezionati + custom
  zoneCustomDraft: string;         // input testo per aggiungere chip custom
  consensoOk; consensoLoading; consensoMotivi;
};
```

Default `quantita=1`, input number `step=1 min=1`, niente decimali.

#### UI riga (Card)
- Select trattamento + Input sedute (come oggi).
- **Badge consenso** + tooltip motivi. **Rimosso bottone "Firma consenso"** dalla riga.
- Sezione **"Prodotti previsti"**: per ogni prodotto `[Select prodotto] [Input qta intero] [trash]` + `+ Aggiungi prodotto`.
- Sezione **"Zone previste"**: chip cliccabili da `ZONE_PREDEFINITE` (toggle), sotto un `Input + bottone "Aggiungi"` per zone custom; chip già selezionati mostrano una `x` per rimuovere.

#### Footer dialog Nuovo Piano
Pannello riassuntivo prima dei bottoni:
- Riga "Totale base: € X" (somma `prezzo_indicativo * numero_sedute` per ogni riga; se `prezzo_indicativo` null, riga vale 0 e mostra warning inline "Trattamento senza prezzo indicativo").
- Selettore sconto: `[Nessuno] [€] [%]` + Input valore (disabilitato se "Nessuno").
- Riga "Totale finale: € Y" in evidenza (font display, bold).

#### Salvataggio
- `piano_trattamento`: salva `prezzo_totale = totaleBase`, `sconto_tipo`, `sconto_valore`, `prezzo_finale = finale`. Niente `data` per riga seduta (resta `data_seduta = now()` di default DB, non lo mostriamo più in UI).
- `piano_trattamento_voce`: aggiunge `zone: string[]`.
- Generazione sedute identica a oggi.

#### Modifica piano esistente (NUOVO)
Bottone "Modifica" su ogni `Card` piano. Apre lo stesso dialog precaricato:
- Carica voci + sedute. Ogni riga form rappresenta una voce esistente con `voceId?: string`.
- Per ogni voce: campi prodotti/zone editabili. `numero_sedute` editabile **ma con vincolo**: non scendere sotto il numero di sedute già `completata=true` di quella voce.
- Sconto/tipo editabili.
- Bottone `+ Aggiungi trattamento` permette di aggiungere nuove voci.
- Bottone trash su una voce: consentito solo se nessuna seduta di quella voce è completata; toast d'errore altrimenti.
- Salvataggio:
  - `UPDATE piano_trattamento` (titolo ricomposto, totali, sconto, numero_sedute_previste).
  - Per ogni voce esistente: `UPDATE` su prodotti/zone/numero_sedute.
  - Per ogni voce nuova: `INSERT` voce + sedute.
  - Per voce rimossa: `DELETE` voce + `DELETE` sedute non completate di quella voce.
  - Aggiustamento sedute per voce esistente:
    - Se `numero_sedute` aumenta: INSERT sedute mancanti `numero = max+1..nuovoTotale`.
    - Se diminuisce: DELETE sedute con `numero_seduta > nuovoTotale AND completata=false`.

#### Render piano (Card collassabile)
- **Rimossi i tick "completa seduta"** e l'azione `completaSeduta`.
- **Rimossa visualizzazione data per singola seduta**; mostra solo numero seduta + (se completata) badge "fatta" derivato.
- Header piano mostra: titolo, **data piano** (`created_at`), badge stato, **prezzo finale**.
- **Alert consenso**: per ogni voce, calcolo `puoEseguireTrattamento` lazy on-expand; se mancante mostra `<Alert variant="destructive">` con CTA bottone "Firma consenso ora" che apre `SignatureSessionDialog` per quel trattamento. L'alert appare anche compatto in cima alla card del piano: "⚠ N trattamenti senza consenso firmato".
- Bottone "Modifica" + Select stato (attivo/sospeso/annullato — `completato` è auto e disabilitato manualmente).
- Bottone "Aggiungi seduta" rimosso (le sedute si pianificano dal piano; aggiunte spot saranno gestite dalla futura sezione Sedute).

#### Backward compatibility
Piani vecchi senza voci: render "fallback semplice" con titolo + numero sedute + stato; nessun crash; bottone "Modifica" disabilitato con tooltip "Piano legacy non modificabile".

### 6. Cosa NON tocchiamo in questo turno

- Nessuna nuova sezione "Sedute" (rimandata).
- `signature-session-dialog`, `consensi-engine`, `access-guard`, `anamnesi-panel`, `consensi-panel`: invariati.
- `firma-trattamento-launcher`: invariato (riusato dentro l'alert).
- Nessuna scrittura su `diario` / `paziente_nota`.

### 7. File toccati

- `supabase/migrations/<ts>_piano_sconto_zone_autostato.sql` (nuovo)
- `src/lib/zone-trattamento.ts` (nuovo)
- `src/lib/piano-prezzo.ts` (nuovo)
- `src/types/trattamenti.ts` (campi `sconto_*`, `prezzo_finale`, `zone`)
- `src/components/paziente/piani-panel.tsx` (refactor: rimozione tick/data/firma riga, aggiunta zone/sconto/totale/modifica/alert)

### 8. Rischi

- **Modifica voci con sedute completate**: vincoli espliciti + toast. Test manuale richiesto su: riduzione sedute, eliminazione voce, cambio prodotti su voce con sedute future esistenti (i prodotti delle sedute future verranno **ri-clonati** dalla voce aggiornata).
- **Trigger auto-stato**: scatta anche su INSERT/DELETE seduta — verificato che la modifica piano (insert/delete sedute) lascia il piano `attivo` finché esistono sedute non completate.
- **Prezzo per trattamenti senza `prezzo_indicativo`**: warning inline, totale calcolato come 0 per quella riga, nessun blocco.
