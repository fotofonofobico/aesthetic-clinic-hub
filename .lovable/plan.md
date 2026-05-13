## 1. Fix bottone "Esci da modalità firma"

In `src/routes/firma.tsx` rimuovere `signOut()` e navigare a `/dashboard`. Sessione mantenuta.

## 2. Peso, altezza, BMI nella scheda paziente

Le colonne `peso_kg` e `altezza_cm` su `pazienti` esistono già. Niente migration.

- In `pazienti.$id.edit.tsx`: due campi opzionali "Peso (kg)" e "Altezza (cm)".
- In `pazienti.$id.tsx`: riquadro compatto Peso · Altezza · **BMI calcolato** + categoria (sottopeso/normo/sovrappeso/obesità).
- Sempre disponibili per qualunque paziente, mai obbligatori.

## 3. Pannello "Misurazioni" (circonferenze)

Nuova tabella leggera, JSON flessibile, collegata al paziente (e opz. alla seduta).

```sql
CREATE TABLE public.paziente_misurazione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paziente_id uuid NOT NULL,
  seduta_id uuid,
  data_rilevazione date NOT NULL DEFAULT CURRENT_DATE,
  peso_kg numeric,
  misure jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- { vita, fianchi, addome, braccio_dx, braccio_sn, coscia_dx, coscia_sn, ... }
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.paziente_misurazione ENABLE ROW LEVEL SECURITY;
-- RLS: operatori attivi SELECT/INSERT/UPDATE; medico DELETE
CREATE INDEX ON public.paziente_misurazione (paziente_id, data_rilevazione DESC);
```

UI: pannello `MisurazioniPanel` nella scheda paziente con lista cronologica + bottone "Nuova rilevazione" (dialog con data, peso opz., griglia campi numerici opzionali, note). Confronto delta prima vs ultima in alto. Niente grafici, niente pagine separate.

## 4. Criolipolisi — 4 voci preconfigurate

Nessun cambio di schema. Inserire in `trattamenti` (categoria `device`, tipo `ciclo`):

- Criolipolisi – 1 manipolo, 1 zona
- Criolipolisi – 1 manipolo, 2 zone
- Criolipolisi – 2 manipoli, 1 zona
- Criolipolisi – 2 manipoli, 2 zone

Prezzi e durata da impostare poi manualmente in Trattamenti. Per i cicli pluri-seduta si usano i `trattamento_pacchetto` esistenti.

## 5. Reminder "misurazione baseline mancante" per criolipolisi

**Non bloccante**. Promemoria visibile, l'utente può sempre procedere.

Quando si sta per completare la **prima seduta** di un piano criolipolisi e il paziente non ha ancora alcuna riga in `paziente_misurazione`:

- Banner ambra nel dialog di completamento seduta:
  > 🔔 Promemoria: non è stata registrata la misurazione baseline. Vuoi aggiungerla ora?
- Due bottoni: **"Aggiungi misurazione"** (apre il dialog del punto 3) e **"Procedi comunque"** (chiude il banner e prosegue normalmente, nessuna conferma extra).
- Stesso reminder (sempre non bloccante) come banner informativo nella scheda paziente quando esiste un piano criolipolisi attivo senza misurazioni.

Riconoscimento "trattamento criolipolisi" tramite `src/lib/trattamenti-speciali.ts` (match per prefisso "Criolipolisi"). Logica frontend, nessun trigger DB.

## File toccati

- `src/routes/firma.tsx` — fix logout
- `src/routes/_authenticated/pazienti.$id.edit.tsx` — campi peso/altezza
- `src/routes/_authenticated/pazienti.$id.tsx` — riquadro BMI + montaggio MisurazioniPanel + banner reminder
- `src/components/paziente/misurazioni-panel.tsx` — nuovo
- `src/components/paziente/misurazione-dialog.tsx` — nuovo
- `src/components/paziente/sedute-panel.tsx` — banner reminder pre-completamento prima seduta criolipolisi
- `src/lib/bmi.ts` — calcolo + categoria
- `src/lib/trattamenti-speciali.ts` — riconoscimento criolipolisi
- Migration: `paziente_misurazione` + RLS
- Insert: 4 voci criolipolisi in `trattamenti`

## Cosa NON faccio

- Misurazioni non sono vincolate al trattamento criolipolisi (sempre disponibili).
- Nessun campo manipoli/zone sulla voce di piano, nessun prezzo dinamico.
- Nessun grafico storico, nessuna pagina separata.
- Nessun blocco/conferma extra: il reminder è solo informativo.
