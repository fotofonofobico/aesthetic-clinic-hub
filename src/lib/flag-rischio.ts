/**
 * Calcolo flag rischio automatici a partire dai dati di anamnesi.
 * Output: lista di codici/etichette/severità che vengono persistiti
 * nella tabella anamnesi_flag_rischio (origine = 'auto').
 */

import type { AlertSeverity } from "@/types/clinico";

export interface AutoFlag {
  codice: string;
  etichetta: string;
  severity: AlertSeverity;
}

export interface AnamnesiPayload {
  generale?: {
    gravidanza?: boolean;
    allattamento?: boolean;
    portatore_pacemaker?: boolean;
  };
  patologica?: {
    diabete?: boolean;
    cardiopatia?: boolean;
    ipertensione?: boolean;
    epilessia?: boolean;
    tumori_attivi?: boolean;
    malattie_autoimmuni?: boolean;
    cheloidi?: boolean;
    herpes_recidivante?: boolean;
  };
  farmacologica?: {
    anticoagulanti?: boolean;
    cortisonici?: boolean;
    isotretinoina_recente?: boolean;
    immunosoppressori?: boolean;
  };
  allergologica?: {
    lattice?: boolean;
    anestetici_locali?: boolean;
    farmaci?: string;
    altre?: string;
  };
  abitudini?: {
    fuma?: boolean;
    alcol_eccesso?: boolean;
  };
}

export function computeAutoFlags(a: AnamnesiPayload): AutoFlag[] {
  const flags: AutoFlag[] = [];

  if (a.generale?.gravidanza) {
    flags.push({ codice: "GRAVIDANZA", etichetta: "In gravidanza", severity: "critico" });
  }
  if (a.generale?.allattamento) {
    flags.push({ codice: "ALLATTAMENTO", etichetta: "In allattamento", severity: "attenzione" });
  }
  if (a.generale?.portatore_pacemaker) {
    flags.push({ codice: "PACEMAKER", etichetta: "Portatore pacemaker", severity: "critico" });
  }

  if (a.patologica?.diabete) {
    flags.push({ codice: "DIABETE", etichetta: "Diabete", severity: "attenzione" });
  }
  if (a.patologica?.cardiopatia) {
    flags.push({ codice: "CARDIOPATIA", etichetta: "Cardiopatia", severity: "critico" });
  }
  if (a.patologica?.ipertensione) {
    flags.push({ codice: "IPERTENSIONE", etichetta: "Ipertensione", severity: "info" });
  }
  if (a.patologica?.epilessia) {
    flags.push({ codice: "EPILESSIA", etichetta: "Epilessia", severity: "critico" });
  }
  if (a.patologica?.tumori_attivi) {
    flags.push({ codice: "TUMORE", etichetta: "Patologia oncologica attiva", severity: "critico" });
  }
  if (a.patologica?.malattie_autoimmuni) {
    flags.push({
      codice: "AUTOIMMUNE",
      etichetta: "Malattia autoimmune",
      severity: "attenzione",
    });
  }
  if (a.patologica?.cheloidi) {
    flags.push({ codice: "CHELOIDI", etichetta: "Tendenza cheloidi", severity: "attenzione" });
  }
  if (a.patologica?.herpes_recidivante) {
    flags.push({
      codice: "HERPES",
      etichetta: "Herpes recidivante (profilassi pre-trattamento)",
      severity: "attenzione",
    });
  }

  if (a.farmacologica?.anticoagulanti) {
    flags.push({
      codice: "ANTICOAGULANTI",
      etichetta: "Terapia anticoagulante",
      severity: "critico",
    });
  }
  if (a.farmacologica?.cortisonici) {
    flags.push({
      codice: "CORTISONICI",
      etichetta: "Terapia cortisonica",
      severity: "attenzione",
    });
  }
  if (a.farmacologica?.isotretinoina_recente) {
    flags.push({
      codice: "ISOTRETINOINA",
      etichetta: "Isotretinoina assunta negli ultimi 6 mesi",
      severity: "critico",
    });
  }
  if (a.farmacologica?.immunosoppressori) {
    flags.push({
      codice: "IMMUNOSOPPRESSORI",
      etichetta: "Terapia immunosoppressiva",
      severity: "critico",
    });
  }

  if (a.allergologica?.lattice) {
    flags.push({ codice: "ALLERGIA_LATTICE", etichetta: "Allergia lattice", severity: "critico" });
  }
  if (a.allergologica?.anestetici_locali) {
    flags.push({
      codice: "ALLERGIA_ANESTETICI",
      etichetta: "Allergia anestetici locali",
      severity: "critico",
    });
  }

  if (a.abitudini?.fuma) {
    flags.push({ codice: "FUMO", etichetta: "Fumatore", severity: "info" });
  }

  return flags;
}
