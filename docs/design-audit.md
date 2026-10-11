# Library Platform — Design Audit: Prototype v2

**Reference Source:** `design-reference/library_platform_interactive_prototype_v2.html`

## 1. Visual Identity & Design Tokens Audit

The prototype establishes a modern, editorial aesthetic with forest green primary branding, subtle warm-tinted off-white surfaces, and tactile book cover cards.

### 1.1 CSS Custom Properties (Theme Tokens)

```css
:root {
  /* Brand Accents */
  --accent: #235640;             /* Forest green primary */
  --accent-strong: #173e2d;      /* Dark green hover/active */
  --accent-soft: #e8f2eb;        /* Mint surface tint / selection */

  /* Neutral Surfaces */
  --canvas: #f5f7f4;             /* Off-white background canvas */
  --surface: #ffffff;            /* Card / panel background */
  --text: #1b2921;               /* Dark charcoal/forest text */
  --muted: #718076;              /* Slate muted secondary text */
  --border: #e2e8e2;             /* Subtle surface borders */

  /* Status Tokens */
  --success: #e7f5eb;   --success-text: #207447;
  --warn: #fff4d6;      --warn-text: #855c12;
  --danger: #fae8e7;    --danger-text: #a03932;
  --info: #e8f0fc;      --info-text: #2d5c9b;

  /* Geometry & Typography */
  --radius: 16px;
  --space: 18px;
  --font-size: 14px;
  --shadow: 0 8px 28px rgba(24, 46, 34, 0.055);
}

/* Dark Mode Tokens */
body.dark {
  --canvas: #101713;
  --surface: #18221b;
  --text: #edf3ee;
  --muted: #a1b1a5;
  --border: #2b3b30;
  --accent-soft: #263e2e;
  --shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
}
```

### 1.2 Theme Presets
- **Editorial (Default):** Radius `16px`, Space `18px`, warm serif covers, balanced card density.
- **Soft cards:** Radius `22px`, Space `20px`, rounded buttons, friendly and spacious.
- **Crisp:** Radius `9px`, Space `13px`, compact table padding, clean and analytical.

---

## 2. Procedural Book Cover Engine

The prototype implements procedural CSS book cover art that eliminates the need for external placeholder image services:
- **Genre Gradients:**
  - Fiction: `linear-gradient(150deg, #365b4a, #9bb6a0)`
  - Nonfiction: `linear-gradient(150deg, #94714b, #d9b990)`
  - Mystery: `linear-gradient(150deg, #28384a, #687d92)`
  - Thriller: `linear-gradient(150deg, #6d3436, #c77b6b)`
  - Science Fiction: `linear-gradient(150deg, #35316d, #8585bd)`
- **Typography:** Georgia serif title overlay with uppercase genre kicker.
- **Geometry:** Radial orbital rings positioned at top-right for visual depth (`.cover-orbit`).

---

## 3. Reusable Component Inventory

1. **Layout Primitives:**
   - `<Sidebar>`: Role-filtered navigation with badge numbering (`06`–`35`) and mobile collapse drawer.
   - `<Topbar>`: Sticky navigation containing dynamic breadcrumbs, role preview switcher, library branch switcher, notification indicator, theme drawer trigger, and user avatar.
   - `<AppearanceDrawer>`: Slide-out drawer with live theme preview cards, 6 accent color swatches, density selector, corner roundness slider, and dark mode toggle.
2. **Data Presentation:**
   - `<KpiCard>`: High-contrast metric cards with title, prominent value, and contextual footnote.
   - `<Pill>`: Status indicators with pill radius (`Available`, `On loan`, `Waitlist`, `Overdue`).
   - `<DataTable>`: Striped hover rows, uppercase headers, action buttons.
   - `<BookCard>`: Editorial book card with CoverArt, metadata, star ratings, and action buttons.
   - `<ReviewCard>`: Community review card with upvote/downvote buttons and comment count.
3. **Spatial Fixtures:**
   - `<FloorPlanViewer>`: 2D interactive canvas highlighting racks with available copies.
   - `<ShelfElevationView>`: Vertical elevation of shelves 1–6 showing copy IDs, titles, and availability.
   - `<FloorPlanBuilder>`: Layout builder with fixture toolbox (Rack, Wall, Door, Desk), properties panel (X, Y, W, H), and publish controls.

