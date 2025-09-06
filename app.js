/* ===================================================================
   Budget Tracker App.js (Advanced Filters build)
   =================================================================== */

/* ----- DOM refs ----- */
const form          = document.getElementById('entryForm');
const descInput     = document.getElementById('descInput');
const amountInput   = document.getElementById('amountInput');
const typeInput     = document.getElementById('typeInput');
const categoryInput = document.getElementById('categoryInput');
const repeatInput   = document.getElementById('repeatInput');

const descError     = document.getElementById('descError');
const amountError   = document.getElementById('amountError');

const summaryEl     = document.getElementById('summary');
const entriesEl     = document.getElementById('entries');
const ctx           = document.getElementById('balanceChart').getContext('2d');

const exportBtn     = document.getElementById('exportBtn');
const importBtn     = document.getElementById('importBtn');
const importFile    = document.getElementById('importFile');
const themeToggle   = document.getElementById('themeToggle');

const filterContainer = document.querySelector('.filter-container');
const filterToggle    = document.getElementById('filterToggle');

filterToggle.addEventListener('click', () => {
  const isOpen = filterContainer.classList.toggle('open');
  filterToggle.setAttribute('aria-expanded', isOpen);
});

/* Filter controls */
const filterType    = document.getElementById('filterType');    // new
const filterInput   = document.getElementById('filterInput');   // category
const filterFrom    = document.getElementById('filterFrom');    // date from
const filterTo      = document.getElementById('filterTo');      // date to
const filterSearch  = document.getElementById('filterSearch');  // text
const filterClear   = document.getElementById('filterClear');   // clear btn

/* ----- Storage keys ----- */
const STORAGE_KEY = 'budget-entries';
const RECUR_KEY   = 'budget-recurring';
const THEME_KEY   = 'budget-theme';

/* ----- State ----- */
let entries   = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let recurring = JSON.parse(localStorage.getItem(RECUR_KEY))   || [];

/* Optional clean-up: drop old budget data */
localStorage.removeItem('budget-limits');

/* ----- Utils ----- */
const fmt = n => '$' + Number(n).toFixed(2);
function cssVar(name){
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}
function parseISODateOnly(str){
  // Accept ISO or yyyy-mm-dd; return Date or null
  if(!str) return null;
  // Some entries have full ISO with time; Date(...) handles both
  const d = new Date(str);
  return isNaN(d) ? null : d;
}
function ymd(date){
  return date.toISOString().slice(0,10);
}

/* ----- Theme ----- */
function applyTheme(){
  const mode = localStorage.getItem(THEME_KEY) || 'light';
  document.body.classList.toggle('dark-mode', mode === 'dark');
  themeToggle.textContent = mode === 'dark' ? '☀️' : '🌙';
  applyFiltersAndRender(); // re-color chart labels
}
themeToggle.addEventListener('click', () => {
  const next = document.body.classList.toggle('dark-mode') ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, next);
  themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  applyFiltersAndRender();
});

