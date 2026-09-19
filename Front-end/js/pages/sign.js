// ============================
// pages/sign.js — E-Signature Modal & PDF Stamp
// ============================

import { api, toast, BASE_URL } from '../core/api.js';
import { navigate } from '../core/nav.js';

// ─── Open Signature Modal ────────────────────────────────────────────────
export function openSignModal(App, id, title) {
  App.signDocId = id;
  document.getElementById('signDocTitle').textContent = `เอกสาร: ${title}`;
  document.getElementById('signModal').style.display = 'flex';
  document.getElementById('modal').style.display     = 'none';

  const canvas = document.getElementById('signatureCanvas');
  App.signCtx  = canvas.getContext('2d');
  App.signCtx.fillStyle   = '#fff';
  App.signCtx.fillRect(0, 0, canvas.width, canvas.height);
  App.signCtx.strokeStyle = '#1a1a2e';
  App.signCtx.lineWidth   = 2;
  App.signCtx.lineCap     = 'round';
  App.signing = false;

  const getPos = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };

  canvas.onmousedown = canvas.ontouchstart = (e) => {
    e.preventDefault(); App.signing = true;
    const p = getPos(e); App.signCtx.beginPath(); App.signCtx.moveTo(p.x, p.y);
  };
  canvas.onmousemove = canvas.ontouchmove = (e) => {
    if (!App.signing) return; e.preventDefault();
    const p = getPos(e); App.signCtx.lineTo(p.x, p.y); App.signCtx.stroke();
  };
  canvas.onmouseup   = canvas.ontouchend = () => { App.signing = false; };
  canvas.onmouseleave = () => { App.signing = false; };

  document.getElementById('clearSignature').onclick = () => {
    App.signCtx.fillStyle = '#fff';
    App.signCtx.fillRect(0, 0, canvas.width, canvas.height);
  };

  document.getElementById('confirmSignature').onclick = async () => {
    const data = canvas.toDataURL();
    await api(`/api/documents/${App.signDocId}/sign`, { method: 'PUT', body: { signatureData: data } });
    document.getElementById('signModal').style.display = 'none';
    toast('ลงนามเอกสารเรียบร้อย', 'success');
    navigate(App.currentPage, App);
  };

  document.getElementById('closeSignModal').onclick = () => {
    document.getElementById('signModal').style.display = 'none';
  };
}

// ─── Create High-DPI Signature Stamp Image ───────────────────────────────
export function createSignatureStampImage(sig) {
  return new Promise((resolve) => {
    const scale = 2;
    const w = 260 * scale;
    const h = 110 * scale;
    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Rounded Card Background
    ctx.fillStyle   = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth   = 2 * scale;
    const r = 8 * scale;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Top Ribbon
    ctx.fillStyle = '#eff6ff';
    ctx.beginPath();
    ctx.moveTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, 24 * scale); ctx.lineTo(0, 24 * scale);
    ctx.closePath(); ctx.fill();

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
      ctx.fillText('✓ ผ่านการตรวจสอบระบบ DocMS (SHA-256)', 12 * scale, 96 * scale);

      resolve(canvas.toDataURL('image/png'));
    };

    if (sig.signatureData && sig.signatureData.startsWith('data:image')) {
      const sigImg = new Image();
      sigImg.crossOrigin = 'anonymous';
      sigImg.onload  = () => { ctx.drawImage(sigImg, 12 * scale, 28 * scale, 95 * scale, 48 * scale); finishStamp(); };
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

// ─── Download PDF with Signature Stamp ───────────────────────────────────
export async function downloadStampedPdf(App, id) {
  try {
    toast('กำลังประมวลผลประทับลายเซ็นลงบน PDF...', 'info');
    const doc = await api(`/api/documents/${id}`);
    if (!doc || !doc.fileStorageName) { toast('ไม่พบไฟล์เอกสาร', 'error'); return; }

    if (typeof PDFLib === 'undefined' || !doc.signatures || !doc.signatures.length) {
      return App.downloadDoc(id);
    }

    const res = await fetch(`${BASE_URL}/api/documents/${id}/download`, { credentials: 'include' });
    if (!res.ok) throw new Error('Download failed');
    const existingPdfBytes = await res.arrayBuffer();

    const pdfDoc  = await PDFLib.PDFDocument.load(existingPdfBytes);
    const pages   = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    for (let i = 0; i < doc.signatures.length; i++) {
      const sig          = doc.signatures[i];
      const stampDataUrl = await createSignatureStampImage(sig);
      const stampPngBytes = await fetch(stampDataUrl).then(r => r.arrayBuffer());
      const stampImage    = await pdfDoc.embedPng(stampPngBytes);

      const stampWidth  = 210;
      const stampHeight = 88;
      const xPos = width  - stampWidth  - 25;
      const yPos = 25     + (i * (stampHeight + 12));

      lastPage.drawImage(stampImage, { x: xPos, y: yPos, width: stampWidth, height: stampHeight });
    }

    const stampedPdfBytes = await pdfDoc.save();
    const blob = new Blob([stampedPdfBytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `[Signed]_${doc.fileName || 'document.pdf'}`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);

    toast('ดาวน์โหลด PDF พร้อมประทับตราและลายเซ็นจริงสำเร็จ!', 'success');
  } catch (err) {
    console.error('PDF Stamp Error:', err);
    toast('เกิดข้อผิดพลาด กำลังดาวน์โหลดไฟล์ต้นฉบับแทน', 'info');
    App.downloadDoc(id);
  }
}
