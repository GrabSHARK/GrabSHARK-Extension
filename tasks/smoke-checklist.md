# GrabSHARK Extension Smoke Checklist

## Automated

### Chromium
```bash
npm run smoke
```

### Firefox
```bash
npm run smoke:firefox
```

What the automated smoke check verifies:
- `dist/` exists after build
- active manifest references point at real built files
- background, popup, options, content, embedded, capture, and toast bundles exist
- icon assets and `assets/*` web-accessible resources are present

## Manual

Run these after loading the unpacked extension.

### 1. Embedded Open / Close
- Open any normal web page.
- Open the GrabSHARK embedded panel.
- Close and reopen it twice.
- Expected: panel opens cleanly, no duplicate UI shells, no broken styles.

### 2. Quick Save
- Save the current page from the embedded UI or popup.
- Save the same page again.
- Expected: first save succeeds, second pass resolves to saved/edit state instead of duplicating.

### 3. Highlight Flow
- Select text on a saved page.
- Create a highlight.
- Refresh the page.
- Expected: highlight persists and toolbox/note panel still render correctly.

### 4. Smart Capture
- Toggle Smart Capture.
- Hover a few elements, then make one selection.
- Exit capture mode.
- Expected: overlay tracks correctly, capture UI appears once, cleanup is clean after exit.

### 5. Embedded Save Sync
- Save a page from embedded mode.
- Confirm saved state updates without a full page reload.
- Expected: highlight/save state stays in sync and cached card state is updated.

### 6. Badge / Config Refresh
- Change extension preferences or reconnect config.
- Return to an already open page.
- Expected: extension state refreshes without requiring duplicate reload loops.

## Logging Notes
- CSS parse summary logs like `[Readability] Suppressed N CSS parse warning...` are acceptable in worker logs.
- Repeated bootstrap loops, duplicate embedded shells, missing CSS, or unresolved dynamic bundle loads are not.
