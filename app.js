/*
  =========================================================
  TURKS & CAICOS TRIP APP — app.js
  =========================================================
  This file is intentionally over-commented since you're
  learning. Every section explains WHAT it does and WHY.

  Data lives in Firestore (Google's real-time database), not
  just your browser. That means: everyone who opens this page
  — on any device — reads and writes the SAME data, and changes
  appear for everyone within a second or two, with no login
  required. See firebase-config.js for the connection.
  =========================================================
*/

import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  doc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ---------------------------------------------------------
// 1. TAB NAVIGATION (top-level tabs + the packing/groceries sub-tabs)
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

// Sub-tabs work the same way, just scoped to elements tagged with
// data-subpanel instead of data-tab, so they don't interfere with
// the top-level tab logic above.
const subTabButtons = document.querySelectorAll('.sub-tab');
const subPanels = document.querySelectorAll('.sub-panel');

subTabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const target = button.dataset.subtab;

    subTabButtons.forEach((b) => b.classList.remove('is-active'));
    button.classList.add('is-active');

    subPanels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.subpanel === target);
    });
  });
});

// ---------------------------------------------------------
// 2. ITINERARY
// ---------------------------------------------------------
const itineraryCollection = collection(db, 'itinerary');
let itinerary = [];

const itineraryForm = document.getElementById('itinerary-form');
const itineraryDateInput = document.getElementById('itinerary-date');
const itineraryTimeInput = document.getElementById('itinerary-time');
const itineraryTitleInput = document.getElementById('itinerary-title');
const itineraryListEl = document.getElementById('itinerary-list');

itineraryForm.addEventListener('submit', (event) => {
  event.preventDefault();

  addDoc(itineraryCollection, {
    date: itineraryDateInput.value,
    time: itineraryTimeInput.value,
    title: itineraryTitleInput.value,
  });

  itineraryForm.reset();
});

onSnapshot(itineraryCollection, (snapshot) => {
  itinerary = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  renderItinerary();
});

function renderItinerary() {
  renderDayGroups({
    items: itinerary,
    listEl: itineraryListEl,
    emptyHtml: `<p class="empty-state">No plans yet. Add the first one above &mdash; flights, excursions, dinner reservations, whatever's locked in.</p>`,
    rowHtml: (entry) => `
      <div class="day-item">
        <span class="day-item__time">${entry.time || '—'}</span>
        <span class="day-item__title">${escapeHtml(entry.title)}</span>
        <button class="day-item__delete" data-id="${entry.id}">Remove</button>
      </div>`,
    deleteSelector: '.day-item__delete',
    collectionName: 'itinerary',
    itemLabel: 'this plan',
  });
}

// ---------------------------------------------------------
// 3. DINNER PLAN
// ---------------------------------------------------------
const dinnerCollection = collection(db, 'dinner');
let dinnerPlans = [];

const dinnerForm = document.getElementById('dinner-form');
const dinnerDateInput = document.getElementById('dinner-date');
const dinnerTimeInput = document.getElementById('dinner-time');
const dinnerRestaurantInput = document.getElementById('dinner-restaurant');
const dinnerNotesInput = document.getElementById('dinner-notes');
const dinnerListEl = document.getElementById('dinner-list');

dinnerForm.addEventListener('submit', (event) => {
  event.preventDefault();

  addDoc(dinnerCollection, {
    date: dinnerDateInput.value,
    time: dinnerTimeInput.value,
    restaurant: dinnerRestaurantInput.value,
    notes: dinnerNotesInput.value,
  });

  dinnerForm.reset();
});

onSnapshot(dinnerCollection, (snapshot) => {
  dinnerPlans = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  renderDinner();
});

function renderDinner() {
  renderDayGroups({
    items: dinnerPlans,
    listEl: dinnerListEl,
    emptyHtml: `<p class="empty-state">No dinner plans yet. Add the first night above.</p>`,
    rowHtml: (entry) => `
      <div class="day-item">
        <span class="day-item__time">${entry.time || '—'}</span>
        <span class="day-item__title">${escapeHtml(entry.restaurant)}${entry.notes ? ` &mdash; ${escapeHtml(entry.notes)}` : ''}</span>
        <button class="day-item__delete" data-id="${entry.id}">Remove</button>
      </div>`,
    deleteSelector: '.day-item__delete',
    collectionName: 'dinner',
    itemLabel: 'this dinner plan',
  });
}

