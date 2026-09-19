// ============================
// pages/documents.js — Document List, View, Actions
// ============================

import { api, toast, BASE_URL } from '../core/api.js';
import { navigate, updateBadges } from '../core/nav.js';

const STATUS_MAP = {
  draft: 'draft', pending_approval: 'pending', approved: 'approved',
  rejected: 'rejected', signed: 'signed', pending_signature: 'pending-sign'
};
const PRIORITY_ICONS = { high: 'fa-arrow-up', medium: 'fa-minus', low: 'fa-arrow-down' };

// ─── Document List ───────────────────────────────────────────────────────
export async function loadDocuments(App, search) {
  const docs      = await api(`/api/documents${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  const area      = document.getElementById('contentArea');
  const canCreate = ['secretary', 'admin'].includes(App.user.role);

  const rows = docs.map(d => `<tr>
    <td><strong style="cursor:pointer;color:var(--accent-blue)" onclick="App.viewDocument('${d.id}')">${d.title}</strong><br><span style="font-size:11px;color:var(--text-muted)">${d.category}</span></td>
    <td><span class="status-badge ${STATUS_MAP[d.status] || 'draft'}">${d.statusText}</span></td>
    <td><span class="priority-badge ${d.priority}"><i class="fas ${PRIORITY_ICONS[d.priority]}"></i> ${d.priority === 'high' ? 'สูง' : d.priority === 'medium' ? 'ปานกลาง' : 'ต่ำ'}</span></td>
    <td>${d.uploadedByName}</td>
    <td>${new Date(d.createdAt).toLocaleDateString('th-TH')}</td>
    <td><div class="btn-group">
      <button class="btn-icon" onclick="App.viewDocument('${d.id}')" title="ดู"><i class="fas fa-eye"></i></button>
      ${d.fileName ? `<button class="btn-icon" onclick="App.downloadDoc('${d.id}')" title="ดาวน์โหลด" style="color:var(--accent-green)"><i class="fas fa-download"></i></button>` : ''}
      ${getDocActions(App, d)}
    </div></td>
  </tr>`).join('');

  area.innerHTML = `<div class="fade-in">
    <div class="toolbar"><div class="toolbar-left">
      <div class="search-input"><i class="fas fa-search"></i><input placeholder="ค้นหาเอกสาร..." id="docSearch" value="${search || ''}"></div>
      <select class="filter-select" id="filterStatus"><option value="">สถานะทั้งหมด</option><option value="draft">ฉบับร่าง</option><option value="pending_approval">รออนุมัติ</option><option value="approved">อนุมัติแล้ว</option><option value="rejected">ปฏิเสธ</option><option value="signed">ลงนามแล้ว</option></select>
      <select class="filter-select" id="filterCategory"><option value="">หมวดหมู่ทั้งหมด</option><option value="บันทึกข้อความ">บันทึกข้อความ</option><option value="สัญญา">สัญญา</option><option value="รายงาน">รายงาน</option><option value="คำสั่ง">คำสั่ง</option><option value="ใบเสนอราคา">ใบเสนอราคา</option><option value="แผนงาน">แผนงาน</option><option value="ทั่วไป">ทั่วไป</option></select>
    </div>${canCreate ? '<button class="btn btn-primary" onclick="App.navigate(\'upload\')"><i class="fas fa-plus"></i> สร้างเอกสาร</button>' : ''}</div>
    <div class="content-card"><div class="content-card-body no-padding">
      ${docs.length
        ? `<table class="data-table"><thead><tr><th>ชื่อเอกสาร</th><th>สถานะ</th><th>ความสำคัญ</th><th>ผู้สร้าง</th><th>วันที่</th><th>จัดการ</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<div class="empty-state"><i class="fas fa-folder-open"></i><h4>ไม่พบเอกสาร</h4><p>ยังไม่มีเอกสารในระบบ</p></div>'}
    </div></div>
  </div>`;

  document.getElementById('docSearch').onkeydown = (e) => {
    if (e.key === 'Enter') loadDocuments(App, e.target.value);
  };

  const reloadDocs = () => {
    const s   = document.getElementById('docSearch').value;
    const st  = document.getElementById('filterStatus').value;
    const cat = document.getElementById('filterCategory').value;
    let qs = '';
    if (s)   qs += `search=${encodeURIComponent(s)}&`;
    if (st)  qs += `status=${st}&`;
    if (cat) qs += `category=${cat}&`;
    api(`/api/documents?${qs}`).then(() => loadDocuments(App, s));
  };
  document.getElementById('filterStatus').onchange   = reloadDocs;
  document.getElementById('filterCategory').onchange = reloadDocs;
}

// ─── Document Actions Buttons (for table row) ──────────────────────────
export function getDocActions(App, doc) {
  const r = App.user.role;
  let btns = '';

  let canApprove = false;
  if (doc.status === 'pending_approval' && doc.approvalWorkflow && doc.approvalWorkflow.length > 0) {
    const pendingStep = doc.approvalWorkflow.find(w => w.status === 'pending');
    if (pendingStep && pendingStep.role === r) canApprove = true;
  } else if (doc.status === 'pending_approval') {
    if (r === 'user' || r === 'executive' || r === 'admin') canApprove = true;
  }

  if ((r === 'secretary' || r === 'admin') && doc.status === 'draft')
    btns += `<button class="btn-icon" onclick="App.submitDoc('${doc.id}')" title="ส่งอนุมัติ"><i class="fas fa-paper-plane"></i></button>`;
  if (canApprove) {
    btns += `<button class="btn-icon" onclick="App.approveDoc('${doc.id}')" title="อนุมัติ" style="color:var(--accent-green)"><i class="fas fa-check"></i></button>`;
    btns += `<button class="btn-icon danger" onclick="App.rejectDoc('${doc.id}')" title="ปฏิเสธ"><i class="fas fa-times"></i></button>`;
  }
  if ((r === 'executive' || r === 'admin') && (doc.status === 'approved' || doc.status === 'pending_signature'))
    btns += `<button class="btn-icon" onclick="App.openSignModal('${doc.id}','${doc.title}')" title="ลงนาม" style="color:var(--accent-purple)"><i class="fas fa-signature"></i></button>`;
  if ((r === 'admin' || r === 'secretary') && (doc.status === 'draft' || doc.status === 'rejected'))
    btns += `<button class="btn-icon danger" onclick="App.deleteDoc('${doc.id}')" title="ลบ"><i class="fas fa-trash"></i></button>`;

  return btns;
}

// ─── Modal Actions (for document detail modal) ──────────────────────────
export function getModalActions(App, doc) {
  const r = App.user.role;
  let btns = '';

  let canApprove = false;
  if (doc.status === 'pending_approval' && doc.approvalWorkflow && doc.approvalWorkflow.length > 0) {
    const pendingStep = doc.approvalWorkflow.find(w => w.status === 'pending');
    if (pendingStep && pendingStep.role === r) canApprove = true;
  } else if (doc.status === 'pending_approval') {
    if (r === 'user' || r === 'executive' || r === 'admin') canApprove = true;
  }

  if ((r === 'secretary' || r === 'admin') && doc.status === 'draft')
    btns += `<button class="btn btn-primary" onclick="App.submitDoc('${doc.id}')"><i class="fas fa-paper-plane"></i> ส่งอนุมัติ</button>`;
  if (canApprove) {
    btns += `<button class="btn btn-success" onclick="App.approveDoc('${doc.id}')"><i class="fas fa-check"></i> อนุมัติ</button>`;
    btns += `<button class="btn btn-danger"  onclick="App.rejectDoc('${doc.id}')"><i class="fas fa-times"></i> ปฏิเสธ</button>`;
  }
  if ((r === 'executive' || r === 'admin') && (doc.status === 'approved' || doc.status === 'pending_signature'))
    btns += `<button class="btn btn-primary" onclick="App.openSignModal('${doc.id}','${doc.title}')"><i class="fas fa-signature"></i> ลงนาม</button>`;

  return btns;
}

// ─── View Document Modal ─────────────────────────────────────────────────
export async function viewDocument(App, id) {
  const doc   = await api(`/api/documents/${id}`);
  const modal = document.getElementById('modal');

  // Signatures HTML
  const sigHtml = doc.signatures.length
    ? doc.signatures.map(s => {
        let deviceName = 'Unknown Device';
        if (s.userAgent) {
          if      (s.userAgent.includes('iPhone'))  deviceName = 'iPhone';
          else if (s.userAgent.includes('iPad'))    deviceName = 'iPad';
          else if (s.userAgent.includes('Android')) deviceName = 'Android';
          else if (s.userAgent.includes('Mac OS'))  deviceName = 'Mac';
          else if (s.userAgent.includes('Windows')) deviceName = 'Windows';
        }
        const auditTrail = s.ipAddress
          ? `<div style="margin-top:12px;padding:8px 12px;background:rgba(0,0,0,0.02);border-radius:6px;font-size:11px;color:var(--text-muted);border:1px solid rgba(0,0,0,0.05)">
               <div style="font-weight:600;margin-bottom:6px;color:var(--text-primary)">Audit Trail</div>
               <div style="margin-bottom:4px"><span style="color:var(--accent-green)">●</span> อุปกรณ์ • ${deviceName}</div>
               <div><span style="color:var(--accent-green)">●</span> ลงนาม • ${new Date(s.signedAt).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} • ${s.ipAddress}</div>
             </div>` : '';
        return `
          <div class="signature-item" style="display:flex;flex-direction:column;padding:12px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-sm);margin-bottom:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div style="display:flex;align-items:center;gap:12px">
                ${s.signatureData && s.signatureData.startsWith('data:image')
                  ? `<img src="${s.signatureData}" style="height:45px;max-width:120px;object-fit:contain;background:#fff;border-radius:4px;padding:2px;border:1px solid var(--border-color)">`
                  : `<div style="width:45px;height:45px;border-radius:6px;background:rgba(139,92,246,0.15);color:var(--accent-purple);display:flex;align-items:center;justify-content:center;font-size:20px"><i class="fas fa-signature"></i></div>`}
                <div class="signature-item-info">
                  <div class="signature-item-name" style="font-weight:600;color:var(--text-primary)"><i class="fas fa-check-circle" style="color:var(--accent-green)"></i> ${s.signedByName}</div>
                  <div class="signature-item-time" style="font-size:12px;color:var(--text-muted)"><i class="fas fa-clock"></i> ${new Date(s.signedAt).toLocaleString('th-TH')}</div>
                  <div style="font-size:11px;color:var(--accent-blue)"><i class="fas fa-shield-alt"></i> ${s.certificateId || 'CERT-VERIFIED'}</div>
                </div>
              </div>
              <span class="status-badge signed" style="font-size:11px"><i class="fas fa-certificate"></i> ดิจิทัล</span>
            </div>
            ${auditTrail}
          </div>`;
      }).join('')
    : '<p style="color:var(--text-muted);font-size:13px">ยังไม่มีลายเซ็น</p>';

  // Comments HTML
  const commHtml = doc.comments.length
    ? doc.comments.map(c =>
        `<div class="comment-item">
           <div class="comment-avatar"><i class="fas fa-user"></i></div>
           <div class="comment-content">
             <div class="comment-name">${c.byName}</div>
             <div class="comment-text">${c.text}</div>
             <div class="comment-time">${new Date(c.at).toLocaleString('th-TH')}</div>
           </div>
         </div>`
      ).join('')
    : '';

  const canComment = App.user.role === 'admin' || App.user.role === 'secretary' || doc.assignedTo.includes(App.user.id);
  const commentInput = canComment
    ? `<div class="comment-input-area" style="margin-top:16px">
         <h4 style="font-size:14px;margin-bottom:8px"><i class="fas fa-comment-dots" style="color:var(--accent-green)"></i> เพิ่มความคิดเห็น</h4>
         <div style="display:flex;gap:10px;align-items:flex-start">
           <textarea id="commentText" rows="2" placeholder="พิมพ์ความคิดเห็น..." style="flex:1;padding:10px 14px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:inherit;resize:vertical"></textarea>
           <button class="btn btn-primary" onclick="App.addComment('${doc.id}')" style="height:fit-content"><i class="fas fa-paper-plane"></i> ส่ง</button>
         </div>
       </div>` : '';

  const downloadButtons = doc.fileStorageName
    ? `<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
         <button class="btn btn-secondary" onclick="App.downloadDoc('${doc.id}')"><i class="fas fa-download"></i> ดาวน์โหลดต้นฉบับ</button>
         ${doc.signatures && doc.signatures.length
           ? `<button class="btn btn-primary" onclick="App.downloadStampedPdf('${doc.id}')" style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);border:none;box-shadow:0 4px 14px rgba(16,185,129,0.35)">
                <i class="fas fa-file-signature"></i> ดาวน์โหลด PDF พร้อมประทับลายเซ็นจริง ⭐
              </button>` : ''}
       </div>` : '';

  // Workflow HTML
  let workflowHtml = '';
  if (doc.approvalWorkflow && doc.approvalWorkflow.length > 0) {
    const stepsHtml = doc.approvalWorkflow.map((w, index) => {
      let statusBadge = '';
      if (w.status === 'approved')
        statusBadge = `<span style="background:#e6f4ea;color:#137333;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600"><i class="fas fa-check"></i> อนุมัติแล้ว</span>`;
      else if (w.status === 'rejected')
        statusBadge = `<span style="background:#fce8e6;color:#c5221f;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600"><i class="fas fa-times"></i> ปฏิเสธ</span>`;
      else
        statusBadge = `<span style="background:#f1f3f4;color:#5f6368;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600">รออนุมัติ</span>`;

      const isLast = index === doc.approvalWorkflow.length - 1;
      return `
        <div style="display:flex;gap:16px;margin-bottom:12px;position:relative">
          ${!isLast ? `<div style="position:absolute;left:19px;top:38px;bottom:-20px;width:2px;background:#e8eaed;z-index:1"></div>` : ''}
          <div style="width:40px;display:flex;flex-direction:column;align-items:center">
            <div style="width:36px;height:36px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;position:relative;z-index:2"><i class="fas fa-user-tie"></i></div>
          </div>
          <div style="flex:1;background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 2px 4px rgba(0,0,0,0.02)">
            <div>
              <div style="font-weight:600;color:var(--text-primary);font-size:13px">${w.roleName}</div>
              <div style="color:var(--text-muted);font-size:12px;margin-top:2px">${w.name} ${w.timestamp ? `• ${new Date(w.timestamp).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}` : ''}</div>
            </div>
            <div>${statusBadge}</div>
          </div>
        </div>`;
    }).join('');
    workflowHtml = `<div style="margin-top:24px;background:#fffaf3;border:1px solid #fbe3d2;border-radius:12px;padding:20px"><h4 style="font-size:14px;margin-bottom:20px;color:var(--text-primary)"><i class="fas fa-route" style="color:var(--accent-orange)"></i> เส้นทางการอนุมัติ</h4>${stepsHtml}</div>`;
  }

  const modalActions = getModalActions(App, doc);

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-header"><h3><i class="fas fa-file-alt"></i> ${doc.title}</h3><button class="modal-close" onclick="document.getElementById('modal').style.display='none'"><i class="fas fa-times"></i></button></div>
    <div class="modal-body">
      <div class="doc-detail">
        <div class="doc-detail-item"><div class="doc-detail-label">หมวดหมู่</div><div class="doc-detail-value">${doc.category}</div></div>
        <div class="doc-detail-item"><div class="doc-detail-label">สถานะ</div><div class="doc-detail-value"><span class="status-badge ${STATUS_MAP[doc.status]}">${doc.statusText}</span></div></div>
        <div class="doc-detail-item"><div class="doc-detail-label">ผู้สร้าง</div><div class="doc-detail-value">${doc.uploadedByName}</div></div>
        <div class="doc-detail-item"><div class="doc-detail-label">วันที่สร้าง</div><div class="doc-detail-value">${new Date(doc.createdAt).toLocaleString('th-TH')}</div></div>
        <div class="doc-detail-item doc-detail-full"><div class="doc-detail-label">คำอธิบาย</div><div class="doc-detail-value">${doc.description}</div></div>
        ${doc.deadline  ? `<div class="doc-detail-item"><div class="doc-detail-label">กำหนดส่ง</div><div class="doc-detail-value">${new Date(doc.deadline).toLocaleDateString('th-TH')}</div></div>` : ''}
        ${doc.expiryDate ? `<div class="doc-detail-item"><div class="doc-detail-label">วันหมดอายุ</div><div class="doc-detail-value" style="color:${new Date(doc.expiryDate) < new Date() ? 'var(--accent-red)' : 'var(--accent-orange)'}">${new Date(doc.expiryDate).toLocaleDateString('th-TH')}</div></div>` : ''}
        <div class="doc-detail-item"><div class="doc-detail-label">เวอร์ชัน</div><div class="doc-detail-value">v${doc.version || 1}</div></div>
        ${doc.fileName ? `<div class="doc-detail-item"><div class="doc-detail-label">ไฟล์</div><div class="doc-detail-value"><i class="fas fa-file-pdf" style="color:var(--accent-red)"></i> ${doc.fileName} (${(doc.fileSize / 1024 / 1024).toFixed(2)} MB)</div></div>` : ''}
      </div>
      ${downloadButtons}
      ${doc.versionHistory && doc.versionHistory.length
        ? `<div style="margin-top:16px"><h4 style="font-size:14px;margin-bottom:8px"><i class="fas fa-code-branch" style="color:var(--accent-orange)"></i> ประวัติเวอร์ชัน</h4>${doc.versionHistory.map(v => `<div style="padding:8px 12px;background:var(--bg-input);border-radius:var(--radius-sm);margin-bottom:6px;font-size:13px"><strong>v${v.version}</strong> — ${v.fileName} — ${new Date(v.uploadedAt).toLocaleString('th-TH')}</div>`).join('')}</div>` : ''}
      ${workflowHtml}
      <div style="margin-top:20px"><h4 style="font-size:14px;margin-bottom:8px"><i class="fas fa-signature" style="color:var(--accent-purple)"></i> ลายเซ็นที่ประทับลงในเอกสาร</h4>${sigHtml}</div>
      <div class="doc-comments" style="margin-top:16px"><h4 style="font-size:14px;margin-bottom:8px"><i class="fas fa-comments" style="color:var(--accent-cyan)"></i> ความคิดเห็น (${doc.comments.length})</h4>${commHtml || '<p style="color:var(--text-muted);font-size:13px">ยังไม่มีความคิดเห็น</p>'}</div>
      ${commentInput}
    </div>
    <div class="modal-footer">${modalActions ? `<div class="btn-group">${modalActions}</div>` : ''}<button class="btn btn-secondary" onclick="document.getElementById('modal').style.display='none'">ปิด</button></div>`;
  modal.style.display = 'flex';
}

// ─── Add Comment ─────────────────────────────────────────────────────────
export async function addComment(App, docId) {
  const text = document.getElementById('commentText').value.trim();
  if (!text) { toast('กรุณาพิมพ์ความคิดเห็น', 'error'); return; }
  const data = await api(`/api/documents/${docId}/comment`, { method: 'POST', body: { text } });
  if (data.error) { toast(data.error, 'error'); return; }
  toast('เพิ่มความคิดเห็นเรียบร้อย', 'success');
  viewDocument(App, docId);
}

// ─── Document State Actions ─────────────────────────────────────────────
export async function submitDoc(App, id) {
  const data = await api(`/api/documents/${id}/submit`, { method: 'PUT' });
  if (data.error) { toast(data.error, 'error'); return; }
  toast('ส่งเอกสารเพื่ออนุมัติแล้ว', 'success');
  document.getElementById('modal').style.display = 'none';
  updateBadges(App);
  navigate(App.currentPage, App);
}

export async function approveDoc(App, id) {
  const comment = prompt('ความคิดเห็น (ถ้ามี):') || '';
  const data = await api(`/api/documents/${id}/approve`, { method: 'PUT', body: { comment } });
  if (data.error) { toast(data.error, 'error'); return; }
  toast('อนุมัติเอกสารเรียบร้อย', 'success');
  document.getElementById('modal').style.display = 'none';
  updateBadges(App);
  navigate(App.currentPage, App);
}

export async function rejectDoc(App, id) {
  const comment = prompt('เหตุผลที่ปฏิเสธ:');
  if (!comment) return;
  const data = await api(`/api/documents/${id}/reject`, { method: 'PUT', body: { comment } });
  if (data.error) { toast(data.error, 'error'); return; }
  toast('ปฏิเสธเอกสารแล้ว', 'error');
  document.getElementById('modal').style.display = 'none';
  updateBadges(App);
  navigate(App.currentPage, App);
}

export async function deleteDoc(App, id) {
  if (!confirm('ยืนยันการลบเอกสาร?')) return;
  await api(`/api/documents/${id}`, { method: 'DELETE' });
  toast('ลบเอกสารแล้ว', 'success');
  document.getElementById('modal').style.display = 'none';
  updateBadges(App);
  navigate(App.currentPage, App);
}

// ─── Download ────────────────────────────────────────────────────────────
export async function downloadDoc(App, id) {
  try {
    const res = await fetch(`${BASE_URL}/api/documents/${id}/download`, { credentials: 'include' });
    if (!res.ok) {
      const data = await res.json();
      toast(data.error || 'ไม่สามารถดาวน์โหลดได้', 'error');
      return;
    }
    const blob        = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    let filename = 'document.pdf';
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match) filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
    }
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast('ดาวน์โหลดเรียบร้อย', 'success');
  } catch (e) {
    toast('เกิดข้อผิดพลาดในการดาวน์โหลด', 'error');
  }
}
