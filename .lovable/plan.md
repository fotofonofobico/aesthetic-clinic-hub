# Piano interventi

## 1. Calendario — colore pallino "Eventi"
In `src/components/calendario/calendario-filtri.tsx` e `src/lib/calendario.ts` il colore `Eventi` usa `hsl(var(--primary))` che sul tema attuale risulta quasi bianco. Sostituire con un colore distintivo (es. **viola** `hsl(262 83% 58%)`) e allinearlo anche nei badge dell'evento nella vista calendario (`calendario-vista.tsx`).

## 2. Magazzino — editare i prodotti
In `src/routes/_authenticated/magazzino.index.tsx` il `ProdottoFormDialog` viene aperto solo per la creazione. Aggiungere:
- Pulsante "Modifica" (icona matita) su ogni riga prodotto
- Stato `prodottoInModifica` passato come prop al dialog
- Estendere `ProdottoFormDialog` (`src/components/magazzino/prodotto-form-dialog.tsx`) per supportare modalità edit: precompila i campi e fa `update` invece di `insert`

## 3. PDF — rimuovere riga firma medico in GDPR / Uso immagini / Anamnesi
- `src/lib/pdf-template.ts` → `renderSignatureBlock`: aggiungere parametro `mostraFirmaMedico` (default true)
- `src/lib/pdf-anamnesi.ts`: passare `mostraFirmaMedico: false`
- `src/lib/pdf-consenso.ts`: passare `false` quando `categoria === 'gdpr'` o `'uso_immagini'`

## 4. PDF — ottimizzare layout di stampa (riferimento "Peeling_consenso_Cuneo.pdf")
Rivedere `pdf-template.ts` + `pdf-consenso.ts` per avvicinarsi al modello caricato:
- Header compatto a due colonne (intestazione studio a sx, dati paziente a dx in box bordato)
- Titolo del consenso centrato in maiuscolo con sottotitolo categoria
- Corpo a giustificato, line-height più ampio, paragrafi separati
- Sezioni numerate con titolo in grassetto su fondo grigio chiaro
- Footer per pagina con numero pagina "X di Y" e nome documento
- Box firma in fondo con linea + label sotto, allineato a dx, data a sx
- Margini tipografici uniformi (top/bottom 60pt, lat 50pt)

## 5. Badge "Foto PRIMA mancante" — staccare triangolo dal testo
Cercare il badge nei componenti `src/components/foto/*` (probabilmente `foto-stato-badge.tsx` o `foto-baseline-banner.tsx`) e aggiungere `gap-1.5` (o `mr-1.5` sull'icona) tra l'icona `AlertTriangle` e il testo "Foto PRIMA mancante".

---

### Note tecniche
- Punto 4 è il più consistente: comporta una riscrittura di `pdf-template.ts`. Mantenere la firma pubblica delle funzioni invariata per non rompere `pdf-anamnesi.ts` e `pdf-cartella-paziente.ts`.
- Per il punto 1, verificare contrast ratio su sfondo chiaro/scuro.
- Tutti i punti sono solo frontend, nessuna migrazione DB.
