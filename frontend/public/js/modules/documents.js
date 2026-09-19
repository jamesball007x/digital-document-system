import { api } from '../api.js';
import { state } from '../state.js';
import { toast, statusMap, priorityIcons } from '../utils.js';
import { openSignModal, downloadStampedPdf } from './signing.js';

export async function loadDocuments(search) {
  const docs = await api(`/api/documents${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  const area = document.getElementById('contentArea');
  if (!area || !state.user) return;
  const canCreate = ['secretary', 'admin'].includes(state.user.role);

  const rows = docs.map(d => `<tr>
    <td><strong style="cursor:pointer;color:var(--accent-blue)" data-action="view" data-id="${d.id}">${d.title}</strong><br><span style="font-size:11px;color:var(--text-muted)">${d.category}</span></td>
    <td><span class="status-badge ${statusMap[d.status] || 'draft'}">${d.statusText}</span></td>
    <td><span class="priority-badge ${d.priority}"><i class="fas ${priorityIcons[d.priority]}"></i> ${d.priority === 'high' ? 'สูง' : d.priority === 'medium' ? 'ปานกลาง' : 'ต่ำ'}</span></td>
    <td>${d.uploadedByName}</td>
    <td>${new Date(d.createdAt).toLocaleDateString('th-TH')}</td>
    <td><div class="btn-group">
      <button class="btn-icon" data-action="view" data-id="${d.id}" title="ดู"><i class="fas fa-eye"></i></button>
      ${d.fileName ? `<button class="btn-icon" data-action="download" data-id="${d.id}" title="ดาวน์โหลด" style="color:var(--accent-green)"><i class="fas fa-download"></i></button>` : ''}
      ${getDocActions(d)}
    </div></td>
  </tr>`).join('');

  area.innerHTML = `<div class="fade-in">
    <div class="toolbar"><div class="toolbar-left">
      <div class="search-input"><i class="fas fa-search"></i><input placeholder="ค้นหาเอกสาร..." id="docSearch" value="${search || ''}"></div>
      <select class="filter-select" id="filterStatus"><option value="">สถานะทั้งหมด</option><option value="draft">ฉบับร่าง</option><option value="pending_approval">รออนุมัติ</option><option value="approved">อนุมัติแล้ว</option><option value="rejected">ปฏิเสธ</option><option value="signed">ลงนามแล้ว</option></select>
      <select class="filter-select" id="filterCategory"><option value="">หมวดหมู่ทั้งหมด</option><option value="บันทึกข้อความ">บันทึกข้อความ</option><option value="สัญญา">สัญญา</option><option value="รายงาน">รายงาน</option><option value="คำสั่ง">คำสั่ง</option><option value="ใบเสนอราคา">ใบเสนอราคา</option><option value="แผนงาน">แผนงาน</option><option value="ทั่วไป">ทั่วไป</option></select>
    </div>${canCreate ? '<button class="btn btn-primary" id="btnGoUpload"><i class="fas fa-plus"></i> สร้างเอกสาร</button>' : ''}</div>
    <div class="content-card"><div class="content-card-body no-padding">
      ${docs.length ? `<table class="data-table"><thead><tr><th>ชื่อเอกสาร</th><th>สถานะ</th><th>ความสำคัญ</th><th>ผู้สร้าง</th><th>วันที่</th><th>จัดการ</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="empty-state"><i class="fas fa-folder-open"></i><h4>ไม่พบเอกสาร</h4><p>ยังไม่มีเอกสารในระบบ</p></div>'}
    </div></div></div>`;

  bindDocumentListEvents(area);
}

function bindDocumentListEvents(container) {
  const searchInput = container.querySelector('#docSearch');
  if (searchInput) {
    searchInput.onkeydown = (e) => { if (e.key === 'Enter') loadDocuments(e.target.value); };
  }

  const reloadDocs = () => {
    const s = container.querySelector('#docSearch')?.value || '';
    const st = container.querySelector('#filterStatus')?.value || '';
    const cat = container.querySelector('#filterCategory')?.value || '';
    let qs = '';
    if (s) qs += `search=${encodeURIComponent(s)}&`;
    if (st) qs += `status=${st}&`;
    if (cat) qs += `category=${cat}&`;
    api(`/api/documents?${qs}`).then(() => loadDocuments(s));
  };

  const filterStatus = container.querySelector('#filterStatus');
  if (filterStatus) filterStatus.onchange = reloadDocs;
  const filterCategory = container.querySelector('#filterCategory');
  if (filterCategory) filterCategory.onchange = reloadDocs;

  container.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    const title = target.dataset.title;

    if (action === 'view') viewDocument(id);
    else if (action === 'download') downloadDoc(id);
    else if (action === 'submit') submitDoc(id);
    else if (action === 'approve') approveDoc(id);
    else if (action === 'reject') rejectDoc(id);
    else if (action === 'sign') openSignModal(id, title, () => loadDocuments());
    else if (action === 'delete') deleteDoc(id);
  });
}

