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

type TernaryFreq = "si" | "no" | "occasionale" | "";

export interface AnamnesiPayload {
  generale?: {
    gravidanza?: boolean;
    allattamento?: boolean;
    menopausa?: boolean;
    portatore_pacemaker?: boolean;
    vaccinazione_recente?: boolean;
  };
  patologica?: {
    diabete?: boolean;
    tiroide?: boolean;
    cardiopatia?: boolean;
    ipertensione?: boolean;
    varici?: boolean;
    coagulopatia?: boolean;
    asma_bpco?: boolean;
    epilessia?: boolean;
    cefalea_cronica?: boolean;
    psichiatrico?: boolean;
    tumori_attivi?: boolean;
    tumori_pregressi?: boolean;
    malattie_autoimmuni?: boolean;
    cheloidi?: boolean;
    herpes_recidivante?: boolean;
    dermatologica_attiva?: boolean;
    infettiva_hbv_hcv_hiv?: boolean;
    interventi_viso?: boolean;
  };
  farmacologica?: {
    anticoagulanti?: boolean;
    cortisonici?: boolean;
    isotretinoina_recente?: boolean;
    immunosoppressori?: boolean;
    terapie_in_corso?: string;
    integratori?: boolean;
  };
  allergologica?: {
    lattice?: boolean;
    anestetici_locali?: boolean;
    farmaci?: boolean;
    alimentari_ambientali?: boolean;
    anafilassi_pregressa?: boolean;
  };
  abitudini?: {
    fumo?: TernaryFreq;
    alcol?: TernaryFreq;
    sostanze?: TernaryFreq;
    sport?: boolean;
    alimentazione?: "sana" | "abbastanza" | "disequilibrata" | "";
  };
  estetica?: {
    fototipo?: "I" | "II" | "III" | "IV" | "V" | "VI" | "";
    abbronzatura?: boolean;
    elastosi?: boolean;
    texture?: "omogenea" | "parziale" | "disomogenea" | "";
    trattamenti_pregressi?: Record<string, boolean>;
    filler_permanenti?: boolean;
    reazioni_pregresse?: boolean;
    esposizione_prevista_4w?: boolean;
    spf_uso?: boolean;
  };
}

