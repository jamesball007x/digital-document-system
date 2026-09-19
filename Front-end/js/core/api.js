// ============================
// core/api.js — API Helper & Toast
// ============================

export const BASE_URL = 'http://localhost:3000';

/**
 * Fetch wrapper — แนบ credentials และแปลง body เป็น JSON อัตโนมัติ
 * @param {string} url - relative path หรือ full URL
 * @param {object} options - fetch options
 */
export async function api(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : BASE_URL + url;
  const res = await fetch(fullUrl, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return res.json();
}

/**
 * แสดง toast notification
 * @param {string} msg - ข้อความ
 * @param {'info'|'success'|'error'} type - ประเภท
 */
export function toast(msg, type = 'info') {
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${icons[type]} toast-icon"></i><span class="toast-text">${msg}</span>`;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastOut 0.3s forwards';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}
