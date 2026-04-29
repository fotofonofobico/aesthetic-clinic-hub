import { useEffect, useState } from "react";
import { getSignedUrl, deleteFoto } from "@/lib/foto-clinica";
import type { FotoClinica } from "@/types/foto-clinica";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Trash2, ImageOff } from "lucide-react";
import { toast } from "sonner";

interface Props {
  foto: FotoClinica[];
  onDeleted?: (id: string) => void;
  canDelete?: boolean;
  emptyHint?: string;
}

function FotoThumb({
  f,
  onClick,
}: {
  f: FotoClinica;
  onClick: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSignedUrl(f.storage_path)
      .then((u) => mounted && setUrl(u))
      .catch(() => mounted && setError(true));
    return () => {
      mounted = false;
    };
  }, [f.storage_path]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square overflow-hidden rounded-md border bg-muted hover:ring-2 hover:ring-primary"
    >
      {error ? (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageOff className="h-6 w-6" />
        </div>
      ) : !url ? (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <img
          src={url}
          alt={f.zona ?? "foto clinica"}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-left">
        <div className="flex items-center gap-1">
          <Badge
            variant={f.momento === "prima" ? "default" : "secondary"}
            className="text-[10px]"
          >
            {f.momento.toUpperCase()}
          </Badge>
          <span className="text-[10px] font-medium text-white">
            {new Date(f.data_scatto).toLocaleDateString("it-IT")}
          </span>
        </div>
        {f.zona && (
          <p className="truncate text-[10px] text-white/90">{f.zona}</p>
        )}
      </div>
    </button>
  );
}

export function FotoGrid({ foto, onDeleted, canDelete, emptyHint }: Props) {
  const [openFoto, setOpenFoto] = useState<FotoClinica | null>(null);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!openFoto) {
      setOpenUrl(null);
      return;
    }
    let mounted = true;
    getSignedUrl(openFoto.storage_path).then((u) => mounted && setOpenUrl(u));
    return () => {
      mounted = false;
    };
  }, [openFoto]);

  async function handleDelete() {
    if (!openFoto) return;
    if (!confirm("Eliminare questa foto?")) return;
    setDeleting(true);
    try {
      await deleteFoto(openFoto);
      toast.success("Foto eliminata");
      onDeleted?.(openFoto.id);
      setOpenFoto(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  if (foto.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        {emptyHint ?? "Nessuna foto."}
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {foto.map((f) => (
          <FotoThumb key={f.id} f={f} onClick={() => setOpenFoto(f)} />
        ))}
      </div>

      <Dialog open={!!openFoto} onOpenChange={(v) => !v && setOpenFoto(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="sr-only">Foto clinica</DialogTitle>
          {openFoto && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={openFoto.momento === "prima" ? "default" : "secondary"}>
                  {openFoto.momento.toUpperCase()}
                </Badge>
                <span className="font-medium">
                  {new Date(openFoto.data_scatto).toLocaleDateString("it-IT")}
                </span>
                {openFoto.zona && (
                  <span className="text-muted-foreground">· {openFoto.zona}</span>
                )}
                <Badge variant="outline" className="ml-auto">
                  {openFoto.livello === "piano" ? "Piano" : "Seduta"}
                </Badge>
              </div>
              <div className="overflow-hidden rounded-md bg-black">
                {openUrl ? (
                  <img
                    src={openUrl}
                    alt="foto"
                    className="mx-auto max-h-[70vh] w-auto"
                  />
                ) : (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              {openFoto.note && (
                <p className="text-sm text-muted-foreground">{openFoto.note}</p>
              )}
              {canDelete && (
                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    <Trash2 className="h-4 w-4" />
                    Elimina
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
