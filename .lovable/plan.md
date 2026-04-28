## Obiettivo

Rendere modificabile un'anamnesi firmata creando automaticamente una nuova versione draft, mantenendo le precedenti immutabili in cronologia, e richiedendo firma del paziente (con SignaturePad) per convalidare. Allineare regole consensi trattamento/ciclo.

## Problemi attuali

1. UI dell'anamnesi blocca completamente i campi quando `stato='signed'`: l'utente deve cliccare "Nuova versione" prima di poter modificare. Va invece consentita la modifica diretta che crea automaticamente un nuovo draft al primo cambio.
2. La firma anamnesi attualmente passa `firmaPazienteDataUrl: null` — manca la cattura della firma del paziente.
3. La cronologia versioni esiste (`AnamnesiCronologia` + tabella `anamnesi`) ma le versioni precedenti non vengono marcate `superseded` quando una nuova viene firmata.
4. Consensi trattamento singolo/ciclo: la logica RPC `paziente_consensi_stato` già gestisce `expired` per seduta completata e per `valido_fino_a`, ma manca la **garanzia** che a creazione consenso `trattamento_ciclo` venga impostato `valido_fino_a = now() + validita_mesi` (default 12) se non valorizzato, e va eliminato il fallback "vuoto = nessuna scadenza" per le categorie ciclo.

## Modifiche

### 1. UI Anamnesi (`src/components/paziente/anamnesi-panel.tsx`)

- **Auto-fork on edit**: quando `data.stato === 'signed'` e l'utente modifica un campo, intercettare il primo cambio (`patch()` e setter di `note_libere`) e creare in automatico un nuovo draft (clone della versione firmata, `versione_numero + 1`). Lo stato locale viene sostituito con il nuovo draft prima di applicare la patch. Nessun blocco UI sui campi.
- **Banner stato**: mostrare 3 stati: `signed` (verde, "Firmata vN — modifica per creare nuova versione"), `draft` da firmata precedente (warning, "Bozza vN+1 in revisione di vN — richiede nuova firma paziente"), `draft` iniziale.
- **Pulsante "Firma e blocca"**: aprire un dialog con `SignaturePad` (componente già esistente in `src/components/signature-pad.tsx`) per cattura firma paziente; opzionalmente firma medico. Validare presenza firma paziente prima di procedere.
- **Marca superseded**: in `firmaAnamnesi()`, dopo aver portato il nuovo record a `signed`, eseguire `UPDATE anamnesi SET stato='superseded' WHERE paziente_id=? AND id<>? AND stato='signed'`.
- Rimuovere il pulsante separato "Nuova versione" (diventa automatico). Mantenere però la cronologia visibile.

### 2. Trigger DB (nuova migration)

- **Aggiornare `anamnesi_signed_protect`**: oggi blocca solo il cambio dei campi clinici quando `OLD.stato='signed' AND NEW.stato='signed'`. Aggiungere blocco anche per la transizione `signed → draft/superseded` da parte di chiunque non sia il sistema (consentire solo `signed → superseded`). Vietare modifiche ai campi `firma_paziente`, `firma_medico`, `firmata_il`, `hash_integrita`, `pdf_url` di un record `signed`.
- **Auto-supersede trigger**: trigger `AFTER UPDATE ON anamnesi` che, quando un record passa a `signed`, marca automaticamente le altre versioni `signed` dello stesso paziente come `superseded` (così l'app non deve farlo manualmente e la regola è centralizzata).

### 3. PDF anamnesi (`src/lib/pdf-anamnesi.ts`)

- Nessun cambio strutturale: già accetta `firmaPazienteDataUrl` e `firmaMedicoDataUrl`. Verifico solo che venga renderizzato il riquadro firma paziente quando presente.

### 4. Salvataggio firma paziente

- Aggiornare `firmaAnamnesi()` per:
  - Salvare `firma_paziente` (data URL) e `firma_medico` (se catturata) nei campi già esistenti della tabella `anamnesi`.
  - Passare entrambe a `generaPdfAnamnesi`.
  - Includere il data URL nella stringa hashata SHA-256 per integrità.

### 5. Consensi trattamento — regole rafforzate

- **Frontend (`src/components/paziente/consensi-panel.tsx`)**: alla firma di un consenso categoria `trattamento_ciclo`, se `validita_mesi` del template è null forzare default 12; calcolare e impostare `valido_fino_a = firmato_il + validita_mesi`. Per `trattamento_singolo` lasciare `valido_fino_a = NULL` ma legare `seduta_id` (la RPC gestisce già `expired` su seduta completata).
- **Trigger DB di validazione**: nuovo trigger `BEFORE INSERT ON consenso_firmato` che:
  - se `categoria_snapshot = 'trattamento_ciclo'` e `valido_fino_a IS NULL`, calcola `valido_fino_a = firmato_il + COALESCE(validita_mesi_snapshot,12) months`.
  - se `categoria_snapshot = 'trattamento_singolo'` e `seduta_id IS NULL`, RAISE: un consenso di seduta deve essere associato.

### 6. Access guard / pre-trattamento

- Nessuna modifica logica: `puoEseguireTrattamento` già blocca se manca consenso valido per ogni template attivo. Verifico solo che `piani-panel.tsx` chiami `puoEseguireTrattamento` prima di creare la seduta (già fatto nel turno precedente).

## File modificati

- `src/components/paziente/anamnesi-panel.tsx` — auto-fork + dialog firma paziente
- `src/lib/pdf-anamnesi.ts` — verifica rendering firma (eventuale fix)
- `src/components/paziente/consensi-panel.tsx` — calcolo `valido_fino_a` per cicli
- `supabase/migrations/<new>.sql` — trigger auto-supersede + validazione consensi + protezioni firma

## Flusso utente finale

1. Apre anamnesi firmata v3 → vede banner verde "Firmata v3".
2. Modifica un campo qualsiasi → toast "Creata bozza v4 da v3" → continua a editare liberamente.
3. Clicca "Firma e blocca" → dialog con SignaturePad paziente (obbligatorio) + medico (opz.) → conferma.
4. v4 diventa `signed`, v3 diventa `superseded` automaticamente, PDF generato con firme, hash registrato.
5. Cronologia mostra v1 superseded, v2 superseded, v3 superseded, v4 signed.
