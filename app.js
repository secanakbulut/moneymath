// moneymath - financial calculators in the browser

// --- tabs ---
const tabs = document.querySelectorAll('.tab');
tabs.forEach(t => {
  t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('panel-' + t.dataset.tab).classList.add('active');
  });
});

// --- helpers ---
function fmt(n) {
  if (!isFinite(n)) return '-';
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

// =====================================================================
// 1) COMPOUND INTEREST
// =====================================================================
let ciChart = null;

function calcCompound() {
  const P = parseFloat(document.getElementById('ci-principal').value) || 0;
  const annual = (parseFloat(document.getElementById('ci-rate').value) || 0) / 100;
  const t = parseFloat(document.getElementById('ci-years').value) || 0;
  const pmt = parseFloat(document.getElementById('ci-pmt').value) || 0;

  const labels = [];
  const balances = [];
  const principals = [];

  const totalMonths = Math.max(1, Math.round(t * 12));
  let bal = P;
  const monthlyRate = annual / 12;
  labels.push(0);
  balances.push(bal);
  principals.push(P);

  let contributed = 0;
  for (let m = 1; m <= totalMonths; m++) {
    bal = bal * (1 + monthlyRate) + pmt;
    contributed += pmt;
    if (m % 12 === 0) {
      labels.push(m / 12);
      balances.push(bal);
      principals.push(P + contributed);
    }
  }

  document.getElementById('ci-result').textContent = 'future value: ' + fmt(bal);

  const ctx = document.getElementById('ci-chart').getContext('2d');
  if (ciChart) ciChart.destroy();
  ciChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.map(y => 'year ' + y),
      datasets: [
        {
          label: 'balance',
          data: balances,
          borderColor: '#1c1c1c',
          backgroundColor: 'rgba(28,28,28,0.08)',
          fill: true,
          tension: 0.15
        },
        {
          label: 'money put in',
          data: principals,
          borderColor: '#888',
          borderDash: [4, 4],
          fill: false,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y: { ticks: { callback: v => '$' + v.toLocaleString() } }
      }
    }
  });
}

document.getElementById('ci-go').addEventListener('click', calcCompound);

// =====================================================================
// 2) MORTGAGE
// =====================================================================
let mtChart = null;

function calcMortgage() {
  const P = parseFloat(document.getElementById('mt-loan').value) || 0;
  const annual = (parseFloat(document.getElementById('mt-rate').value) || 0) / 100;
  const years = parseFloat(document.getElementById('mt-years').value) || 0;

  const r = annual / 12;
  const n = Math.round(years * 12);

  // M = P * (r(1+r)^n) / ((1+r)^n - 1)
  let M;
  if (r === 0) {
    M = P / n;
  } else {
    const pow = Math.pow(1 + r, n);
    M = P * (r * pow) / (pow - 1);
  }

  const rows = [];
  let bal = P;
  let totalInterest = 0;
  const yrPrincipal = [];
  const yrInterest = [];
  let curYearP = 0, curYearI = 0;

  for (let i = 1; i <= n; i++) {
    const interest = bal * r;
    let principal = M - interest;
    if (i === n) principal = bal; // last row: clean up rounding drift
    bal -= principal;
    if (bal < 0) bal = 0;
    totalInterest += interest;

    curYearP += principal;
    curYearI += interest;
    if (i % 12 === 0 || i === n) {
      yrPrincipal.push(curYearP);
      yrInterest.push(curYearI);
      curYearP = 0;
      curYearI = 0;
    }

    rows.push({ i, payment: M, principal, interest, balance: bal });
  }

  document.getElementById('mt-result').innerHTML =
    'monthly payment: ' + fmt(M) +
    '<br><span style="font-size:14px;color:#666">total interest paid: ' + fmt(totalInterest) + '</span>';

  // table
  const tbody = document.querySelector('#mt-table tbody');
  tbody.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + row.i + '</td>' +
      '<td>' + fmt(row.payment) + '</td>' +
      '<td>' + fmt(row.principal) + '</td>' +
      '<td>' + fmt(row.interest) + '</td>' +
      '<td>' + fmt(row.balance) + '</td>';
    tbody.appendChild(tr);
  });

  // stacked bar by year
  const ctx = document.getElementById('mt-chart').getContext('2d');
  if (mtChart) mtChart.destroy();
  const yearLabels = yrPrincipal.map((_, i) => 'year ' + (i + 1));
  mtChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: yearLabels,
      datasets: [
        { label: 'principal', data: yrPrincipal, backgroundColor: '#1c1c1c' },
        { label: 'interest', data: yrInterest, backgroundColor: '#c0a060' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { stacked: true },
        y: { stacked: true, ticks: { callback: v => '$' + v.toLocaleString() } }
      }
    }
  });
}

