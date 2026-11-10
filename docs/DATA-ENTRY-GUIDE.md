# Test Mate — guide for data entry

You keep the prices on Test Mate correct. People decide where to get a test based on what you enter, so **accuracy beats speed**.

Sign in at **`/admin/login`** with the email and password you were given.

---

## The daily routine (about 30 minutes)

1. Open **Call list** (top menu). Labs are sorted by who needs a call first.
   - **Stale** = checked more than 90 days ago. These prices are greyed out on the site and never shown as cheapest.
   - **Due** = will turn stale within 14 days. Call these before they go stale.
2. Tap the lab's phone number and call. Ask for the current price of each test in the list.
3. Click **Open grid** for that lab (it shows only stale and due tests).
4. For each test:
   - **Same price?** Tick the row's checkbox. When done, click **Mark N verified today**.
   - **New price?** Type it in the **Regular ৳** box and press **Enter** (jumps to the next test). Fill **Discount ৳** and **Discount until** only if the lab says there is an offer and until when.
   - **Lab stopped doing the test?** Clear the regular price. The row turns grey ("will be removed").
5. Before saving, check **Source of today's edits** at the top (normally *Phone call*).
6. Press **Ctrl + S** (or the **Save** button). Green message = saved. Red rows = fix the shown problem and save again; nothing was saved.
7. Open **Bookings** and handle new requests (see below).

Saving a row marks it **verified today** with your name. Only save prices you actually confirmed today.

## Entering prices for a new lab

1. **Labs & prices → Add lab.** Fill name, branch, area, address and phone. WhatsApp only if it is a mobile number the lab uses for WhatsApp. Tick *Offers home collection* if they do and enter the fee (0 = free, blank = don't know).
2. After saving you land in the lab's **price grid**. Type in the box **Find test** to jump to a test (`cbc`, `lipid`, `সিবিসি` all work).
3. For each test: regular price → Enter. Add report time in hours (e.g. 6, 24, 48) and tick *Home* if the lab collects that test at home.
4. Ctrl + S.

**50 prices from a price list:** use CSV import instead (next section) — or type them in the grid: price, Enter, price, Enter…

## CSV import (price lists, many prices at once)

1. **CSV import / export → Download empty template** (or open a lab's grid and click **Import CSV** — then you don't need the `lab_slug` column).
2. Fill one row per test: `test_slug`, `regular_price`, `source` are required. In `test_slug` you may also write a common name like `CBC` or `সিবিসি`.
3. Upload or paste, click **Check file**. Nothing is saved yet. Read the preview:
   - *New* = first price for this lab; *Price changed* (yellow) = shows the old price — double-check these; *Same price — re-verify*.
   - Red rows have a problem and will be skipped.
4. Click **Import N valid rows**.

## Booking requests

**Bookings** in the menu (orange number = new requests).
1. Call the patient to confirm the test, date and home collection.
2. Tell the lab: **Call lab**, or **Forward on WhatsApp** (opens WhatsApp with the details filled in).
3. Set the status: *Forwarded to lab* → *Confirmed* → *Completed* (or *Cancelled*). Write anything useful in **Notes** and click **Save**.

Patients pay the lab directly. Test Mate never takes payments.

## Rules — please read

- **Never invent a price.** If a lab won't say, leave it empty.
- **Never write medical advice.** Test descriptions and preparation notes (e.g. "fasting 8 hours") only appear on the site after an ADMIN reviews them. If you add one, it stays hidden until then.
- **Source matters.** Pick how you got the price: phone call, price list/photo, lab website, lab submitted it, or you visited.
- **Featured labs** get a badge but are never moved up the list. Don't change prices to help a lab.
- **Spelling for search:** if people search a test by another name (Bangla spelling, short form, common misspelling), add it under **Tests → (test) → Search aliases**, one per line.
- A test page appears on the site only when **3 labs** have a fresh price (2 labs in an area for the area page). If a page is missing, it usually needs more fresh prices.

## Quick answers

| Problem | What to do |
|---|---|
| Red row: "discount_price must be lower than regular_price" | The offer price must be smaller than the normal price. |
| Red row: "regular_price … not a valid amount" | Whole taka only, no text. Bangla digits are fine. |
| I saved by mistake | Type the correct price and save again. Every change is kept in **Price history** (button in the grid). |
| A lab closed | Open the lab, untick **Active**. Its prices disappear from the site; nothing is deleted. |
| I can't find a test | Ask the ADMIN to add it under **Tests → Add test**. |
