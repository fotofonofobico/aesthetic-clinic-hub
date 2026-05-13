export interface BmiResult {
  value: number;
  category: "sottopeso" | "normo" | "sovrappeso" | "obesita";
  label: string;
}

export function calcolaBmi(
  pesoKg: number | null | undefined,
  altezzaCm: number | null | undefined,
): BmiResult | null {
  const peso = typeof pesoKg === "number" ? pesoKg : Number(pesoKg);
  const altezza = typeof altezzaCm === "number" ? altezzaCm : Number(altezzaCm);
  if (!peso || !altezza || altezza <= 0) return null;
  const m = altezza / 100;
  const value = Math.round((peso / (m * m)) * 10) / 10;
  let category: BmiResult["category"];
  let label: string;
  if (value < 18.5) {
    category = "sottopeso";
    label = "Sottopeso";
  } else if (value < 25) {
    category = "normo";
    label = "Normopeso";
  } else if (value < 30) {
    category = "sovrappeso";
    label = "Sovrappeso";
  } else {
    category = "obesita";
    label = "Obesità";
  }
  return { value, category, label };
}
