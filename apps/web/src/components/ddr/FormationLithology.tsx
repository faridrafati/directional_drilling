/**
 * Formation & Lithology tab — the multi-well Tops-matrix browser
 * (FormationMatrix): facet-filtered formation-tops cross-tab, lithology-%
 * table, and the multi-well lithology + formation graph. The former per-well
 * "Single well" view has been removed.
 */
import { FormationMatrix } from "./FormationMatrix.js";

export function FormationLithology() {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <FormationMatrix />
    </div>
  );
}
