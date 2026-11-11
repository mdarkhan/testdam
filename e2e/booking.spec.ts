// End-to-end (brief): search → test page → booking, at 360 px, checking the dataLayer at each step.
import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
test.afterAll(() => db.$disconnect());

const events = (page: Page) =>
  page.evaluate(() => (window.dataLayer ?? []).filter((e) => typeof e.event === "string" && !String(e.event).startsWith("gtm.")));

test("search in Bangla → test page → booking request", async ({ page }) => {
  const phone = `017${String(Date.now()).slice(-8)}`; // unique per run so the per-phone limit never trips

  // Land with UTM parameters: they must end up on the booking.
  await page.goto("/?utm_source=e2e&utm_medium=test&utm_campaign=phase4");

  // 1. Search in Bangla, choose the suggestion.
  await page.getByRole("combobox").fill("সিবিসি");
  const option = page.getByRole("option").first();
  await expect(option).toContainText("CBC");
  await option.locator("a").click();
  await expect(page).toHaveURL(/\/test\/cbc$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("CBC");

  // 2. Cards, not tables, and the cheapest is marked.
  await expect(page.locator("table")).toHaveCount(0);
  await expect(page.locator("#price-list article").first()).toContainText("সবচেয়ে কম দাম");

  // 3. Open the booking form on the cheapest lab.
  await page.locator("#price-list article").first().getByRole("button", { name: "বুক করুন" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // 4. Empty submit → errors next to the fields, nothing saved.
  await dialog.getByRole("button", { name: "অনুরোধ পাঠান" }).click();
  await expect(dialog.getByText("নাম লিখুন")).toBeVisible();
  await expect(dialog.getByText("সঠিক মোবাইল নম্বর দিন")).toBeVisible();

  // 5. Fill and send.
  await dialog.getByLabel("আপনার নাম").fill("E2E Test Patient");
  await dialog.getByLabel("মোবাইল নম্বর").fill(phone);
  await dialog.getByRole("button", { name: "অনুরোধ পাঠান" }).click();
  await expect(dialog.getByText("অনুরোধ পাঠানো হয়েছে")).toBeVisible();

  // 6. dataLayer: the right events, in order, with the right parameters and no personal data.
  const ev = await events(page);
  const names = ev.map((e) => e.event);
  expect(names).toEqual(expect.arrayContaining(["search", "view_test_prices", "booking_form_open", "generate_lead"]));
  expect(names.indexOf("booking_form_open")).toBeLessThan(names.indexOf("generate_lead"));
  expect(ev.find((e) => e.event === "search")).toMatchObject({ search_term: "সিবিসি" });
  expect(ev.find((e) => e.event === "view_test_prices")).toMatchObject({ test_slug: "cbc" });
  const lead = ev.find((e) => e.event === "generate_lead")!;
  expect(lead).toMatchObject({ test_slug: "cbc" });
  expect(typeof lead.booking_id).toBe("number");
  expect(lead.lab_slug).toBeTruthy();
  expect(lead.area_slug).toBeTruthy();
  expect(JSON.stringify(ev)).not.toContain(phone.slice(-8));
  expect(JSON.stringify(ev)).not.toContain("E2E Test Patient");

  // 7. The booking is stored with status NEW, the server-side price, and the UTM data.
  const saved = await db.bookingRequest.findUnique({ where: { id: lead.booking_id as number }, include: { test: true, lab: true } });
  expect(saved).toMatchObject({ status: "NEW", phone, patientName: "E2E Test Patient", utmSource: "e2e", utmMedium: "test", utmCampaign: "phase4", landingPath: "/" });
  expect(saved!.test.slug).toBe("cbc");
  expect(saved!.lab.slug).toBe(lead.lab_slug);
  expect(saved!.priceAtRequest).toBe(lead.price);

  // 8. The patient sees a booking code (no look-alike characters), and it is the stored one.
  const shown = await dialog.locator("[data-booking-code]").innerText();
  expect(shown).toMatch(/^TM-[2-9A-HJKMNP-Z]{5}$/);
  expect(saved!.code).toBe(shown);
});

test("call and WhatsApp taps are tracked", async ({ page }) => {
  await page.goto("/test/cbc");
  const card = page.locator("#price-list article").first();
  // Don't actually follow tel: — just check the tap is tracked.
  await page.evaluate(() => document.addEventListener("click", (e) => { if ((e.target as HTMLElement).closest("a[href^='tel:'],a[href*='wa.me']")) e.preventDefault(); }));
  await card.getByRole("link", { name: "কল করুন" }).click();
  const ev = await events(page);
  expect(ev.find((e) => e.event === "call_click")).toMatchObject({ test_slug: "cbc" });
  expect(ev.find((e) => e.event === "call_click")!.lab_slug).toBeTruthy();

  const wa = card.getByRole("link", { name: "হোয়াটসঅ্যাপ" });
  await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/8801300000000\?text=/);
  await wa.click();
  const after = await events(page);
  expect(after.find((e) => e.event === "whatsapp_click")).toMatchObject({ test_slug: "cbc" });
});

test("thin pages return 404", async ({ page }) => {
  const res = await page.goto("/test/this-test-does-not-exist");
  expect(res?.status()).toBe(404);
});

test("test basket: add from test pages, totals per lab on /basket", async ({ page }) => {
  await page.goto("/test/cbc");
  await page.getByRole("button", { name: "লিস্টে যোগ করুন" }).click();
  await expect(page.getByRole("button", { name: "লিস্টে আছে" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/test/lipid-profile");
  await page.getByRole("button", { name: "লিস্টে যোগ করুন" }).click();

  // The header link carries the list; /basket shows labs with both tests, cheapest total first.
  await page.getByRole("link", { name: /আমার লিস্ট, ২টি টেস্ট/ }).click();
  await expect(page).toHaveURL(/\/basket\?t=cbc,lipid-profile$/);
  await expect(page.getByRole("heading", { name: /সবগুলো টেস্ট হয় এমন ল্যাব/ })).toBeVisible();
  const totals = await page.locator("main ol article .tabular.text-2xl").allInnerTexts();
  expect(totals.length).toBeGreaterThan(1);
  const asNumber = (t: string) => Number(t.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[^0-9]/g, ""));
  const nums = totals.map(asNumber);
  expect(nums).toEqual([...nums].sort((a, b) => a - b));
  await expect(page.locator("main ol article").first()).toContainText("সবচেয়ে কম মোট খরচ");

  // Make the DEAREST lab a partner: it gets the badge and discount line but stays last (no ranking boost).
  const cards = page.locator("main ol article");
  const dearest = cards.last();
  const partnerSlug = (await dearest.getAttribute("data-lab"))!;
  await db.lab.update({ where: { slug: partnerSlug }, data: { isPartner: true, partnerDiscountPct: 10, commissionBps: 1000 } });
  try {
    await page.reload();
    expect((await cards.locator(".tabular.text-2xl").allInnerTexts()).map(asNumber)).toEqual(nums);
    await expect(cards.last()).toHaveAttribute("data-lab", partnerSlug);
    await expect(cards.last()).toContainText("পার্টনার ল্যাব");
    await expect(cards.last()).toContainText("বুকিং কোডে ১০% ছাড়");
    await expect(cards.first()).not.toContainText("পার্টনার ল্যাব");

    // Book both tests at the partner lab in one request: one booking, one item per test, total = sum,
    // a booking code and the promised discount.
    const phone = `018${String(Date.now()).slice(-8)}`;
    await cards.last().getByRole("button", { name: "বুক করুন" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("২টি টেস্ট");
  await dialog.getByLabel("আপনার নাম").fill("E2E Basket Patient");
  await dialog.getByLabel("মোবাইল নম্বর").fill(phone);
  await dialog.getByRole("button", { name: "অনুরোধ পাঠান" }).click();
  await expect(dialog.getByText("অনুরোধ পাঠানো হয়েছে")).toBeVisible();
  await expect(dialog).toContainText("বিলে ১০% ছাড় পাবেন");
  const lead = (await events(page)).find((e) => e.event === "generate_lead")!;
  expect(lead).toMatchObject({ test_slug: "cbc,lipid-profile", price: nums[nums.length - 1], lab_slug: partnerSlug });
  const saved = await db.bookingRequest.findUnique({ where: { id: lead.booking_id as number }, include: { items: { include: { test: true }, orderBy: { id: "asc" } } } });
  expect(saved!.items.map((i) => i.test.slug)).toEqual(["cbc", "lipid-profile"]);
  expect(saved!.priceAtRequest).toBe(saved!.items.reduce((s, i) => s + i.priceAtRequest, 0));
  expect(saved!.priceAtRequest).toBe(nums[nums.length - 1]);
  expect(saved!.partnerDiscountPct).toBe(10);
  expect(saved!.code).toBe(await dialog.locator("[data-booking-code]").innerText());
  await dialog.getByRole("button", { name: "বন্ধ করুন" }).click();
  } finally {
    await db.lab.update({ where: { slug: partnerSlug }, data: { isPartner: false, partnerDiscountPct: null, commissionBps: null } });
  }

  // Removing a test updates the URL and the stored list.
  await page.getByRole("button", { name: /লিপিড প্রোফাইল.*লিস্ট থেকে সরান/ }).click();
  await expect(page).toHaveURL(/\/basket\?t=cbc$/);
});

test("company check-up request: errors by the fields, then saved without personal data in analytics", async ({ page }) => {
  await page.goto("/corporate");
  await page.getByRole("button", { name: "অনুরোধ পাঠান" }).click();
  await expect(page.getByText("প্রতিষ্ঠানের নাম লিখুন")).toBeVisible();
  await expect(page.getByLabel("প্রতিষ্ঠানের নাম")).toBeFocused();

  const phone = `019${String(Date.now()).slice(-8)}`;
  await page.getByLabel("প্রতিষ্ঠানের নাম").fill("E2E Garments Ltd");
  await page.getByLabel("আপনার নাম").fill("E2E HR");
  await page.getByLabel("মোবাইল নম্বর").fill(phone);
  await page.getByLabel("কতজন কর্মী").fill("১২০");
  await page.getByLabel("কোন টেস্ট বা কী ধরনের চেকআপ চান").fill("CBC, FBS");
  await page.getByRole("button", { name: "অনুরোধ পাঠান" }).click();
  await expect(page.getByText("অনুরোধ পেয়েছি")).toBeVisible();

  const ev = (await events(page)).find((e) => e.event === "corporate_lead")!;
  expect(ev).toMatchObject({ employee_count: 120 });
  expect(JSON.stringify(ev)).not.toContain("E2E Garments");
  const saved = await db.corporateRequest.findUnique({ where: { id: ev.lead_id as number } });
  expect(saved).toMatchObject({ companyName: "E2E Garments Ltd", phone, employees: 120, status: "NEW" });
});

test("lab page: find a test, open its row, book it there", async ({ page }) => {
  // A lab with a published page (thin-content rule), from the same index the site uses.
  const lab = await db.lab.findFirst({ where: { isActive: true, prices: { some: { test: { slug: "cbc" } } } }, orderBy: { id: "asc" }, select: { slug: true } });
  await page.goto(`/lab/${lab!.slug}`);
  const filter = page.getByLabel("এই ল্যাবে টেস্ট খুঁজুন");
  if (await filter.count()) await filter.fill("cbc");
  const row = page.locator("[data-price-row][data-test='cbc']");
  await row.locator("summary").click();
  await row.getByRole("button", { name: "বুক করুন" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("CBC");
  await dialog.getByLabel("আপনার নাম").fill("E2E Lab Page");
  await dialog.getByLabel("মোবাইল নম্বর").fill(`016${String(Date.now()).slice(-8)}`);
  await dialog.getByRole("button", { name: "অনুরোধ পাঠান" }).click();
  await expect(dialog.getByText("অনুরোধ পাঠানো হয়েছে")).toBeVisible();
  const lead = (await events(page)).find((e) => e.event === "generate_lead")!;
  expect(lead).toMatchObject({ test_slug: "cbc", lab_slug: lab!.slug });
});

test("search with no results suggests popular tests and keeps the query", async ({ page }) => {
  await page.goto("/search?q=zzzqqq");
  await expect(page.getByRole("combobox")).toHaveValue("zzzqqq");
  await expect(page.getByRole("heading", { name: "জনপ্রিয় টেস্ট" })).toBeVisible();
  await expect(page.getByRole("link", { name: "সব টেস্ট দেখুন" })).toBeVisible();
});
