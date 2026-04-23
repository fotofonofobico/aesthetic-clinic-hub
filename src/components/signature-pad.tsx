import * as React from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
}

interface Props {
  onChange?: (empty: boolean) => void;
  height?: number;
}

export const SignaturePad = React.forwardRef<SignaturePadHandle, Props>(
  ({ onChange, height = 220 }, ref) => {
    const sigRef = React.useRef<SignatureCanvas | null>(null);
    const wrapRef = React.useRef<HTMLDivElement | null>(null);
    const [width, setWidth] = React.useState<number>(600);

    React.useEffect(() => {
      if (!wrapRef.current) return;
      const ro = new ResizeObserver((entries) => {
        for (const e of entries) {
          setWidth(Math.floor(e.contentRect.width));
        }
      });
      ro.observe(wrapRef.current);
      return () => ro.disconnect();
    }, []);

    React.useImperativeHandle(ref, () => ({
      isEmpty: () => sigRef.current?.isEmpty() ?? true,
      toDataURL: () => sigRef.current?.toDataURL("image/png") ?? "",
      clear: () => {
        sigRef.current?.clear();
        onChange?.(true);
      },
    }));

    return (
      <div className="space-y-2">
        <div
          ref={wrapRef}
          className="overflow-hidden rounded-lg border border-border bg-card"
          style={{ height }}
        >
          <SignatureCanvas
            ref={(r) => {
              sigRef.current = r;
            }}
            penColor="#0f172a"
            canvasProps={{
              width,
              height,
              className: "touch-none",
              style: { display: "block", width: "100%", height: "100%" },
            }}
            onEnd={() => onChange?.(sigRef.current?.isEmpty() ?? true)}
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              sigRef.current?.clear();
              onChange?.(true);
            }}
          >
            <Eraser className="h-4 w-4" />
            Cancella firma
          </Button>
        </div>
      </div>
    );
  },
);
SignaturePad.displayName = "SignaturePad";
