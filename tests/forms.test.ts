import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseForm, zCheckbox, zOptInt } from "@/lib/forms";

describe("parseForm", () => {
  const schema = z.object({ home: zCheckbox, fee: zOptInt("Fee") });
  it("treats a missing checkbox as false", () => {
    expect(parseForm(schema, new FormData())).toEqual({ data: { home: false, fee: null } });
  });
  it("reads a ticked checkbox and a number", () => {
    const fd = new FormData();
    fd.set("home", "on");
    fd.set("fee", "200");
    expect(parseForm(schema, fd)).toEqual({ data: { home: true, fee: 200 } });
  });
  it("returns per-field errors", () => {
    const fd = new FormData();
    fd.set("fee", "abc");
    const r = parseForm(schema, fd);
    expect("error" in r && r.error?.fieldErrors?.fee).toMatch(/whole number/);
  });
});