export function getDocActions(doc) {
  const r = state.user.role;
  let btns = '';
  
  let canApprove = false;
  if (doc.status === 'pending_approval' && doc.approvalWorkflow && doc.approvalWorkflow.length > 0) {
    const pendingStep = doc.approvalWorkflow.find(w => w.status === 'pending');
    if (pendingStep && pendingStep.role === r) canApprove = true;
  } else if (doc.status === 'pending_approval') {
    if (r === 'user' || r === 'executive' || r === 'admin') canApprove = true;
  }

  if ((r === 'secretary' || r === 'admin') && doc.status === 'draft') btns += `<button class="btn-icon" data-action="submit" data-id="${doc.id}" title="ส่งอนุมัติ"><i class="fas fa-paper-plane"></i></button>`;
  if (canApprove) {
    btns += `<button class="btn-icon" data-action="approve" data-id="${doc.id}" title="อนุมัติ" style="color:var(--accent-green)"><i class="fas fa-check"></i></button>`;
    btns += `<button class="btn-icon danger" data-action="reject" data-id="${doc.id}" title="ปฏิเสธ"><i class="fas fa-times"></i></button>`;
  }
  if ((r === 'executive' || r === 'admin') && (doc.status === 'approved' || doc.status === 'pending_signature')) btns += `<button class="btn-icon" data-action="sign" data-id="${doc.id}" data-title="${doc.title}" title="ลงนาม" style="color:var(--accent-purple)"><i class="fas fa-signature"></i></button>`;
  if ((r === 'admin' || r === 'secretary') && (doc.status === 'draft' || doc.status === 'rejected')) btns += `<button class="btn-icon danger" data-action="delete" data-id="${doc.id}" title="ลบ"><i class="fas fa-trash"></i></button>`;
  return btns;
}

