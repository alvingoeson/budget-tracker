/* ===================================================================
   Budget Tracker App.js (modernized)
   -------------------------------------------------------------------
   Features: Theme toggle, CSV import/export, Category Budgets,
   Recurring Transactions (daily/weekly/monthly), Chart theming.
=================================================================== */

/* ---------- DOM refs ---------- */
const form          = document.getElementById('entryForm');
const descInput     = document.getElementById('descInput');
const amountInput   = document.getElementById('amountInput');
const typeInput     = document.getElementById('typeInput');
const categoryInput = document.getElementById('categoryInput');
const filterInput   = document.getElementById('filterInput');

const descError     = document.getElementById('descError');
const amountError   = document.getElementById('amountError');

const summaryEl     = document.getElementById('summary');
const entriesEl     = document.getElementById('entries');
const ctx           = document.getElementById('balanceChart').getContext('2d');

const exportBtn     = document.getElementById('exportBtn');
const importBtn     = document.getElementById('importBtn');
const importFile    = document.getElementById('importFile');
const themeToggle   = document.getElementById('themeToggle');

const budgetBtn     = document.getElementById('budgetBtn');
const budgetDlg     = document.getElementById('budgetDlg');
const budgetForm    = document.getElementById('budgetForm');
const budgetFields  = document.getElementById('budgetFields');
const budgetCancel  = document.getElementById('budgetCancel');

const repeatInput   = document.getElementById('repeatInput');

/* ---------- Storage keys ---------- */
const STORAGE_KEY = 'budget-entries';
const RECUR_KEY   = 'budget-recurring';
const BUDGET_KEY  = 'budget-limits';
const THEME_KEY   = 'budget-theme';

/* ---------- State ---------- */
let entries   = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let recurring = JSON.parse(localStorage.getItem(RECUR_KEY))   || [];
let budgets   = JSON.parse(localStorage.getItem(BUDGET_KEY))  || {};

/* ---------- Utility ---------- */
const fmt = n => '$' + Number(n).toFixed(2);

/* CSS custom property reader */
function cssVar(name){
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

/* ---------- Theme ---------- */
function applyTheme(){
  const mode = localStorage.getItem(THEME_KEY) || 'light';
  document.body.classList.toggle('dark-mode', mode === 'dark');
  themeToggle.textContent = mode === 'dark' ? '☀️' : '🌙';
  // re-theme chart
  renderChart();
}
themeToggle.addEventListener('click', () => {
  const next = document.body.classList.toggle('dark-mode') ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, next);
  themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  renderChart(); // update colors
});

