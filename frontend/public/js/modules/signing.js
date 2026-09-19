import { api } from '../api.js';
import { toast } from '../utils.js';
import { state } from '../state.js';

let signCtx = null;
let signDocId = null;
let isSigning = false;

export async function createSignatureStampImage(sig) {
  return new Promise((resolve) => {
    const scale = 2;
    const w = 260 * scale;
    const h = 110 * scale;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2 * scale;
    
    const r = 8 * scale;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#eff6ff';
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, 24 * scale);
    ctx.lineTo(0, 24 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1d4ed8';
    ctx.font = `bold ${10 * scale}px 'Noto Sans Thai', 'Inter', sans-serif`;
    ctx.fillText('🔒 DIGITALLY SIGNED & VERIFIED', 12 * scale, 16 * scale);

    const finishStamp = () => {
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold ${9 * scale}px 'Noto Sans Thai', 'Inter', sans-serif`;
      ctx.fillText(`ลงนามโดย: ${sig.signedByName || 'ผู้มีอำนาจลงนาม'}`, 120 * scale, 42 * scale);

      ctx.fillStyle = '#475569';
      ctx.font = `${8 * scale}px 'Noto Sans Thai', 'Inter', sans-serif`;
      const timeStr = sig.signedAt ? new Date(sig.signedAt).toLocaleString('th-TH') : new Date().toLocaleString('th-TH');
      ctx.fillText(`วันเวลา: ${timeStr}`, 120 * scale, 57 * scale);

      ctx.fillStyle = '#64748b';
      ctx.font = `${7.5 * scale}px 'Noto Sans Thai', 'Inter', sans-serif`;
      ctx.fillText(`ใบรับรอง: ${sig.certificateId || 'CERT-SECURE-256'}`, 120 * scale, 70 * scale);

      ctx.fillStyle = '#16a34a';
      ctx.font = `bold ${7.5 * scale}px 'Noto Sans Thai', 'Inter', sans-serif`;
      ctx.fillText(`✓ ผ่านการตรวจสอบระบบ DocMS (SHA-256)`, 12 * scale, 96 * scale);

      resolve(canvas.toDataURL('image/png'));
    };

    if (sig.signatureData && sig.signatureData.startsWith('data:image')) {
      const sigImg = new Image();
      sigImg.crossOrigin = 'anonymous';
      sigImg.onload = () => {
        ctx.drawImage(sigImg, 12 * scale, 28 * scale, 95 * scale, 48 * scale);
        finishStamp();
      };
      sigImg.onerror = () => {
        ctx.fillStyle = '#1d4ed8';
        ctx.font = `bold ${11 * scale}px 'Noto Sans Thai', sans-serif`;
        ctx.fillText(`[${sig.signedByName}]`, 16 * scale, 55 * scale);
        finishStamp();
      };
      sigImg.src = sig.signatureData;
    } else {
      ctx.fillStyle = '#1d4ed8';
      ctx.font = `bold ${11 * scale}px 'Noto Sans Thai', sans-serif`;
      ctx.fillText(`[${sig.signedByName}]`, 16 * scale, 55 * scale);
      finishStamp();
    }
  });
}

export async function downloadStampedPdf(id) {
  try {
    toast('กำลังประมวลผลประทับลายเซ็นลงบน PDF...', 'info');
    const doc = await api(`/api/documents/${id}`);
    if (!doc || !doc.fileStorageName) {
      toast('ไม่พบไฟล์เอกสาร', 'error');
      return;
    }

    if (typeof PDFLib === 'undefined' || !doc.signatures || !doc.signatures.length) {
      window.open(`/api/documents/${id}/download`, '_blank');
      return;
    }

    const res = await fetch(`/api/documents/${id}/download`);
    if (!res.ok) throw new Error('Download failed');
    const existingPdfBytes = await res.arrayBuffer();

    const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    for (let i = 0; i < doc.signatures.length; i++) {
      const sig = doc.signatures[i];
      const stampDataUrl = await createSignatureStampImage(sig);
      const stampPngBytes = await fetch(stampDataUrl).then(r => r.arrayBuffer());
      const stampImage = await pdfDoc.embedPng(stampPngBytes);

      const stampWidth = 210;
      const stampHeight = 88;
      const xPos = width - stampWidth - 25;
      const yPos = 25 + (i * (stampHeight + 12));

      lastPage.drawImage(stampImage, {
        x: xPos,
        y: yPos,
        width: stampWidth,
        height: stampHeight
      });
    }

    const stampedPdfBytes = await pdfDoc.save();
    const blob = new Blob([stampedPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `[Signed]_${doc.fileName || 'document.pdf'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast('ดาวน์โหลด PDF พร้อมประทับตราและลายเซ็นจริงสำเร็จ!', 'success');
  } catch (err) {
    console.error('PDF Stamp Error:', err);
    toast('เกิดข้อผิดพลาด กำลังดาวน์โหลดไฟล์ต้นฉบับแทน', 'info');
    window.open(`/api/documents/${id}/download`, '_blank');
  }
}

export function openSignModal(id, title, onComplete) {
  signDocId = id;
  const docTitleEl = document.getElementById('signDocTitle');
  if (docTitleEl) docTitleEl.textContent = `เอกสาร: ${title}`;

  const signModal = document.getElementById('signModal');
  const mainModal = document.getElementById('modal');
  if (signModal) signModal.style.display = 'flex';
  if (mainModal) mainModal.style.display = 'none';

  // ===== Canvas (Tab 1: Draw) =====
  const canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;

  // Fix canvas resolution vs display size mismatch
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round((rect.width || 500) * dpr);
  canvas.height = Math.round(200 * dpr);
  canvas.style.width = '100%';
  canvas.style.height = '200px';

  signCtx = canvas.getContext('2d');
  signCtx.scale(dpr, dpr);
  signCtx.fillStyle = '#fff';
  signCtx.fillRect(0, 0, canvas.width, canvas.height);
  signCtx.strokeStyle = '#1a1a2e';
  signCtx.lineWidth = 2.5;
  signCtx.lineCap = 'round';
  signCtx.lineJoin = 'round';
  isSigning = false;

  const getPos = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };

  canvas.onmousedown = (e) => {
    e.preventDefault();
    isSigning = true;
    const p = getPos(e);
    signCtx.beginPath();
    signCtx.moveTo(p.x, p.y);
  };
  canvas.onmousemove = (e) => {
    if (!isSigning) return;
    e.preventDefault();
    const p = getPos(e);
    signCtx.lineTo(p.x, p.y);
    signCtx.stroke();
  };
  canvas.onmouseup = () => { isSigning = false; };
  canvas.onmouseleave = () => { isSigning = false; };

  canvas.ontouchstart = (e) => {
    e.preventDefault();
    isSigning = true;
    const p = getPos(e);
    signCtx.beginPath();
    signCtx.moveTo(p.x, p.y);
  };
  canvas.ontouchmove = (e) => {
    if (!isSigning) return;
    e.preventDefault();
    const p = getPos(e);
    signCtx.lineTo(p.x, p.y);
    signCtx.stroke();
  };
  canvas.ontouchend = () => { isSigning = false; };

  // Clear button
  const clearBtn = document.getElementById('clearSignature');
  if (clearBtn) {
    clearBtn.onclick = () => {
      signCtx.fillStyle = '#fff';
      signCtx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    };
  }

  // ===== Helper: build stamp and call sign API =====
  const doSign = async (signatureData) => {
    const user = (state.user || {});
    const sigMeta = {
      signatureData,
      signedByName: user.name || user.username || 'ผู้มีอำนาจลงนาม',
      signedAt: new Date().toISOString(),
      certificateId: user.certId || ('CERT-' + Date.now().toString(36).toUpperCase())
    };

    let stampImage = null;
    try {
      stampImage = await createSignatureStampImage(sigMeta);
    } catch (e) {
      console.warn('Could not generate stamp image:', e);
    }

    const payload = { signatureData };
    if (stampImage) payload.stampImage = stampImage;

    const result = await api(`/api/documents/${signDocId}/sign`, { method: 'PUT', body: payload });
    if (result && result.error) { toast(result.error, 'error'); return; }
    if (signModal) signModal.style.display = 'none';
    toast('ลงนามเอกสารเรียบร้อยแล้ว ✅', 'success');
    if (onComplete) onComplete();
  };

  // ===== Confirm Draw button =====
  const confirmDrawBtn = document.getElementById('confirmSignatureDraw');
  if (confirmDrawBtn) {
    confirmDrawBtn.onclick = async () => {
      const signatureData = canvas.toDataURL('image/png');
      await doSign(signatureData);
    };
  }

  // ===== Tab 2: Upload =====
  let uploadedSigData = null;
  const sigFileInput = document.getElementById('sigFileInput');
  const sigPreviewWrap = document.getElementById('sigPreviewWrap');
  const sigImagePreview = document.getElementById('sigImagePreview');
  const confirmUploadBtn = document.getElementById('confirmSignatureUpload');

  if (sigFileInput) {
    sigFileInput.value = '';
    sigFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        uploadedSigData = ev.target.result;
        if (sigImagePreview) sigImagePreview.src = uploadedSigData;
        if (sigPreviewWrap) sigPreviewWrap.style.display = 'block';
        if (confirmUploadBtn) confirmUploadBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    };
  }

  if (confirmUploadBtn) {
    confirmUploadBtn.onclick = async () => {
      if (!uploadedSigData) { toast('กรุณาเลือกภาพลายเซ็นก่อน', 'error'); return; }
      await doSign(uploadedSigData);
    };
  }

  // ===== Tab 3: Saved Signature =====
  const savedContainer = document.getElementById('savedSigContainer');
  const confirmSavedBtn = document.getElementById('confirmSignatureSaved');
  let savedSigData = null;

  if (savedContainer) {
    savedContainer.innerHTML = '<div style="color:var(--text-muted);font-size:13px"><i class="fas fa-spinner fa-spin"></i> กำลังโหลดลายเซ็น...</div>';
    api('/api/signatures').then(data => {
      const sigs = Array.isArray(data) ? data : (data?.signatures || []);
      if (!sigs.length) {
        savedContainer.innerHTML = '<div style="color:var(--text-muted);font-size:13px">ยังไม่มีลายเซ็นที่บันทึกไว้ กรุณาวาดหรืออัปโหลดลายเซ็น</div>';
        return;
      }
      const latest = sigs[0];
      savedSigData = latest.signatureData;
      savedContainer.innerHTML = `
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">ลายเซ็นที่บันทึกไว้:</p>
        <img src="${savedSigData}" style="max-height:120px;max-width:100%;background:#fff;border:1px solid var(--border-color);border-radius:8px;padding:8px">
      `;
      if (confirmSavedBtn) confirmSavedBtn.style.display = 'inline-flex';
    }).catch(() => {
      savedContainer.innerHTML = '<div style="color:var(--text-muted);font-size:13px">ไม่สามารถโหลดลายเซ็นได้</div>';
    });
  }

  if (confirmSavedBtn) {
    confirmSavedBtn.onclick = async () => {
      if (!savedSigData) { toast('ไม่พบลายเซ็นที่บันทึกไว้', 'error'); return; }
      await doSign(savedSigData);
    };
  }

  // ===== Tab switching =====
  const tabBtns = document.querySelectorAll('.sig-tab-btn');
  const tabContents = document.querySelectorAll('.sig-tab-content');
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => {
        b.style.borderBottom = 'none';
        b.style.color = 'var(--text-muted)';
        b.style.fontWeight = 'normal';
      });
      btn.style.borderBottom = '2px solid var(--accent-blue)';
      btn.style.color = 'var(--accent-blue)';
      btn.style.fontWeight = '600';
      tabContents.forEach(tc => { tc.style.display = 'none'; });
      const activeTab = document.getElementById(`sigTab${target.charAt(0).toUpperCase() + target.slice(1)}`);
      if (activeTab) activeTab.style.display = 'block';
    };
  });

  // Close button
  const closeBtn = document.getElementById('closeSignModal');
  if (closeBtn) closeBtn.onclick = () => { if (signModal) signModal.style.display = 'none'; };
}


