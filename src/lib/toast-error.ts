import { toast } from "sonner";

const ERRORI_NOTI: Array<[string, string]> = [
  ["row-level security", "Sessione scaduta. Ricarica la pagina e accedi di nuovo."],
  ["JWT expired", "La sessione è scaduta. Effettua di nuovo il login."],
  ["duplicate key", "Questo elemento esiste già."],
  ["foreign key violation", "Impossibile eliminare: ci sono dati collegati a questo elemento."],
  ["network", "Connessione assente. Verifica la rete e riprova."],
  ["Failed to fetch", "Connessione assente. Verifica la rete e riprova."],
];

export function toastError(err: unknown, fallback = "Si è verificato un errore") {
  const msg = err instanceof Error ? err.message : String(err);
  const match = ERRORI_NOTI.find(([k]) => msg.toLowerCase().includes(k.toLowerCase()));
  toast.error(match?.[1] ?? `${fallback}: ${msg}`);
}
