const form           = document.getElementById('entryForm');
const descInput      = document.getElementById('descInput');
const amountInput    = document.getElementById('amountInput');
const typeInput      = document.getElementById('typeInput');
const entriesEl      = document.getElementById('entries');
const totalIncomeEl  = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const balanceEl      = document.getElementById('balance');

let entries = JSON.parse(localStorage.getItem('budget-entries') || '[]');

function save() {
    localStorage.setItem('budget-entries', JSON.stringify(entries));
}

function currency(n) {
    return '$' + n.toFixed(2);
}

function renderSummary() {
    const income = entries
        .filter(e => e.type === 'income')
        .reduce((s, e) => s + e.amount, 0);
    const expense = entries
        .filter(e => e.type === 'expense')
        .reduce((s, e) => s + e.amount, 0);
    const balance = income - expense;
    totalIncomeEl.textContent  = currency(income);
    totalExpenseEl.textContent = currency(expense);
    balanceEl.textContent      = currency(balance);
}

function renderEntries() {
    entriesEl.innerHTML = '';
    entries.forEach(entry => {
        const li = document.createElement('li');
        li.className = `entry ${entry.type}`;
        li.innerHTML = `
            <span class="entry-desc">${entry.desc}</span>
            <span class="entry-amt">${entry.type === 'expense' ? '-' : '+'} ${currency(entry.amount)}</span>
            <button title="Delete" aria-label="Delete">&times;</button>
        `;
        li.querySelector('button').addEventListener('click', () => {
            entries = entries.filter(e => e.id !== entry.id);
            save();
            renderEntries();
            renderSummary();
        });
        entriesEl.appendChild(li);
    });
}

form.addEventListener('submit', e => {
    e.preventDefault();
    const desc   = descInput.value.trim();
    const amount = parseFloat(amountInput.value);
    if (!desc || isNaN(amount) || amount <= 0) return;
    const type = typeInput.value;
    entries.push({ id: Date.now(), desc, amount, type });
    save();
    renderEntries();
    renderSummary();
    form.reset();
    descInput.focus();
});

// Initial render
renderEntries();
renderSummary();