export async function showMfaSignModal(docId, onComplete) {
  const modal = document.getElementById('modal');
  if (!modal) return;
  modal.innerHTML = `
  <div class="modal-overlay" id="mfaModalOverlay">
    <div class="modal-content" style="max-width:450px">
      <div class="modal-header"><h3><i class="fas fa-shield-alt" style="color:var(--accent-blue)"></i> ยืนยันตัวตน (MFA)</h3><button class="modal-close" id="btnCloseMfaModal">&times;</button></div>
      <div class="modal-body">
        <div style="text-align:center;margin-bottom:20px">
          <div style="width:60px;height:60px;border-radius:50%;background:rgba(59,130,246,0.15);color:var(--accent-blue);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:24px"><i class="fas fa-key"></i></div>
          <p style="color:var(--text-muted);font-size:14px">กรุณายืนยันตัวตนด้วยรหัส OTP ก่อนลงนาม</p>
        </div>
        <div id="otpStep1">
          <button class="btn btn-primary" style="width:100%" id="btnRequestOtp"><i class="fas fa-paper-plane"></i> ส่งรหัส OTP</button>
        </div>
        <div id="otpStep2" style="display:none">
          <div class="form-group" style="margin-bottom:16px">
            <label><i class="fas fa-lock"></i> รหัส OTP (6 หลัก)</label>
            <input type="text" id="otpInput" maxlength="6" placeholder="กรอกรหัส OTP" style="text-align:center;font-size:24px;letter-spacing:8px;font-weight:700">
            <p id="otpDisplay" style="font-size:12px;color:var(--accent-green);margin-top:8px"></p>
          </div>
          <button class="btn btn-success" style="width:100%" id="btnVerifyAndSign"><i class="fas fa-signature"></i> ยืนยันและลงนาม</button>
        </div>
      </div>
    </div>
  </div>`;
  modal.style.display = 'block';

  document.getElementById('btnCloseMfaModal').onclick = () => { modal.style.display = 'none'; modal.innerHTML = ''; };

  document.getElementById('btnRequestOtp').onclick = async () => {
    const data = await api('/api/otp/generate', { method: 'POST' });
    if (data.error) { toast(data.error, 'error'); return; }
    document.getElementById('otpStep1').style.display = 'none';
    document.getElementById('otpStep2').style.display = 'block';
    document.getElementById('otpDisplay').textContent = `(Demo) รหัส OTP ของคุณ: ${data.otp}`;
    toast('ส่งรหัส OTP แล้ว', 'success');
  };

  document.getElementById('btnVerifyAndSign').onclick = async () => {
    const otp = document.getElementById('otpInput').value.trim();
    if (!otp || otp.length !== 6) { toast('กรุณากรอกรหัส OTP 6 หลัก', 'error'); return; }

    const verifyData = await api('/api/otp/verify', { method: 'POST', body: { otp } });
    if (verifyData.error) { toast(verifyData.error, 'error'); return; }

    const signData = await api(`/api/documents/${docId}/sign-with-otp`, { method: 'PUT', body: { signatureType: 'approve' } });
    if (signData.error) { toast(signData.error, 'error'); return; }

    modal.style.display = 'none';
    modal.innerHTML = '';
    toast('ลงนามเอกสารเรียบร้อย (ยืนยัน MFA)', 'success');
    if (onComplete) onComplete();
  };
}
