## 🔧 PROMPT COMPLETO CORRETTO

## Sintesi dei bug

1. **Radio decentrato** sui pulsanti "Acconsento / Non acconsento".
2. **GDPR – firma non sempre visibile**: nel dialog "Nuovo consenso" della tab Consensi, in modalità tablet manca proprio la scelta acconsento/non_acconsento; la firma compare ma l'esito è forzato ad "acconsento".
3. **Non tutti i consensi sono scaricabili in PDF dalla tab Consensi**: il link PDF appare solo se `modalita_firma === "pdf_caricato"`. Per tablet (es. GDPR firmato sul tablet) il PDF c'è (`pdf_url`) ma non viene mostrato nessun pulsante per scaricarlo.
4. **Link PDF "vuoto"** per uso immagini / anamnesi: la signed URL viene generata ma a volte il `pdf_url` salvato punta a un path che non esiste (upload fallito silenziosamente in vecchi record) oppure il link non viene mai mostrato. Va reso visibile + gestito il caso "PDF non disponibile" senza link morto.
5. **Anamnesi – warning "versione successiva non firmata"** non viene mostrato a UI, anche se il guard ora produce `anamnesiObsoleta = true`.

---

## Modifiche

### 1. `src/components/ui/radio-group.tsx` — centrare il pallino

Sostituire l'indicatore:

```tsx
<Circle className="h-3.5 w-3.5 fill-primary" />

```

con:

```tsx
<RadioGroupPrimitive.Indicator className="flex h-full w-full items-center justify-center">
  <span className="h-2 w-2 rounded-full bg-primary" />
</RadioGroupPrimitive.Indicator>

```

---

### 2. `src/components/paziente/consensi-panel.tsx` — `NuovoConsensoDialog`

#### UI + logica tablet

- Aggiungere stato:

```ts
esitoTablet: "acconsento" | "non_acconsento" | undefined

```

- In modalità tablet:
  - mostrare **RadioGroup Acconsento / Non acconsento PRIMA della firma**
  - **nessuna preselezione**
  - firma sempre visibile sotto
  - firma sempre obbligatoria

---

#### Validazioni

- bloccare submit se:

```ts
modalita === "tablet" && !esitoTablet

```

---

#### Logica salvataggio

```ts
isRifiutato =
  (modalita === "pdf_caricato" && esitoCartaceo === "non_acconsento") ||
  (modalita === "tablet" && esitoTablet === "non_acconsento")

valido_fino_a = isRifiutato ? null : validoFinoA

```

---

#### 🔴 PDF — REGOLA FONDAMENTALE (NUOVA)

```txt
ALL new consents MUST always generate a PDF.

- gdpr
- uso immagini
- trattamento

If PDF generation or upload fails:
→ block save completely

Do NOT allow saving records without pdf_url for new entries

```

---

#### Visualizzazione PDF

- Mostrare SEMPRE:
  - firma immagine (se tablet)
  - E SOTTO link PDF

---

#### 🔴 VALIDAZIONE LINK PDF (NUOVA — OBBLIGATORIA)

```txt
PDF link must NOT be shown based only on pdf_url presence.

Before rendering link:
- verify file exists in storage

If file does NOT exist:
- DO NOT render clickable link
- show label:
  "PDF non disponibile"

Never show broken links

```

---

#### Fallback UI

Se manca PDF:

```txt
PDF non disponibile per questo consenso (record antecedente alla generazione automatica)

```

---

#### 🔵 PDF CONTENT (MIGLIORIA)

```txt
Include patient choice (acconsento / non_acconsento) inside PDF content

```

---

### 3. `src/components/paziente/anamnesi-panel.tsx`

#### Mostrare sempre PDF

Sostituire logica:

```ts
isSigned && isCartaceo(data) && data.pdf_url

```

con:

```ts
data.stato === "signed" && data.pdf_url

```

---

#### 🔴 VALIDAZIONE FILE ANAMNESI (NUOVA)

```txt
Before showing PDF link:
- verify file exists in "anamnesi-pdf" bucket

If missing:
- show fallback text instead of clickable link

```

---

#### Fallback

```txt
PDF non disponibile (versione anteriore al PDF automatico)

```

---

### 4. `src/components/pdf-signed-link.tsx`

#### Robustezza

- verificare esistenza file prima di mostrare link
- evitare link vuoti
- gestire errore 404 / signed URL non valido

---

### 5. `src/routes/_authenticated/pazienti.$id.tsx`

#### Alert anamnesi obsoleta

```tsx
{guard?.anamnesiObsoleta && (
  <Alert variant="default" className="border-warning/40 bg-warning/10">
    <AlertTriangle className="h-4 w-4 text-warning" />
    <AlertTitle>Anamnesi: nuova versione in lavorazione</AlertTitle>
    <AlertDescription>
      È presente una nuova anamnesi non firmata. Stai operando su una versione precedente.
    </AlertDescription>
  </Alert>
)}

```

---

## File toccati

- `src/components/ui/radio-group.tsx`
- `src/components/paziente/consensi-panel.tsx`
- `src/components/paziente/anamnesi-panel.tsx`
- `src/components/pdf-signed-link.tsx`
- `src/routes/_authenticated/pazienti.$id.tsx`

---

## Cosa NON toccare

- DB
- RLS
- trigger
- edge functions
- signature-session-dialog
- access-guard

---

## Risultato atteso

- radio centrati
- GDPR corretto (scelta + firma sempre)
- PDF SEMPRE generato per nuovi consensi
- nessun link rotto
- fallback chiaro se PDF mancante
- PDF anamnesi sempre accessibile
- alert anamnesi obsoleta visibile
- nessun blocco trattamenti se esiste signed