/* ---------- Recurring engine ---------- */
function nextDate(dateStr, freq){
  const d = new Date(dateStr);
  if (freq === 'daily')   d.setDate(d.getDate() + 1);
  if (freq === 'weekly')  d.setDate(d.getDate() + 7);
  if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function materialiseRecurring(){
  const today = new Date().toISOString();
  let changed = false;

  recurring.forEach(r => {
    while (r.nextDue <= today){
      entries.push({
        id: Date.now() + Math.random(),
        date: r.nextDue,
        desc: r.desc,
        amount: r.amount,
        type: r.type,
        category: r.category,
        _recurring: true
      });
      r.nextDue = nextDate(r.nextDue, r.freq);
      changed = true;
    }
  });

  if (changed) saveAll();
}

/* ---------- Save helpers ---------- */
function saveAll(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  localStorage.setItem(RECUR_KEY,   JSON.stringify(recurring));
  localStorage.setItem(BUDGET_KEY,  JSON.stringify(budgets));
}

/* ---------- CSV import/export ---------- */
function entriesToCSV(){
  const header = ['id','date','desc','amount','type','category'];
  const rows   = entries.map(e => [e.id, e.date, e.desc, e.amount, e.type, e.category]);
  return Papa.unparse([header, ...rows]); // spread rows
}
function downloadCSV(){
  const csv  = entriesToCSV();
  const blob = new Blob([csv],{type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `budget-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function importCSVFile(file){
  Papa.parse(file,{
    header:true,
    skipEmptyLines:true,
    complete:({data})=>{
      const imported = data
        .filter(r => r.amount && !isNaN(Number(r.amount)))
        .map(r => ({
          id: Number(r.id) || Date.now()+Math.random(),
          date: r.date || new Date().toISOString(),
          desc: r.desc || '',
          amount: Number(r.amount),
          type: (r.type === 'income') ? 'income' : 'expense',
          category: r.category || 'Other'
        }));
      entries = entries.concat(imported);
      saveAll();
      renderAll();
      alert(`Imported ${imported.length} rows ✔`);
    },
    error:(err)=>alert('Import failed: '+err.message)
  });
}
exportBtn.addEventListener('click', downloadCSV);
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', e => {
  if(e.target.files.length) importCSVFile(e.target.files[0]);
  importFile.value = ''; // reset
});

/* ---------- Budgets ---------- */
function openBudgetDialog(){
  const cats = [...new Set(entries.map(e=>e.category))].sort();
  budgetFields.innerHTML = cats.map(cat=>{
    const val = budgets[cat] ?? '';
    return `<label>${cat}<input type="number" min="0" step="0.01" name="${cat}" value="${val}" /></label>`;
  }).join('') || '<p>No categories yet. Add an entry first.</p>';
  budgetDlg.showModal();
}
budgetBtn.addEventListener('click', openBudgetDialog);
budgetCancel.addEventListener('click', () => budgetDlg.close());

budgetForm.addEventListener('submit', e=>{
  e.preventDefault();
  const data = new FormData(budgetForm);
  budgets = {};
  data.forEach((val,key)=>{
    const num = Number(val);
    if(num>0) budgets[key] = num;
  });
  saveAll();
  budgetDlg.close();
  renderBudgets();
});

function calcSpendByCat(){
  const spends = {};
  entries.forEach(e=>{
    const cat = e.category;
    const delta = (e.type === 'expense') ? e.amount : -e.amount;
    spends[cat] = (spends[cat]||0) + delta;
  });
  return spends;
}

function renderBudgets(){
  let host = document.getElementById('budgetBars');
  if(!host){
    host = document.createElement('div');
    host.id = 'budgetBars';
    summaryEl.appendChild(host);
  }
  host.innerHTML = '';

  const spends = calcSpendByCat();
  Object.keys(budgets).forEach(cat=>{
    const limit = budgets[cat];
    const spent = Math.max(spends[cat]||0,0);
    const pct   = Math.round((spent/limit)*100);
    const clamped = Math.min(100,pct);

    const row = document.createElement('div');
    row.className = 'budget-row';
    row.innerHTML = `
      <span>${cat}</span>
      <span>${spent.toLocaleString()}/${limit.toLocaleString()}</span>
      <div class="bar"><div style="width:${clamped}%"></div></div>
    `;
    row.querySelector('.bar div').style.background =
      pct >= 100 ? 'var(--expense)' : 'var(--income)';
    host.appendChild(row);
  });

  if(!host.childElementCount){
    host.innerHTML = '<p style="color:var(--sub);font-size:.9rem">Set monthly budgets to track progress.</p>';
  }
}

/* ---------- Category lists (static seeds) ---------- */
const cats = {
  income : ['Salary','Freelance','Investment','Gift','Interest','Other'],
  expense: ['Food','Rent','Utilities','Transportation','Entertainment','Health','Education','Subscriptions','Shopping','Other']
};

/* ---------- Populate category + filter ---------- */
function fillCats() {
  const list = cats[typeInput.value] || [];

  // Populate categoryInput (for entry form) as before
  if (list.length) {
    categoryInput.innerHTML =
      `<option value="" disabled selected hidden> </option>` +
      list.map(c => `<option value="${c}">${c}</option>`).join('');
  } else {
    categoryInput.innerHTML =
      `<option value="" disabled selected hidden> </option>`;
  }
  categoryInput.value = "";
  categoryInput.selectedIndex = 0;

  // Populate filterInput with all unique categories from entries
  const allCats = [...new Set(entries.map(e => e.category))].sort();
  filterInput.innerHTML =
    '<option value="all">All</option>' +
    allCats.map(c => `<option value="${c}">${c}</option>`).join('');
}
typeInput.addEventListener('change', fillCats);
filterInput.addEventListener('change', renderEntries);

/* ---------- Summary cards ---------- */
function renderSummary(filteredEntries = entries) {
  const inc = filteredEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const exp = filteredEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);

  summaryEl.innerHTML = `
    <div class="sum-card income">Income: <span>${fmt(inc)}</span></div>
    <div class="sum-card expense">Expenses: <span>${fmt(exp)}</span></div>
    <div class="sum-card balance">Balance: <span>${fmt(inc - exp)}</span></div>
  `;
}


/* ---------- Entries list ---------- */
function renderEntries() {
  entriesEl.innerHTML = '';
  const filter = filterInput.value;

  // Filtered entries
  const filtered = entries
    .filter(e => filter === 'all' || e.category === filter)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Render filtered entries
  filtered.reduce((lastMonth, entry) => {
    const d = new Date(entry.date);
    const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;

    if (monthKey !== lastMonth) {
      const header = document.createElement('li');
      header.className = 'month-header';
      header.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
      entriesEl.appendChild(header);
    }

    const li = document.createElement('li');
    li.className = `entry ${entry.type}`;
    const dateLabel = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    li.innerHTML = `
      <span class="entry-date">${dateLabel}</span>
      <span class="entry-category">${entry.category}</span>
      <span class="entry-desc">${entry.desc}</span>
      <span class="entry-amt">${entry.type === 'expense' ? '-' : '+'} ${fmt(entry.amount)}</span>
      <button aria-label="Delete entry">&times;</button>
    `;
    li.querySelector('button').onclick = () => {
      entries = entries.filter(e => e.id !== entry.id);
      saveAll();
      renderAll();
    };
    entriesEl.appendChild(li);

    return monthKey;
  }, '');

  // Only update the chart with filtered entries
  renderChart(filtered);
}

/* ---------- Chart ---------- */
let balanceChart;
function renderChart(filteredEntries = entries) {
  // guard if canvas missing
  if(!ctx) return;

  const inc = filteredEntries.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0);
  const exp = filteredEntries.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0);

  // Create gradients matching summary cards
  const incomeGradient = ctx.createLinearGradient(0, 0, 0, 400);
  incomeGradient.addColorStop(0, "#43e97b"); // green
  incomeGradient.addColorStop(1, "#38f9d7"); // teal

  const expenseGradient = ctx.createLinearGradient(0, 0, 0, 400);
  expenseGradient.addColorStop(0, "#ff5858"); // red
  expenseGradient.addColorStop(1, "#f09819"); // orange

  if (balanceChart) balanceChart.destroy();
  balanceChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{
        data: [inc, exp],
        backgroundColor: [incomeGradient, expenseGradient],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            color: "#fff",
            font: { weight: 600 },
            padding: 28
          }
        }
      }
    }
  });
}

/* ---------- Master render ---------- */
function renderAll() {
  renderSummary();    // always show summary for all entries
  renderEntries();    // entries and chart will reflect filter
  renderChart();      // (optional, since renderEntries calls renderChart)
  renderBudgets();
}

/* ---------- Validation ---------- */
function fieldsAreValid(){
  let valid = true;

  if (!descInput.value.trim()){
    descError.hidden = false;
    valid = false;
  } else {
    descError.hidden = true;
  }

  const val = Number(amountInput.value);
  if (isNaN(val) || val <= 0){
    amountError.hidden = false;
    valid = false;
  } else {
    amountError.hidden = true;
  }

  if (!typeInput.value) valid = false;
  if (!categoryInput.value) valid = false;

  return valid;
}

/* ---------- Form submit ---------- */
form.addEventListener('submit', e => {
  e.preventDefault();
  if (!fieldsAreValid()) return;

  const baseEntry = {
    id: Date.now(),
    date: new Date().toISOString(),
    desc: descInput.value.trim(),
    amount: Number(amountInput.value),
    type: typeInput.value,
    category: categoryInput.value
  };

  const freq = repeatInput.value;
  if (freq === 'none'){
    entries.push(baseEntry);
  } else {
    entries.push(baseEntry);
    recurring.push({
      id: baseEntry.id,   // link template id to first occurrence
      desc: baseEntry.desc,
      amount: baseEntry.amount,
      type: baseEntry.type,
      category: baseEntry.category,
      freq,
      nextDue: nextDate(baseEntry.date, freq)
    });
  }

  saveAll();
  renderAll();

  form.reset();
  repeatInput.value = 'none';
  fillCats(); // resets category placeholder
  descInput.focus();
});

/* ---------- Init ---------- */
applyTheme();
materialiseRecurring();   // must run before first render so missed items appear
fillCats();
renderAll();
