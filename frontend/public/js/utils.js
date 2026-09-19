// Utility functions module

export function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> <span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toastOut 0.3s forwards';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

export function timeAgo(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'เมื่อครู่';
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ที่แล้ว`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
  return d.toLocaleDateString('th-TH');
}

export function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const statusMap = {
  draft: 'draft',
  pending_approval: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  signed: 'signed',
  expired: 'expired'
};

export const priorityIcons = {
  high: 'fa-arrow-up',
  medium: 'fa-minus',
  low: 'fa-arrow-down'
};