// ---------------------------------------------------------
// 3b. DINNER VOTING
// ---------------------------------------------------------
// Each poll document looks like:
//   { date: "2026-11-15", options: ["Coconut Bar", "Blue Haven"], votes: { "Smith Family": "Coconut Bar" } }
// "votes" is a map from voter name -> the option they picked. Using a
// map (rather than a list of vote records) means a person can change
// their vote just by voting again — the old value is simply overwritten.
const dinnerPollsCollection = collection(db, 'dinnerPolls');
let dinnerPolls = [];

// The "your name" field is remembered per-device via localStorage —
// this is just a convenience so you don't retype it every time you
// vote on this browser. It's not shared with anyone; it only pre-fills
// the box.
const voterNameInput = document.getElementById('voter-name');
voterNameInput.value = localStorage.getItem('trip.voterName') || '';
voterNameInput.addEventListener('input', () => {
  localStorage.setItem('trip.voterName', voterNameInput.value);
});

const pollForm = document.getElementById('poll-form');
const pollDateInput = document.getElementById('poll-date');
const pollOptionsInput = document.getElementById('poll-options');
const pollListEl = document.getElementById('poll-list');

pollForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const options = pollOptionsInput.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (options.length < 2) {
    alert('Add at least two options, separated by commas.');
    return;
  }

  addDoc(dinnerPollsCollection, { date: pollDateInput.value, options, votes: {} });
  pollForm.reset();
});

onSnapshot(dinnerPollsCollection, (snapshot) => {
  dinnerPolls = snapshot.docs.map((docSnap) => ({ id: docSnap.id, votes: {}, ...docSnap.data() }));
  renderPolls();
});

function renderPolls() {
  if (dinnerPolls.length === 0) {
    pollListEl.innerHTML = `<p class="empty-state">No polls yet.</p>`;
    return;
  }

  const sorted = [...dinnerPolls].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const myName = voterNameInput.value.trim();

  pollListEl.innerHTML = sorted
    .map((poll) => {
      const votes = poll.votes || {};

      // Tally: for each option, collect the list of voter names who picked it.
      const voterNamesByOption = {};
      poll.options.forEach((opt) => (voterNamesByOption[opt] = []));
      Object.entries(votes).forEach(([voter, chosenOption]) => {
        if (voterNamesByOption[chosenOption]) voterNamesByOption[chosenOption].push(voter);
      });

      const highestCount = Math.max(0, ...Object.values(voterNamesByOption).map((v) => v.length));
      const myVote = votes[myName];

      const optionsHtml = poll.options
        .map((opt) => {
          const voters = voterNamesByOption[opt];
          const isLeading = voters.length > 0 && voters.length === highestCount;
          const isMine = myVote === opt;
          const voterList = voters.length ? ` &middot; ${voters.map(escapeHtml).join(', ')}` : '';

          return `
            <button
              class="poll-option ${isLeading ? 'is-leading' : ''} ${isMine ? 'is-mine' : ''}"
              data-id="${poll.id}"
              data-option="${escapeHtml(opt)}"
            >
              <span>${escapeHtml(opt)}</span>
              <span class="poll-option__count">${voters.length} vote${voters.length === 1 ? '' : 's'}${voterList}</span>
            </button>`;
        })
        .join('');

      return `
        <div class="poll-card">
          <div class="poll-card__head">
            <span class="poll-card__date">${formatDateHeading(poll.date)}</span>
            <button class="poll-card__delete" data-id="${poll.id}">Remove poll</button>
          </div>
          ${optionsHtml}
        </div>`;
    })
    .join('');

  pollListEl.querySelectorAll('.poll-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = voterNameInput.value.trim();
      if (!name) {
        alert("Enter your name in the box above first, so we know whose vote this is.");
        voterNameInput.focus();
        return;
      }
      // Dot-notation field paths let us update just ONE key inside the
      // "votes" map without overwriting anyone else's vote.
      updateDoc(doc(db, 'dinnerPolls', btn.dataset.id), { [`votes.${name}`]: btn.dataset.option });
    });
  });

  pollListEl.querySelectorAll('.poll-card__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirmRemove('this poll (and all its votes)')) return;
      deleteDoc(doc(db, 'dinnerPolls', btn.dataset.id));
    });
  });
}