/* ----- Recurring engine ----- */
function nextDate(dateStr, freq){
  const d = new Date(dateStr);
  if(freq==='daily')   d.setDate(d.getDate()+1);
  if(freq==='weekly')  d.setDate(d.getDate()+7);
  if(freq==='monthly') d.setMonth(d.getMonth()+1);
  return d.toISOString();
}
function materialiseRecurring(){
  const today = new Date().toISOString();
  let changed = false;
  recurring.forEach(r=>{
    while(r.nextDue <= today){
      entries.push({
        id: Date.now()+Math.random(),
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
  if(changed) saveAll();
}

/* ----- Save helpers ----- */
function saveAll(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  localStorage.setItem(RECUR_KEY,   JSON.stringify(recurring));
}

/* ----- CSV helpers ----- */
function entriesToCSV(){
  const header = ['id','date','desc','amount','type','category'];
  const rows   = entries.map(e=>[e.id,e.date,e.desc,e.amount,e.type,e.category]);
  return Papa.unparse([header,...rows]);
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
        .filter(r=>r.amount && !isNaN(Number(r.amount)))
        .map(r=>({
          id: Number(r.id)||Date.now()+Math.random(),
          date: r.date || new Date().toISOString(),
          desc: r.desc || '',
          amount: Number(r.amount),
          type: (r.type==='income')?'income':'expense',
          category: r.category || 'Other'
        }));
      entries = entries.concat(imported);
      saveAll();
      applyFiltersAndRender();
      alert(`Imported ${imported.length} rows ✔`);
    },
    error:(err)=>alert('Import failed: '+err.message)
  });
}
exportBtn.addEventListener('click', downloadCSV);
importBtn.addEventListener('click', ()=>importFile.click());
importFile.addEventListener('change', e=>{
  if(e.target.files.length) importCSVFile(e.target.files[0]);
  importFile.value='';
});

/* ----- Category seeds (for entry form only) ----- */
const cats = {
  income : ['Salary','Freelance','Investment','Gift','Interest','Other'],
  expense: ['Food','Rent','Utilities','Transportation','Entertainment','Health','Education','Subscriptions','Shopping','Remittance','Other']
};

/* ----- Populate entry-form Category options based on Type ----- */
function fillCats() {
  const list = cats[typeInput.value] || [];
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
}
typeInput.addEventListener('change', fillCats);

/* ===== FILTER SYSTEM ===== */

/* Build the Category filter choices from current entries (respecting Type filter) */
function rebuildFilterCategory() {
  const prior = filterInput.value;
  const typeVal = filterType.value;
  const catsSet = new Set(
    entries
      .filter(e => typeVal === 'all' || e.type === typeVal)
      .map(e => e.category)
  );
  const catOptions = ['all', ...Array.from(catsSet).sort()];
  filterInput.innerHTML = catOptions
    .map(v => `<option value="${v}">${v === 'all' ? 'All' : v}</option>`)
    .join('');
  // restore selection if still present; else All
  filterInput.value = catOptions.includes(prior) ? prior : 'all';
}

/* Constrain date pickers to data range; preserve chosen values if valid */
function setFilterDateBounds() {
  if(!entries.length){
    filterFrom.min = filterFrom.max = filterTo.min = filterTo.max = '';
    return;
  }
  const dates = entries.map(e=>new Date(e.date));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const minISO = ymd(minDate);
  const maxISO = ymd(maxDate);
  filterFrom.min = filterTo.min = minISO;
  filterFrom.max = filterTo.max = maxISO;
  // Clamp existing values if out of range
  if(filterFrom.value && filterFrom.value < minISO) filterFrom.value = minISO;
  if(filterTo.value   && filterTo.value   > maxISO) filterTo.value   = maxISO;
}

/* Collect & apply all filters, returning the filtered array */
function getFilteredEntries(){
  let out = [...entries];

  const t = filterType.value;
  if(t !== 'all') out = out.filter(e => e.type === t);

  const c = filterInput.value;
  if(c !== 'all') out = out.filter(e => e.category === c);

  const fromVal = filterFrom.value;
  const toVal   = filterTo.value;
  if(fromVal){
    const fromDate = new Date(fromVal + 'T00:00:00');
    out = out.filter(e => new Date(e.date) >= fromDate);
  }
  if(toVal){
    // inclusive end-of-day
    const toDate = new Date(toVal + 'T23:59:59.999');
    out = out.filter(e => new Date(e.date) <= toDate);
  }

  const q = filterSearch.value.trim().toLowerCase();
  if(q){
    out = out.filter(e => e.desc.toLowerCase().includes(q));
  }

  return out;
}

/* Event wiring */
[filterType, filterInput, filterFrom, filterTo].forEach(el=>{
  el.addEventListener('change', applyFiltersAndRender);
});
filterSearch.addEventListener('input', applyFiltersAndRender);
filterClear.addEventListener('click', ()=>{
  filterType.value = 'all';
  filterInput.value = 'all';
  filterFrom.value = '';
  filterTo.value = '';
  filterSearch.value = '';
  applyFiltersAndRender();
});

/* ----- Render Summary ----- */
function renderSummary(list = entries) {
  const inc = list.filter(e => e.type==='income').reduce((s,e)=>s+e.amount,0);
  const exp = list.filter(e => e.type==='expense').reduce((s,e)=>s+e.amount,0);
  const bal = inc - exp;
  summaryEl.innerHTML = `
    <div class="sum-card income">Income: <span>${fmt(inc)}</span></div>
    <div class="sum-card expense">Expenses: <span>${fmt(exp)}</span></div>
    <div class="sum-card balance">Balance: <span>${fmt(bal)}</span></div>
  `;
}

/* ----- Render Entries ----- */
function renderEntries(list = entries) {
  entriesEl.innerHTML = '';
  list
    .sort((a,b)=>new Date(b.date)-new Date(a.date))
    .reduce((lastMonth, entry) => {
      const d = new Date(entry.date);
      const monthKey = `${d.getFullYear()}-${d.getMonth()+1}`;

      if (monthKey!==lastMonth) {
        const header = document.createElement('li');
        header.className = 'month-header';
        header.textContent = d.toLocaleDateString(undefined,{year:'numeric',month:'long'});
        entriesEl.appendChild(header);
      }

      const li = document.createElement('li');
      li.className = `entry ${entry.type}${entry._recurring?' _recurring':''}`;
      const dateLabel = d.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'});
      li.innerHTML = `
        <span class="entry-date">${dateLabel}</span>
        <span class="entry-category">${entry.category}</span>
        <span class="entry-desc">${entry.desc}</span>
        <span class="entry-amt">${entry.type==='expense'?'-':'+'} ${fmt(entry.amount)}</span>
        <button aria-label="Delete entry">&times;</button>
      `;
      li.querySelector('button').onclick = () => {
        entries = entries.filter(e => e.id!==entry.id);
        saveAll();
        applyFiltersAndRender();
      };
      entriesEl.appendChild(li);

      return monthKey;
    }, '');
}

/* ---------- Chart ---------- */
let balanceChart;
function renderChart(list = entries) {
  if (!ctx) return;
  const inc = list.filter(e => e.type==='income').reduce((s,e)=>s+e.amount,0);
  const exp = list.filter(e => e.type==='expense').reduce((s,e)=>s+e.amount,0);
  const h = ctx.canvas.clientHeight || ctx.canvas.height || 200;

  const incomeGradient = ctx.createLinearGradient(0,0,0,h);
  incomeGradient.addColorStop(0, "#43e97b");
  incomeGradient.addColorStop(1, "#38f9d7");

  const expenseGradient = ctx.createLinearGradient(0,0,0,h);
  expenseGradient.addColorStop(0, "#ff5858");
  expenseGradient.addColorStop(1, "#f09819");

  const legendColor = cssVar('--text') || '#000';

  if (balanceChart) balanceChart.destroy();
  balanceChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{ data: [inc, exp], backgroundColor: [incomeGradient, expenseGradient], borderWidth: 0 }]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      cutout:'55%',
      plugins:{
        legend:{ position:'bottom', labels:{ usePointStyle:true, color:legendColor, font:{weight:600}, padding:28 }},
        tooltip:{ callbacks:{ label:(ctx)=>`${ctx.label}: ${fmt(Number(ctx.parsed))}` }}
      }
    }
  });
}

