
# Fix definitivo Sì/No + prossima sezione: Consensi

## 1. Sì/No: passo da radio a segmented buttons

I cerchietti dei radio shadcn hanno il pallino interno (`Circle` SVG) che a volte risulta decentrato per via del rendering vettoriale a dimensioni piccole + `leading-none` sulla label. Invece di rincorrere il pixel-perfect, sostituisco il radio con **due pulsanti segmented** (stessa logica di TernaryRow per Fumo/Alcol/Caffè), che sono già visivamente coerenti nel resto dell'anamnesi.

**Comportamento**:
- Due bottoni affiancati: `[ No ] [ Sì ]`
- Quello attivo = `variant="default"` (pieno colore primario)
- Quello inattivo = `variant="outline"`
- Click cambia stato, niente disallineamenti possibili
- Larghezza minima uniforme (`min-w-[64px]`) per renderli simmetrici

File: `src/components/paziente/anamnesi-panel.tsx` → riscrivo `YesNoRow`.

## 2. Prossima sezione: Consensi

Per pianificare bene serve sapere come li vuoi gestire. Ti propongo una bozza che poi affiniamo insieme:

**Stato attuale**:
- Esiste `consenso_template` (titolo, testo, versione, trattamento collegato)
- Esiste `consenso_firmato` (snapshot del template + firma immagine + IP/UA + hash)
- C'è già `ConsensiPanel` nel paziente, da rivedere
- C'è già la pagina `/consensi` per gestire i template (catalogo)

**Cosa vorrei chiederti** (te lo chiedo con domande strutturate dopo l'approvazione di questo fix), in linea di massima:
- Firma su tablet con `<canvas>` direttamente in app (`signature-pad.tsx` esiste già) o anche caricamento PDF firmato esternamente?
- Validità temporale del consenso (es. scade dopo X mesi, da rifirmare)?
- Consensi obbligatori per attivare un trattamento (blocco se mancante)?
- Consenso GDPR/privacy generale separato da quelli per trattamento?

Per ora il piano è solo: **sistemare Sì/No con segmented buttons**, poi riapro la conversazione sui consensi con domande mirate.
