// Helper robusto per scaricare un Blob (PDF o altro) con fallback per
// Safari/iOS, popup bloccati e ambienti embed dove il click programmatico
// non triggera il download.
import { toast } from "sonner";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPad nuovi si presentano come Mac: includi anche "Macintosh" + touch
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document)
  );
}

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
}

/**
 * Avvia il download di un Blob. Tenta prima il pattern standard
 * <a download>, poi fallback a window.open per Safari/iOS o popup bloccati.
 */
export function triggerBlobDownload(blob: Blob, filename: string, mime?: string): void {
  if (!blob) {
    toast.error("File non disponibile");
    return;
  }
  const finalBlob = mime && blob.type !== mime ? new Blob([blob], { type: mime }) : blob;
  const url = URL.createObjectURL(finalBlob);

  // iOS Safari non supporta `download`: apriamo direttamente in nuovo tab
  if (isIOS() || isSafari()) {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      // popup bloccato: tentativo come navigazione corrente
      try {
        window.location.href = url;
      } catch (err) {
        console.warn("[download] navigation fallback failed", err);
        toast.error("Impossibile scaricare. Abilita i popup e riprova.");
      }
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener noreferrer";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    console.warn("[download] anchor click failed, falling back to window.open", err);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      toast.error("Popup bloccato. Abilita i popup per scaricare il file.");
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

/** Apre un blob in nuovo tab (utile per stampa). */
export function openBlobInNewTab(blob: Blob, mime = "application/pdf"): void {
  if (!blob) return;
  const finalBlob = blob.type !== mime ? new Blob([blob], { type: mime }) : blob;
  const url = URL.createObjectURL(finalBlob);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) {
    toast.error("Popup bloccato. Abilita i popup o usa Scarica.");
    URL.revokeObjectURL(url);
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
