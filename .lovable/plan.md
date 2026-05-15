# Piano

## 1. Anamnesi — un unico box in coda

In `anamnesi-panel.tsx`:
- Rimuovo la sezione "Dati di monitoraggio" attualmente in testa con `MetricheCorporeeCard` + `MisurazioniPanel` separati.
- In coda all'anamnesi (sotto la cronologia/firme) aggiungo **un solo Card** "Misurazioni e metriche corporee" con:
  - in alto, riga inline editabile con Peso (kg) · Altezza (cm) · BMI calcolato + bottone "Salva metriche"
  - sotto, la lista misurazioni circonferenze (contenuto attuale di `MisurazioniPanel`, senza il proprio Card wrapper)
- Elimino `MetricheCorporeeCard` standalone e refattorizzo `MisurazioniPanel` per esporre una variante "embedded" senza Card esterno (oppure creo `MisurazioniMetricheCard` che incorpora entrambi).
- Nessun cambio alla logica salvataggio o agli alert criolipolisi (continuano a leggere `peso_kg/altezza_cm` + righe `paziente_misurazione`).

## 2. Intestazione studio su TUTTI i PDF

Stato attuale: solo `pdf-relazione.ts` ha l'header studio. Devono averlo anche `pdf-consenso`, `pdf-consenso-vuoto`, `pdf-anamnesi`, `pdf-cartella-paziente`.

Approccio:
- In `src/lib/pdf-template.ts` estraggo `renderHeaderStudio(doc, studio, logoDataUrl, margin, startY) → newY`. Disegna logo (se presente) a sinistra + ragione sociale, indirizzo, contatti, direttore sanitario + linea separatrice. Sostituisce il blocco inline oggi in `pdf-relazione.ts`.
- Creo `src/lib/pdf-studio-loader.ts` con `loadStudioForPdf(): Promise<{ studio: StudioInfo|null, logoDataUrl: string|null }>` che:
  - legge `studio_info` (riga più recente)
  - se `logo_url` presente, fa `createSignedUrl` su `studio-assets`, fetch del blob e converte in dataURL (jsPDF richiede base64)
- Aggiorno le firme dei generatori PDF per accettare `studio` + `logoDataUrl` (opzionali, ma se mancano stampo solo titolo/header paziente come oggi):
  - `generaPdfConsenso`, `generaPdfConsensoVuoto`, `generaPdfAnamnesi`, `generaPdfCartellaPaziente`, `generaPdfRelazione`
- Aggiorno **tutti i call site** (in `consensi-panel.tsx`, `anamnesi-panel.tsx`, ecc.) per chiamare prima `loadStudioForPdf()` e passare i dati.
- `pdf-relazione.ts` si semplifica usando il nuovo helper condiviso.

## 3. Quattro task rimasti

### 3a. Impostazioni → Studi (multi-studio)
- In `impostazioni.studio.tsx` aggiungo, sotto "Dati dello studio" (intestazione fiscale), una **nuova sezione "I miei studi"** che usa la tabella `studio` già creata:
  - lista studi (nome, indirizzo, badge "attivo")
  - bottone "Aggiungi studio" → dialog (nome, indirizzo, città)
  - per ogni riga: edit, attiva/disattiva, elimina (solo se nessun paziente collegato)
  - select "Studio attivo predefinito" (scrive `profiles.studio_attivo_id` per l'utente)

### 3b. Selettore studio in scheda paziente
- In `pazienti.$id.edit.tsx`: se `useStudi()` ritorna ≥2 studi, mostro `<Select>` "Studio di riferimento" che salva `pazienti.studio_id`. Default: studio attivo del profilo. Se uno studio solo, campo nascosto.

### 3c. Badge studio nella lista pazienti
- In `pazienti.index.tsx`: quando esistono ≥2 studi, aggiungo colonna/badge con il nome dello studio del paziente (join su `studio_id`).

### 3d. "Stampa relazione" sulle note di diario
- In `diario-panel.tsx`: per ogni nota di tipo `clinica` (manuale, non auto-generata) aggiungo bottone "Stampa relazione" che:
  - chiama `loadStudioForPdf()`
  - chiama `generaPdfRelazione({ paziente, studio, dataNota, testo: nota.testo, medicoNome: profilo medico })`
  - apre il PDF in nuova tab / download

## File toccati

- **Modificati**: `src/components/paziente/anamnesi-panel.tsx`, `src/components/paziente/misurazioni-panel.tsx`, `src/lib/pdf-template.ts`, `src/lib/pdf-consenso.ts`, `src/lib/pdf-consenso-vuoto.ts`, `src/lib/pdf-anamnesi.ts`, `src/lib/pdf-cartella-paziente.ts`, `src/lib/pdf-relazione.ts`, `src/components/paziente/consensi-panel.tsx` (e altri call site dei PDF), `src/routes/_authenticated/impostazioni.studio.tsx`, `src/routes/_authenticated/pazienti.$id.edit.tsx`, `src/routes/_authenticated/pazienti.index.tsx`, `src/components/paziente/diario-panel.tsx`
- **Creati**: `src/lib/pdf-studio-loader.ts`, eventuale `src/components/paziente/misurazioni-metriche-card.tsx`
- **Eliminato**: `src/components/paziente/metriche-corporee-card.tsx` (logica assorbita nel card unificato)

## Cosa NON faccio

- Nessuna modifica alla migrazione DB (tabella `studio`, colonne `studio_id` e `studio_attivo_id` esistono già).
- Nessun filtro globale per studio su agenda/calendario/dashboard.
- Nessuna nuova tabella per le relazioni cliniche (riusa note diario).
