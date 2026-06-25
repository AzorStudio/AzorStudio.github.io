const API_BASE = (window.OBSIDIAN_API_URL || '').replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE}${path}`;
const $ = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(apiUrl(path), {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
  } catch (error) {
    throw new Error('Backend is not reachable. Check config.js and Railway.');
  }

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function setStatus(form, message, bad = false) {
  const status = form.querySelector('.modal-status');
  if (!status) return;
  status.textContent = message;
  status.style.color = bad ? '#ff9b9b' : 'var(--soft)';
}

function closeModals() {
  document.querySelectorAll('.modal').forEach((modal) => modal.classList.remove('open'));
}

function closeAccountMenu() {
  $('#accountMenu')?.classList.add('hidden');
}

async function refreshAccount() {
  const login = $('#loginButton');
  const signup = $('#signupButton');
  const badge = $('#accountBadge');
  const admin = $('#adminLink');
  const menu = $('#accountMenu');

  try {
    const { user } = await api('/api/auth/me');

    if (!user) {
      login?.classList.remove('hidden');
      signup?.classList.remove('hidden');
      badge?.classList.add('hidden');
      admin?.classList.add('hidden');
      menu?.classList.add('hidden');
      return;
    }

    login?.classList.add('hidden');
    signup?.classList.add('hidden');
    badge?.classList.remove('hidden');
    admin?.classList.toggle('hidden', user.role !== 'admin');

    badge.innerHTML = `<img src="${user.avatarUrl}" onerror="this.src='assets/pack.png'" alt=""><span>${user.username}</span><b>⌄</b>`;
  } catch (error) {
    // Not logged in or backend unavailable. Keep page usable.
  }
}

$('#mobileToggle')?.addEventListener('click', () => $('#mobileNav')?.classList.toggle('open'));

$('#accountBadge')?.addEventListener('click', (event) => {
  event.stopPropagation();
  $('#accountMenu')?.classList.toggle('hidden');
});

document.addEventListener('click', closeAccountMenu);

$('#accountPasswordButton')?.addEventListener('click', (event) => {
  event.stopPropagation();
  closeAccountMenu();
  $('#changePasswordModal')?.classList.add('open');
});

$('#accountLogoutButton')?.addEventListener('click', async (event) => {
  event.stopPropagation();
  await api('/api/auth/logout', { method: 'POST' });
  closeAccountMenu();
  refreshAccount();
});

document.querySelectorAll('[data-modal]').forEach((button) => {
  button.addEventListener('click', () => document.getElementById(button.dataset.modal)?.classList.add('open'));
});

document.querySelectorAll('.modal,.close-modal').forEach((element) => {
  element.addEventListener('click', (event) => {
    if (event.target === element || element.classList.contains('close-modal')) closeModals();
  });
});

$('#loginForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    closeModals();
    refreshAccount();
  } catch (error) {
    setStatus(form, error.message, true);
  }
});

$('#signupForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api('/api/auth/signup', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    closeModals();
    refreshAccount();
  } catch (error) {
    setStatus(form, error.message, true);
  }
});

$('#forgotPasswordForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const data = await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    setStatus(form, data.message || 'If the account exists, a reset email was sent.');
  } catch (error) {
    setStatus(form, error.message, true);
  }
});

$('#changePasswordForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    setStatus(form, 'Password changed.');
  } catch (error) {
    setStatus(form, error.message, true);
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
refreshAccount();


const topbar = document.querySelector('.topbar');
const updateNavbar = () => {
  if (topbar) topbar.classList.toggle('nav-scrolled', window.scrollY > 20);
};
updateNavbar();
window.addEventListener('scroll', updateNavbar, { passive: true });

document.querySelectorAll('.discover-trigger').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.closest('.discover-menu')?.classList.toggle('open');
  });
});

document.addEventListener('click', () => {
  document.querySelectorAll('.discover-menu.open').forEach((menu) => menu.classList.remove('open'));
});
