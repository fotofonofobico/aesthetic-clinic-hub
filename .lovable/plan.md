## Obiettivo

Cinque correzioni mirate al flusso clinico:
1. Unificare firma visita + anamnesi in un'unica esperienza consequenziale
2. Confermare/rendere visibile il passaggio automatico Piano → Completato
3. Default "durata in sedute" nei consensi ciclo (e wording corretto)
4. Prodotti realmente differenziabili seduta per seduta (non solo replicati)
5. Niente apertura automatica "Esegui seduta" dopo la firma

---

## 1. Firma visita + anamnesi: un unico flusso

**Stato attuale**: `buildVisitaSession` include già GDPR + Uso immagini + Anamnesi se l'anamnesi è in `draft`. Però l'utente vede ancora due bottoni / due dialog separati perché nel pannello Anamnesi c'è il proprio bottone "Firma anamnesi" che bypassa la sessione. Inoltre in `SignatureSessionDialog` la fase anamnesi mostra solo un testo placeholder generico ("Confermo la veridicità…"), senza lasciar vedere il riassunto dei dati che il paziente sta firmando.

**Cambi**:
- **`src/components/paziente/anamnesi-panel.tsx`**: il bottone "Firma anamnesi" non apre più il dialog locale; chiama invece `buildVisitaSession(pazienteId)` e apre `SignatureSessionDialog`. Se la sessione non contiene anamnesi (es. già firmata), mostra toast informativo. Il dialog di firma anamnesi locale resta solo come fallback "carica PDF cartaceo firmato".
- **`src/lib/signature-session.ts`** → `buildVisitaSession`: includi sempre il doc anamnesi se esiste un `draft` corrente OPPURE se l'ultima firmata è obsoleta (versione cambiata, dati modificati). Oggi solo `draft`.
- **`src/components/signature-session-dialog.tsx`** fase anamnesi:
  - Carica e mostra un riassunto leggibile dell'anamnesi che si sta firmando (sezioni Generale/Patologica/Farmacologica/Estetica con i campi compilati) — non solo il testo del consenso. Box scrollabile, max 40vh.
  - Mantieni la firma paziente come unica obbligatoria (firma medico solo se richiesta dal template anamnesi, comportamento attuale).
- **`src/routes/_authenticated/pazienti.$id.tsx`**: il bottone "Firma visita" resta in alto e diventa l'UNICO entry point per firmare consensi visita + anamnesi insieme. Etichetta aggiornata: "Firma visita & anamnesi".

**Risultato**: il paziente, durante una stessa interazione tablet, firma prima i consensi (GDPR + Uso immagini con firma unica) e subito dopo l'anamnesi, senza chiudere il dialog né cercare un altro bottone.

---

## 2. Piano → Completato automatico

**Stato attuale**: il trigger `trg_seduta_piano_auto_stato` è già attivo (verificato). Quando tutte le sedute non annullate diventano `completata = true`, il piano passa a `completato`. Funziona già — confermo nel piano e aggiungo solo:
- **`src/components/paziente/piani-panel.tsx`**: nel select stato del piano, etichetta "Completato" diventa disabilitata con tooltip "Si imposta automaticamente quando tutte le sedute risultano registrate". Già presente come `toast.info` ma manca il visual hint.
- **`src/components/paziente/sedute-panel.tsx`**: dopo l'esecuzione/registrazione di una seduta, fai un `void load()` anche dei piani (oggi la funzione `load` di pazienti.$id.tsx viene già chiamata via `onCompleted`). Verifico solo che il passaggio sia visibile in UI senza refresh manuale.

Nessuna modifica DB richiesta. Solo conferma + miglior feedback UI.

---

## 3. Consensi: default "sedute", niente più mesi forzati

**Stato attuale**: il template editor (`src/routes/_authenticated/consensi.index.tsx`) ha già il selettore `sedute | mesi`, ma il default iniziale è "mesi" e l'unità non viene precompilata dal trattamento collegato.

**Cambi** in `src/routes/_authenticated/consensi.index.tsx` (`TemplateEditor`):
- Quando `categoria === "trattamento_ciclo"`: imposta `cicloDurataTipo = "sedute"` di default.
- Quando l'utente collega un trattamento (`trattamentoId`), precompila `cicloDurata` con `trattamento.durata_ciclo_valore` se disponibile.
- Riordina il select unità con "Sedute" come prima opzione (già fatto).
- Aggiorna il microcopy: rimuovi qualsiasi riferimento residuo a "mesi" nell'help della pagina elenco template ciclo (verifica righe 514-518: già OK condizionalmente).
- **`src/components/paziente/consensi-panel.tsx`** (cronologia firmati): mostra "X/N sedute usate · scade al raggiungimento" quando `durata_tipo_snapshot === 'sedute'`, invece della data.

