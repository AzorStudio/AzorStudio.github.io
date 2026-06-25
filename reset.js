const API_BASE = (window.OBSIDIAN_API_URL || '').replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE}${path}`;
const token = new URLSearchParams(location.search).get('token');
const form = document.getElementById('resetForm');
const statusEl = document.getElementById('resetStatus');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusEl.textContent = 'Resetting...';
  const newPassword = new FormData(form).get('newPassword');
  try {
    const res = await fetch(apiUrl('/api/auth/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Reset failed');
    statusEl.textContent = 'Password reset. You can now log in.';
    setTimeout(() => location.href = 'index.html', 1500);
  } catch (error) {
    statusEl.textContent = error.message;
    statusEl.style.color = '#ff9b9b';
  }
});
