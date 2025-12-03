# SafeLease-AR

Create a **structured, timestamped inspection report** (checklist + photos + optional AR context) entirely in the browser. No accounts, no backend.

- **Artifact:** `SafeLease_Report.pdf` (timestamp + address + checklist + photo grid)
- **Privacy:** data stays in your browser until you explicitly export the PDF
- **Offline-first:** static assets; after initial load, no network is required
- **AR optional:** works without AR; AR guidance available on Chrome (Android/desktop)
- **Compatibility:** Chrome (Android/desktop) ✅ AR + non-AR; Safari iOS ✅ non-AR, AR best-effort

## Quick Start (GitHub Codespaces or local)

```bash
npm install
npm run dev
# open http://localhost:3000
```

## How to Use
1. Load the app and (optionally) enter an address.
2. Walk through rooms and items; check what you inspect.
3. (Optional) Tap **Enter AR** on a compatible device/device+browser to place markers.
4. (Optional) Tap **Take photo** to capture a snapshot of the AR canvas (if AR is active).
5. Export your **PDF** via **Export PDF**.

> If your browser blocks canvas snapshots (some iOS settings), the app will show a hint and still export a report (without photos).

## Files
- `frontend/index.html` — UI shell
- `frontend/public/css/app.css` — styles (print-friendly)
- `frontend/src/checklist.json` — rooms/items schema (editable without code changes)
- `frontend/src/app.js` — state mgmt, rendering, PDF export
- `frontend/src/ar.js` — optional AR reticle + markers

## Notes
- PDF generation uses jsPDF (loaded from CDN on initial page load).
- Images are JPEG-compressed and capped by default to keep PDFs under ~10 MB.
- This v1.0 does **not** request camera permission; photos come from AR/WebGL snapshots. The non-AR path is fully usable and still exports a valid PDF.

## License
MIT