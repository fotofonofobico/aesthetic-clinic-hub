/**
 * Logica flag rischio automatici (anamnesi v2).
 * Due livelli: "critico" (rosso) e "attenzione" (ambra).
 */

import type { AlertSeverity } from "@/types/clinico";

export interface AutoFlag {
  codice: string;
  etichetta: string;
  severity: AlertSeverity;
}

type Ternary = "si" | "no" | "occasionale" | "";
type CondizioniOrmonali = "nessuna" | "gravidanza" | "allattamento" | "menopausa" | "";

export interface AnamnesiGenerale {
  allergie?: boolean;
  allergie_note?: string;
  lidocaina_sensibile?: boolean;
  fumo?: Ternary;
  alcol?: Ternary;
  caffe?: Ternary;
  sport?: boolean;
  sport_note?: string;
  alimentazione?: "sana" | "abbastanza" | "disequilibrata" | "";
  acqua_litri?: number | null;
  condizioni_ormonali?: CondizioniOrmonali;
  vaccino_recente?: boolean;
  vaccino_note?: string;
}

export interface AnamnesiPatologica {
  presenti?: boolean;
  diabete?: boolean;
  ipertensione?: boolean;
  tiroide?: boolean;
  cardiopatia?: boolean;
  varici?: boolean;
  coagulopatia?: boolean;
  asma_bpco?: boolean;
  oncologico_attivo?: boolean;
  neoplasia_pregressa?: boolean;
  autoimmune?: boolean;
  cheloidi?: boolean;
  dermatopatie?: boolean;
  hsv?: boolean;
  altro?: boolean;
  altro_note?: string;
  interventi?: boolean;
  interventi_tipi?: {
    maggiore?: boolean;
    traumi?: boolean;
    estetica?: boolean;
    dermatologica?: boolean;
    altro?: boolean;
  };
  interventi_altro_note?: string;
  interventi_note?: string;
  // Patologie infettive (anamnesi generale)
  infettiva?: boolean;
  hbv?: boolean;
  hcv?: boolean;
  hiv?: boolean;
  infettiva_altro?: boolean;
  infettiva_altro_note?: string;
  infettiva_note?: string;
}

export interface AnamnesiFarmacologica {
  presenti?: boolean;
  anticoagulanti?: boolean;
  cortisonici?: boolean;
  isotretinoina?: boolean;
  immunosoppressori?: boolean;
  integratori?: boolean;
  altro?: boolean;
  altro_note?: string;
}

export interface AnamnesiEstetica {
  fototipo?: "I" | "II" | "III" | "IV" | "V" | "VI" | "";
  texture?: "omogenea" | "parziale" | "disomogenea" | "";
  abbronzatura?: boolean;
  elastosi?: boolean;
  spf_uso?: boolean;
  trattamenti_pregressi?: boolean;
  trattamenti_pregressi_note?: string;
  reazioni_pregresse?: boolean;
  reazioni_pregresse_note?: string;
}

export interface AnamnesiPayload {
  generale?: AnamnesiGenerale;
  patologica?: AnamnesiPatologica;
  farmacologica?: AnamnesiFarmacologica;
  estetica?: AnamnesiEstetica;
}

export function computeAutoFlags(a: AnamnesiPayload): AutoFlag[] {
  const f: AutoFlag[] = [];
  const g = a.generale ?? {};
  const p = a.patologica ?? {};
  const fa = a.farmacologica ?? {};
  const es = a.estetica ?? {};

  // === CRITICI (rosso) ===
  if (g.allergie) {
    f.push({ codice: "ALLERGIE", etichetta: "Allergie", severity: "critico" });
  }
  if (g.lidocaina_sensibile) {
    f.push({
      codice: "LIDOCAINA",
      etichetta: "Sensibilità/reazioni ad anestetici locali",
      severity: "critico",
    });
  }
  if (g.condizioni_ormonali === "gravidanza") {
    f.push({ codice: "GRAVIDANZA", etichetta: "In gravidanza", severity: "critico" });
  }
  if (g.condizioni_ormonali === "allattamento") {
    f.push({ codice: "ALLATTAMENTO", etichetta: "In allattamento", severity: "critico" });
  }
  if (p.presenti) {
    if (p.coagulopatia) {
      f.push({
        codice: "COAGULOPATIA",
        etichetta: "Coagulopatia / patologia ematologica",
        severity: "critico",
      });
    }
    if (p.oncologico_attivo) {
      f.push({
        codice: "ONCOLOGICO_ATTIVO",
        etichetta: "Oncologico attivo",
        severity: "critico",
      });
    }
    if (p.dermatopatie) {
      f.push({
        codice: "DERMATOPATIE",
        etichetta: "Dermatopatie attive",
        severity: "critico",
      });
    }
  }
  if (fa.presenti && fa.isotretinoina) {
    f.push({
      codice: "ISOTRETINOINA",
      etichetta: "Isotretinoina ultimi 6 mesi",
      severity: "critico",
    });
  }

  // === ATTENZIONE (ambra) ===
  if (fa.presenti) {
    if (fa.anticoagulanti) {
      f.push({
        codice: "ANTICOAGULANTI",
        etichetta: "Terapia anticoagulante / antiaggregante",
        severity: "attenzione",
      });
    }
    if (fa.immunosoppressori) {
      f.push({
        codice: "IMMUNOSOPPRESSORI",
        etichetta: "Terapia immunosoppressiva",
        severity: "attenzione",
      });
    }
    if (fa.cortisonici) {
      f.push({
        codice: "CORTISONICI",
        etichetta: "Terapia cortisonica",
        severity: "attenzione",
      });
    }
  }
  if (p.presenti) {
    if (p.autoimmune) {
      f.push({
        codice: "AUTOIMMUNE",
        etichetta: "Malattia autoimmune",
        severity: "attenzione",
      });
    }
    if (p.cardiopatia) {
      f.push({ codice: "CARDIOPATIA", etichetta: "Cardiopatia", severity: "attenzione" });
    }
    if (p.diabete) {
      f.push({ codice: "DIABETE", etichetta: "Diabete", severity: "attenzione" });
    }
    if (p.hsv) {
      f.push({ codice: "HSV", etichetta: "HSV (Herpes simplex)", severity: "attenzione" });
    }
    if (p.cheloidi) {
      f.push({ codice: "CHELOIDI", etichetta: "Cheloidi", severity: "attenzione" });
    }
    if (p.neoplasia_pregressa) {
      f.push({
        codice: "NEOPLASIA_PREGRESSA",
        etichetta: "Neoplasia pregressa",
        severity: "attenzione",
      });
    }
  }
  if (es.reazioni_pregresse) {
    f.push({
      codice: "REAZIONI_PREGRESSE",
      etichetta: "Reazioni pregresse a trattamenti",
      severity: "attenzione",
    });
  }

  return f;
}
