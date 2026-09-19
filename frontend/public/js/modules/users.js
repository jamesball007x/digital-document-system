import { api } from '../api.js';
import { toast } from '../utils.js';

export async function loadUsers() {
  const users = await api('/api/users');
  const area = document.getElementById('contentArea');
  if (!area) return;

  const rows = users.map(u => `<tr>
    <td><strong>${u.name}</strong><br><span style="font-size:11px;color:var(--text-muted)">${u.username}</span></td>
    <td>${u.email}</td>
    <td><span class="role-badge ${u.role}"><i class="fas fa-circle" style="font-size:6px"></i> ${u.roleName}</span></td>
    <td>${u.department}</td>
    <td><span class="status-dot ${u.status === 'active' ? 'online' : 'offline'}"></span>${u.status === 'active' ? 'ใช้งาน' : 'ระงับ'}</td>
    <td><div class="btn-group">
      <button class="btn-icon" data-action="edit-user" data-id="${u.id}" title="แก้ไข"><i class="fas fa-edit"></i></button>
      <button class="btn-icon danger" data-action="delete-user" data-id="${u.id}" title="ลบ"><i class="fas fa-trash"></i></button>
    </div></td>
  </tr>`).join('');

  area.innerHTML = `<div class="fade-in"><div class="toolbar"><div class="toolbar-left"><h3 style="font-size:18px">จัดการผู้ใช้</h3></div>
    <button class="btn btn-primary" id="btnShowAddUser"><i class="fas fa-user-plus"></i> เพิ่มผู้ใช้</button></div>
    <div class="content-card"><div class="content-card-body no-padding">
      <table class="data-table"><thead><tr><th>ชื่อ</th><th>อีเมล</th><th>บทบาท</th><th>แผนก</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${rows}</tbody></table>
    </div></div></div>`;

  document.getElementById('btnShowAddUser').onclick = () => showAddUser();

  area.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (action === 'edit-user') editUser(id);
    else if (action === 'delete-user') deleteUser(id);
  });
}

export function showAddUser() {
  const modal = document.getElementById('modal');
  if (!modal) return;
  document.getElementById('modalContent').innerHTML = `
    <div class="modal-header"><h3><i class="fas fa-user-plus"></i> เพิ่มผู้ใช้ใหม่</h3><button class="modal-close" id="btnCloseAddUser"><i class="fas fa-times"></i></button></div>
    <div class="modal-body"><form id="addUserForm">
      <div class="form-group"><label>ชื่อผู้ใช้ *</label><input type="text" id="newUsername" required></div>
      <div class="form-group"><label>รหัสผ่าน *</label><div class="password-wrapper"><input type="password" id="newPassword" required><button type="button" class="pw-toggle" id="btnToggleNewPw" tabindex="-1"><i class="fas fa-eye"></i></button></div></div>
      <div class="form-group"><label>ชื่อ-นามสกุล *</label><input type="text" id="newName" required></div>
      <div class="form-group"><label>อีเมล</label><input type="email" id="newEmail"></div>
      <div class="form-group"><label>บทบาท *</label><select id="newRole"><option value="user">ผู้ใช้งานทั่วไป</option><option value="secretary">ธุรการ</option><option value="executive">ผู้บริหารระดับสูง</option><option value="admin">ผู้ดูแลระบบ</option></select></div>
      <div class="form-group"><label>แผนก</label><input type="text" id="newDept"></div>
    </form></div>
    <div class="modal-footer"><button class="btn btn-secondary" id="btnCancelAddUser">ยกเลิก</button>
    <button class="btn btn-primary" id="btnSaveAddUser"><i class="fas fa-save"></i> บันทึก</button></div>`;
  modal.style.display = 'flex';

  document.getElementById('btnCloseAddUser').onclick = () => modal.style.display = 'none';
  document.getElementById('btnCancelAddUser').onclick = () => modal.style.display = 'none';
  document.getElementById('btnSaveAddUser').onclick = () => addUser();

  const toggleBtn = document.getElementById('btnToggleNewPw');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      const input = document.getElementById('newPassword');
      if (input.type === 'password') {
        input.type = 'text';
        toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
      } else {
        input.type = 'password';
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
      }
    };
  }
}

export async function addUser() {
  const data = await api('/api/users', {
    method: 'POST', body: {
      username: document.getElementById('newUsername').value,
      password: document.getElementById('newPassword').value,
      name: document.getElementById('newName').value,
      email: document.getElementById('newEmail').value,
      role: document.getElementById('newRole').value,
      department: document.getElementById('newDept').value
    }
  });
  if (data.error) { toast(data.error, 'error'); return; }
  document.getElementById('modal').style.display = 'none';
  toast('เพิ่มผู้ใช้เรียบร้อย', 'success');
  loadUsers();
}

export async function editUser(id) {
  const users = await api('/api/users');
  const u = users.find(x => x.id === id);
  if (!u) return;
  const modal = document.getElementById('modal');
  if (!modal) return;
  document.getElementById('modalContent').innerHTML = `
    <div class="modal-header"><h3><i class="fas fa-user-edit"></i> แก้ไขผู้ใช้</h3><button class="modal-close" id="btnCloseEditUser"><i class="fas fa-times"></i></button></div>
    <div class="modal-body">
      <div class="form-group"><label>ชื่อ-นามสกุล</label><input type="text" id="editName" value="${u.name}"></div>
      <div class="form-group"><label>อีเมล</label><input type="email" id="editEmail" value="${u.email}"></div>
      <div class="form-group"><label>บทบาท</label><select id="editRole"><option value="user" ${u.role === 'user' ? 'selected' : ''}>ผู้ใช้งานทั่วไป</option><option value="secretary" ${u.role === 'secretary' ? 'selected' : ''}>ธุรการ</option><option value="executive" ${u.role === 'executive' ? 'selected' : ''}>ผู้บริหารระดับสูง</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ</option></select></div>
      <div class="form-group"><label>แผนก</label><input type="text" id="editDept" value="${u.department}"></div>
      <div class="form-group"><label>สถานะ</label><select id="editStatus"><option value="active" ${u.status === 'active' ? 'selected' : ''}>ใช้งาน</option><option value="inactive" ${u.status === 'inactive' ? 'selected' : ''}>ระงับ</option></select></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" id="btnCancelEditUser">ยกเลิก</button>
    <button class="btn btn-primary" id="btnSaveEditUser"><i class="fas fa-save"></i> บันทึก</button></div>`;
  modal.style.display = 'flex';

  document.getElementById('btnCloseEditUser').onclick = () => modal.style.display = 'none';
  document.getElementById('btnCancelEditUser').onclick = () => modal.style.display = 'none';
  document.getElementById('btnSaveEditUser').onclick = () => saveUser(id);
}

export async function saveUser(id) {
  await api(`/api/users/${id}`, {
    method: 'PUT', body: {
      name: document.getElementById('editName').value,
      email: document.getElementById('editEmail').value,
      role: document.getElementById('editRole').value,
      department: document.getElementById('editDept').value,
      status: document.getElementById('editStatus').value
    }
  });
  document.getElementById('modal').style.display = 'none';
  toast('แก้ไขผู้ใช้เรียบร้อย', 'success');
  loadUsers();
}

export async function deleteUser(id) {
  if (!confirm('ยืนยันการลบผู้ใช้?')) return;
  await api(`/api/users/${id}`, { method: 'DELETE' });
  toast('ลบผู้ใช้เรียบร้อย', 'success');
  loadUsers();
}