---

## 4. Full 30-Screen Inventory (To Recreate in React)

### Reader Workspace (`/reader/...`)
1. **[06] Discover (`/` or `/discover`):** Morning greeting, catalog search bar, 2 active loan KPI card, trending books grid, recent reviews.
2. **[07] Catalog Search (`/catalog`):** Full-text search, sort, filter chips (All, Available, Fiction...), grid of BookCards.
3. **[08] Book Details (`/books/:id`):** Large book cover, edition details, Check Availability, Reserve, Add to Collection, reader reviews.
4. **[09] Floor Plan Map (`/floor-map`):** Interactive floor plan, floor selector, rack selection nodes, availability summary.
5. **[16] Rack & Shelf Contents (`/racks/:rackId`):** Elevation view of 6 shelves, detailed table of copies with status.
6. **[29] My Loans (`/loans`):** Active loans KPIs, due date table, Request Extension modal trigger.
7. **[30] Reservation Tracking (`/reservations`):** Waitlist queue position, pickup deadline countdown, Cancel Hold action.
8. **[31] Wallet & Fines (`/wallet`):** Balance KPI, unpaid fines, simulated top-up card (`₹100`, `₹250`, `₹500`), immutable ledger table.
9. **[32] Notifications Inbox (`/notifications`):** Filterable alerts (Reservations, Loans, Social), mark as read actions.
10. **[33] Reader Profile & Badges (`/profile`):** Avatar, reading activity statistics, monthly reading goal progress bar, earned badges gallery.
11. **[34] My Reviews (`/reviews`):** User's published reviews, helpful vote counts, Write Review button.
12. **[35] My Collections (`/collections`):** Grid of curated reading lists with privacy badges, Create Collection dialog.

### Librarian Workspace (`/librarian/...`)
13. **[10] Circulation Desk (`/circulation`):** Reader lookup input, barcode scanner input, current checkout/return activity table.
14. **[17] Returns Processing (`/circulation/returns`):** Barcode validation, condition assessment, reshelving location assignment.
15. **[18] Walk-in Checkout (`/circulation/checkout`):** 2-step wizard: patron lookup + copy barcode scan, policy validation summary, Confirm Checkout.
16. **[11] Reservation Queue (`/circulation/queue`):** Table of active holds, queue positions, allocated copies, Open Fulfillment action.
17. **[19] Reservation Fulfillment (`/circulation/fulfillment`):** Copy allocation verification, physical pickup shelf assignment, Start Pickup Window action.
18. **[20] Catalog Work Management (`/catalog/admin`):** Tabs for Works, Editions, Authors, Publishers, Categories, Add Book wizard.
19. **[12] Copy Inventory (`/inventory`):** Physical copies table, status filters, bulk barcode intake trigger, Add Copy dialog.
20. **[21] Bulk Barcode Intake (`/inventory/bulk-intake`):** Edition selector, multi-line barcode paste/scanner textarea, validation summary.
21. **[22] Exceptions Handling (`/inventory/exceptions`):** Copy condition exception handler (Lost, Damaged, Withdrawn) with audit reason.

### Admin & Organization Workspace (`/admin/...`)
22. **[13] Library Settings (`/settings`):** Circulation defaults, reservation rules, fee policy inputs, curation unlock thresholds.
23. **[14] Floor Plan Builder (`/floor-builder`):** 2D canvas, fixture toolbox, fixture properties panel, Validate and Publish controls.
24. **[15] Organization Overview (`/organization`):** Branch cards (up to 3 libraries), member totals, database status, Create Library action.
25. **[23] Members & Roles (`/members`):** Staff and patron directory, role switcher (Owner, Admin, Librarian, Reader), Export data.
26. **[24] Invitations (`/invitations`):** Send invitation form, pending invitation list with Resend/Revoke actions.
27. **[25] Review Moderation (`/moderation`):** Reported/flagged review queue with audit reason modal.
28. **[26] Finance & Fines (`/finance`):** Outstanding fines aggregate, wallet liability total, fine adjustment/waiver form with audit requirement.
29. **[27] Audit Log (`/audit`):** Immutable event log with actor, action, target resource, timestamp, and trace ID filter.
30. **[28] Notification Delivery (`/delivery`):** Email and in-app delivery monitoring, retry queue, provider error inspector.
