
# Refactor core: Consensi, Anamnesi firmata, Piani con tariffario, Audit

## Obiettivo

Trasformare consensi/anamnesi/piani in un sistema medico-legale coerente, con blocchi automatici non bypassabili, PDF immutabili, versioning e audit. UI esistente viene riusata; la logica viene centralizzata.

## Architettura — moduli centrali (nuovi)

```text
src/lib/
├── consensi-engine.ts      # stati consenso, calcolo scadenze, valutazione blocchi
├── access-guard.ts         # gate centrale: può accedere/trattare il paziente?
├── pdf-consenso.ts         # genera PDF firmato (jsPDF) -> Storage
├── pdf-anamnesi.ts         # genera PDF anamnesi firmata
├── audit.ts                # writeAudit(entity, before, after, user)
└── tariffario.ts           # calcolo prezzo da trattamenti + pacchetti + sconto
```

`access-guard.evaluate(pazienteId)` ritorna:
```ts
{
  bloccoTotale: boolean,        // GDPR mancante/revocato
  bloccoTrattamenti: boolean,   // anamnesi non firmata o non aggiornata
  immaginiConsentite: boolean,  // consenso uso immagini
  trattamentiBloccati: string[],// trattamenti senza consenso valido
  motivi: string[]
}
```
È l'unico punto che decide se un'azione clinica è permessa: chiamato da `PianiPanel`, `aggiungiSeduta`, upload foto, ecc.

## Modello dati — modifiche schema

### `consenso_template`
- `categoria` esteso: `gdpr` | `uso_immagini` | `anamnesi` | `trattamento_singolo` | `trattamento_ciclo` | `altro`
- `richiede_firma_medico boolean default false`
- `validita_mesi` resta nullable ma con semantica nuova (vedi engine)
- aggiungere check: se `categoria='trattamento_singolo'` allora `validita_mesi` deve essere null (validità = singola seduta)

### `consenso_firmato`
- `firma_medico_immagine text null`
- `firmato_da_medico uuid null`
- `seduta_id uuid null` — se categoria `trattamento_singolo`, lega il consenso alla seduta specifica
- `pdf_generato_url text null` — PDF auto-generato (separato da `pdf_url` che è upload manuale)
- vincolo: record è di fatto immutabile salvo `revocato_il/revocato_da` (policy UPDATE già limita ai medici; aggiungere trigger che impedisce modifiche di campi non-revoca)

### `anamnesi` — versioning con firma
Schema attuale ha già `anamnesi_versione` (snapshot ad ogni update). Aggiungiamo:
- `anamnesi.stato` enum `draft | signed | superseded` default `draft`
- `anamnesi.firmata_il timestamptz null`
- `anamnesi.firma_paziente text null` (data URL)
- `anamnesi.firma_medico text null`
- `anamnesi.pdf_url text null`
- `anamnesi.hash_integrita text null`
- Trigger: ogni UPDATE su anamnesi `signed` → archivia in `anamnesi_versione` con stato `superseded`, resetta nuova riga a `draft` (no overwrite del firmato)

### `trattamenti` — tariffario
- `prezzo_indicativo` resta come prezzo singola seduta
- nuova tabella `trattamento_pacchetto`:
  ```
  id, trattamento_id, nome, numero_sedute, prezzo_pacchetto, attivo
  ```

### `piano_trattamento` — multi-trattamento
- nuova tabella `piano_trattamento_voce`:
  ```
  id, piano_id, trattamento_id, pacchetto_id null, numero_sedute,
  prezzo_unitario, prezzo_riga, ordine
  ```
- aggiungere a `piano_trattamento`: `sconto numeric default 0`, `prezzo_finale numeric`, `stato` esteso con `bozza | confermato | attivo | completato | sospeso | annullato`
- `seduta.voce_id uuid null` — collega seduta alla voce di piano (per sapere quale trattamento)

### `audit_log` — già esiste, lo usiamo
Wrapper `audit.ts` scrive: `entity_type='paziente'|'consenso'|...`, `metadata={campo, prima, dopo}`.
Per anagrafica: trigger Postgres su `pazienti` che intercetta UPDATE su telefono/email/codice_fiscale/indirizzo/... e inserisce in `audit_log`.

## Engine consensi (`consensi-engine.ts`)

Funzioni pure, una sola fonte di verità:

```ts
type Stato = 'valid' | 'missing' | 'expiring' | 'expired' | 'obsolete' | 'revoked';

calcolaStatoConsenso(firmato, templateCorrente, ora) -> Stato
// regole:
// - revocato_il != null              -> 'revoked'
// - templateCorrente.versione != snapshot -> 'obsoleto'
// - categoria='trattamento_singolo' && seduta.completata -> 'expired'
// - valido_fino_a < ora              -> 'expired'
// - valido_fino_a < ora+30gg         -> 'expiring'
// - else                             -> 'valid'

statoConsensiPaziente(pazienteId) -> Map<categoria|template, Stato>
puoEseguireTrattamento(pazienteId, trattamentoId) -> { ok, motivi[] }
```

L'RPC `paziente_consensi_stato` viene aggiornata di conseguenza (server-side per sicurezza), ma esiste anche la versione client per UX immediata.

## Flusso firma — niente preselezione

Dialog firma consenso/anamnesi:
1. Mostra testo completo (scrollabile)
2. Due bottoni espliciti: `[ Acconsento ] [ Non acconsento ]` — nessun default
3. Se "non acconsento":
   - GDPR → blocco totale paziente, salvato come `consenso_firmato` con flag rifiuto
   - Uso immagini → salvato, `access-guard` setta `immaginiConsentite=false`
   - Trattamento → blocca quel trattamento
