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

// --- compound interest ---
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

  const fv = bal;
  document.getElementById('ci-result').textContent = 'future value: ' + fmt(fv);

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

// run once on load so the chart is not empty
calcCompound();
