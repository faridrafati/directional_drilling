import { describe, it, expect } from "vitest";
import { surToVct, vctToSur, dot, cross, length, normalise } from "./vector.js";
import { rotateAboutAxis } from "./rotation.js";
import { projectToPlane, unprojectFromPlane } from "./plane.js";
import { incFind, azmFind } from "./solve.js";

const PI = Math.PI;
const close = (a: number, b: number, prec = 10) => expect(a).toBeCloseTo(b, prec);

describe("surToVct / vctToSur", () => {
  it("vertical: inc=0 → tvd=1, ns=ew=0", () => {
    const v = surToVct({ inc: 0, azm: 0 });
    close(v.tvd, 1); close(v.ns, 0); close(v.ew, 0);
  });

  it("horizontal north: inc=π/2, azm=0 → ns=1", () => {
    const v = surToVct({ inc: PI / 2, azm: 0 });
    close(v.ns, 1); close(v.ew, 0); close(v.tvd, 0);
  });

  it("horizontal east: inc=π/2, azm=π/2 → ew=1", () => {
    const v = surToVct({ inc: PI / 2, azm: PI / 2 });
    close(v.ns, 0); close(v.ew, 1); close(v.tvd, 0);
  });

  it("round-trips a representative cluster of angles", () => {
    const cases: Array<{ inc: number; azm: number }> = [
      { inc: 0.1, azm: 0.3 },
      { inc: 0.5, azm: 1.2 },
      { inc: 1.0, azm: 4.0 },
      { inc: 1.4, azm: 5.8 },
    ];
    const wrap = (x: number) => ((x % (2 * PI)) + 2 * PI) % (2 * PI);
    for (const c of cases) {
      const back = vctToSur(surToVct(c));
      close(back.inc, c.inc, 8);
      close(wrap(back.azm), wrap(c.azm), 6);
    }
  });

  it("normalises azimuth to [0, 2π)", () => {
    const a = vctToSur({ ns: 1, ew: -1, tvd: 0 });
    expect(a.azm).toBeGreaterThanOrEqual(0);
    expect(a.azm).toBeLessThan(2 * PI);
  });
});

describe("vector arithmetic", () => {
  it("dot/cross of ortho basis", () => {
    const n = { ns: 1, ew: 0, tvd: 0 };
    const e = { ns: 0, ew: 1, tvd: 0 };
    expect(dot(n, e)).toBe(0);
    const c = cross(n, e);
    expect(c.tvd).toBe(1); expect(c.ns).toBe(0); expect(c.ew).toBe(0);
  });

  it("normalise gives unit length", () => {
    const n = normalise({ ns: 3, ew: 4, tvd: 0 });
    expect(length(n)).toBeCloseTo(1, 12);
  });
});

describe("rotateAboutAxis", () => {
  it("rotating about z-axis (tvd) by π swaps signs of ns/ew", () => {
    const r = rotateAboutAxis(
      { ns: 0, ew: 0, tvd: 0 },
      { ns: 0, ew: 0, tvd: 1 },
      PI,
      { ns: 1, ew: 0, tvd: 0 }
    );
    close(r.ns, -1, 10); close(r.ew, 0, 10); close(r.tvd, 0, 10);
  });

  it("rotation by 2π is identity", () => {
    const p = { ns: 1.5, ew: -0.7, tvd: 2.0 };
    const r = rotateAboutAxis({ ns: 0, ew: 0, tvd: 0 }, { ns: 1, ew: 1, tvd: 1 }, 2 * PI, p);
    close(r.ns, p.ns, 8); close(r.ew, p.ew, 8); close(r.tvd, p.tvd, 8);
  });

  it("zero-length axis returns original point", () => {
    const p = { ns: 5, ew: 7, tvd: 9 };
    const r = rotateAboutAxis({ ns: 0, ew: 0, tvd: 0 }, { ns: 0, ew: 0, tvd: 0 }, PI / 3, p);
    expect(r).toEqual(p);
  });
});

describe("projectToPlane / unprojectFromPlane", () => {
  it("project then unproject is identity for representative inputs", () => {
    const a1 = { ns: 0, ew: 0, tvd: 0 };
    const a2 = { ns: 0, ew: 0, tvd: 1 }; // vertical
    const a3 = { ns: 1, ew: 0.5, tvd: 0.3 };
    const p = { ns: 2.5, ew: 1.1, tvd: 0.8 };
    const { projected, theta } = projectToPlane(a1, a2, a3, p);
    const back = unprojectFromPlane(a1, a2, a3, theta, projected);
    close(back.ns, p.ns, 6); close(back.ew, p.ew, 6); close(back.tvd, p.tvd, 6);
  });

  it("zero ns shortcut leaves point unchanged", () => {
    const a1 = { ns: 1, ew: 1, tvd: 1 };
    const a2 = { ns: 1, ew: 0, tvd: 0 };
    const a3 = { ns: 0, ew: 1, tvd: 0 };
    const p = { ns: 0, ew: 4, tvd: 5 };
    const r = projectToPlane(a1, a2, a3, p);
    expect(r.projected).toEqual(p);
  });
});

describe("incFind / azmFind", () => {
  it("incFind returns ok for a non-degenerate plane", () => {
    // Need a2 × a3 to have non-zero az (=ns*ew − ew*ns); the previous inputs gave az=0.
    const r = incFind({ ns: 1, ew: 0, tvd: 0 }, { ns: 0, ew: 1, tvd: 1 }, PI / 4);
    expect(r.ok).toBe(true);
    expect(r.inc).toBeGreaterThan(0);
  });

  it("azmFind returns two candidates", () => {
    const a1 = { ns: 0, ew: 0, tvd: 0 };
    const a2 = { ns: 0, ew: 0, tvd: 1 };
    const a3 = { ns: 1, ew: 1, tvd: 0 };
    const r = azmFind(a1, a2, a3, PI / 6);
    expect(r.ok).toBe(true);
    expect(typeof r.candidate1).toBe("number");
    expect(typeof r.candidate2).toBe("number");
  });
});
