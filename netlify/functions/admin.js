// Netlify Function: Admin dashboard
// Password-protected viewer for logged KCU chatbot conversations.
// Access: https://YOUR-SITE.netlify.app/.netlify/functions/admin?p=YOUR_PASSWORD
// Password is read from the ADMIN_PASSWORD environment variable in Netlify.
// Uses modern Netlify Functions API so @netlify/blobs auto-configures.

import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return htmlResponse(
      `<h1>Admin not configured</h1>
       <p>The ADMIN_PASSWORD environment variable hasn't been set in Netlify yet.</p>`
    );
  }

  const url = new URL(req.url);
  const password = url.searchParams.get('p') || '';

  // No password or wrong password → show login form
  if (password !== adminPassword) {
    const showError = password.length > 0;
    return htmlResponse(loginPage(showError));
  }

  // Load all conversations
  let conversations = [];
  try {
    const store = getStore('conversations');
    const { blobs } = await store.list();

    const loaded = await Promise.all(
      blobs.map(b => store.get(b.key, { type: 'json' }).catch(() => null))
    );
    conversations = loaded.filter(Boolean);
  } catch (err) {
    console.error('Failed to load conversations:', err);
    return htmlResponse(
      `<h1>Error loading conversations</h1>
       <p>${escapeHtml(err.message)}</p>`
    );
  }

  // Sort most-recent first
  conversations.sort((a, b) =>
    new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );

  return htmlResponse(dashboardPage(conversations, password));
};

// === HTML helpers ===