// Shared helper for both Itinerary and Dinner: both are "grouped by day"
// lists, so this one function sorts, groups by date, renders, and wires
// up delete buttons for whichever collection is passed in.
function renderDayGroups({ items, listEl, emptyHtml, rowHtml, deleteSelector, collectionName, itemLabel = 'this item' }) {
  if (items.length === 0) {
    listEl.innerHTML = emptyHtml;
    return;
  }

  const sorted = [...items].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

  const groups = {};
  sorted.forEach((entry) => {
    if (!groups[entry.date]) groups[entry.date] = [];
    groups[entry.date].push(entry);
  });

  listEl.innerHTML = Object.entries(groups)
    .map(([date, entries]) => `
      <div class="day-group">
        <div class="day-group__heading">${formatDateHeading(date)}</div>
        ${entries.map(rowHtml).join('')}
      </div>`)
    .join('');

  listEl.querySelectorAll(deleteSelector).forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirmRemove(itemLabel)) return;
      deleteDoc(doc(db, collectionName, btn.dataset.id));
    });
  });
}

function formatDateHeading(dateStr) {
  if (!dateStr) return 'No date';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// ---------------------------------------------------------
// 4. EXCURSIONS
// ---------------------------------------------------------
// Each excursion document has a "joiners" field — a plain array
// of names, e.g. ["Sam", "Priya"]. arrayUnion/arrayRemove are
// special Firestore instructions that add or remove one value
// from that array without needing to read the whole document first.
const excursionsCollection = collection(db, 'excursions');
let excursions = [];

const excursionForm = document.getElementById('excursion-form');
const excursionNameInput = document.getElementById('excursion-name');
const excursionDateInput = document.getElementById('excursion-date');
const excursionTimeInput = document.getElementById('excursion-time');
const excursionListEl = document.getElementById('excursion-list');

excursionForm.addEventListener('submit', (event) => {
  event.preventDefault();

  addDoc(excursionsCollection, {
    name: excursionNameInput.value,
    date: excursionDateInput.value,
    time: excursionTimeInput.value,
    joiners: [],
  });

  excursionForm.reset();
});

onSnapshot(excursionsCollection, (snapshot) => {
  excursions = snapshot.docs.map((docSnap) => ({ id: docSnap.id, joiners: [], ...docSnap.data() }));
  renderExcursions();
});

function renderExcursions() {
  if (excursions.length === 0) {
    excursionListEl.innerHTML = `<p class="empty-state">No excursions posted yet.</p>`;
    return;
  }

  const sorted = [...excursions].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

  excursionListEl.innerHTML = sorted
    .map(
      (ex) => `
        <div class="excursion-card">
          <div class="excursion-card__head">
            <span class="excursion-card__title">${escapeHtml(ex.name)}</span>
            <span class="excursion-card__when">${formatShortDate(ex.date)}${ex.time ? ' · ' + ex.time : ''}</span>
          </div>
          <div class="chips">
            ${ex.joiners.length === 0
              ? '<span class="empty-state" style="padding:0;">Nobody\'s joined yet</span>'
              : ex.joiners
                  .map(
                    (name) => `<span class="chip">${escapeHtml(name)} <button class="chip__leave" data-id="${ex.id}" data-name="${escapeHtml(name)}">✕</button></span>`
                  )
                  .join('')}
          </div>
          <div class="join-row">
            <input type="text" class="join-input" placeholder="Your name" />
            <button class="join-btn" data-id="${ex.id}">I'm in</button>
          </div>
          <button class="excursion-card__delete" data-id="${ex.id}">Remove excursion</button>
        </div>`
    )
    .join('');

  excursionListEl.querySelectorAll('.join-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling; // the .join-input right before this button
      const name = input.value.trim();
      if (!name) return;
      updateDoc(doc(db, 'excursions', btn.dataset.id), { joiners: arrayUnion(name) });
      input.value = '';
    });
  });

  excursionListEl.querySelectorAll('.chip__leave').forEach((btn) => {
    btn.addEventListener('click', () => {
      updateDoc(doc(db, 'excursions', btn.dataset.id), { joiners: arrayRemove(btn.dataset.name) });
    });
  });

  excursionListEl.querySelectorAll('.excursion-card__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirmRemove('this excursion (and everyone who joined it)')) return;
      deleteDoc(doc(db, 'excursions', btn.dataset.id));
    });
  });
}