document.getElementById('mt-go').addEventListener('click', calcMortgage);

// =====================================================================
// shared cash-flow row builder
// =====================================================================
function makeRow(container, t, val) {
  const row = document.createElement('div');
  row.className = 'cf-row';
  row.innerHTML =
    '<span class="t">t=' + t + '</span>' +
    '<input type="number" step="any" value="' + val + '">' +
    '<button type="button" class="rm" title="remove">&times;</button>';
  row.querySelector('.rm').addEventListener('click', () => {
    row.remove();
    renumber(container);
  });
  container.appendChild(row);
}

function renumber(container) {
  [...container.children].forEach((row, idx) => {
    row.querySelector('.t').textContent = 't=' + idx;
  });
}

function readFlows(container) {
  return [...container.children].map(row => parseFloat(row.querySelector('input').value) || 0);
}

// =====================================================================
// 3) NPV
// =====================================================================
const npvRows = document.getElementById('npv-rows');
[-10000, 3000, 4000, 5000, 4000].forEach((v, i) => makeRow(npvRows, i, v));

document.getElementById('npv-add').addEventListener('click', () => {
  makeRow(npvRows, npvRows.children.length, 0);
});

function npvOf(rate, flows) {
  let s = 0;
  for (let t = 0; t < flows.length; t++) {
    s += flows[t] / Math.pow(1 + rate, t);
  }
  return s;
}

function calcNPV() {
  const rate = (parseFloat(document.getElementById('npv-rate').value) || 0) / 100;
  const flows = readFlows(npvRows);
  const value = npvOf(rate, flows);

  document.getElementById('npv-result').textContent = 'npv: ' + fmt(value);

  const tbody = document.querySelector('#npv-table tbody');
  tbody.innerHTML = '';
  flows.forEach((cf, t) => {
    const df = 1 / Math.pow(1 + rate, t);
    const pv = cf * df;
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + t + '</td>' +
      '<td>' + fmt(cf) + '</td>' +
      '<td>' + df.toFixed(6) + '</td>' +
      '<td>' + fmt(pv) + '</td>';
    tbody.appendChild(tr);
  });
}

document.getElementById('npv-go').addEventListener('click', calcNPV);

// =====================================================================
// 4) IRR via Newton-Raphson
// =====================================================================
function fmtPct(n) {
  if (!isFinite(n)) return '-';
  return (n * 100).toFixed(4) + '%';
}

const irrRows = document.getElementById('irr-rows');
[-10000, 3000, 4200, 5100, 4800].forEach((v, i) => makeRow(irrRows, i, v));

document.getElementById('irr-add').addEventListener('click', () => {
  makeRow(irrRows, irrRows.children.length, 0);
});

function calcIRR() {
  const flows = readFlows(irrRows);
  const log = [];

  // f(r) = NPV(r), we want f(r) = 0
  // f'(r) is taken numerically with a small h
  const h = 1e-5;
  let x = 0.1; // starting guess
  log.push('start guess: 0.1');

  let converged = false;
  for (let k = 0; k < 100; k++) {
    const f = npvOf(x, flows);
    const fp = (npvOf(x + h, flows) - npvOf(x - h, flows)) / (2 * h);

    log.push(
      'iter ' + (k + 1).toString().padStart(3, ' ') +
      '  r=' + x.toFixed(8) +
      '  npv=' + f.toFixed(6) +
      "  npv'=" + fp.toFixed(4)
    );

    if (Math.abs(f) < 1e-7) { converged = true; break; }
    if (fp === 0) { log.push('derivative was zero, bailing'); break; }

    const next = x - f / fp;
    if (!isFinite(next) || next < -0.999) {
      log.push('iteration went out of bounds');
      break;
    }
    x = next;
  }

  document.getElementById('irr-log').textContent = log.join('\n');
  document.getElementById('irr-result').textContent =
    'irr: ' + (converged ? fmtPct(x) : '(did not converge)');
}

document.getElementById('irr-go').addEventListener('click', calcIRR);

// run defaults on load
calcCompound();
calcMortgage();
calcNPV();
calcIRR();
