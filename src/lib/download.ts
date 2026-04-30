// Helper per stampa PDF: apre il PDF in una nuova tab usando il viewer nativo
// del browser e attiva automaticamente il dialog di stampa. Approccio più
// affidabile dell'iframe nascosto, che su Safari/Chrome spesso mostra
// un'anteprima vuota perché il viewer PDF non è ancora pronto.
import { toast } from "sonner";

/**
 * Apre il PDF in una nuova tab e attiva la stampa nativa del browser.
 * Funziona su Chrome, Safari, Firefox ed Edge.
 */
export function printBlob(blob: Blob, mime = "application/pdf"): void {
  if (!blob) {
    toast.error("PDF non disponibile");
    return;
  }
  const finalBlob = blob.type !== mime ? new Blob([blob], { type: mime }) : blob;
  const url = URL.createObjectURL(finalBlob);

  // Apri subito la nuova finestra (deve avvenire nel gesto utente per evitare il blocco popup)
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    URL.revokeObjectURL(url);
    toast.error("Popup bloccato. Abilita i popup per stampare.");
    return;
  }

  // Scrivi un piccolo HTML che incorpora il PDF a tutta pagina e chiama print()
  // dopo il load. Usiamo <embed> perché è quello che attiva il viewer PDF
  // nativo in modo più affidabile su tutti i browser.
  win.document.open();
  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Stampa PDF</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; width: 100%; background: #525659; }
  embed, iframe { width: 100%; height: 100%; border: 0; display: block; }
</style>
</head>
<body>
<embed id="pdf" type="application/pdf" src="${url}">
<script>
  (function() {
    var printed = false;
    function doPrint() {
      if (printed) return;
      printed = true;
      try { window.focus(); window.print(); } catch (e) { console.warn(e); }
    }
    // Su Chrome/Safari il viewer PDF nativo non emette eventi load affidabili;
    // diamo tempo al viewer di renderizzare prima di chiamare print().
    window.addEventListener('load', function() { setTimeout(doPrint, 800); });
    // Safety net
    setTimeout(doPrint, 2000);
  })();
</script>
</body>
</html>`);
  win.document.close();

  // Revoca l'URL dopo che la nuova finestra ha avuto tempo di caricarlo
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Apre un blob in nuovo tab (fallback). */
export function openBlobInNewTab(blob: Blob, mime = "application/pdf"): void {
  if (!blob) return;
  const finalBlob = blob.type !== mime ? new Blob([blob], { type: mime }) : blob;
  const url = URL.createObjectURL(finalBlob);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) {
    toast.error("Popup bloccato. Abilita i popup per aprire il PDF.");
    URL.revokeObjectURL(url);
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
