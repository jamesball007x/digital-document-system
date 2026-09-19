// ============================
// core/auth.js — Login / Register / Forgot Password
// ============================

import { api, toast } from './api.js';

/**
 * ผูก event handlers สำหรับ login page ทั้งหมด
 * @param {object} App - App object หลัก (ใช้ App.user และ App.showApp())
 */
export function bindLogin(App) {
  // ─── Login Form ───
  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const userEl = document.getElementById('username');
    const passEl = document.getElementById('password');
    const errEl  = document.getElementById('loginError');
    errEl.style.display = 'none';

    // Clear previous inline errors
    document.querySelectorAll('.invalid-feedback').forEach(el => el.remove());
    document.querySelectorAll('.form-group').forEach(el => el.classList.remove('has-error'));

    const showFieldError = (inputEl, message) => {
      inputEl.classList.add('is-invalid');
      const fg = inputEl.closest('.form-group') || inputEl.parentElement;
      if (fg) fg.classList.add('has-error');
      const feedback = document.createElement('div');
      feedback.className = 'invalid-feedback';
      feedback.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>${message}</span>`;
      if (inputEl.parentElement.classList.contains('password-wrapper')) {
        inputEl.parentElement.after(feedback);
      } else {
        inputEl.after(feedback);
      }
    };

    let hasError = false;
    if (!userEl.value.trim()) { showFieldError(userEl, 'กรุณากรอกชื่อผู้ใช้'); hasError = true; }
    if (!passEl.value)        { showFieldError(passEl, 'กรุณากรอกรหัสผ่าน');  hasError = true; }
    if (hasError) return;

    const data = await api('/api/auth/login', {
      method: 'POST',
      body: { username: userEl.value, password: passEl.value }
    });
    if (data.error) {
      showFieldError(userEl, data.error);
      showFieldError(passEl, '');
      return;
    }
    App.user = data.user;
    App.showApp();
  };

  // Auto clear invalid highlight on input
  document.addEventListener('input', (e) => {
    if (e.target.matches('input, select, textarea')) {
      e.target.classList.remove('is-invalid');
      const fg = e.target.closest('.form-group');
      if (fg) {
        fg.classList.remove('has-error');
        const fb = fg.querySelector('.invalid-feedback');
        if (fb) fb.remove();
      }
    }
  });

  // Demo buttons
  document.querySelectorAll('.demo-btn').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('username').value = btn.dataset.user;
      document.getElementById('password').value = btn.dataset.pass;
      document.getElementById('username').classList.remove('is-invalid');
      document.getElementById('password').classList.remove('is-invalid');
      document.getElementById('loginForm').requestSubmit();
    };
  });

  // ─── Toggle Login ↔ Register ───
  document.getElementById('showRegister').onclick = (e) => {
    e.preventDefault();
    document.getElementById('loginForm').style.display    = 'none';
    document.getElementById('forgotPwForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('loginError').style.display   = 'none';
  };
  document.getElementById('showLogin').onclick = (e) => {
    e.preventDefault();
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotPwForm').style.display = 'none';
    document.getElementById('loginForm').style.display    = 'block';
    document.getElementById('registerError').style.display = 'none';
  };

  // ─── Toggle Login ↔ Forgot Password ───
  document.getElementById('showForgotPw').onclick = (e) => {
    e.preventDefault();
    document.getElementById('loginForm').style.display    = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotPwForm').style.display = 'block';
    document.getElementById('loginError').style.display   = 'none';
  };
  document.getElementById('showLoginFromForgot').onclick = (e) => {
    e.preventDefault();
    document.getElementById('forgotPwForm').style.display = 'none';
    document.getElementById('loginForm').style.display    = 'block';
  };

  // ─── Forgot Password Submit ───
  document.getElementById('forgotPwForm').onsubmit = async (e) => {
    e.preventDefault();
    const errEl    = document.getElementById('forgotError');
    const resultEl = document.getElementById('forgotPwResult');
    errEl.style.display    = 'none';
    resultEl.style.display = 'none';

    const data = await api('/api/auth/forgot-password', {
      method: 'POST',
      body: {
        username: document.getElementById('forgotUsername').value.trim(),
        email:    document.getElementById('forgotEmail').value.trim()
      }
    });

    if (data.error) {
      errEl.textContent   = data.error;
      errEl.style.display = 'block';
      return;
    }

    resultEl.style.background = 'rgba(16,185,129,0.15)';
    resultEl.style.color      = 'var(--accent-green)';
    resultEl.style.border     = '1px solid var(--accent-green)';
    resultEl.innerHTML = `<i class="fas fa-check-circle"></i> รีเซ็ตสำเร็จ!<br>
      <strong style="font-size:18px;letter-spacing:2px">${data.newPassword}</strong><br>
      <span style="font-size:11px;color:var(--text-muted)">กรุณาจดรหัสผ่านใหม่แล้วกลับไปเข้าสู่ระบบ</span>`;
    resultEl.style.display = 'block';
  };

  // ─── Register Submit ───
  document.getElementById('registerForm').onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('registerError');
    errEl.style.display = 'none';

    const pw  = document.getElementById('regPassword').value;
    const pw2 = document.getElementById('regPassword2').value;
    if (pw !== pw2) {
      errEl.textContent   = 'รหัสผ่านไม่ตรงกัน';
      errEl.style.display = 'block';
      return;
    }

    const data = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name:       document.getElementById('regName').value,
        username:   document.getElementById('regUsername').value,
        email:      document.getElementById('regEmail').value,
        department: document.getElementById('regDept').value,
        password:   pw
      }
    });

    if (data.error) {
      errEl.textContent   = data.error;
      errEl.style.display = 'block';
      return;
    }
    App.user = data.user;
    App.showApp();
  };
}
