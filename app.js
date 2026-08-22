/*
  =========================================================
  TURKS & CAICOS TRIP APP — app.js
  =========================================================
  This file is intentionally over-commented since you're
  learning. Every section explains WHAT it does and WHY.

  Data now lives in Firestore (Google's real-time database),
  not just your browser. That means: everyone who opens this
  page — on any device — reads and writes the SAME data, and
  changes appear for everyone within a second or two, with no
  login required. See firebase-config.js for the connection.
  =========================================================
*/

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------------------------------------------------------
// 1. TAB NAVIGATION
// ---------------------------------------------------------
const tabButtons = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.tab; // e.g. "itinerary", "packing", "flights"

    tabButtons.forEach((b) => b.classList.remove('is-active'));
    button.classList.add('is-active');

    panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.id === `panel-${target}`);
    });
  });
});

// ---------------------------------------------------------
// 2. ITINERARY
// ---------------------------------------------------------
// "collection(db, 'itinerary')" points at a folder-like bucket
// of documents in Firestore called "itinerary".
const itineraryCollection = collection(db, 'itinerary');
let itinerary = []; // kept in sync automatically, see onSnapshot below

const itineraryForm = document.getElementById('itinerary-form');
const itineraryDateInput = document.getElementById('itinerary-date');
const itineraryTimeInput = document.getElementById('itinerary-time');
const itineraryTitleInput = document.getElementById('itinerary-title');
const itineraryListEl = document.getElementById('itinerary-list');

itineraryForm.addEventListener('submit', (event) => {
  event.preventDefault(); // stop the page from reloading, which is a <form>'s default behavior

  // addDoc sends this new entry to Firestore. We don't update our
  // local `itinerary` array ourselves — the onSnapshot listener
  // below will notice the change (for us AND everyone else) and
  // re-render automatically.
  addDoc(itineraryCollection, {
    date: itineraryDateInput.value,   // e.g. "2026-11-14"
    time: itineraryTimeInput.value,   // e.g. "14:30" (may be empty)
    title: itineraryTitleInput.value,
  });

  itineraryForm.reset();
});

// onSnapshot is the heart of the real-time sync: Firestore calls this
// function immediately with the current data, and again every time
// ANYONE changes the collection — including other people's phones.
onSnapshot(itineraryCollection, (snapshot) => {
  itinerary = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  renderItinerary();
});

function renderItinerary() {
  if (itinerary.length === 0) {
    itineraryListEl.innerHTML = `<p class="empty-state">No plans yet. Add the first one above &mdash; flights, excursions, dinner reservations, whatever's locked in.</p>`;
    return;
  }

  // Sort by date, then by time, so the list always reads top-to-bottom chronologically.
  const sorted = [...itinerary].sort((a, b) => {
    return (a.date + a.time).localeCompare(b.date + b.time);
  });

  // Group entries under the day they belong to, e.g. { "2026-11-14": [...] }
  const groups = {};
  sorted.forEach((entry) => {
    if (!groups[entry.date]) groups[entry.date] = [];
    groups[entry.date].push(entry);
  });

  itineraryListEl.innerHTML = Object.entries(groups)
    .map(([date, entries]) => {
      const heading = formatDateHeading(date);
      const rows = entries
        .map(
          (entry) => `
            <div class="day-item">
              <span class="day-item__time">${entry.time || '—'}</span>
              <span class="day-item__title">${escapeHtml(entry.title)}</span>
              <button class="day-item__delete" data-id="${entry.id}">Remove</button>
            </div>`
        )
        .join('');

      return `
        <div class="day-group">
          <div class="day-group__heading">${heading}</div>
          ${rows}
        </div>`;
    })
    .join('');

  itineraryListEl.querySelectorAll('.day-item__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      // deleteDoc removes it from Firestore; onSnapshot fires again
      // for everyone and the list re-renders without it.
      deleteDoc(doc(db, 'itinerary', btn.dataset.id));
    });
  });
}

