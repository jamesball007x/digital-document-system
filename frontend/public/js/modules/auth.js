import { api } from '../api.js';
import { state } from '../state.js';
import { toast, sanitize } from '../utils.js';

export function bindLogin(onLoginSuccess) {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('loginError');
      const successEl = document.getElementById('loginSuccess');
      errEl.style.display = 'none';
      if (successEl) successEl.style.display = 'none';

      try {
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: {
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
          }
        });
        if (data.error) {
          errEl.textContent = data.error;
          errEl.style.display = 'block';
          return;
        }
        state.user = data.user;
        onLoginSuccess();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    };
  }

  document.querySelectorAll('.demo-btn').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('username').value = btn.dataset.user;
      document.getElementById('password').value = btn.dataset.pass;
      document.getElementById('loginForm').requestSubmit();
    };
  });

  // Toggle login ↔ register
  const showRegBtn = document.getElementById('showRegister');
  if (showRegBtn) {
    showRegBtn.onclick = (e) => {
      e.preventDefault();
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('forgotPwForm').style.display = 'none';
      document.getElementById('registerForm').style.display = 'block';
      document.getElementById('loginError').style.display = 'none';
      const successEl = document.getElementById('loginSuccess');
      if (successEl) successEl.style.display = 'none';
    };
  }

  const showLoginBtn = document.getElementById('showLogin');
  if (showLoginBtn) {
    showLoginBtn.onclick = (e) => {
      e.preventDefault();
      document.getElementById('registerForm').style.display = 'none';
      document.getElementById('forgotPwForm').style.display = 'none';
      document.getElementById('loginForm').style.display = 'block';
      document.getElementById('registerError').style.display = 'none';
    };
  }

  // Toggle login ↔ forgot password
  const showForgotBtn = document.getElementById('showForgotPw');
  if (showForgotBtn) {
    showForgotBtn.onclick = (e) => {
      e.preventDefault();
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('registerForm').style.display = 'none';
      document.getElementById('forgotPwForm').style.display = 'block';
      document.getElementById('loginError').style.display = 'none';
      const successEl = document.getElementById('loginSuccess');
      if (successEl) successEl.style.display = 'none';
    };
  }

  const showLoginFromForgotBtn = document.getElementById('showLoginFromForgot');
  if (showLoginFromForgotBtn) {
    showLoginFromForgotBtn.onclick = (e) => {
      e.preventDefault();
      document.getElementById('forgotPwForm').style.display = 'none';
      document.getElementById('loginForm').style.display = 'block';
    };
  }

  // Forgot password submit
  const forgotPwForm = document.getElementById('forgotPwForm');
  if (forgotPwForm) {
    forgotPwForm.onsubmit = async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('forgotError');
      const resultEl = document.getElementById('forgotPwResult');
      errEl.style.display = 'none';
      resultEl.style.display = 'none';

      try {
        const data = await api('/api/auth/forgot-password', {
          method: 'POST',
          body: {
            username: document.getElementById('forgotUsername').value.trim(),
            email: document.getElementById('forgotEmail').value.trim()
          }
        });

        if (data.error) {
          errEl.textContent = data.error;
          errEl.style.display = 'block';
          return;
        }

        resultEl.style.background = 'rgba(16,185,129,0.15)';
        resultEl.style.color = 'var(--accent-green)';
        resultEl.style.border = '1px solid var(--accent-green)';
        resultEl.innerHTML = `<i class="fas fa-check-circle"></i> รีเซ็ตสำเร็จ!<br><strong style="font-size:18px;letter-spacing:2px">${data.newPassword}</strong><br><span style="font-size:11px;color:var(--text-muted)">กรุณาจดรหัสผ่านใหม่แล้วกลับไปเข้าสู่ระบบ</span>`;
        resultEl.style.display = 'block';
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    };
  }

  // Register submit
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.onsubmit = async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('registerError');
      errEl.style.display = 'none';

      const pw = document.getElementById('regPassword').value;
      const pw2 = document.getElementById('regPassword2').value;
      if (pw !== pw2) { errEl.textContent = 'รหัสผ่านไม่ตรงกัน'; errEl.style.display = 'block'; return; }

      const regUsername = document.getElementById('regUsername').value.trim();

      try {
        const data = await api('/api/auth/register', {
          method: 'POST',
          body: {
            name: document.getElementById('regName').value,
            username: regUsername,
            email: document.getElementById('regEmail').value,
            department: document.getElementById('regDept').value,
            password: pw
          }
        });

        if (data.error) { errEl.textContent = data.error; errEl.style.display = 'block'; return; }

        // Show toast notification
        toast('สมัครสมาชิกสำเร็จแล้ว! กรุณาเข้าสู่ระบบ', 'success');

        // Show success alert message on login form
        const successEl = document.getElementById('loginSuccess');
        if (successEl) {
          successEl.innerHTML = `<i class="fas fa-check-circle"></i> สมัครสมาชิกสำเร็จแล้ว! กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้ <strong>${sanitize(regUsername)}</strong>`;
          successEl.style.display = 'block';
        }

        // Auto fill username on login form and clear password
        const loginUserEl = document.getElementById('username');
        if (loginUserEl) loginUserEl.value = regUsername;
        const loginPwEl = document.getElementById('password');
        if (loginPwEl) {
          loginPwEl.value = '';
          loginPwEl.focus();
        }

        // Reset register form
        registerForm.reset();

        // Switch view to login form
        registerForm.style.display = 'none';
        const forgotForm = document.getElementById('forgotPwForm');
        if (forgotForm) forgotForm.style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';

      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    };
  }
}