function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------
// 5. PACKING LIST + GROCERIES
// ---------------------------------------------------------
// These are two separate Firestore collections ("packing" and
// "groceries"), but they behave identically — add an item, check
// it off, remove it — so one function builds both instead of
// copy-pasting the same code twice.
function setupChecklist({ collectionName, formEl, inputEl, listEl }) {
  const col = collection(db, collectionName);
  let items = [];

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    addDoc(col, { text: inputEl.value, packed: false });
    formEl.reset();
  });

  onSnapshot(col, (snapshot) => {
    items = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    render();
  });

  function render() {
    if (items.length === 0) {
      listEl.innerHTML = `<li class="empty-state">Nothing on the list yet.</li>`;
      return;
    }

    listEl.innerHTML = items
      .map(
        (item) => `
          <li class="${item.packed ? 'is-packed' : ''}">
            <input type="checkbox" id="${collectionName}-${item.id}" data-id="${item.id}" ${item.packed ? 'checked' : ''} />
            <label for="${collectionName}-${item.id}">${escapeHtml(item.text)}</label>
            <button class="checklist__delete" data-id="${item.id}">Remove</button>
          </li>`
      )
      .join('');

    listEl.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        updateDoc(doc(db, collectionName, checkbox.dataset.id), { packed: checkbox.checked });
      });
    });

    listEl.querySelectorAll('.checklist__delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!confirmRemove('this item')) return;
        deleteDoc(doc(db, collectionName, btn.dataset.id));
      });
    });
  }
}

setupChecklist({
  collectionName: 'packing',
  formEl: document.getElementById('packing-form'),
  inputEl: document.getElementById('packing-item'),
  listEl: document.getElementById('packing-list'),
});

setupChecklist({
  collectionName: 'groceries',
  formEl: document.getElementById('groceries-form'),
  inputEl: document.getElementById('groceries-item'),
  listEl: document.getElementById('groceries-list'),
});

// ---------------------------------------------------------
// 6. EXPENSES
// ---------------------------------------------------------
// Log who paid for what, list the names splitting costs (e.g. one
// entry per family), and see two things: a per-person balance
// against an equal split, AND a settle-up list — the fewest
// payments needed to make everyone even. That second part uses a
// classic "debt simplification" trick: match the person owed the
// most money with the person who owes the most, repeat.
const expensesCollection = collection(db, 'expenses');
const expensesSettingsRef = doc(db, 'settings', 'expenses');
let expenses = [];
let participants = [];

const expensesSettingsForm = document.getElementById('expenses-settings-form');
const expensesParticipantsInput = document.getElementById('expenses-participants');
const expenseForm = document.getElementById('expense-form');
const expenseDescriptionInput = document.getElementById('expense-description');
const expenseAmountInput = document.getElementById('expense-amount');
const expensePayerInput = document.getElementById('expense-payer');
const expenseListEl = document.getElementById('expense-list');
const expenseSummaryEl = document.getElementById('expense-summary');
const expenseSettlementsEl = document.getElementById('expense-settlements');

expensesSettingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const names = expensesParticipantsInput.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // setDoc with { merge: true } creates the document if it doesn't exist yet,
  // or updates just this field if it does — either way is safe here.
  setDoc(expensesSettingsRef, { participants: names }, { merge: true });
});

