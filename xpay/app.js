const SECTIONS = {
  users: { cols: ['id', 'phone', 'balance', 'status'] },
  deposits: { cols: ['id', 'userId', 'amount', 'status', 'createdAt'] },
  withdrawals: { cols: ['id', 'userId', 'amount', 'status', 'createdAt'] },
  bets: { cols: ['id', 'userId', 'game', 'amount', 'result'] },
  games: { cols: ['id', 'name', 'enabled', 'config'] },
  settings: { cols: ['key', 'value'] },
};

const SEED = {
  users: [
    { id: 1, phone: '+919900000001', balance: 1250, status: 'active' },
    { id: 2, phone: '+919900000002', balance: 380, status: 'active' },
    { id: 3, phone: '+919900000003', balance: 0, status: 'blocked' },
  ],
  deposits: [
    { id: 1, userId: 1, amount: 500, status: 'approved', createdAt: '2026-11-27 10:12' },
    { id: 2, userId: 2, amount: 200, status: 'pending', createdAt: '2026-11-27 11:40' },
  ],
  withdrawals: [
    { id: 1, userId: 1, amount: 300, status: 'paid', createdAt: '2026-11-26 18:05' },
  ],
  bets: [
    { id: 1, userId: 1, game: 'Lucky Wheel', amount: 100, result: 'win' },
    { id: 2, userId: 2, game: 'Crash', amount: 50, result: 'loss' },
  ],
  games: [
    { id: 1, name: 'Lucky Wheel', enabled: 'yes', config: 'default' },
    { id: 2, name: 'Plinko', enabled: 'yes', config: 'default' },
    { id: 3, name: 'Roulette', enabled: 'no', config: 'default' },
  ],
  settings: [
    { key: 'appName', value: 'XPay' },
    { key: 'minDeposit', value: '100' },
    { key: 'support', value: 'admin' },
  ],
};

const AUTH_USER = 'admin';
const AUTH_HASH = '07996431636d427da4dcec62a8ad530932b776f0ae37a3287cdf308bfb669c06'; // XPayAdmin@2026
const DEMO_KEY = 'xpay-demo-data';

const $ = (id) => document.getElementById(id);
let cfg = JSON.parse(localStorage.getItem('xpay-admin') || '{}');
let section = 'users';

$('user').value = cfg.user || '';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function showApp() { $('login').classList.add('hidden'); $('app').classList.remove('hidden'); }

$('loginBtn').onclick = () => {
  $('loginError').textContent = '';
  const user = $('user').value.trim().toLowerCase();
  const pass = $('pass').value.trim();
  if (user !== AUTH_USER || pass !== AUTH_PASS) {
    $('loginError').textContent = 'Invalid username or password.';
    return;
  }
  cfg = { user: AUTH_USER };
  localStorage.setItem('xpay-admin', JSON.stringify(cfg));
  showApp();
  load();
};

$('logout').onclick = () => { localStorage.removeItem('xpay-admin'); location.reload(); };
$('refresh').onclick = load;
$('addRow').onclick = addRow;

document.querySelectorAll('nav button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('nav button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    section = b.dataset.section;
    $('sectionTitle').textContent = section[0].toUpperCase() + section.slice(1);
    load();
  };
});

function demoData() {
  let data = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null');
  if (!data) {
    data = JSON.parse(JSON.stringify(SEED));
    localStorage.setItem(DEMO_KEY, JSON.stringify(data));
  }
  return data;
}
function saveDemo(data) { localStorage.setItem(DEMO_KEY, JSON.stringify(data)); }

function render(rows) {
  const head = SECTIONS[section].cols.concat('Actions');
  $('thead').innerHTML = '<tr>' + head.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr>';
  $('tbody').innerHTML = rows.map((r, i) =>
    '<tr>' + SECTIONS[section].cols.map((c) => '<td>' + esc(r[c]) + '</td>').join('') +
    '<td><button class="danger" data-index="' + i + '">Delete</button></td></tr>'
  ).join('') || '<tr><td colspan="' + head.length + '">No records yet.</td></tr>';
  $('sectionInfo').textContent = rows.length + ' record(s) — stored only in this browser.';
  $('conn').textContent = 'Demo';
}

function load() {
  const rows = demoData()[section] || [];
  render(rows);
}

function addRow() {
  const row = {};
  for (const col of SECTIONS[section].cols) {
    const value = prompt(col);
    if (value === null) return;
    row[col] = value;
  }
  const data = demoData();
  (data[section] ||= []).push(row);
  saveDemo(data);
  load();
}

$('tbody').addEventListener('click', (e) => {
  if (!e.target.classList.contains('danger')) return;
  const index = Number(e.target.dataset.index);
  const data = demoData();
  const rows = data[section] || [];
  const record = rows[index];
  if (!record) return;
  if (!confirm('Delete record ' + (record.id ?? record.key) + '?')) return;
  rows.splice(index, 1);
  saveDemo(data);
  load();
});
