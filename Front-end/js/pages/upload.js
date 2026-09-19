// ============================
// pages/upload.js — Create / Upload Document Form
// ============================

import { api, toast, BASE_URL } from '../core/api.js';
import { navigate } from '../core/nav.js';

export function loadUploadForm(App) {
  const area = document.getElementById('contentArea');
  area.innerHTML = `<div class="fade-in"><div class="content-card"><div class="content-card-header"><h3><i class="fas fa-cloud-upload-alt"></i> สร้างเอกสารใหม่</h3></div><div class="content-card-body">
    <form id="docForm" enctype="multipart/form-data">
      <div class="doc-detail">
        <div class="doc-detail-item doc-detail-full form-group"><label>ชื่อเอกสาร *</label><input type="text" id="docTitle" required placeholder="กรอกชื่อเอกสาร"></div>
        <div class="doc-detail-item doc-detail-full form-group"><label>คำอธิบาย</label><textarea id="docDesc" rows="3" placeholder="รายละเอียดเอกสาร"></textarea></div>
        <div class="doc-detail-item doc-detail-full form-group"><label><i class="fas fa-file-pdf" style="color:var(--accent-red)"></i> ไฟล์ PDF</label>
          <div class="file-upload-area" id="fileUploadArea">
            <i class="fas fa-cloud-upload-alt"></i>
            <p>คลิกเพื่อเลือกไฟล์ PDF หรือลากวาง</p>
            <p style="font-size:11px;color:var(--text-muted)">ขนาดสูงสุด 50 MB</p>
            <input type="file" id="docFile" accept=".pdf" style="display:none">
            <span id="fileName" style="color:var(--accent-green);font-size:13px;margin-top:8px"></span>
          </div>
        </div>
        <div class="doc-detail-item form-group"><label>หมวดหมู่</label><select id="docCategory"><option>บันทึกข้อความ</option><option>สัญญา</option><option>รายงาน</option><option>คำสั่ง</option><option>ใบเสนอราคา</option><option>แผนงาน</option><option>ทั่วไป</option></select></div>
        <div class="doc-detail-item form-group"><label>ความสำคัญ</label><select id="docPriority"><option value="low">ต่ำ</option><option value="medium" selected>ปานกลาง</option><option value="high">สูง</option></select></div>
        <div class="doc-detail-item form-group"><label>กำหนดส่ง</label><input type="date" id="docDeadline"></div>
        <div class="doc-detail-item form-group"><label>วันหมดอายุ</label><input type="date" id="docExpiry"></div>
      </div>
      <div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end">
        <button type="button" class="btn btn-secondary" onclick="App.navigate('documents')">ยกเลิก</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> บันทึกเอกสาร</button>
      </div>
    </form>
  </div></div></div>`;

  // File upload area click & drag
  const uploadArea = document.getElementById('fileUploadArea');
  const fileInput  = document.getElementById('docFile');
  uploadArea.onclick   = () => fileInput.click();
  fileInput.onchange   = () => {
    if (fileInput.files[0]) document.getElementById('fileName').textContent = '📄 ' + fileInput.files[0].name;
  };
  uploadArea.ondragover  = (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--accent-blue)'; };
  uploadArea.ondragleave = ()  => { uploadArea.style.borderColor = ''; };
  uploadArea.ondrop      = (e) => {
    e.preventDefault(); uploadArea.style.borderColor = '';
    if (e.dataTransfer.files[0]) {
      fileInput.files = e.dataTransfer.files;
      document.getElementById('fileName').textContent = '📄 ' + e.dataTransfer.files[0].name;
    }
  };

  document.getElementById('docForm').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title',    document.getElementById('docTitle').value);
    formData.append('description', document.getElementById('docDesc').value);
    formData.append('category', document.getElementById('docCategory').value);
    formData.append('priority', document.getElementById('docPriority').value);

    const deadline = document.getElementById('docDeadline').value;
    if (deadline) formData.append('deadline', new Date(deadline).toISOString());

    const expiry = document.getElementById('docExpiry').value;
    if (expiry) formData.append('expiryDate', new Date(expiry).toISOString());

    const fi = document.getElementById('docFile');
    if (fi.files[0]) formData.append('file', fi.files[0]);

    const res  = await fetch(`${BASE_URL}/api/documents`, { method: 'POST', body: formData, credentials: 'include' });
    const data = await res.json();
    if (data.error) { toast(data.error, 'error'); return; }
    toast('สร้างเอกสารเรียบร้อย', 'success');
    navigate('documents', App);
  };
}
