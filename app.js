// ─── DOM references ──────────────────────────
const form          = document.getElementById('entryForm');
const descInput     = document.getElementById('descInput');
const amountInput   = document.getElementById('amountInput');
const typeInput     = document.getElementById('typeInput');
const categoryInput = document.getElementById('categoryInput');
const filterInput   = document.getElementById('filterInput');

const addButton   = form.querySelector('button[type="submit"]');
const descError   = document.getElementById('descError');
const amountError = document.getElementById('amountError');

const entriesEl      = document.getElementById('entries');
const totalIncomeEl  = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const balanceEl      = document.getElementById('balance');

// ─── Local-storage state ──────────────────────
const STORAGE_KEY = 'budget-entries';
let entries = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

// ─── Helpers ──────────────────────────────────
const save     = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
const currency = n => '$' + n.toFixed(2);

function renderSummary() {
  const income  = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const expense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  totalIncomeEl.textContent  = currency(income);
  totalExpenseEl.textContent = currency(expense);
  balanceEl.textContent      = currency(income - expense);
}

function renderEntries() {
  entriesEl.innerHTML = '';
  const filter = filterInput.value;

  // Sort newest-first so month headers appear descending
  const list = entries
    .filter(e => filter === 'all' || e.category === filter)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let lastMonthKey = '';

  list.forEach(entry => {
    const d = new Date(entry.date);
    const monthKey = d.getFullYear() + '-' + (d.getMonth() + 1);  // e.g. "2025-7"

    // ── Insert a month header if we’re in a new month ──
    if (monthKey !== lastMonthKey) {
      lastMonthKey = monthKey;
      const header = document.createElement('li');
      header.className = 'month-header';
      header.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
      entriesEl.appendChild(header);
    }

    // ── Build the entry row ──
    const li = document.createElement('li');
    li.className = `entry ${entry.type}`;

    const dateLabel = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

    li.innerHTML = `
      <span class="entry-date">${dateLabel}</span>
      <span class="entry-category">${entry.category}:</span>
      <span class="entry-desc">${entry.desc}</span>
      <span class="entry-amt">
        ${entry.type === 'expense' ? '-' : '+'} ${currency(entry.amount)}
      </span>
      <button title="Delete" aria-label="Delete">&times;</button>
    `;

    li.querySelector('button').onclick = () => {
      entries = entries.filter(e => e.id !== entry.id);
      save();
      renderEntries();
      renderSummary();
    };

    entriesEl.appendChild(li);
  });
}

// ─── Submit-only validation ───────────────────
function fieldsAreValid() {
  const desc   = descInput.value.trim();
  const amount = Number(amountInput.value);
  let valid = true;

  if (desc === '') {
    descError.hidden = false;
    valid = false;
  } else {
    descError.hidden = true;
  }

  if (isNaN(amount) || amount <= 0) {
    amountError.hidden = false;
    valid = false;
  } else {
    amountError.hidden = true;
  }

  return valid;
}

// ─── Event listeners ─────────────────────────
filterInput.addEventListener('change', renderEntries);

form.addEventListener('submit', e => {
  e.preventDefault();
  if (!fieldsAreValid()) return;      // show errors & abort if invalid

  // Create and store the new entry (timestamped!)
  entries.push({
    id:       Date.now(),
    date:     new Date().toISOString(),        // 🆕 timestamp
    desc:     descInput.value.trim(),
    amount:   Number(amountInput.value),
    type:     typeInput.value,
    category: categoryInput.value
  });

  save();
  renderEntries();
  renderSummary();

  // Reset for next input
  form.reset();
  descError.hidden   = true;
  amountError.hidden = true;
  descInput.focus();
});

// ─── First render ─────────────────────────────
renderEntries();
renderSummary();
