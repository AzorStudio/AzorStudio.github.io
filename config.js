// Backend API URL. Automatically uses localhost for local testing, and Railway for production.
window.OBSIDIAN_API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://website-production-d9c9.up.railway.app';

// Instantly apply cached website theme for zero flicker
const activeTheme = localStorage.getItem('azor_theme');
if (activeTheme === 'summer') {
  document.documentElement.classList.add('theme-summer');
} else if (activeTheme === 'default') {
  document.documentElement.classList.remove('theme-summer');
}

// Seamlessly sync global active theme with backend database only if not locally overridden
try {
  fetch(window.OBSIDIAN_API_URL + '/api/theme')
    .then(res => res.json())
    .then(data => {
      if (data && data.theme && data.theme !== 'default' && !localStorage.getItem('azor_theme_override')) {
        localStorage.setItem('azor_theme', data.theme);
        if (data.theme === 'summer') {
          document.documentElement.classList.add('theme-summer');
        } else {
          document.documentElement.classList.remove('theme-summer');
        }
      }
    })
    .catch(() => {});
} catch (e) {}