/* ----- Central render orchestrator ----- */
function applyFiltersAndRender(){
  rebuildFilterCategory();
  setFilterDateBounds();
  const filtered = getFilteredEntries();
  renderSummary(filtered);
  renderEntries(filtered);
  renderChart(filtered);
}

/* ----- Validation ----- */
function fieldsAreValid(){
  let valid = true;
  if (!descInput.value.trim()){ descError.hidden=false; valid=false; } else descError.hidden=true;
  const val = Number(amountInput.value);
  if (isNaN(val)||val<=0){ amountError.hidden=false; valid=false; } else amountError.hidden=true;
  if (!typeInput.value) valid=false;
  if (!categoryInput.value) valid=false;
  return valid;
}

/* ----- Submit ----- */
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

  const freq = repeatInput.value || 'none';
  if (freq==='none' || freq==='') {
    entries.push(baseEntry);
  } else {
    entries.push(baseEntry);
    recurring.push({
      id: baseEntry.id,
      desc: baseEntry.desc,
      amount: baseEntry.amount,
      type: baseEntry.type,
      category: baseEntry.category,
      freq,
      nextDue: nextDate(baseEntry.date, freq)
    });
  }

  saveAll();
  form.reset();
  repeatInput.value = '';
  typeInput.value   = '';
  fillCats();
  descInput.focus();

  applyFiltersAndRender();
});

/* ----- Init ----- */
applyTheme();
materialiseRecurring();
fillCats();
applyFiltersAndRender();