export function computeAutoFlags(a: AnamnesiPayload): AutoFlag[] {
  const f: AutoFlag[] = [];

  // ---- Generale ----
  if (a.generale?.gravidanza) f.push({ codice: "GRAVIDANZA", etichetta: "In gravidanza", severity: "critico" });
  if (a.generale?.allattamento) f.push({ codice: "ALLATTAMENTO", etichetta: "In allattamento", severity: "attenzione" });
  if (a.generale?.menopausa) f.push({ codice: "MENOPAUSA", etichetta: "Menopausa", severity: "info" });
  if (a.generale?.portatore_pacemaker) f.push({ codice: "PACEMAKER", etichetta: "Portatore pacemaker", severity: "critico" });
  if (a.generale?.vaccinazione_recente) f.push({ codice: "VACCINO_RECENTE", etichetta: "Vaccinazione recente (<2 sett.)", severity: "attenzione" });

  // ---- Patologica ----
  if (a.patologica?.diabete) f.push({ codice: "DIABETE", etichetta: "Diabete", severity: "attenzione" });
  if (a.patologica?.tiroide) f.push({ codice: "TIROIDE", etichetta: "Patologia tiroidea", severity: "info" });
  if (a.patologica?.cardiopatia) f.push({ codice: "CARDIOPATIA", etichetta: "Cardiopatia", severity: "critico" });
  if (a.patologica?.ipertensione) f.push({ codice: "IPERTENSIONE", etichetta: "Ipertensione", severity: "info" });
  if (a.patologica?.varici) f.push({ codice: "VARICI", etichetta: "Varici", severity: "info" });
  if (a.patologica?.coagulopatia) f.push({ codice: "COAGULOPATIA", etichetta: "Coagulopatia", severity: "critico" });
  if (a.patologica?.asma_bpco) f.push({ codice: "RESPIRATORIA", etichetta: "Asma / BPCO", severity: "attenzione" });
  if (a.patologica?.epilessia) f.push({ codice: "EPILESSIA", etichetta: "Epilessia", severity: "critico" });
  if (a.patologica?.cefalea_cronica) f.push({ codice: "CEFALEA", etichetta: "Cefalea cronica / emicrania", severity: "info" });
  if (a.patologica?.psichiatrico) f.push({ codice: "PSICHIATRICO", etichetta: "Disturbo psichiatrico", severity: "attenzione" });
  if (a.patologica?.tumori_attivi) f.push({ codice: "TUMORE", etichetta: "Patologia oncologica attiva", severity: "critico" });
  if (a.patologica?.tumori_pregressi) f.push({ codice: "TUMORE_PREGRESSO", etichetta: "Neoplasia pregressa", severity: "attenzione" });
  if (a.patologica?.malattie_autoimmuni) f.push({ codice: "AUTOIMMUNE", etichetta: "Malattia autoimmune", severity: "attenzione" });
  if (a.patologica?.cheloidi) f.push({ codice: "CHELOIDI", etichetta: "Tendenza cheloidi", severity: "attenzione" });
  if (a.patologica?.herpes_recidivante) f.push({ codice: "HERPES", etichetta: "Herpes recidivante (profilassi pre-trattamento)", severity: "attenzione" });
  if (a.patologica?.dermatologica_attiva) f.push({ codice: "DERMATOLOGICA", etichetta: "Dermatopatia attiva (acne/psoriasi/dermatite)", severity: "attenzione" });
  if (a.patologica?.infettiva_hbv_hcv_hiv) f.push({ codice: "INFETTIVA", etichetta: "Patologia infettiva (HBV/HCV/HIV)", severity: "critico" });

  // ---- Farmaci ----
  if (a.farmacologica?.anticoagulanti) f.push({ codice: "ANTICOAGULANTI", etichetta: "Terapia anticoagulante", severity: "critico" });
  if (a.farmacologica?.cortisonici) f.push({ codice: "CORTISONICI", etichetta: "Terapia cortisonica", severity: "attenzione" });
  if (a.farmacologica?.isotretinoina_recente) f.push({ codice: "ISOTRETINOINA", etichetta: "Isotretinoina ultimi 6 mesi", severity: "critico" });
  if (a.farmacologica?.immunosoppressori) f.push({ codice: "IMMUNOSOPPRESSORI", etichetta: "Terapia immunosoppressiva", severity: "critico" });
  if (a.farmacologica?.integratori) f.push({ codice: "INTEGRATORI", etichetta: "Integratori (verificare interazioni)", severity: "info" });

  // ---- Allergie ----
  if (a.allergologica?.lattice) f.push({ codice: "ALLERGIA_LATTICE", etichetta: "Allergia lattice", severity: "critico" });
  if (a.allergologica?.anestetici_locali) f.push({ codice: "ALLERGIA_ANESTETICI", etichetta: "Allergia anestetici locali", severity: "critico" });
  if (a.allergologica?.farmaci) f.push({ codice: "ALLERGIA_FARMACI", etichetta: "Allergia a farmaci", severity: "attenzione" });
  if (a.allergologica?.anafilassi_pregressa) f.push({ codice: "ANAFILASSI", etichetta: "Reazione anafilattica pregressa", severity: "critico" });

  // ---- Abitudini ----
  if (a.abitudini?.fumo === "si") f.push({ codice: "FUMO", etichetta: "Fumatore", severity: "info" });
  if (a.abitudini?.alcol === "si") f.push({ codice: "ALCOL", etichetta: "Consumo alcolico abituale", severity: "info" });
  if (a.abitudini?.sostanze === "si") f.push({ codice: "SOSTANZE", etichetta: "Uso sostanze stupefacenti", severity: "attenzione" });
  if (a.abitudini?.alimentazione === "disequilibrata") f.push({ codice: "DIETA", etichetta: "Alimentazione disequilibrata", severity: "info" });

  // ---- Estetica ----
  if (a.estetica?.filler_permanenti) f.push({ codice: "FILLER_PERMANENTI", etichetta: "Filler permanenti/semipermanenti pregressi", severity: "critico" });
  if (a.estetica?.reazioni_pregresse) f.push({ codice: "REAZIONI_ESTETICHE", etichetta: "Reazioni a trattamenti estetici pregressi", severity: "critico" });
  if (a.estetica?.esposizione_prevista_4w) f.push({ codice: "SOLE_4W", etichetta: "Esposizione solare prevista nelle 4 sett.", severity: "attenzione" });
  if (a.estetica?.fototipo === "V" || a.estetica?.fototipo === "VI") {
    f.push({ codice: "FOTOTIPO_ALTO", etichetta: `Fototipo ${a.estetica.fototipo} (rischio iperpigmentazione)`, severity: "attenzione" });
  }

  return f;
}
