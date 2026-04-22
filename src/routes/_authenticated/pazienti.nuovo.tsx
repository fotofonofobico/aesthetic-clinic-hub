import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Route as EditRoute } from "./pazienti.$id.edit";

export const Route = createFileRoute("/_authenticated/pazienti/nuovo")({
  component: NuovoPazienteRedirect,
});

function NuovoPazienteRedirect() {
  // riusiamo direttamente il form passando id="new"
  const navigate = useNavigate();
  // Renderizziamo direttamente il componente di edit con id "new"
  // tramite una piccola navigation
  if (typeof window !== "undefined") {
    // redirect lato client
    window.history.replaceState(null, "", "/pazienti/new/edit");
    void navigate({ to: "/pazienti/$id/edit", params: { id: "new" } });
  }
  return null;
}

// Tieni un riferimento per evitare warning di import non usato
void EditRoute;
