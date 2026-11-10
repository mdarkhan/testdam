import { describe, expect, it } from "vitest";
import { validateCorporate } from "@/lib/corporate";

const ok = { companyName: "Acme Garments Ltd", contactName: "Rahim", phone: "০১৭১২৩৪৫৬৭৮", employees: "১২০", needs: "CBC, FBS, X-ray chest" };

describe("validateCorporate", () => {
  it("accepts a normal request and normalises phone, digits and email", () => {
    const r = validateCorporate({ ...ok, email: " HR@Acme.com.bd ", area: "Mirpur" });
    expect(r).toEqual({ ok: true, data: { companyName: "Acme Garments Ltd", contactName: "Rahim", phone: "01712345678", email: "hr@acme.com.bd", employees: 120, area: "Mirpur", needs: "CBC, FBS, X-ray chest" } });
  });
  it("reports every bad field", () => {
    const r = validateCorporate({ companyName: "", contactName: "R", phone: "123", email: "nope", employees: "0", needs: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fieldErrors).sort()).toEqual(["companyName", "contactName", "email", "employees", "needs", "phone"]);
  });
  it("treats a blank email and area as not given", () => {
    const r = validateCorporate({ ...ok, email: "  ", area: "" });
    expect(r.ok && r.data.email === null && r.data.area === null).toBe(true);
  });
  it("accepts 1,000-style employee counts", () => {
    const r = validateCorporate({ ...ok, employees: "1,500" });
    expect(r.ok && r.data.employees).toBe(1500);
  });
});
