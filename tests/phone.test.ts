import { describe, expect, it } from "vitest";
import { normalizeBdMobile, normalizeLabPhone } from "@/lib/phone";

describe("normalizeBdMobile", () => {
  it.each(["01712345678", "+8801712345678", "8801712345678", "017-1234-5678", "+880 1712 345678", "০১৭১২৩৪৫৬৭৮"])("accepts %s", (v) => {
    expect(normalizeBdMobile(v)).toBe("01712345678");
  });
  it.each(["0171234567", "017123456789", "01212345678", "02-9123456", "abc", ""])("rejects %s", (v) => {
    expect(normalizeBdMobile(v)).toBeNull();
  });
});

describe("normalizeLabPhone", () => {
  it("keeps landlines and hotlines", () => {
    expect(normalizeLabPhone("02-9123456")).toBe("02-9123456");
    expect(normalizeLabPhone("10666")).toBe("10666");
    expect(normalizeLabPhone("+880 1712 345678")).toBe("01712345678");
    expect(normalizeLabPhone("call us")).toBeNull();
  });
});