---

## 4. Prodotti diversi per ogni seduta (non solo replicati)

**Stato attuale**: la colonna DB `piano_trattamento_voce.prodotti_per_seduta` jsonb esiste già, ma il form non la usa. I prodotti vengono SOLO replicati su tutte le sedute.

**Cambi** in `src/components/paziente/piani-panel.tsx`:
- Nel form voce, accanto al titolo "Prodotti per seduta", aggiungi toggle/switch **"Personalizza per seduta"**.
  - **OFF (default)**: comportamento attuale — un'unica lista prodotti applicata a tutte le N sedute.
  - **ON**: mostra N tab/accordion (uno per seduta: "Seduta 1", "Seduta 2", …), ognuna con la propria lista prodotti indipendente. Sotto a ciascuna, riepilogo "Tot fiale ciclo" aggregato.
- Modifica `RigaForm`: aggiungi `personalizzaPerSeduta: boolean` e `prodottiPerSeduta: { uid; prodotto_id; quantita }[][]` (array per seduta). Quando OFF, l'array per seduta non viene popolato.
- `buildVocePayload`:
  - Se `personalizzaPerSeduta = false` → invia `prodotti_previsti = lista` e `prodotti_per_seduta = null` (comportamento attuale).
  - Se `true` → `prodotti_previsti = prodottiPerSeduta[0]` (fallback) e `prodotti_per_seduta = prodottiPerSeduta` (array di array).
- `creaPiano` / `modificaPiano` (loop di insert sedute): per la seduta `n`, scegli i prodotti da `v.prodotti_per_seduta[n-1]` se valorizzato, altrimenti da `v.prodotti_previsti`. Sostituisce il `JSON.parse(JSON.stringify(prodottiBase))` attuale.
- `apriModifica`: ricostruisci lo stato del toggle leggendo `voce.prodotti_per_seduta` (se non null e con length > 0 → personalizzata).
- Quando l'utente cambia "numero sedute" mentre il toggle è ON: estendi/tronca `prodottiPerSeduta` di conseguenza, preservando le sedute esistenti (extend con array vuoti, truncate dalla fine).
- Aggiorna l'helpertext: rimuovi la frase "Verranno replicate su ogni seduta del ciclo" e sostituisci con: "Default: stessa lista per tutte le sedute. Attiva 'Personalizza per seduta' per usare prodotti diversi (es. bio leggera nelle prime 2 sedute, densa nell'ultima)."

Nessun cambio DB (colonna già presente). Nessun cambio al trigger `seduta_sync_diario` (lavora già su `NEW.prodotti_previsti` per-seduta).

---

## 5. Esegui seduta NON deve aprirsi automaticamente dopo la firma

**Stato attuale** in `src/components/paziente/sedute-panel.tsx` (riga 459-465): l'`onCompleted` della firma esegue `if (s) setEseguiSeduta(s)` → apre subito il dialog esecuzione. È quello che condiziona il medico.

**Cambi**:
- **`src/components/paziente/sedute-panel.tsx`**: rimuovi `pendingExecAfterFirma`/`setEseguiSeduta(s)` dall'`onCompleted`. Dopo la firma fai solo `setFirmaOpen(false); void load(); toast.success("Consenso firmato. Puoi registrare la seduta quando vuoi.")`.
- **`src/components/firma-trattamento-launcher.tsx`**: già non apre alcun dialog di esecuzione — ok, nessuna modifica.
- **`src/components/paziente/piani-panel.tsx`**: lo stesso flusso `firmaOpen` qui non apre `Esegui seduta`. Verifica e ok.

Risultato: dopo la firma, il medico torna alla scheda paziente. Quando vorrà, andrà nel tab Sedute e cliccherà "Esegui" su quella riga.

---

## File toccati (riepilogo)

- `src/components/paziente/anamnesi-panel.tsx` — bottone "Firma anamnesi" usa la sessione visita
- `src/lib/signature-session.ts` — `buildVisitaSession` include anamnesi anche se obsoleta
- `src/components/signature-session-dialog.tsx` — riassunto leggibile anamnesi nella fase 2
- `src/routes/_authenticated/pazienti.$id.tsx` — etichetta "Firma visita & anamnesi"
- `src/routes/_authenticated/consensi.index.tsx` — default `sedute`, precompila durata da trattamento
- `src/components/paziente/consensi-panel.tsx` — cronologia mostra "X/N sedute usate"
- `src/components/paziente/piani-panel.tsx` — toggle "Personalizza per seduta", payload con `prodotti_per_seduta`, generazione sedute con prodotti per indice; tooltip stato Completato
- `src/components/paziente/sedute-panel.tsx` — rimuovi apertura automatica "Esegui seduta" dopo firma

Nessuna migration DB. Tutte le colonne necessarie esistono già.