export async function viewDocument(id) {
  const doc = await api(`/api/documents/${id}`);
  state.currentDoc = doc;
  const modal = document.getElementById('modal');
  if (!modal) return;

  const sigHtml = doc.signatures.length ? doc.signatures.map(s => {
    let deviceName = 'Unknown Device';
    if (s.userAgent) {
      if (s.userAgent.includes('iPhone')) deviceName = 'iPhone';
      else if (s.userAgent.includes('iPad')) deviceName = 'iPad';
      else if (s.userAgent.includes('Android')) deviceName = 'Android';
      else if (s.userAgent.includes('Mac OS')) deviceName = 'Mac';
      else if (s.userAgent.includes('Windows')) deviceName = 'Windows';
    }
    const auditTrail = s.ipAddress ? `<div style="margin-top:12px;padding:8px 12px;background:rgba(0,0,0,0.02);border-radius:6px;font-size:11px;color:var(--text-muted);border:1px solid rgba(0,0,0,0.05)"><div style="font-weight:600;margin-bottom:6px;color:var(--text-primary)">Audit Trail</div><div style="margin-bottom:4px"><span style="color:var(--accent-green)">●</span> อุปกรณ์ • ${deviceName}</div><div><span style="color:var(--accent-green)">●</span> ลงนาม • ${new Date(s.signedAt).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} • ${s.ipAddress}</div></div>` : '';
    return `
    <div class="signature-item" style="display:flex;flex-direction:column;padding:12px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-sm);margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px">
          ${s.signatureData && s.signatureData.startsWith('data:image') ? `<img src="${s.signatureData}" style="height:45px;max-width:120px;object-fit:contain;background:#fff;border-radius:4px;padding:2px;border:1px solid var(--border-color)">` : `<div style="width:45px;height:45px;border-radius:6px;background:rgba(139,92,246,0.15);color:var(--accent-purple);display:flex;align-items:center;justify-content:center;font-size:20px"><i class="fas fa-signature"></i></div>`}
          <div class="signature-item-info">
            <div class="signature-item-name" style="font-weight:600;color:var(--text-primary)"><i class="fas fa-check-circle" style="color:var(--accent-green)"></i> ${s.signedByName}</div>
            <div class="signature-item-time" style="font-size:12px;color:var(--text-muted)"><i class="fas fa-clock"></i> ${new Date(s.signedAt).toLocaleString('th-TH')}</div>
            <div style="font-size:11px;color:var(--accent-blue)"><i class="fas fa-shield-alt"></i> ${s.certificateId || 'CERT-VERIFIED'}</div>
          </div>
        </div>
        <span class="status-badge signed" style="font-size:11px"><i class="fas fa-certificate"></i> ดิจิทัล</span>
      </div>
      ${auditTrail}
    </div>
  `}).join('') : '<p style="color:var(--text-muted);font-size:13px">ยังไม่มีลายเซ็น</p>';
  const commHtml = doc.comments.length ? doc.comments.map(c => `<div class="comment-item"><div class="comment-avatar"><i class="fas fa-user"></i></div><div class="comment-content"><div class="comment-name">${c.byName}</div><div class="comment-text">${c.text}</div><div class="comment-time">${new Date(c.at).toLocaleString('th-TH')}</div></div></div>`).join('') : '';

  const canComment = state.user.role === 'admin' || state.user.role === 'secretary' || doc.assignedTo.includes(state.user.id);
  const commentInput = canComment ? `
    <div class="comment-input-area" style="margin-top:16px">
      <h4 style="font-size:14px;margin-bottom:8px"><i class="fas fa-comment-dots" style="color:var(--accent-green)"></i> เพิ่มความคิดเห็น</h4>
      <div style="display:flex;gap:10px;align-items:flex-start">
        <textarea id="commentText" rows="2" placeholder="พิมพ์ความคิดเห็น..." style="flex:1;padding:10px 14px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:inherit;resize:vertical"></textarea>
        <button class="btn btn-primary" id="btnSubmitComment" data-docid="${doc.id}" style="height:fit-content"><i class="fas fa-paper-plane"></i> ส่ง</button>
      </div>
    </div>` : '';

  const downloadButtons = doc.fileStorageName ? `
    <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-secondary" id="btnDownloadOrig" data-id="${doc.id}"><i class="fas fa-download"></i> ดาวน์โหลดต้นฉบับ</button>
      ${doc.signatures && doc.signatures.length ? `
        <button class="btn btn-primary" id="btnDownloadStamped" data-id="${doc.id}" style="background:linear-gradient(135deg,#10b981 0%,#06b6d4 100%);border:none;box-shadow:0 4px 14px rgba(16,185,129,0.35)">
          <i class="fas fa-file-signature"></i> ดาวน์โหลด PDF พร้อมประทับลายเซ็นจริง ⭐
        </button>
      ` : ''}
    </div>
  ` : '';

  let workflowHtml = '';
  if (doc.approvalWorkflow && doc.approvalWorkflow.length > 0) {
    const stepsHtml = doc.approvalWorkflow.map((w, index) => {
      let statusBadge = '';
      if (w.status === 'approved') {
        statusBadge = `<span style="background:#e6f4ea;color:#137333;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600"><i class="fas fa-check"></i> อนุมัติแล้ว</span>`;
      } else if (w.status === 'rejected') {
        statusBadge = `<span style="background:#fce8e6;color:#c5221f;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600"><i class="fas fa-times"></i> ปฏิเสธ</span>`;
      } else {
        statusBadge = `<span style="background:#f1f3f4;color:#5f6368;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600">รออนุมัติ</span>`;
      }
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
      </div>
      `;
    }).join('');
    workflowHtml = `<div style="margin-top:24px;background:#fffaf3;border:1px solid #fbe3d2;border-radius:12px;padding:20px"><h4 style="font-size:14px;margin-bottom:20px;color:var(--text-primary)"><i class="fas fa-route" style="color:var(--accent-orange)"></i> เส้นทางการอนุมัติ</h4>${stepsHtml}</div>`;
  }

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-header"><h3><i class="fas fa-file-alt"></i> ${doc.title}</h3><button class="modal-close" id="btnCloseModal"><i class="fas fa-times"></i></button></div>
    <div class="modal-body">
      <div class="doc-detail">
        <div class="doc-detail-item"><div class="doc-detail-label">หมวดหมู่</div><div class="doc-detail-value">${doc.category}</div></div>
        <div class="doc-detail-item"><div class="doc-detail-label">สถานะ</div><div class="doc-detail-value"><span class="status-badge ${statusMap[doc.status]}">${doc.statusText}</span></div></div>
        <div class="doc-detail-item"><div class="doc-detail-label">ผู้สร้าง</div><div class="doc-detail-value">${doc.uploadedByName}</div></div>
        <div class="doc-detail-item"><div class="doc-detail-label">วันที่สร้าง</div><div class="doc-detail-value">${new Date(doc.createdAt).toLocaleString('th-TH')}</div></div>
        <div class="doc-detail-item doc-detail-full"><div class="doc-detail-label">คำอธิบาย</div><div class="doc-detail-value">${doc.description}</div></div>
        ${doc.deadline ? `<div class="doc-detail-item"><div class="doc-detail-label">กำหนดส่ง</div><div class="doc-detail-value">${new Date(doc.deadline).toLocaleDateString('th-TH')}</div></div>` : ''}
        ${doc.expiryDate ? `<div class="doc-detail-item"><div class="doc-detail-label">วันหมดอายุ</div><div class="doc-detail-value" style="color:${new Date(doc.expiryDate) < new Date() ? 'var(--accent-red)' : 'var(--accent-orange)'}">${new Date(doc.expiryDate).toLocaleDateString('th-TH')}</div></div>` : ''}
        <div class="doc-detail-item"><div class="doc-detail-label">เวอร์ชัน</div><div class="doc-detail-value">v${doc.version || 1}</div></div>
        ${doc.fileName ? `<div class="doc-detail-item"><div class="doc-detail-label">ไฟล์</div><div class="doc-detail-value"><i class="fas fa-file-pdf" style="color:var(--accent-red)"></i> ${doc.fileName} (${(doc.fileSize / 1024 / 1024).toFixed(2)} MB)</div></div>` : ''}
      </div>
      ${downloadButtons}
      ${doc.versionHistory && doc.versionHistory.length ? `<div style="margin-top:16px"><h4 style="font-size:14px;margin-bottom:8px"><i class="fas fa-code-branch" style="color:var(--accent-orange)"></i> ประวัติเวอร์ชัน</h4>${doc.versionHistory.map(v => `<div style="padding:8px 12px;background:var(--bg-input);border-radius:var(--radius-sm);margin-bottom:6px;font-size:13px"><strong>v${v.version}</strong> — ${v.fileName} — ${new Date(v.uploadedAt).toLocaleString('th-TH')}</div>`).join('')}</div>` : ''}
      ${workflowHtml}
      <div style="margin-top:20px"><h4 style="font-size:14px;margin-bottom:8px"><i class="fas fa-signature" style="color:var(--accent-purple)"></i> ลายเซ็นที่ประทับลงในเอกสาร</h4>${sigHtml}</div>
      <div class="doc-comments" style="margin-top:16px"><h4 style="font-size:14px;margin-bottom:8px"><i class="fas fa-comments" style="color:var(--accent-cyan)"></i> ความคิดเห็น (${doc.comments.length})</h4>${commHtml || '<p style="color:var(--text-muted);font-size:13px">ยังไม่มีความคิดเห็น</p>'}</div>
      ${commentInput}
    </div>
    <div class="modal-footer">${getDocActions(doc) ? `<div class="btn-group">${getDocActions(doc)}</div>` : ''}<button class="btn btn-secondary" id="btnCloseModalFooter">ปิด</button></div>`;

  modal.style.display = 'flex';

  document.getElementById('btnCloseModal').onclick = () => modal.style.display = 'none';
  document.getElementById('btnCloseModalFooter').onclick = () => modal.style.display = 'none';
  
  const btnComment = document.getElementById('btnSubmitComment');
  if (btnComment) {
    btnComment.onclick = () => addComment(doc.id);
  }
  const btnDownloadOrig = document.getElementById('btnDownloadOrig');
  if (btnDownloadOrig) {
    btnDownloadOrig.onclick = () => downloadDoc(doc.id);
  }
  const btnDownloadStamped = document.getElementById('btnDownloadStamped');
  if (btnDownloadStamped) {
    btnDownloadStamped.onclick = () => downloadStampedPdf(doc.id);
  }

  // Handle action buttons inside modal (e.g. sign, approve, submit, delete)
  const modalFooterActions = modal.querySelectorAll('.modal-footer [data-action]');
  modalFooterActions.forEach(btn => {
    btn.onclick = () => {
      const act = btn.dataset.action;
      const id = btn.dataset.id || doc.id;
      const title = btn.dataset.title || doc.title;
      modal.style.display = 'none';
      if (act === 'sign') {
        openSignModal(id, title, () => {
          loadDocuments();
          viewDocument(id);
        });
      } else if (act === 'approve') {
        approveDoc(id).then(() => viewDocument(id));
      } else if (act === 'reject') {
        rejectDoc(id).then(() => viewDocument(id));
      } else if (act === 'submit') {
        submitDoc(id).then(() => viewDocument(id));
      } else if (act === 'delete') {
        deleteDoc(id);
      }
    };
  });
}

export async function addComment(docId) {
  const textEl = document.getElementById('commentText');
  if (!textEl) return;
  const text = textEl.value.trim();
  if (!text) { toast('กรุณาพิมพ์ความคิดเห็น', 'error'); return; }
  const data = await api(`/api/documents/${docId}/comment`, { method: 'POST', body: { text } });
  if (data.error) { toast(data.error, 'error'); return; }
  toast('เพิ่มความคิดเห็นเรียบร้อย', 'success');
  viewDocument(docId);
}

export async function submitDoc(id) {
  await api(`/api/documents/${id}/submit`, { method: 'PUT' });
  toast('ส่งอนุมัติเรียบร้อย', 'success');
  loadDocuments();
}

export async function approveDoc(id) {
  await api(`/api/documents/${id}/approve`, { method: 'PUT' });
  toast('อนุมัติเอกสารเรียบร้อย', 'success');
  loadDocuments();
}

export async function rejectDoc(id) {
  const comment = prompt('กรุณาระบุเหตุผลการปฏิเสธ:');
  if (!comment) return;
  await api(`/api/documents/${id}/reject`, { method: 'PUT', body: { reason: comment } });
  toast('ปฏิเสธเอกสารเรียบร้อย', 'info');
  loadDocuments();
}

export async function deleteDoc(id) {
  if (!confirm('ยืนยันลบเอกสาร?')) return;
  await api(`/api/documents/${id}`, { method: 'DELETE' });
  toast('ลบเอกสารเรียบร้อย', 'success');
  loadDocuments();
}

export async function downloadDoc(id) {
  window.open(`/api/documents/${id}/download`, '_blank');
}
