// utils.js

// Format a number as currency
export function currency(n) {
  return '$' + n.toFixed(2);
}

// Given a list of entries, compute monthly labels and totals
export function getMonthlyData(entries) {
  const map = {};
  entries.forEach(e => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${d.getMonth()+1}`;
    if (!map[key]) map[key] = { income: 0, expense: 0 };
    map[key][e.type] += e.amount;
  });
  const keys = Object.keys(map).sort((a,b) => {
    const [ay,am] = a.split('-').map(Number);
    const [by,bm] = b.split('-').map(Number);
    return new Date(ay,am-1) - new Date(by,bm-1);
  });
  return {
    labels:   keys.map(k => {
      const [y,m] = k.split('-');
      return new Date(y,m-1).toLocaleDateString('en-US',{year:'numeric',month:'short'});
    }),
    incomes:  keys.map(k => map[k].income),
    expenses: keys.map(k => map[k].expense)
  };
}
