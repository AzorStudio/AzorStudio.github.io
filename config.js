// Backend API URL. Automatically uses localhost for local testing, and Railway for production.
window.OBSIDIAN_API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://website-production-d9c9.up.railway.app';
