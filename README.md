# The morning sheet

Live at **[morning-sheet.tasti.io](https://morning-sheet.tasti.io)**. Part of the
[Tasti.io demos](https://demo.tasti.io).

One page for a four-site restaurant group, read before opening. The top half is
yesterday from the point of sale: every site on one line, with only the sites
worth attention flagged. The bottom half is what the POS cannot see: sixteen weeks
of supplier invoices, priced per kilogram or litre and compared against what the
same item cost six to sixteen weeks ago. Together they answer whether yesterday
actually made any money.

A second tab, **Tomorrow**, looks forward: a half-hour demand forecast for each
room, and a proposed change to the usual rota for that weekday, under British
Columbia's employment rules, for a manager to approve or override.

## The design rules

**No model in the request path.** `api/sheet.js`, `api/costs.js` and
`api/tomorrow.js` are arithmetic over stored data. Opening the page costs nothing,
however many people do, and a stranger cannot run up a bill by refreshing.

**The model transcribes. It never calculates.** Invoices are read once, when they
arrive, by `lib/invoices/extract.js`, the only file that calls a model. It returns
amounts as the strings printed on the page; `toCents()` converts them, and
`lib/invoices/units.js` and `lib/invoices/drift.js` derive every unit price and
dollar figure in plain code. So the product lines can be added up and checked
against the invoice's own subtotal before anything is believed, and a misread digit
shows up as "does not reconcile" instead of a confident sentence about money.

**Compare a site to its own normal.** `lib/shape.js` flags a site against its own
four-week median for the same weekday, never against the group. A ninety-seat room
and a food hall counter have nothing to say about each other. Labour is flagged on
its share of sales, voids as a rate.

**Say nothing unless it is worth money.** A cost finding must clear $150 a month
(`RULES` in `drift.js`, all thresholds in one place so they can be argued with).
Prices are compared against a volume-weighted window, not the last invoice.

**Start from the manager's own rota.** `lib/forecast/plan.js` does not build a rota
from nothing. It takes the rota the manager would copy forward and changes it only
where the forecast says the copy is wrong, at most four changes per room, each with
a named person and a reason. Productivity is learned from that same rota, so a
reason reads like "your own Friday puts six servers on at 14:00, and the rush
starts at 17:30", not "you need 3.4 servers".

## How it stays correct

- **What gets held back.** A description no catalog entry matches, a pack size that
  cannot be parsed, and an invoice whose lines do not add up to its own goods
  subtotal (or total, where no subtotal is printed) go to
  a review list instead of into the numbers. The catalog match is deterministic
  keyword and item-code matching (`lib/invoices/catalog.js`), so a price history
  cannot reorganise itself between runs.
- **British Columbia's rules, with section numbers** (`lib/forecast/bc.js`): no
  proposed shift past 8 paid hours (s.40), an unpaid meal break after 5 hours
  (s.32), at least 2 paid hours (s.34), 1.5 times plus an average day's pay on a
  statutory holiday (s.46), managers outside the overtime rules. Where the code
  simplifies (for example, estimating the average day's pay), the comment says so
  and the page repeats it. On a holiday the planner asks for a much bigger rush
  before it adds anyone, because an extra hour costs about two and a half times.
- **It never invents a person.** One shift per person per day across the whole
  group; a slot nobody can work is reported as unfilled.
- **Drizzle is not rain.** Weather only moves the plan at 2 mm or more on the day.
- **Deterministic.** The same day renders the same way twice, so a screenshot in an
  email matches the page.
- **Self-test.** `npm run check` runs 74 checks with no network, including 60 days
  of generated plans checked for double shifts, invented people, overtime, short
  shifts, and wage bills that move by exactly the sum of the changes, to the cent.

## What is real, simulated and invented

- **Invented:** Harbour & Co, its four sites, sales, staff, rota and suppliers. The
  group comes from [harbour-data](https://github.com/Tasti-io/harbour-data),
  vendored under `lib/harbour` with a `VERSION` hash, so every demo describes one
  business. The supplier names are invented too.
- **Sample data by default.** The sheet reads `lib/sources/fixtures.js`, a seeded
  generator, and the invoices come from `lib/sources/invoices-fixtures.js`. The
  invoice set is deliberately awkward: a steady price creep, the same chicken from
  two suppliers at two prices, a price that fell, a noisy item that must stay quiet,
  a large rise on something too small to mention, an unreadable pack, an unknown
  item, and an invoice that does not add up. The self-test checks each one.
- **Optional live POS source:** `lib/sources/square.js` reads the same shape from a
  Square **sandbox** (`?source=square` or `DEMO_SOURCE=square`). The base URL is
  pinned to the sandbox and there is no production branch. If it fails, the sheet
  falls back to sample data and says so. `scripts/seed-square.mjs` builds the four
  sites in a sandbox, since Square provides one mock location and no bulk import.
- **Real on the Tomorrow tab:** the weather (Open-Meteo for Vancouver, no key, with
  a 2.5 second timeout; if it does not answer, the plan is made without a weather
  adjustment and the page says so) and the 2026 BC statutory holidays.
- **Assumed:** how weather and the calendar move each room. Every assumption is
  labelled on the page, and the page quotes no accuracy figure, because invented
  history has nothing honest to measure one against.
- **Approval sends nothing.** Approvals and overrides on the Tomorrow tab stay in the
  browser. There is no connection to a scheduling tool in this demo.

## Layout

```
api/sheet.js                  GET: yesterday across four sites (fixtures, or Square sandbox with fallback)
api/costs.js                  GET: cost findings and the review list from stored invoice lines
api/tomorrow.js               GET ?date=: tomorrow's forecast and proposed rota, any of the next seven days
lib/shape.js                  the sheet: per-site exceptions against each site's own median, group totals
lib/sources/fixtures.js       seeded sample POS data
lib/sources/square.js         Square sandbox source, same output shape
lib/sources/invoices-fixtures.js  sixteen weeks of invented invoices, awkward on purpose
lib/invoices/extract.js       the only model call: transcription into line items, toCents()
lib/invoices/units.js         pack parsing and conversion to kg, litre or each
lib/invoices/catalog.js       canonical items, supplier codes and aliases, link to menu price
lib/invoices/drift.js         ingest, reconciliation, review list, creep, relief and supplier spread
lib/forecast/bc.js            BC holidays, long weekends, Employment Standards Act costing
lib/forecast/demand.js        half-hour baseline from the last four ordinary same weekdays, plus adjustments
lib/forecast/plan.js          the proposed rota: named shifts, reasons, cost against the usual rota
lib/harbour/                  vendored Harbour & Co dataset
public/index.html             the page: The sheet, Tomorrow, How it works
scripts/parse-invoice.mjs     read one real invoice from the command line
scripts/seed-square.mjs       build the four sites in a Square sandbox
scripts/dev.mjs               local server that routes the handlers the way Vercel does
scripts/selftest.mjs          74 checks, no network
```

## Run

```bash
npm run check                       # self-test, no keys needed
npm run dev                         # http://localhost:3010
npm run parse -- invoice.pdf        # read a real invoice (PDF or photo); needs ANTHROPIC_API_KEY
npm run parse -- photo.jpg --json   # the same, as JSON
npm run seed:dry                    # what the Square seeder would do, no writes; needs SQUARE_SANDBOX_TOKEN
npm run seed                        # seed a Square sandbox; needs SQUARE_SANDBOX_TOKEN
```

`parse` is the one path that calls a model, and it runs from the command line,
never from a page request. It prints each line with a unit price beside it, plus
anything that did not match the catalog or reconcile.

No npm dependencies.
