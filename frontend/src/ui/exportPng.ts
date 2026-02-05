import { toPng } from "html-to-image";
import { saveAs } from "file-saver";

export async function exportRefToPng(el: HTMLElement | null, filename: string) {
  if (!el) return;

  // Make sure background is white in the exported PNG
  const dataUrl = await toPng(el, {
    cacheBust: true,
    backgroundColor: "#FFFFFF",
    pixelRatio: 2,
  });

  saveAs(dataUrl, filename);
}
