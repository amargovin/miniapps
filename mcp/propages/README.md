# Swarajya PRO — sales site (`propages`)

A self-contained marketing/sales site for **Swarajya PRO**: the Swarajya group
subscription **+** access to the [Swarajya MCP](../CLAUDE.md) intelligence layer,
sold per seat to organisations.

It is deliberately **independent of the MCP app** in the parent folder — its own
zero-dependency Node static server so it can be deployed to its own Railway service.

## What's here

```
propages/
├── public/
│   ├── index.html     # the page
│   ├── styles.css     # on-brand editorial styling (Swarajya palette)
│   └── app.js         # pricing calculator + FAQ accordion (vanilla JS)
├── server.js          # zero-dependency static server (Node built-ins only)
├── package.json       # start script + Node engine (no dependencies to install)
└── railway.json       # Railway/Nixpacks deploy config
```

## Run locally

```bash
cd propages
node server.js          # → http://localhost:3000  (honours $PORT)
```

No `npm install` needed — there are no dependencies.

## Pricing model (encoded in `public/app.js`)

- **₹1,999 / seat / year** list price, **+ 18% GST**, billed annually.
- **Minimum 10 seats.**
- Volume discount: **10 seats → 10%**, **11–20 → 20%**, **21+ → 30%**.

Change any of these constants at the top of `app.js` (`LIST_PRICE`, `GST_RATE`,
`MIN_SEATS`, `discountFor`) and the calculator + copy update. The static tier
table in `index.html` (`#pricing`) is hand-mirrored — update it to match.

## Deploy to Railway (independent service)

1. Create a new Railway service pointing at this repo, **root directory `propages`**
   (Settings → Root Directory), or deploy from within the folder:
   ```bash
   cd propages && railway up
   ```
2. Nixpacks detects `package.json` → Node, runs `node server.js`.
3. The server binds `$PORT` automatically. No env vars required.

Add a custom domain (e.g. `pro.swarajyamag.com`) on the Railway service.

## Contact CTA

The "Request access" buttons and calculator CTA build a prefilled `mailto:` to
**pro@swarajyamag.com** including the chosen seat count and estimated total.
Swap this for a form/CRM endpoint when one exists.