onSnapshot(expensesSettingsRef, (snapshot) => {
  participants = snapshot.exists() ? snapshot.data().participants || [] : [];
  expensesParticipantsInput.value = participants.join(', ');
  renderExpenses();
});

expenseForm.addEventListener('submit', (event) => {
  event.preventDefault();

  addDoc(expensesCollection, {
    description: expenseDescriptionInput.value,
    amount: parseFloat(expenseAmountInput.value) || 0,
    payer: expensePayerInput.value,
  });

  expenseForm.reset();
});

onSnapshot(expensesCollection, (snapshot) => {
  expenses = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  renderExpenses();
});

function renderExpenses() {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Anyone who paid for something counts toward the split even if you
  // forgot to list them in "Who's splitting" above — otherwise their
  // money would vanish from the math.
  const everyone = new Set(participants);
  expenses.forEach((e) => everyone.add(e.payer || 'Unknown'));
  const people = [...everyone];
  const fairShare = people.length ? total / people.length : 0;

  const paidByPerson = {};
  expenses.forEach((e) => {
    const name = e.payer || 'Unknown';
    paidByPerson[name] = (paidByPerson[name] || 0) + e.amount;
  });

  // balance > 0 means "is owed money back"; balance < 0 means "owes more".
  const balances = {};
  people.forEach((name) => {
    balances[name] = (paidByPerson[name] || 0) - fairShare;
  });

  // --- Summary card: what each person paid vs. their fair share ---
  const summaryRows = people
    .map((name) => {
      const diff = balances[name];
      const paid = paidByPerson[name] || 0;
      const label = diff >= 0.005 ? `is owed $${diff.toFixed(2)} back` : diff <= -0.005 ? `owes $${Math.abs(diff).toFixed(2)} more` : 'is settled up';
      const cls = diff >= 0.005 ? 'summary-card__row--owed' : diff <= -0.005 ? 'summary-card__row--owes' : '';
      return `<div class="summary-card__row ${cls}"><span>${escapeHtml(name)} (paid $${paid.toFixed(2)})</span><span>${label}</span></div>`;
    })
    .join('');

  expenseSummaryEl.innerHTML = `
    <div class="summary-card__total">Total: $${total.toFixed(2)} &middot; split ${people.length} way${people.length === 1 ? '' : 's'} = $${fairShare.toFixed(2)} each</div>
    ${summaryRows || '<div class="summary-card__row">No expenses logged yet.</div>'}
  `;

  // --- Settle-up card: the fewest payments to zero everyone out ---
  const settlements = computeSettlements(balances);
  expenseSettlementsEl.innerHTML = `
    <div class="summary-card__total">Settle up</div>
    ${
      settlements.length === 0
        ? '<div class="summary-card__row">Everyone\'s even — nothing to settle.</div>'
        : settlements
            .map((s) => `<div class="summary-card__row"><span>${escapeHtml(s.from)} pays ${escapeHtml(s.to)}</span><span>$${s.amount.toFixed(2)}</span></div>`)
            .join('')
    }
  `;

  // --- Expense list ---
  if (expenses.length === 0) {
    expenseListEl.innerHTML = `<p class="empty-state">No expenses logged yet.</p>`;
    return;
  }

  expenseListEl.innerHTML = expenses
    .map(
      (e) => `
        <div class="day-item">
          <span class="day-item__time">$${e.amount.toFixed(2)}</span>
          <span class="day-item__title">${escapeHtml(e.description)} &mdash; paid by ${escapeHtml(e.payer)}</span>
          <button class="day-item__delete" data-id="${e.id}">Remove</button>
        </div>`
    )
    .join('');

  expenseListEl.querySelectorAll('.day-item__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirmRemove('this expense')) return;
      deleteDoc(doc(db, 'expenses', btn.dataset.id));
    });
  });
}

