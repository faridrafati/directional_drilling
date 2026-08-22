/**
 * `peloton.appframe.ini` — WellView's own application manifest.
 *
 * Small enough to have been dismissed, and it should not have been: it names
 * the exact build every piece of shipped material came from, and it numbers the
 * five single-well visual tools, which is where the app's tab order comes from
 * rather than from someone's preference.
 *
 * Skips cleanly when the vendor tree is absent, which a clean checkout is.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appFrame, WELL_FILE_EXTENSION, WELLVIEW_DATA_EXTENSION } from "./appframe.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const INI = join(HERE, "..", "..", "..", "..", "WellView_files", "system", "peloton.appframe.ini");
const d = describe.skipIf(!existsSync(INI));

describe("the manifest is optional", () => {
  it("does not claim a version this app cannot substantiate", () => {
    // Absent vendor tree -> null, never a hardcoded guess. A version printed
    // from memory would go stale against the export it is meant to describe.
    const a = appFrame();
    if (!existsSync(INI)) expect(a).toBeNull();
    else expect(a).not.toBeNull();
  });
});

d("peloton.appframe.ini", () => {
  it("names the build the shipped material came from", () => {
    const a = appFrame()!;
    expect(a.appName).toBe("WellView 9.0");
    expect(a.version).toBe("9.0");
    // The templates, data model, unit table and icons are all from THIS package.
    expect(a.packageId).toBe("9.0.20111208");
  });

  it("gives the five single-well tools in their numbered order", () => {
    const a = appFrame()!;
    expect(a.singleTools.length).toBe(5);
    // Values in the file are the display order, not the file order, so this
    // asserts the sort — reading them in file order would look identical here
    // only by luck.
    expect(a.singleTools.map((t) => t.split(".").pop())).toEqual([
      "ReportEngineControlSingle",
      "wellboreschematic",
      "wellhead",
      "TimeTracksControl",
      "DaysVsDepth",
    ]);
    expect(a.multiTools.map((t) => t.split(".").pop())).toEqual(["ReportEngineControlMulti"]);
  });

  it("confirms the one tool the app does not build, and why that is right", () => {
    // Time Tracks is the only one of the five with no counterpart, and the
    // reason is data, not effort: wvTimeCurve and wvJobOfflineTimeLog are empty
    // in both converted databases and the .ttr templates are missing from this
    // export. The manifest is what proves the list is otherwise complete.
    const built = ["ReportEngineControlSingle", "wellboreschematic", "wellhead", "DaysVsDepth"];
    const a = appFrame()!;
    const names = a.singleTools.map((t) => t.split(".").pop()!);
    expect(names.filter((n) => !built.includes(n))).toEqual(["TimeTracksControl"]);
  });

  it("does NOT take WellView's own well-file extension", () => {
    // The manifest says a WellView well file is `.wvd`. What Export Well writes
    // is a JSON document of this app's making that WellView cannot open, so
    // borrowing the extension would claim an interoperability that is not there.
    expect(WELLVIEW_DATA_EXTENSION).toBe("wvd");
    expect(WELL_FILE_EXTENSION).not.toContain("wvd");
    expect(WELL_FILE_EXTENSION).toBe("wellview.json");
  });
});
