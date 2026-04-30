// Helper per stampa PDF tramite iframe nascosto: apre subito il dialog di
// stampa nativo del browser, senza dipendere da popup o nuove tab.
import { toast } from "sonner";

/**
 * Apre il dialog di stampa nativo del browser per il PDF dato.
 * Usa un iframe nascosto: niente popup, niente nuove tab.
 */
export function printBlob(blob: Blob, mime = "application/pdf"): void {
  if (!blob) {
    toast.error("PDF non disponibile");
    return;
  }
  const finalBlob = blob.type !== mime ? new Blob([blob], { type: mime }) : blob;
  const url = URL.createObjectURL(finalBlob);

  // Pulisce un eventuale iframe di stampa precedente
  const prev = document.getElementById("__pdf_print_frame__");
  if (prev) prev.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__pdf_print_frame__";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      const cw = iframe.contentWindow;
      if (!cw) throw new Error("iframe contentWindow non disponibile");
      cw.focus();
      cw.print();
    } catch (err) {
      console.warn("[print] iframe.print fallito, fallback a nuova tab", err);
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) toast.error("Stampa non disponibile. Abilita i popup e riprova.");
    }
  };

  iframe.onload = () => {
    // Piccolo delay per dare tempo al PDF viewer di rendersi pronto
    setTimeout(triggerPrint, 200);
  };

  document.body.appendChild(iframe);

  // Safety net: alcuni viewer (Safari/iOS) non emettono onload
  setTimeout(triggerPrint, 1500);

  // Revoca l'URL e rimuove l'iframe dopo che la stampa è stata gestita
  setTimeout(() => {
    URL.revokeObjectURL(url);
    iframe.remove();
  }, 60_000);
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
