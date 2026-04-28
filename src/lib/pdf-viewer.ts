function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[char] ?? char;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Conversione PDF non riuscita"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Lettura PDF non riuscita"));
    reader.readAsDataURL(blob);
  });
}

export async function renderPdfInWindow(
  targetWindow: Window,
  blob: Blob,
  title = "PDF",
): Promise<void> {
  const pdfBlob =
    blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
  const dataUrl = await blobToDataUrl(pdfBlob);
  const safeTitle = escapeHtml(title);

  targetWindow.document.open();
  targetWindow.document.write(`<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    html, body { margin: 0; height: 100%; background: #f4f4f5; color: #111827; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .toolbar { height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 12px; background: white; border-bottom: 1px solid #d4d4d8; box-sizing: border-box; }
    .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
    button, a { border: 1px solid #d4d4d8; border-radius: 8px; background: white; color: #111827; padding: 7px 10px; font-size: 13px; text-decoration: none; cursor: pointer; }
    button:hover, a:hover { background: #f4f4f5; }
    iframe { display: block; width: 100%; height: calc(100vh - 48px); border: 0; background: white; }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="title">${safeTitle}</div>
    <button type="button" onclick="window.print()">Stampa</button>
    <a href="${dataUrl}" download="${safeTitle.replace(/[^a-z0-9._-]+/gi, "_")}.pdf">Scarica PDF</a>
  </div>
  <iframe title="${safeTitle}" src="${dataUrl}"></iframe>
</body>
</html>`);
  targetWindow.document.close();
}