function htmlResponse(body) {
  return new Response(pageWrapper(body), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

function pageWrapper(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KCU Assistant — Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --forest-green: #2e6139;
    --light-green: #488e34;
    --leaf-green: #97a843;
    --burnt-orange: #d9782d;
    --charcoal: #333333;
    --pale-sage: #e8ecd6;
    --off-white: #f9f9f4;
    --fog-grey: #b0bec5;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Montserrat', sans-serif;
    background: var(--off-white);
    color: var(--charcoal);
    padding: 2rem 1.25rem;
    max-width: 960px;
    margin: 0 auto;
    line-height: 1.5;
  }
  header { margin-bottom: 2rem; }
  h1 {
    color: var(--forest-green);
    font-size: 1.6rem;
    margin-bottom: 0.25rem;
  }
  .subtitle {
    font-size: 0.85rem;
    color: #666;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.85rem;
    margin: 1.5rem 0 2rem;
  }
  .stat {
    background: white;
    padding: 1rem 1.25rem;
    border-radius: 10px;
    border-left: 4px solid var(--forest-green);
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .stat-value {
    font-size: 1.65rem;
    font-weight: 700;
    color: var(--forest-green);
    line-height: 1.1;
  }
  .stat-label {
    font-size: 0.78rem;
    color: #666;
    margin-top: 0.3rem;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .convo {
    background: white;
    border-radius: 10px;
    margin-bottom: 0.85rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    overflow: hidden;
  }
  .convo summary {
    padding: 0.95rem 1.1rem;
    cursor: pointer;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    font-size: 0.92rem;
  }
  .convo summary::-webkit-details-marker { display: none; }
  .convo summary::after {
    content: '▼';
    font-size: 0.65rem;
    color: var(--fog-grey);
    transition: transform 0.15s;
  }
  .convo[open] summary::after { transform: rotate(180deg); }
  .convo summary:hover { background: #fafafa; }
  .convo-meta { font-weight: 500; }
  .convo-meta small { color: #666; font-weight: 400; margin-left: 0.5rem; }
  .convo-count {
    background: var(--pale-sage);
    color: var(--forest-green);
    padding: 0.15rem 0.55rem;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .messages {
    border-top: 1px solid #f0f0eb;
    padding: 0.5rem 1.1rem 1rem;
  }
  .msg {
    margin-top: 0.85rem;
    padding: 0.65rem 0.9rem;
    border-radius: 10px;
    font-size: 0.88rem;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .msg.user {
    background: var(--forest-green);
    color: white;
    margin-left: 15%;
  }
  .msg.assistant {
    background: #f5f5ed;
    color: var(--charcoal);
    margin-right: 15%;
  }
  .msg-time {
    font-size: 0.7rem;
    color: #888;
    margin-top: 0.3rem;
  }
  .msg.user .msg-time { color: rgba(255,255,255,0.7); }
  .empty {
    text-align: center;
    padding: 3rem 1rem;
    color: #888;
  }
  form.login {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    max-width: 380px;
    margin: 3rem auto;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  form.login label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    margin-bottom: 0.4rem;
  }
  form.login input[type=password] {
    width: 100%;
    padding: 0.7rem 0.9rem;
    border: 1.5px solid #e0e2d8;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.95rem;
    margin-bottom: 1rem;
  }
  form.login input:focus { outline: none; border-color: var(--forest-green); }
  form.login button {
    width: 100%;
    background: var(--forest-green);
    color: white;
    border: none;
    padding: 0.8rem;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }
  form.login button:hover { background: var(--light-green); }
  .error { color: #c0392b; font-size: 0.85rem; margin-bottom: 1rem; }
</style>
</head>
<body>
${content}
</body>
</html>`;
}

function loginPage(showError) {
  return `
<form class="login" method="GET" action="/.netlify/functions/admin">
  <h1>KCU Assistant — Admin</h1>
  <p class="subtitle" style="margin-bottom:1.25rem;">Enter the admin password to view conversations.</p>
  ${showError ? '<p class="error">Incorrect password — try again.</p>' : ''}
  <label for="p">Password</label>
  <input type="password" id="p" name="p" required autofocus>
  <button type="submit">View conversations</button>
</form>`;
}

function dashboardPage(conversations, password) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const totalSessions = conversations.length;
  const totalUserMessages = conversations.reduce(
    (sum, c) => sum + (c.messages?.filter(m => m.role === 'user').length || 0),
    0
  );
  const sessionsToday = conversations.filter(
    c => (c.lastActivity || '').slice(0, 10) === today
  ).length;
  const sessionsThisWeek = conversations.filter(
    c => new Date(c.lastActivity) >= sevenDaysAgo
  ).length;

  if (totalSessions === 0) {
    return `
<header>
  <h1>KCU Assistant — Admin</h1>
  <p class="subtitle">No conversations logged yet.</p>
</header>
<div class="empty">
  <p>Conversations will appear here once people start using the chatbot.</p>
</div>`;
  }

  const convoHtml = conversations.map(c => {
    const userQuestions = (c.messages || []).filter(m => m.role === 'user').length;
    const date = new Date(c.lastActivity);
    const dateLabel = date.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const shortId = (c.sessionId || '').slice(0, 8);

    const messagesHtml = (c.messages || []).map(m => {
      const t = new Date(m.timestamp).toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit'
      });
      return `<div class="msg ${escapeHtml(m.role)}">${escapeHtml(m.content)}<div class="msg-time">${t}</div></div>`;
    }).join('');

    return `
<details class="convo">
  <summary>
    <div>
      <span class="convo-meta">${dateLabel}<small>session ${escapeHtml(shortId)}</small></span>
    </div>
    <span class="convo-count">${userQuestions} ${userQuestions === 1 ? 'question' : 'questions'}</span>
  </summary>
  <div class="messages">${messagesHtml}</div>
</details>`;
  }).join('');

  return `
<header>
  <h1>KCU Assistant — Admin</h1>
  <p class="subtitle">Conversation log. Most recent at the top — click any row to expand.</p>
</header>

<div class="stats">
  <div class="stat">
    <div class="stat-value">${totalSessions}</div>
    <div class="stat-label">Total sessions</div>
  </div>
  <div class="stat">
    <div class="stat-value">${totalUserMessages}</div>
    <div class="stat-label">User questions</div>
  </div>
  <div class="stat">
    <div class="stat-value">${sessionsToday}</div>
    <div class="stat-label">Sessions today</div>
  </div>
  <div class="stat">
    <div class="stat-value">${sessionsThisWeek}</div>
    <div class="stat-label">Last 7 days</div>
  </div>
</div>

${convoHtml}`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
