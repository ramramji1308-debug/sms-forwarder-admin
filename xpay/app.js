const SECTIONS = {
  users: { path: '/users', cols: ['id', 'phone', 'balance', 'status'] },
  deposits: { path: '/deposits', cols: ['id', 'userId', 'amount', 'status', 'createdAt'] },
  withdrawals: { path: '/withdrawals', cols: ['id', 'userId', 'amount', 'status', 'createdAt'] },
  bets: { path: '/bets', cols: ['id', 'userId', 'game', 'amount', 'result'] },
  games: { path: '/games', cols: ['id', 'name', 'enabled', 'config'] },
  settings: { path: '/settings', cols: ['key', 'value'] },
};

const $ = (id) => document.getElementById(id);
let cfg = JSON.parse(localStorage.getItem('xpay-admin') || '{}');
let section = 'users';

$('apiBase').value = cfg.apiBase || '';
$('token').value = cfg.token || '';
$('user').value = cfg.user || '';

function save() {
  cfg = { apiBase: $('apiBase').value.trim(), token: $('token').value.trim(), user: $('user').value.trim() };
  localStorage.setItem('xpay-admin', JSON.stringify(cfg));
}
function showApp() { $('login').classList.add('hidden'); $('app').classList.remove('hidden'); }

$('loginBtn').onclick = () => {
  save();
  if (!cfg.apiBase || !cfg.pass) { $('loginError').textContent = 'Enter the API URL and password.'; return; }
  cfg.pass = $('pass').value;
  showApp();
  load();
};

$('logout').onclick = () => { localStorage.removeItem('xpay-admin'); location.reload(); };
$('refresh').onclick = load;

document.querySelectorAll('nav button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('nav button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    section = b.dataset.section;
    $('sectionTitle').textContent = section[0].toUpperCase() + section.slice(1);
    load();
  };
});

async function api(path, options = {}) {
  const res = await fetch(cfg.apiBase.replace(/\/$/, '') + path, {
    ...options,
    headers: { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function load() {
  const def = SECTIONS[section];
  $('thead').innerHTML = '<tr>' + def.cols.map((c) => '<th>' + c + '</th>').join('') + '</tr>';
  $('tbody').innerHTML = '';
  $('conn').textContent = 'Connecting..';
  $('sectionInfo').textContent = 'Loading ' + def.path + '…';
  try {
    const data = await api(def.path);
    const rows = Array.isArray(data) ? data : (data.data || data.list || []);
    $('tbody').innerHTML = rows.map((r) => '<tr>' + def.cols.map((c) => '<td>' + (r[c] ?? '') + '</td>').join('') + '</tr>').join('')
      || '<tr><td colspan="' + def.cols.length + '">No data returned by your API.</td></tr>';
    $('sectionInfo').textContent = rows.length + ' record(s) from ' + def.path;
    $('conn').textContent = 'online';
  } catch (e) {
    $('conn').textContent = 'Offline';
    $('sectionInfo').textContent = 'Last error: ' + e.message + ' — configure your backend at ' + def.path;
  }
}

// Do not auto-login: the backend password must be entered each time.
