# Turks & Caicos Trip App — setup notes

## Running it locally (needed now that we use Firebase)

Browsers block `import`/`export` (ES modules) when you open an HTML file
directly by double-clicking it. You need a tiny local web server instead —
this is a one-time thing to know, not specific to this app.

**Option A — VS Code:** install the "Live Server" extension, right-click
`index.html`, choose "Open with Live Server."

**Option B — Terminal (if you have Python installed):**
```
cd path/to/turks-trip
python3 -m http.server 8000
```
Then open http://localhost:8000 in your browser.

Once deployed to Firebase Hosting or GitHub Pages (a later step), this
stops being an issue — real web servers don't have this restriction.

## Firestore security rules

Firebase's default "test mode" rules expire 30 days after you create the
database — after that, everyone gets locked out. To avoid that surprise:

1. In the Firebase console, go to Firestore Database → Rules.
2. Replace the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click "Publish."

This keeps the app open to anyone with the link (no login), which matches
what we want for a small trusted friend group. It also means anyone who
somehow found your Firestore project URL could read or edit the data —
low risk for a trip planner with no sensitive info, but worth knowing.
If you ever want to lock it down later (e.g. require a shared passcode),
that's a config change, not a rewrite — just ask.

## Files in this folder

- `index.html` — page structure and layout
- `style.css` — visual design (Turks & Caicos palette, wristband header, flight board)
- `app.js` — behavior: tabs, forms, and real-time sync with Firestore
- `firebase-config.js` — connects the app to your Firebase project
