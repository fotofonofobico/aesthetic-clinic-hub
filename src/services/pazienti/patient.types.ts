import type { Paziente, PazienteAlert, FlagRischio, AlertSeverity } from "@/types/clinico";

export type { Paziente, PazienteAlert, FlagRischio, AlertSeverity };

export interface PazienteConSeverity extends Paziente {
  max_severity: AlertSeverity | null;
}

export interface PazienteDetailData {
  paziente: Paziente;
  alerts: PazienteAlert[];
  flags: FlagRischio[];
}

export interface NuovoAlertInput {
  pazienteId: string;
  testo: string;
  severity: AlertSeverity;
  createdBy: string | null;
}
