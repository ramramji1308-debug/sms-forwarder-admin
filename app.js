'use strict';

/* GitHub Pages admin panel. No backend server required. */
const AUTH_HASH = 'c0d5f54f5c5e7b0878526953e346ca580af331519cf0d405f9ac1ed85de5896d';
const POLL_MS = 5000;

const CHANNELS_KEY = 'smsfwd_channels_v1';
const MESSAGES_KEY = 'smsfwd_messages_v1';
const AUTH_KEY = 'smsfwd_auth_v1';
const TOPIC_KEY_NAME = 'smsfwd_topic_v1';

const $ = (id) => document.getElementById(id);

let channels = load(CHANNELS_KEY, []);
let messages = load(MESSAGES_KEY, []);
let channelFilter = 'all';
let query = '';
let topicUrl = '';
let timer = null;

function load(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch (_) {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function timeAgo(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function readableTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-GB');
}

/* ------------------------------------------------------------------ auth */

async function tryLogin() {
  const user = $('username').value.trim();
  const pass = $('password').value;
  const digest = await sha256(`${user}:${pass}`);
  if (digest === AUTH_HASH) {
    const topicKey = await sha256(`topic:${pass}`);
    topicUrl = `https://ntfy.sh/smsfwd-${topicKey.slice(0, 24)}`;
    sessionStorage.setItem(AUTH_KEY, '1');
    sessionStorage.setItem(TOPIC_KEY_NAME, topicUrl);
    $('loginError').textContent = '';
    showApp();
  } else {
    $('loginError').textContent = 'Invalid username or password';
  }
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(TOPIC_KEY_NAME);
  topicUrl = '';
  clearInterval(timer);
  $('appView').classList.add('hidden');
  $('loginView').classList.remove('hidden');
  $('password').value = '';
}

function showApp() {
  $('loginView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  renderChannels();
  renderMessages();
  poll();
  if (timer) clearInterval(timer);
  timer = setInterval(poll, POLL_MS);
}

/* --------------------------------------------------------------- channels */

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `CH-${suffix}`;
}

function createChannel() {
  let code = makeCode();
  while (channels.some((c) => c.code === code)) code = makeCode();
  channels.unshift({
    code,
    name: $('channelName').value.trim() || `Channel ${channels.length + 1}`,
    active: true,
    createdAt: new Date().toISOString(),
    lastSeen: null,
  });
  $('channelName').value = '';
  save(CHANNELS_KEY, channels);
  renderChannels();
  renderMessages();
}

function renderChannels() {
  const list = $('channelList');
  list.replaceChildren();

  const select = $('channelFilter');
  const previous = channelFilter;
  select.replaceChildren();
  const all = el('option', '', 'All channels');
  all.value = 'all';
  select.appendChild(all);
  channels.forEach((c) => {
    const option = el('option', '', c.name ? `${c.code} - ${c.name}` : c.code);
    option.value = c.code;
    select.appendChild(option);
  });
  if (channels.some((c) => c.code === previous)) select.value = previous;
  else {
    select.value = 'all';
    channelFilter = 'all';
  }

  if (channels.length === 0) {
    list.appendChild(el('div', 'empty', 'No channels yet. Create one, then enter its code in the app.'));
    return;
  }

  channels.forEach((c) => {
    const row = el('div', `channel-row${c.active === false ? ' disabled' : ''}`);
    row.appendChild(el('span', 'channel-code', c.code));
    row.appendChild(el('span', 'channel-name', c.name || 'Unnamed channel'));
    row.appendChild(
      el('span', 'channel-name', c.lastSeen ? `Last seen: ${timeAgo(c.lastSeen)}` : 'Never connected')
    );
    row.appendChild(el('span', 'spacer'));

    const copy = el('button', 'ghost small', 'Copy');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(c.code);
      } catch (_) {
        window.prompt('Copy this channel code:', c.code);
      }
    });

    const toggle = el('button', 'ghost small', c.active === false ? 'Enable' : 'Disable');
    toggle.addEventListener('click', () => {
      c.active = c.active === false;
      save(CHANNELS_KEY, channels);
      renderChannels();
      renderMessages();
    });

    const remove = el('button', 'danger small', 'Delete');
    remove.addEventListener('click', () => {
      if (!confirm(`Delete channel ${c.code}? Messages will be kept.`)) return;
      channels = channels.filter((x) => x.code !== c.code);
      if (channelFilter === c.code) channelFilter = 'all';
      save(CHANNELS_KEY, channels);
      renderChannels();
      renderMessages();
    });

    row.append(copy, toggle, remove);
    list.appendChild(row);
  });
}

