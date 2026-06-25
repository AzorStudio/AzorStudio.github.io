const API_BASE = (window.OBSIDIAN_API_URL || '').replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE}${path}`;
let cachedProducts = [];

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(apiUrl(path), { credentials: 'include', ...options });
  } catch (error) {
    throw new Error('Backend is not reachable. Check config.js and Railway backend URL.');
  }
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    if (!contentType.includes('application/json')) throw new Error('API route not found. Deploy the Node backend, not a static-only site.');
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function table(headers, rows) {
  if (!rows.length) return '<p class="empty-table">Nothing here yet.</p>';
  return `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

async function loadAdmin() {
  try {
    const me = await api('/api/me');
    if (!me.user || me.user.role !== 'admin') return location.href = 'index.html';
    const [{ users }, { downloads }, { activity }, { products }] = await Promise.all([
      api('/api/admin/users'),
      api('/api/admin/downloads'),
      api('/api/admin/activity'),
      api('/api/admin/products')
    ]);

    document.getElementById('statUsers').textContent = users.length;
    document.getElementById('statDownloads').textContent = downloads.length;
    document.getElementById('statActivity').textContent = activity.length;

    cachedProducts = products;
    document.getElementById('productsTable').innerHTML = table(
      ['Name', 'Type', 'Version', 'File', 'Size', 'Uploaded By', 'Date', 'Actions'],
      products.map(p => [
        escapeHtml(p.title),
        escapeHtml(p.category),
        escapeHtml(p.version),
        escapeHtml(p.original_file_name),
        `${Math.round((p.file_size || 0) / 1024)} KB`,
        escapeHtml(p.uploader || '-'),
        p.created_at,
        `<div class="row-actions"><button onclick="editProduct(${p.id})">Edit</button><button class="danger" onclick="deleteProduct(${p.id})">Delete</button></div>`
      ])
    );

    document.getElementById('usersTable').innerHTML = table(
      ['Avatar', 'Username', 'Email', 'Role', 'Created', 'Last Login'],
      users.map(u => [`<img class="avatar-small" src="${u.avatarUrl}" onerror="this.src='assets/pack.png'">`, escapeHtml(u.username), escapeHtml(u.email), escapeHtml(u.role), u.createdAt, u.lastLoginAt || '-'])
    );

    document.getElementById('downloadsTable').innerHTML = table(
      ['User', 'Item', 'Type', 'Date'],
      downloads.map(d => [escapeHtml(d.username || 'Guest'), escapeHtml(d.item), escapeHtml(d.type), d.created_at])
    );

    document.getElementById('activityTable').innerHTML = table(
      ['User', 'Action', 'Details', 'Date', 'IP'],
      activity.map(a => [escapeHtml(a.username || 'Guest'), escapeHtml(a.action), escapeHtml(a.details), a.created_at, escapeHtml(a.ip)])
    );
  } catch (error) {
    document.body.innerHTML = `<main class="section"><h1>Admin only</h1><p>${escapeHtml(error.message)}</p><a class="btn btn-primary" href="index.html">Back</a></main>`;
  }
}


async function deleteProduct(id) {
  const product = cachedProducts.find((item) => item.id === id);
  if (!product) return alert('Product not found in table.');
  if (!confirm(`Delete "${product.title}"? This also removes the uploaded file if it still exists on the backend.`)) return;

  try {
    await api(`/api/admin/products/${id}`, { method: 'DELETE' });
    await loadAdmin();
  } catch (error) {
    alert(error.message);
  }
}

async function editProduct(id) {
  const product = cachedProducts.find((item) => item.id === id);
  if (!product) return alert('Product not found in table.');

  const title = prompt('Project name:', product.title);
  if (title === null) return;

  const category = prompt('Category: plugins, setups, configs, skript, mods, resourcepacks', product.category);
  if (category === null) return;

  const version = prompt('Version:', product.version);
  if (version === null) return;

  const shortDescription = prompt('Summary:', product.short_description || '');
  if (shortDescription === null) return;

  const description = prompt('Description:', product.description || '');
  if (description === null) return;

  try {
    await api(`/api/admin/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, category, version, shortDescription, description })
    });
    await loadAdmin();
  } catch (error) {
    alert(error.message);
  }
}

document.getElementById('projectTitle')?.addEventListener('input', (event) => {
  const slug = event.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  document.getElementById('slugPreview').value = `https://azorstudios/project/${slug}`;
});

document.querySelectorAll('.visibility-pills button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.visibility-pills button').forEach(b => b.classList.remove('selected'));
    button.classList.add('selected');
  });
});

document.getElementById('uploadForm')?.addEventListener('submit', async event => {
  event.preventDefault();

  // Store the form before awaiting. event.currentTarget can become null after async work.
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const status = document.getElementById('uploadStatus');

  status.textContent = 'Uploading...';
  status.style.color = 'var(--mint)';
  if (submitButton) submitButton.disabled = true;

  try {
    const res = await fetch(apiUrl('/api/admin/products'), {
      method: 'POST',
      credentials: 'include',
      body: new FormData(form)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    status.textContent = 'Project uploaded successfully.';
    if (form && typeof form.reset === 'function') form.reset();

    const slugPreview = document.getElementById('slugPreview');
    if (slugPreview) slugPreview.value = 'https://azorstudios/project/';

    await loadAdmin();
  } catch (err) {
    status.textContent = err.message;
    status.style.color = '#ff9b9b';
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  location.href = 'index.html';
});

loadAdmin();
