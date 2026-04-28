# Fix crash Anamnesi + Refactor UI Consensi (template config)

## 1. Bug — Crash su tab Anamnesi (`null is not an object (resolveDispatcher().useState)`)

**Causa probabile**: errore nel rendering del sottoalbero della tab; React 19 rilancia come dispatcher null. Il sospetto principale è la combinazione tra `react-signature-canvas` (alpha) montato eagerly + `AnamnesiCronologia` montata sempre, dentro un `Tabs` Radix. Quando l'errore propaga, il `CatchBoundary` di TanStack mostra il messaggio "Error in route match".

**Interventi (minimi, non distruttivi)**:

- In `src/components/paziente/anamnesi-panel.tsx`:
  - Sostituire gli import named `useState/useEffect/useRef` con `import * as React from "react"` e usare `React.useState` ecc. (allineato a `auth-context` e `signature-pad`, evita problemi di tree-shaking/HMR su React 19).
  - Aggiungere guardia di rendering: se `data == null && !loading` mostrare placeholder + bottone "Inizializza anamnesi" invece di rendere i Card (oggi in pratica si entra sempre nel return principale dopo il fetch).
  - Lazy-loadare `SignaturePad` (`React.lazy` + `Suspense`) DENTRO il dialog di firma, così l'alpha di `react-signature-canvas` non viene importato fino al primo "Firma e blocca" (riduce superficie di crash al primo mount della tab).
- In `src/routes/_authenticated/pazienti.$id.tsx`:
  - Aggiungere `errorComponent` alla `Route` con messaggio leggibile + bottone "Riprova" (`router.invalidate()`), così se un panel crasha l'utente non vede stack trace nudo.

Se il crash dovesse persistere dopo questi fix lo isoliamo aggiungendo un `<ErrorBoundary>` solo attorno a `<AnamnesiPanel/>` con log strutturato: lo decideremo dopo aver verificato.

## 2. Refactor UI — Sezione "Consensi" → gestione template

Modifiche **solo UI** in `src/routes/_authenticated/consensi.index.tsx` (form `TemplateDialog`). **Nessuna modifica al backend, allo schema, alla signature session, al panel paziente.** Mantengo i valori esistenti delle enum di DB compatibili.

### 2.1 Rinomina

- Bottone "Nuovo modello" → **"Nuovo template consenso"**.
- Titolo dialog: "Nuovo template consenso" / "Modifica template consenso".
- Label e copy aggiornati di conseguenza.

### 2.2 Categorie visibili (UI)

Nel `Select` categoria mostrare solo:

- GDPR (`gdpr`)
- Uso immagini (`uso_immagini`)
- Trattamento (UI unica; mappa internamente a `trattamento_singolo` o `trattamento_ciclo` via "modalità validità", vedi 2.3)
- Altro (`altro`)

Nascondere/rimuovere dalla UI: `anamnesi`, `trattamento_ciclo` come categoria a sé, "trattamento singolo" come categoria a sé. (Le costanti DB restano: niente migration, niente rotture su record esistenti.)

### 2.3 Logica dinamica del form

Stato locale aggiuntivo: `tipoUI: "gdpr" | "uso_immagini" | "trattamento" | "altro"`, `modValidita: "singola" | "ciclo"`, `cicloDurata: number`, `cicloUnita: "giorni" | "mesi"`.

Comportamento:

- `tipoUI ≠ "trattamento"` → nascondere completamente: campo "validità mesi", switch ciclo/singola, durata, unità, select "trattamento collegato".
  - Categoria salvata: `gdpr` / `uso_immagini` / `altro`.
  - `validita_mesi = null`, `trattamento_id = null`.
- `tipoUI = "trattamento"` → mostrare:
  - Radio "Modalità validità": "Singola seduta" / "Ciclo".
  - Se "Singola seduta": niente input durata. Categoria salvata = `trattamento_singolo`, `validita_mesi = null`.
  - Se "Ciclo": input numerico "Durata" + select unità (Giorni / Mesi). Salvataggio: categoria = `trattamento_ciclo`, `validita_mesi = cicloDurata` (se mesi) oppure `Math.ceil(giorni/30)` (se giorni) — nota informativa sotto il campo: "La durata viene salvata in mesi".
  - Select "Trattamento collegato" **obbligatorio** (validazione lato form, niente opzione "Nessuno").

### 2.4 Campi rimossi dalla UI

- "Validità (mesi)" come input generico.
- Helper "Vuoto = nessuna scadenza".
- Categoria "Ciclo di trattamento" e "Anamnesi" dal select (anche se in DB restano).

### 2.5 Titolo auto-generato

Quando l'utente seleziona/cambia `tipoUI` (e in modalità trattamento anche il trattamento collegato), proporre un titolo di default:

- `gdpr` → "Informativa privacy e GDPR"
- `uso_immagini` → "Consenso uso immagini"
- `altro` → "" (vuoto)
- `trattamento` + trattamento scelto → "Consenso per `<nome trattamento>`"

Il titolo resta editabile manualmente. Se l'utente l'ha già modificato manualmente, non viene sovrascritto al cambio del tipo (flag `titoloDirty`).

### 2.6 Mapping in apertura (edit)

Quando si apre un template esistente:

- `categoria === "gdpr" | "uso_immagini" | "altro"` → `tipoUI` corrispondente.
- `categoria === "trattamento_singolo"` → `tipoUI = "trattamento"`, `modValidita = "singola"`.
- `categoria === "trattamento_ciclo"` → `tipoUI = "trattamento"`, `modValidita = "ciclo"`, `cicloDurata = validita_mesi ?? 12`, `cicloUnita = "mesi"`.
- `categoria === "anamnesi"` (record legacy) → mostrato in sola lettura con avviso "Categoria deprecata, salvataggio convertirà a Altro" (oppure si lascia così disabilitando il salvataggio — scelgo la via meno invasiva: lasciare modificabile ma con warning).

### 2.7 Validazioni

- Tipo trattamento: `trattamento_id` obbligatorio.
- Tipo trattamento + ciclo: `cicloDurata > 0`.
- Titolo, testo: invariati (obbligatori).

## File modificati

- `src/components/paziente/anamnesi-panel.tsx` (fix crash)
- `src/routes/_authenticated/pazienti.$id.tsx` (errorComponent)
- `src/routes/_authenticated/consensi.index.tsx` (refactor UI `TemplateDialog`)

## Cosa NON tocco

- Schema DB e migration.
- `consenso_firmato`, RPC `paziente_consensi_stato`, RLS.
- `signature-session.ts`, `signature-session-dialog.tsx`.
- `consensi-panel.tsx` (panel paziente).
- Enum `ConsensoCategoria` e `CATEGORIA_LABELS` (i valori esistenti restano per retro-compat record già firmati/template).