/* ---------------------------------------------------------------- messages */

async function poll() {
  try {
    const response = await fetch(`${topicUrl}/json?poll=1&_=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // ntfy returns newline-delimited JSON (one object per line), not a JSON array.
    const text = await response.text();
    const items = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (_) {
          return null;
        }
      })
      .filter((item) => item && item.id);
    const known = new Set(messages.map((m) => m.id));
    let added = 0;

    items.forEach((item) => {
      if (known.has(item.id)) return;
      let data = {};
      try {
        data = JSON.parse(item.message);
      } catch (_) {
        data = { body: item.message };
      }
      messages.unshift({
        id: item.id,
        channel: String(data.channel || '').toUpperCase(),
        sender: data.sender || 'Unknown',
        body: data.body || data.message || item.message,
        device: data.device || '',
        sim: data.sim || null,
        timestamp: data.timestamp || item.time * 1000,
        receivedAt: new Date(item.time * 1000).toISOString(),
        read: false,
      });
      added += 1;
    });

    if (added) {
      messages.sort((a, b) => b.timestamp - a.timestamp);
      save(MESSAGES_KEY, messages);
      renderMessages();
      channels.forEach((c) => {
        if (messages.some((m) => m.channel === c.code)) c.lastSeen = new Date().toISOString();
      });
      save(CHANNELS_KEY, channels);
      renderChannels();
    }

    $('status').textContent = 'online';
    $('status').className = 'ok';
    $('statusDetail').textContent =
      `${messages.length} message${messages.length === 1 ? '' : 's'} stored`;
  } catch (error) {
    $('status').textContent = 'Connecting..';
    $('status').className = 'err';
    $('statusDetail').textContent = `Last error: ${error.message || 'network'}`;
  }
}

function visibleMessages() {
  return messages.filter((m) => {
    if (channelFilter !== 'all' && m.channel !== channelFilter) return false;
    if (!query) return true;
    const haystack = `${m.sender} ${m.body} ${m.device} ${m.channel}`.toLowerCase();
    return haystack.includes(query);
  });
}

function renderMessages() {
  const container = $('messages');
  container.replaceChildren();

  const unread = messages.filter((m) => !m.read).length;
  $('stats').textContent =
    `${messages.length} total · ${unread} unread · ${channels.length} channels`;

  const visible = visibleMessages();
  if (visible.length === 0) {
    container.appendChild(
      el('div', 'empty', messages.length ? 'No messages match this filter.' : 'No messages yet. Tap Test in the app.')
    );
    return;
  }

  visible.forEach((m) => {
    const card = el('div', `msg${m.read ? '' : ' unread'}`);
    const head = el('div', 'msg-head');
    head.appendChild(el('span', 'msg-from', m.sender));
    head.appendChild(el('span', 'msg-time', readableTime(m.timestamp)));
    card.appendChild(head);
    card.appendChild(el('div', 'msg-body', m.body));

    const foot = el('div', 'msg-foot');
    if (m.channel) foot.appendChild(el('span', 'tag channel', `# ${m.channel}`));
    if (m.device) foot.appendChild(el('span', 'tag', `📲 ${m.device}`));
    if (!m.read) foot.appendChild(el('span', 'tag', 'Unread'));
    card.appendChild(foot);

    card.addEventListener('click', () => {
      m.read = true;
      save(MESSAGES_KEY, messages);
      renderMessages();
    });
    container.appendChild(card);
  });
}

/* ----------------------------------------------------------------- events */

$('loginBtn').addEventListener('click', tryLogin);
$('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryLogin();
});
$('username').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('password').focus();
});
$('logoutBtn').addEventListener('click', logout);
$('reloadBtn').addEventListener('click', () => window.location.reload(true));
$('createChannelBtn').addEventListener('click', createChannel);
$('channelName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') createChannel();
});
$('channelFilter').addEventListener('change', (e) => {
  channelFilter = e.target.value;
  renderMessages();
});
$('search').addEventListener('input', (e) => {
  query = e.target.value.trim().toLowerCase();
  renderMessages();
});
$('refreshBtn').addEventListener('click', poll);
$('clearBtn').addEventListener('click', () => {
  if (!confirm('Delete all messages saved in this browser?')) return;
  messages = [];
  save(MESSAGES_KEY, messages);
  renderMessages();
});

if (sessionStorage.getItem(AUTH_KEY) === '1' && sessionStorage.getItem(TOPIC_KEY_NAME)) {
  topicUrl = sessionStorage.getItem(TOPIC_KEY_NAME);
  showApp();
}
