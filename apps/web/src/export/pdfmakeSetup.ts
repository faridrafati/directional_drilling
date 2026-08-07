/**
 * Single place where pdfmake is loaded and its virtual font system is wired
 * up. Both PDF exports for a calculation — the stations-table report
 * (`pdf.ts`) and the Directional Plot report (`directionalPlot.ts`) — import
 * `pdfMake` from here so the VFS bootstrap happens exactly once and neither
 * module can drift from the other.
 *
 * In pdfmake 0.2.x, `vfs_fonts.js` is `module.exports = vfs` (the flat font
 * map), so the imported value itself IS the vfs; older builds nested it under
 * `.vfs` / `.pdfMake.vfs`. Try those, then fall back to the map.
 */
import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfMake as any).vfs = (pdfFonts as any).vfs ?? (pdfFonts as any).pdfMake?.vfs ?? pdfFonts;

export { pdfMake };
export default pdfMake;
