## Obiettivo

Tre rifiniture allo schema paziente, più la predisposizione minima per il multi-studio.

---

### 1. Spostare Peso / Altezza / BMI e Misurazioni in **Anamnesi**

**Scelta architetturale**: Misurazioni e metriche corporee restano dati indipendenti dall'anamnesi firmata (non vengono congelate). Vivono nella tab "Anamnesi" come due card separate, ma usano le stesse tabelle attuali.

- **Tab "Anagrafica"** (`pazienti.$id.tsx`): rimuovo le righe Peso, Altezza, BMI dalla card anagrafica. Rimuovo `MisurazioniPanel` e `CriolipolisiBaselineBanner` da qui.
- **Pagina edit anagrafica** (`pazienti.$id.edit.tsx`): rimuovo i campi Peso/Altezza dal form (i dati restano in DB ma non sono più editabili da qui).
- **Tab "Anamnesi"**: aggiungo in cima (sopra le 5 card numerate dell'anamnesi clinica) due card non versionate:
  - Card **"Metriche corporee"**: form inline con Peso (kg) e Altezza (cm), salvataggio diretto su `pazienti`. Mostra BMI calcolato + categoria. Editabile sempre, indipendentemente dallo stato dell'anamnesi.
  - Card **"Misurazioni"**: il `MisurazioniPanel` già esistente.
- Visivamente separate dall'anamnesi numerata da un divider + label "Dati di monitoraggio (non firmati)".

### 2. Estendere il reminder criolipolisi

Oggi il banner di promemoria scatta solo se mancano misurazioni (rilevazioni in `paziente_misurazione`). Lo estendo:

- Il reminder appare se manca **almeno una** delle seguenti baseline:
  - peso_kg sul paziente
  - altezza_cm sul paziente
  - almeno una rilevazione in `paziente_misurazione`
- Testo dinamico: "Mancano: peso, altezza, misurazioni di partenza".
- Pulsanti: "Aggiungi misurazione" (apre dialog) + "Vai a metriche" (porta alla tab Anamnesi) + "Procedi comunque".
- Stesso comportamento sia nel dialog di completamento seduta, sia nel banner sulla scheda paziente. Resta **non bloccante**.

### 3. Predisposizione multi-studio (minima)

**DB** (migration):
- Nuova tabella `studio` (`nome`, `indirizzo`, `attivo`, `created_at`). RLS: lettura per operatori attivi, modifiche solo medici.
- Aggiungo `studio_id uuid` nullable su `pazienti` (FK logica, no constraint per ora).
- Aggiungo `studio_attivo_id uuid` nullable su `profiles` (lo studio scelto dall'utente).
- Inserisco uno studio di default ("Studio principale") e popolo `studio_id` dei pazienti esistenti con quello.

**UI**:
- **Impostazioni → Studio** (tab già esistente `impostazioni.studio.tsx`): aggiungo sezione "I miei studi" con lista, "Nuovo studio", e selettore "Studio attivo" (salvato sul profilo).
- **Anagrafica paziente** (form edit): nuovo campo Select "Studio di riferimento" (visibile solo se esistono ≥2 studi).
- **Lista pazienti** + **scheda paziente**: badge piccolo accanto al nome con il nome dello studio (visibile solo se esistono ≥2 studi). Nessun filtro automatico, nessuna separazione di permessi.

Questo è solo *predisposizione*: niente filtro globale su calendario/agenda/dashboard adesso (su tua richiesta).

### 4. Relazione visita → nota clinica del diario

Approccio semplice, zero nuove tabelle:

- Nel `diario-panel.tsx`, sulle note di tipo "clinica" (e solo quelle non auto-generate da seduta), aggiungo un pulsante **"Stampa relazione"**.
- Genera un PDF su carta intestata dello studio (riuso `pdf-template.ts`) con:
  - Intestazione studio (nome, indirizzo, medico)
  - Dati paziente (nome, cognome, data nascita, CF)
  - Data della nota
  - Testo della nota
  - Spazio firma medico in basso
- Nessun nuovo campo DB. Il medico scrive la relazione come nota clinica e la stampa quando serve.

---

### File toccati

- **Migration**: `studio` table + RLS + colonne `studio_id` su `pazienti` e `studio_attivo_id` su `profiles` + seed studio default.
- `src/routes/_authenticated/pazienti.$id.tsx`: sposta Misurazioni/Banner in anamnesi tab; rimuove BMI da anagrafica; aggiunge badge studio.
- `src/routes/_authenticated/pazienti.$id.edit.tsx`: rimuove campi peso/altezza; aggiunge select studio (condizionale).
- `src/components/paziente/anamnesi-panel.tsx`: aggiunge in testa le due card (Metriche + Misurazioni).
- Nuovo `src/components/paziente/metriche-corporee-card.tsx`: form inline peso/altezza + BMI.
- `src/components/paziente/misurazioni-panel.tsx`: nessuna modifica strutturale (riusato).
- `src/components/paziente/sedute-panel.tsx` + scheda paziente: estende il reminder a peso/altezza mancanti.
- `src/components/paziente/diario-panel.tsx`: pulsante "Stampa relazione" sulle note cliniche manuali.
- Nuovo `src/lib/pdf-relazione.ts`: genera il PDF della relazione.
- `src/routes/_authenticated/impostazioni.studio.tsx`: sezione gestione studi + studio attivo.
- `src/routes/_authenticated/pazienti.index.tsx`: badge studio nella lista (condizionale).
- `src/types/clinico.ts`: aggiunge `studio_id` a `Paziente`.

### Cosa NON faccio

- Nessun congelamento misurazioni con la firma anamnesi.
- Nessun filtro globale per studio (calendario/agenda/dashboard restano "tutto").
- Nessuna separazione di permessi tra studi.
- Nessuna nuova tabella per le relazioni: si usano le note cliniche esistenti.
- Nessuna modifica al PDF cartella paziente (resta com'è).