// Greedy debt-simplification: repeatedly pair whoever is owed the most
// with whoever owes the most, settle as much of that pair as possible,
// and repeat until everyone's balance is ~zero. This produces the
// fewest payments possible to make the group even (though not
// necessarily "who originally paid whom").
function computeSettlements(balances) {
  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0.005)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < -0.005)
    .map(([name, amount]) => ({ name, amount: -amount })) // store as a positive "owes" amount
    .sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const payment = Math.min(debtors[i].amount, creditors[j].amount);
    transactions.push({ from: debtors[i].name, to: creditors[j].name, amount: payment });

    debtors[i].amount -= payment;
    creditors[j].amount -= payment;

    if (debtors[i].amount < 0.005) i++;
    if (creditors[j].amount < 0.005) j++;
  }

  return transactions;
}

// ---------------------------------------------------------
// 7. ROOMS
// ---------------------------------------------------------
const roomsCollection = collection(db, 'rooms');
let rooms = [];

const roomsForm = document.getElementById('rooms-form');
const roomNameInput = document.getElementById('room-name');
const roomNumberInput = document.getElementById('room-number');
const roomNotesInput = document.getElementById('room-notes');
const roomsListEl = document.getElementById('rooms-list');

roomsForm.addEventListener('submit', (event) => {
  event.preventDefault();

  addDoc(roomsCollection, {
    name: roomNameInput.value,
    room: roomNumberInput.value,
    notes: roomNotesInput.value,
  });

  roomsForm.reset();
});

onSnapshot(roomsCollection, (snapshot) => {
  rooms = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  renderRooms();
});

function renderRooms() {
  if (rooms.length === 0) {
    roomsListEl.innerHTML = `<p class="empty-state">No rooms added yet.</p>`;
    return;
  }

  const sorted = [...rooms].sort((a, b) => a.name.localeCompare(b.name));

  roomsListEl.innerHTML = sorted
    .map(
      (r) => `
        <div class="day-item">
          <span class="day-item__time">${escapeHtml(r.room)}</span>
          <span class="day-item__title">${escapeHtml(r.name)}${r.notes ? ` &mdash; ${escapeHtml(r.notes)}` : ''}</span>
          <button class="day-item__delete" data-id="${r.id}">Remove</button>
        </div>`
    )
    .join('');

  roomsListEl.querySelectorAll('.day-item__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirmRemove('this room entry')) return;
      deleteDoc(doc(db, 'rooms', btn.dataset.id));
    });
  });
}

// ---------------------------------------------------------
// 8. FLIGHTS
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
    // FlightAware's public tracker works off just the flight number, no
    // API key or signup needed — it's a real page showing live status,
    // gate, and delay info when the airline reports it.
    const trackUrl = `https://www.flightaware.com/live/flight/${encodeURIComponent(flight.number)}`;
    row.innerHTML = `
      <span>${escapeHtml(flight.name)} <span class="board__tag">${flight.direction === 'ARR' ? 'landing' : 'departing'}</span></span>
      <span>${escapeHtml(flight.number)}</span>
      <span>${formatShortDate(flight.date)}</span>
      <span>${flight.time}</span>
      <span class="board__actions">
        <a class="board__track" href="${trackUrl}" target="_blank" rel="noopener">Track ↗</a>
        <button class="board__delete" data-id="${flight.id}">✕</button>
      </span>
    `;
    flightBoardEl.appendChild(row);
  });

  flightBoardEl.querySelectorAll('.board__delete').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirmRemove('this flight')) return;
      deleteDoc(doc(db, 'flights', btn.dataset.id));
    });
  });
}

// ---------------------------------------------------------
// 9. SAFETY HELPER
// ---------------------------------------------------------
// Since we insert user-typed text into the page with
// innerHTML, we escape it first so someone typing something
// like "<script>" just shows as plain text instead of running.
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// A single confirmation dialog used before every destructive delete,
// so a stray tap doesn't wipe out something the whole group can see.
// The browser's built-in confirm() pauses everything until someone
// clicks OK or Cancel, and returns true/false accordingly.
function confirmRemove(label) {
  return confirm(`Remove ${label}? This can't be undone.`);
}

// Note: there's no "initial render" call here — every onSnapshot
// listener above fires immediately with the current data as soon
// as it's set up, which triggers each panel's first render on its own.
