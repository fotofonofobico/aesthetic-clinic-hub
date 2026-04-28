/**
 * PLACEHOLDER — sostituire con tabella `prodotti` quando si introdurrà
 * la gestione magazzino. Per ora i prodotti vivono come array statico
 * lato client e vengono persistiti come JSONB sulle voci di piano e
 * sulle sedute.
 */

export interface ProdottoDemo {
  id: string;
  nome: string;
  categoria: "tossina" | "filler" | "biostimolante" | "peeling" | "altro";
  unita: string; // es. "fiala", "ml", "siringa"
}

export const PRODOTTI_DEMO: ProdottoDemo[] = [
  { id: "vistabex-50", nome: "Vistabex 50U", categoria: "tossina", unita: "flacone" },
  { id: "vistabex-100", nome: "Vistabex 100U", categoria: "tossina", unita: "flacone" },
  { id: "azzalure", nome: "Azzalure 125U", categoria: "tossina", unita: "flacone" },
  { id: "hyalual-1-8", nome: "Hyalual 1.8%", categoria: "biostimolante", unita: "siringa" },
  { id: "hyalual-2-2", nome: "Hyalual 2.2%", categoria: "biostimolante", unita: "siringa" },
  { id: "profhilo", nome: "Profhilo", categoria: "biostimolante", unita: "siringa" },
  { id: "juvederm-volift", nome: "Juvederm Volift", categoria: "filler", unita: "siringa" },
  { id: "juvederm-volbella", nome: "Juvederm Volbella", categoria: "filler", unita: "siringa" },
  { id: "restylane-kysse", nome: "Restylane Kysse", categoria: "filler", unita: "siringa" },
  { id: "teosyal-rha2", nome: "Teosyal RHA 2", categoria: "filler", unita: "siringa" },
  { id: "peeling-tca", nome: "Peeling TCA 15%", categoria: "peeling", unita: "applicazione" },
];

export function prodottiPerTrattamento(_trattamentoId?: string | null): ProdottoDemo[] {
  // TODO: filtrare in base al trattamento quando esisterà la mappatura.
  return PRODOTTI_DEMO;
}
