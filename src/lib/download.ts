// Helper per aprire un Blob (PDF o altro) in nuova tab — utile per stampa
// nativa e per "Salva come PDF" del sistema operativo.
import { toast } from "sonner";

/** Apre un blob in nuovo tab (utile per stampa). */
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
