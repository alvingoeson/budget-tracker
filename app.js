// ─── DOM refs
const form         = document.getElementById('entryForm');
const descInput    = document.getElementById('descInput');
const amountInput  = document.getElementById('amountInput');
const typeInput    = document.getElementById('typeInput');
const categoryInput= document.getElementById('categoryInput');
const filterInput  = document.getElementById('filterInput');

const descError   = document.getElementById('descError');
const amountError = document.getElementById('amountError');

const summaryEl = document.getElementById('summary');
const entriesEl = document.getElementById('entries');
const ctx       = document.getElementById('balanceChart').getContext('2d');

// ─── Storage & State
const STORAGE_KEY = 'budget-entries';
const THEME_KEY   = 'budget-theme'; // — NEW
let entries = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

// ─── Theme helpers — NEW FEATURE
function applyTheme(){
  const mode = localStorage.getItem(THEME_KEY) || 'light';
  document.body.classList.toggle('dark-mode', mode==='dark');
  themeToggle.textContent = mode==='dark' ? '☀️' : '🌙';
}
themeToggle.addEventListener('click', () =>{
  const next = document.body.classList.toggle('dark-mode') ? 'dark':'light';
  localStorage.setItem(THEME_KEY,next);
  themeToggle.textContent = next==='dark' ? '☀️' : '🌙';
});

// ─── CSV helpers — NEW FEATURE
function entriesToCSV(){
  const header = ['id','date','desc','amount','type','category'];
  const rows   = entries.map(e=>[
    e.id,e.date,e.desc,e.amount,e.type,e.category
  ]);
  return Papa.unparse([header,...rows]); // uses PapaParse
}
function downloadCSV(){
  const csv = entriesToCSV();
  const blob = new Blob([csv],{type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
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
      // Convert rows → entries; basic validation
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
      entries = [...entries, ...imported];
      save();
      renderAll();
      alert(`Imported ${imported.length} rows ✔`);
    },
    error:(err)=>alert('Import failed: '+err.message)
  });
}

// ─── Categories
const cats = {
  income : ['Salary','Freelance','Investment','Gift','Interest','Other'],
  expense: ['Food','Rent','Utilities','Transportation','Entertainment',
            'Health','Education','Subscriptions','Shopping','Other']
};

// ─── Helpers
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
const fmt  = n  => '$' + n.toFixed(2);

// ─── Populate Type → Category & Filter
function fillCats() {
  const list = cats[typeInput.value] || [];

  if (list.length) {
    categoryInput.innerHTML =
      `<option value="" disabled selected hidden>Category</option>` +
      list.map(c => `<option value="${c}">${c}</option>`).join('');
  } else {
    categoryInput.innerHTML =
      `<option value="" disabled selected hidden>Choose type first…</option>`;
  }

  // ✓ Reset so placeholder shows (gray) until a real option is picked
  categoryInput.value = "";
  categoryInput.selectedIndex = 0;

  // Rebuild filter
  filterInput.innerHTML =
    '<option value="all">All</option>' +
    list.map(c => `<option value="${c}">${c}</option>`).join('');
}

// ─── Render Summary
function renderSummary() {
  const inc = entries.filter(e => e.type==='income').reduce((s,e)=>s+e.amount,0);
  const exp = entries.filter(e => e.type==='expense').reduce((s,e)=>s+e.amount,0);

  summaryEl.innerHTML = `
    <div class="sum-card income">Income: <span>${fmt(inc)}</span></div>
    <div class="sum-card expense">Expenses: <span>${fmt(exp)}</span></div>
    <div class="sum-card balance">Balance: <span>${fmt(inc-exp)}</span></div>
  `;
}

// ─── Render Entries
function renderEntries() {
  entriesEl.innerHTML = '';
  const filter = filterInput.value;

  entries
    .filter(e => filter==='all' || e.category===filter)
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
      li.className = `entry ${entry.type}`;
      const dateLabel = d.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'});
      li.innerHTML = `
        <span class="entry-date">${dateLabel}</span>
        <span class="entry-category">${entry.category}</span>
        <span class="entry-desc">${entry.desc}</span>
        <span class="entry-amt">${entry.type==='expense'?'-':'+'} ${fmt(entry.amount)}</span>
        <button>&times;</button>
      `;
      li.querySelector('button').onclick = () => {
        entries = entries.filter(e => e.id!==entry.id);
        save();
        renderAll();
      };
      entriesEl.appendChild(li);

      return monthKey;
    }, '');
}

// ─── Render Donut Chart
let balanceChart;
function renderChart() {
  const inc = entries.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0);
  const exp = entries.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0);

  if (balanceChart) balanceChart.destroy();
  balanceChart = new Chart(ctx,{
    type:'doughnut',
    data:{
      labels:['Income','Expenses'],
      datasets:[{data:[inc,exp],backgroundColor:['#28a745','#e63946']}]},
    options:{
      responsive:true,
      cutout:'50%',
      plugins:{legend:{position:'bottom'}}
    }
  });
}

// ─── Full Render
function renderAll() {
  renderSummary();
  renderEntries();
  renderChart();
}

// ─── Validation
function fieldsAreValid(){
  let valid = true;
  if (!descInput.value.trim()) { descError.hidden = false; valid = false; }
  else { descError.hidden = true; }
  const val = Number(amountInput.value);
  if (isNaN(val)||val<=0) { amountError.hidden = false; valid = false; }
  else { amountError.hidden = true; }
  return valid;
}

// ─── Listeners
typeInput.addEventListener('change', fillCats);
filterInput.addEventListener('change', renderEntries);

form.addEventListener('submit', e => {
  e.preventDefault();
  if (!fieldsAreValid()) return;

  entries.push({
    id: Date.now(),
    date: new Date().toISOString(),
    desc: descInput.value.trim(),
    amount: Number(amountInput.value),
    type: typeInput.value,
    category: categoryInput.value
  });

  save();
  renderAll();

  // Reset & restore placeholders
  form.reset();
  fillCats();
  descInput.focus();
});

// Add new listeners
exportBtn.addEventListener('click', downloadCSV);
importBtn.addEventListener('click', ()=>importFile.click());
importFile.addEventListener('change', e=>{
  if(e.target.files.length) importCSVFile(e.target.files[0]);
  importFile.value=''; // reset
});

// ─── Init
applyTheme();
fillCats();
renderAll();