4. Se "acconsento" → SignaturePad (paziente) + opzionale firma medico → genera PDF → upload Storage → insert `consenso_firmato`

PDF generato lato client con `jsPDF`:
- intestazione clinica + dati paziente
- testo integrale del template
- versione, data/ora, hash
- immagini firme

## Anamnesi — firma + versioning

UI esistente resta. Si aggiunge:
- bottone **"Riepiloga e firma"** → mostra riepilogo read-only di tutte le sezioni
- SignaturePad obbligatorio
- al salvataggio: `stato='signed'`, snapshot in `anamnesi_versione`, PDF generato, `pdf_url` salvato
- ogni successiva modifica forza creazione di una nuova riga `draft` (la firmata diventa `superseded` e resta consultabile in cronologia)
- `access-guard` blocca trattamenti se `stato != 'signed'` o se esiste draft più recente del signed

## Piani — tariffario e multi-trattamento

Dialog "Nuovo piano":
1. Titolo (prefill automatico = elenco trattamenti)
2. Aggiungi più voci: per ogni trattamento → scegli "singola seduta" o pacchetto disponibile → quantità
3. `tariffario.calcola(voci, sconto)` → mostra subtotale, sconto, totale (modificabile)
4. Stato iniziale `bozza`, bottone "Conferma" → `confermato`

Quando si aggiunge una seduta:
- `access-guard.puoEseguireTrattamento(paziente, voce.trattamento_id)`
- se non ok → dialog "Firma consensi mancanti" che apre direttamente i template necessari
- se trattamento singolo → consenso firmato lega `seduta_id` e diventa `expired` a fine seduta

## Sezione "Alert" paziente

Mostra in modo unificato:
- flag automatici da anamnesi (esiste)
- alert manuali (esiste)
- **stato consensi** (nuovo): elenco categorie/template con badge `valid/expiring/expired/obsoleto/missing/revoked`
- **stato anamnesi**: `signed | draft pendente | superseded`
- riassunto blocchi attivi (cosa il paziente NON può fare e perché)

Banner critico in alto (`CriticalBanner`) include i blocchi.

## Audit anagrafica

- Trigger `audit_anagrafica_changes` su `pazienti` (UPDATE) → per ogni campo sensibile cambiato inserisce riga in `audit_log` con `metadata={campo, prima, dopo}`
- UI: tab "Cronologia modifiche" sotto Anagrafica che legge `audit_log` (solo medici, RLS già ok)

## Migrazione dati esistenti

- `consenso_template.categoria` 'trattamento_continuativo' → 'trattamento_ciclo' (rinomina enum value)
- `consenso_firmato` esistenti: ricalcolo `valido_fino_a` lasciato com'è (compatibile)
- `piano_trattamento` esistenti: creo automaticamente una `piano_trattamento_voce` con `trattamento_id` corrente
- nessuna perdita dati

## Ordine di implementazione

1. **Migrazioni DB** (enum, colonne, tabelle nuove, trigger audit, trigger anamnesi)
2. **Tipi TS** aggiornati (`trattamenti.ts`, `clinico.ts`)
3. **Engine** `consensi-engine.ts` + `access-guard.ts` + `tariffario.ts` + `audit.ts`
4. **PDF generators** (`pdf-consenso.ts`, `pdf-anamnesi.ts`)
5. **Refactor `consensi-panel.tsx`**: dialog firma con Acconsento/Non acconsento, generazione PDF, gestione GDPR/immagini
6. **Refactor `consensi.index.tsx`**: nuove categorie + flag `richiede_firma_medico`
7. **Refactor `anamnesi-panel.tsx`**: bottone firma, riepilogo, blocco modifica del firmato
8. **Refactor `piani-panel.tsx`**: voci multiple, tariffario, sconto, stato bozza/confermato, hook `access-guard` su ogni azione
9. **Refactor `pazienti.$id.tsx`**: tab Alert unificata, banner blocchi
10. **Tab "Cronologia modifiche"** anagrafica
11. **Tariffario UI** in `trattamenti.index.tsx` per gestire pacchetti

## Cosa NON tocco

- `signature-pad.tsx`, `flag-rischio.ts` (logica flag automatici), `auth-context`, routing, anagrafica form (solo aggiunta tab cronologia)
- componenti `Diario`, follow-up
- RLS già conformi, aggiungo solo policy per nuove tabelle

## Note tecniche

- PDF: `jsPDF` + `jspdf-autotable` (da installare). Generazione client-side per semplicità; hash SHA-256 calcolato sul contenuto serializzato prima dell'upload.
- Trigger Postgres per audit anagrafica usa `OLD`/`NEW` e scrive in `audit_log` con `user_id = auth.uid()`.
- Trigger su anamnesi: BEFORE UPDATE — se OLD.stato='signed' e cambia qualsiasi campo dati, blocca con RAISE EXCEPTION e lascia che il client crei nuova riga draft.
- `access-guard` viene sempre chiamato lato client per UX, ma le insert critiche (seduta) hanno anche un check RPC server-side `puo_eseguire_trattamento(paziente, trattamento)` per sicurezza.

## Domanda aperta

Vuoi che il **PDF generato** includa anche il logo/intestazione della clinica? Se sì, mi serve sapere dove caricarlo (lo aggiungo come asset statico o lo metto su Storage e lo carico runtime?). In assenza di risposta, genero PDF con solo testo + dati operatore.
