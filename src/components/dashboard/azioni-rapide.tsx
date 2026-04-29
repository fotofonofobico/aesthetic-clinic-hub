import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { UserPlus, Syringe, FileSignature } from "lucide-react";

export function AzioniRapide() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Button asChild variant="outline" className="justify-start">
        <Link to="/pazienti">
          <UserPlus className="h-4 w-4" />
          Nuovo paziente
        </Link>
      </Button>
      <Button asChild variant="outline" className="justify-start">
        <Link to="/trattamenti">
          <Syringe className="h-4 w-4" />
          Nuovo trattamento
        </Link>
      </Button>
      <Button asChild variant="outline" className="justify-start">
        <Link to="/consensi">
          <FileSignature className="h-4 w-4" />
          Nuovo consenso
        </Link>
      </Button>
    </div>
  );
}