function formatDateHeading(dateStr) {
  if (!dateStr) return 'No date';
  // dateStr is "YYYY-MM-DD"; the "T00:00:00" avoids timezone shifting it to the previous day.
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// ---------------------------------------------------------
// 3. PACKING LIST
// ---------------------------------------------------------
const packingCollection = collection(db, 'packing');
let packing = [];

const packingForm = document.getElementById('packing-form');
const packingItemInput = document.getElementById('packing-item');
const packingListEl = document.getElementById('packing-list');

packingForm.addEventListener('submit', (event) => {
  event.preventDefault();

  addDoc(packingCollection, {
    text: packingItemInput.value,
    packed: false,
  });

  packingForm.reset();
});

onSnapshot(packingCollection, (snapshot) => {
  packing = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  renderPacking();
});

function renderPacking() {
  if (packing.length === 0) {
    packingListEl.innerHTML = `<li class="empty-state">Nothing on the list yet.</li>`;
    return;
  }

  packingListEl.innerHTML = packing
    .map(
      (item) => `
        <li class="${item.packed ? 'is-packed' : ''}">
          <input type="checkbox" id="pack-${item.id}" data-id="${item.id}" ${item.packed ? 'checked' : ''} />
          <label for="pack-${item.id}">${escapeHtml(item.text)}</label>
          <button class="checklist__delete" data-id="${item.id}">Remove</button>
        </li>`
    )
    .join('');

  packingListEl.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      // updateDoc changes just the "packed" field on that one document.
      updateDoc(doc(db, 'packing', checkbox.dataset.id), { packed: checkbox.checked });
    });
  });

  packingListEl.querySelectorAll('.checklist__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteDoc(doc(db, 'packing', btn.dataset.id));
    });
  });
}

// ---------------------------------------------------------
// 4. FLIGHTS
// ---------------------------------------------------------
const flightsCollection = collection(db, 'flights');
let flights = [];

const flightForm = document.getElementById('flight-form');
const flightNameInput = document.getElementById('flight-name');
const flightDirectionInput = document.getElementById('flight-direction');
const flightNumberInput = document.getElementById('flight-number');
const flightDateInput = document.getElementById('flight-date');
const flightTimeInput = document.getElementById('flight-time');
const flightBoardEl = document.getElementById('flight-board');

flightForm.addEventListener('submit', (event) => {
  event.preventDefault();

  addDoc(flightsCollection, {
    name: flightNameInput.value,
    direction: flightDirectionInput.value, // "ARR" or "DEP"
    number: flightNumberInput.value.toUpperCase(),
    date: flightDateInput.value,
    time: flightTimeInput.value,
  });

  flightForm.reset();
});

onSnapshot(flightsCollection, (snapshot) => {
  flights = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  renderFlights();
});

function renderFlights() {
  // Always keep the header row; only replace the rows after it.
  const headerRow = flightBoardEl.querySelector('.board__row--head');
  flightBoardEl.innerHTML = '';
  flightBoardEl.appendChild(headerRow);

  if (flights.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.id = 'flight-empty';
    empty.textContent = 'No flights logged yet.';
    flightBoardEl.appendChild(empty);
    return;
  }

  const sorted = [...flights].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  sorted.forEach((flight) => {
    const row = document.createElement('div');
    row.className = `board__row board__row--${flight.direction.toLowerCase()}`;
    row.innerHTML = `
      <span>${escapeHtml(flight.name)} <span class="board__tag">${flight.direction === 'ARR' ? 'landing' : 'departing'}</span></span>
      <span>${escapeHtml(flight.number)}</span>
      <span>${formatShortDate(flight.date)}</span>
      <span>${flight.time}</span>
      <button class="board__delete" data-id="${flight.id}">✕</button>
    `;
    flightBoardEl.appendChild(row);
  });

  flightBoardEl.querySelectorAll('.board__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteDoc(doc(db, 'flights', btn.dataset.id));
    });
  });
}

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------
// 5. SAFETY HELPER
// ---------------------------------------------------------
// Since we insert user-typed text into the page with
// innerHTML, we escape it first so someone typing something
// like "<script>" just shows as plain text instead of running.
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Note: there's no "initial render" call here anymore — onSnapshot
// fires immediately with the current data as soon as each listener
// is set up above, which triggers the first render on its own.
