import { describe, it, expect } from "vitest";
import { hold } from "./hold.js";
import { c3 } from "./c3.js";
import { sursta } from "./sursta.js";
import { hoctt } from "./hoctt.js";
import { hc3dtft } from "./hc3dtft.js";
import { ch3dffk } from "./ch3dffk.js";
import { ch } from "./ch.js";
import { hch } from "./hch.js";
import { cc2d } from "./cc2d.js";
import { ch2dc1 } from "./ch2dc1.js";
import { ch2dc2 } from "./ch2dc2.js";

const PI = Math.PI;
const close = (a: number, b: number, prec = 6) => expect(a).toBeCloseTo(b, prec);

describe("hold", () => {
  it("vertical hold (theta1=0) produces straight-down station", () => {
    const r = hold({ theta1: 0, azm: 0, md: 1000 });
    expect(r.ok).toBe(true);
    expect(r.keyPoints).toHaveLength(1);
    close(r.keyPoints[0].tvd, 1000);
    close(r.keyPoints[0].ns, 0);
    close(r.keyPoints[0].ew, 0);
    expect(r.stations.length).toBeGreaterThan(0);
    // Last station IS the target
    const last = r.stations[r.stations.length - 1];
    close(last.md, 1000);
  });

  it("hold at 30° inc / azm=0 (due north)", () => {
    const md = 500;
    const r = hold({ theta1: PI / 6, azm: 0, md });
    close(r.keyPoints[0].ns, md * Math.sin(PI / 6));
    close(r.keyPoints[0].tvd, md * Math.cos(PI / 6));
    close(r.keyPoints[0].ew, 0);
  });

  it("MD<=0 fails", () => {
    expect(hold({ theta1: 0, azm: 0, md: -5 }).ok).toBe(false);
  });
});

describe("c3", () => {
  it("builds a 90° curve from 0° to 90° at dls=1", () => {
    const r = c3({ theta1: 0, theta2: PI / 2, dls: 1 });
    expect(r.ok).toBe(true);
    close(r.keyPoints[0].md, PI / 2);
    close(r.keyPoints[0].inc, PI / 2);
    // ew should equal r*(1 - 0) = 1 since r = 1
    close(r.keyPoints[0].ew, 1);
    // tvd should equal r*(1 - 0) = 1
    close(r.keyPoints[0].tvd, 1);
  });

  it("dls=0 fails", () => {
    expect(c3({ theta1: 0, theta2: PI / 2, dls: 0 }).ok).toBe(false);
  });
});

describe("sursta", () => {
  it("produces a station that round-trips MD", () => {
    const r = sursta({ theta1: 0, theta: PI / 4, md: 100 });
    expect(r.ok).toBe(true);
    close(r.keyPoints[0].md, 100);
    close(r.keyPoints[0].inc, PI / 4);
  });

  it("theta == theta1 fails (use Hold)", () => {
    expect(sursta({ theta1: PI / 6, theta: PI / 6, md: 100 }).ok).toBe(false);
  });
});

describe("hoctt", () => {
  it("vertical start to lateral target produces curve", () => {
    const r = hoctt({ theta1: 0, tgtx: 500, tgty: 1000 });
    expect(r.ok).toBe(true);
    expect(r.keyPoints).toHaveLength(1);
    // Final station should land at target
    const last = r.stations[r.stations.length - 1];
    close(last.ew, 500, 2);
    close(last.tvd, 1000, 2);
  });
});

describe("hc3dtft", () => {
  it("hold + curve to a deviated target", () => {
    const r = hc3dtft({ theta1: 0, tgtx: 1000, tgty: 3000, theta: PI / 4 });
    expect(r.ok).toBe(true);
    expect(r.keyPoints).toHaveLength(2);
    // KOP should be a positive depth, EOC at target
    expect(r.keyPoints[0].md).toBeGreaterThan(0);
    close(r.keyPoints[1].ew, 1000, 4);
    close(r.keyPoints[1].tvd, 3000, 4);
    close(r.keyPoints[1].inc, PI / 4);
  });

  it("infeasible target returns ok=false", () => {
    const r = hc3dtft({ theta1: PI / 2, tgtx: 0, tgty: 100, theta: 0 });
    expect(r.ok).toBe(false);
  });
});

