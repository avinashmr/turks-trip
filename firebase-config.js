/*
  =========================================================
  FIREBASE CONFIG
  =========================================================
  This connects the app to YOUR Firebase project. The
  apiKey here is not a secret (unlike a password) — it just
  identifies which project to talk to. What actually controls
  who can read/write your data is the "Firestore Rules" you
  set in the Firebase console (see NOTES.md for the rule to paste in).

  We import the pieces we need straight from Google's CDN —
  no npm install or build step required, which keeps things
  simple while you're learning.
  =========================================================
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwXHzfAEvpUbsxVI2IuICcICzmnVqOnSQ",
  authDomain: "turks-trip.firebaseapp.com",
  projectId: "turks-trip",
  storageBucket: "turks-trip.firebasestorage.app",
  messagingSenderId: "412772628293",
  appId: "1:412772628293:web:698728129c34edaeb7f02c",
  measurementId: "G-X5TB7J7G7R",
};

const app = initializeApp(firebaseConfig);

// "db" is our handle to Firestore — every read/write in app.js goes through this.
export const db = getFirestore(app);