describe("ch3dffk", () => {
  it("curve + hold to a deep deviated target", () => {
    // Curve to 30°, then a long hold — target must be deeper than the curve EOC.
    const r = ch3dffk({ theta1: 0, tgtx: 2000, tgty: 6000, theta: PI / 6 });
    expect(r.ok).toBe(true);
    expect(r.keyPoints).toHaveLength(2);
    const last = r.keyPoints[1];
    close(last.ew, 2000, 2);
    close(last.tvd, 6000, 2);
    close(last.inc, PI / 6);
  });
});

describe("ch", () => {
  it("solves a curve+hold (positive-root branch: target inside curve circle)", () => {
    // dls=0.0005 → r1=2000; tgtx=1500 < r1 picks the positive root.
    const r = ch({ theta1: 0, tgtx: 1500, tgty: 6000, dls: 0.0005 });
    expect(r.ok).toBe(true);
    expect(r.keyPoints).toHaveLength(2);
    close(r.keyPoints[1].tvd, 6000, 1);
  });
});

describe("hch", () => {
  it("hold-curve-hold to deviated target", () => {
    const r = hch({ theta1: 0, tgtx: 1500, tgty: 4000, theta: PI / 3, dls: 0.0015 });
    expect(r.ok).toBe(true);
    expect(r.keyPoints).toHaveLength(3);
    const last = r.keyPoints[2];
    close(last.ew, 1500, 3);
    close(last.tvd, 4000, 3);
    close(last.inc, PI / 3);
  });
});

describe("cc2d", () => {
  it("two back-to-back build curves", () => {
    // Both curves build inclination (theta2 > theta1, theta3 > theta2),
    // matching the Pascal contract that successive MDs are increasing.
    const r = cc2d({ theta1: 0, theta2: PI / 4, theta3: PI / 2, dls1: 0.001, dls2: 0.001 });
    expect(r.ok).toBe(true);
    expect(r.keyPoints).toHaveLength(2);
    close(r.keyPoints[1].inc, PI / 2);
  });
});

describe("ch2dc1", () => {
  it("solves a 3-segment well to a complex target", () => {
    const r = ch2dc1({
      theta1: 0, tgtx: 1500, tgty: 5000, theta: PI / 2,
      dls1: 0.0015, dls2: 0.0015,
    });
    expect(r.ok).toBe(true);
    expect(r.keyPoints).toHaveLength(3);
    const last = r.keyPoints[2];
    close(last.tvd, 5000, 2);
    close(last.ew, 1500, 2);
    close(last.inc, PI / 2);
  });

  it("picks alternate quadratic branch when the heuristic's branch is infeasible (chained CH→D3DS)", () => {
    // Regression: when D3DS follows a CH that left inc≈18°, Pascal's
    // `|tgtx| > |r1|` branch heuristic picks an impossible midInc (~-158°)
    // even though the other root (~22°) is perfectly feasible.
    const r = ch2dc1({
      theta1: 18 * PI / 180,   // build start at 18°
      theta:  60 * PI / 180,   // target inclination 60°
      tgtx: 1131,              // local horizontal step
      tgty: 2000,              // local TVD step
      dls1: 4 * PI / 180 / 100, // 4°/100ft
      dls2: 4 * PI / 180 / 100,
    });
    expect(r.ok).toBe(true);
    expect(r.keyPoints).toHaveLength(3);
    const last = r.keyPoints[2];
    close(last.inc, 60 * PI / 180, 3);
    close(last.ew, 1131, 1);
    close(last.tvd, 2000, 1);
  });
});

describe("ch2dc2", () => {
  it("solves with ddmmdd=true (mid inclination solved)", () => {
    const r = ch2dc2({
      theta1: 0, tgtx: 2000, tgty: 6000, theta: PI / 2,
      dls1: 0.0015, dls2: 0.0015,
      thetaex: 0, dmd: 300, ddmmdd: true,
    });
    expect(r.ok).toBe(true);
    expect(r.keyPoints).toHaveLength(4);
    const last = r.keyPoints[3];
    close(last.ew, 2000, 2);
    close(last.tvd, 6000, 2);
  });

  it("solves with ddmmdd=false (mid given, dmd solved)", () => {
    // For dmd to come out positive we need a wide horizontal step with shallow tvd.
    const r = ch2dc2({
      theta1: 0, tgtx: 10000, tgty: 3000, theta: PI / 2,
      dls1: 0.0010, dls2: 0.0010,
      thetaex: PI / 3, dmd: 0, ddmmdd: false,
    });
    expect(r.ok).toBe(true);
    expect(r.keyPoints).toHaveLength(4);
  });
});
