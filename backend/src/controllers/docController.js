const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb } = require('pdf-lib');
const db = require('../config/db');
const { uploadsDir } = require('../config/multer');
const { logActivity, createNotification, checkDocumentExpiry } = require('../services/activityService');
const { formatDoc, sanitize, fixMojibake } = require('../services/cryptoService');

exports.getDocuments = async (req, res) => {
  try {
    await checkDocumentExpiry();
    const user = req.session.user;
    const docs = await db.query('SELECT * FROM documents ORDER BY createdAt DESC');
    let documents = docs.map(formatDoc);

    let filtered = [];
    if (user.role === 'admin' || user.role === 'executive' || user.role === 'secretary') {
      filtered = documents;
    } else {
      const granted = await db.query('SELECT docId FROM document_access WHERE userId = ?', [user.id]);
      const grantedDocIds = granted.map(g => g.docId);
      filtered = documents.filter(d => (d.assignedTo && d.assignedTo.includes(user.id)) || d.uploadedBy === user.id || grantedDocIds.includes(d.id));
    }

    const { search, category, status } = req.query;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(d => (d.title && d.title.toLowerCase().includes(s)) || (d.description && d.description.toLowerCase().includes(s)));
    }
    if (category) filtered = filtered.filter(d => d.category === category);
    if (status) filtered = filtered.filter(d => d.status === status);

    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงเอกสาร' });
  }
};

exports.getAllDocumentsBasic = async (req, res) => {
  try {
    const docs = await db.query('SELECT id, title, category FROM documents ORDER BY createdAt DESC');
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.getDocumentById = async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    res.json(formatDoc(docs[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.createDocument = async (req, res) => {
  try {
    const { title, description, category, assignedTo, priority, deadline, expiryDate } = req.body;

    let assignedList = [];
    if (assignedTo) {
      assignedList = typeof assignedTo === 'string' ? JSON.parse(assignedTo) : assignedTo;
    }

    const rawOriginalName = req.file ? (Buffer.from(req.file.originalname, 'latin1').toString('utf8')) : '';

    const newDoc = {
      id: 'doc' + Date.now(),
      title: sanitize(title),
      description: sanitize(description),
      category: category || 'ทั่วไป',
      fileName: fixMojibake(rawOriginalName),
      fileStorageName: req.file ? req.file.filename : '',
      fileSize: req.file ? req.file.size : 0,
      uploadedBy: req.session.user.id,
      uploadedByName: req.session.user.name,
      assignedTo: assignedList,
      status: 'draft',
      statusText: 'ฉบับร่าง',
      priority: priority || 'medium',
      version: 1,
      versionHistory: [],
      signatures: [],
      comments: [],
      approvalWorkflow: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deadline: deadline || null,
      expiryDate: expiryDate || null
    };

    const admins = await db.query('SELECT * FROM users WHERE role = "admin" LIMIT 1');
    const execs = await db.query('SELECT * FROM users WHERE role = "executive" LIMIT 1');
    newDoc.approvalWorkflow = [
      { step: 1, role: req.session.user.role, roleName: 'ผู้ขออนุมัติ', name: req.session.user.name, status: 'approved', timestamp: new Date().toISOString() },
      { step: 2, role: 'admin', roleName: 'หัวหน้างาน', name: admins.length ? admins[0].name : 'ไม่พบข้อมูล', status: 'pending', timestamp: null },
      { step: 3, role: 'executive', roleName: 'ผู้อำนวยการ', name: execs.length ? execs[0].name : 'ไม่พบข้อมูล', status: 'pending', timestamp: null }
    ];

    await db.query(
      `INSERT INTO documents (id, title, description, category, fileName, fileStorageName, fileSize, uploadedBy, uploadedByName, assignedTo, status, statusText, priority, version, versionHistory, signatures, comments, approvalWorkflow, createdAt, updatedAt, deadline, expiryDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newDoc.id, newDoc.title, newDoc.description, newDoc.category, newDoc.fileName, newDoc.fileStorageName,
        newDoc.fileSize, newDoc.uploadedBy, newDoc.uploadedByName, JSON.stringify(newDoc.assignedTo),
        newDoc.status, newDoc.statusText, newDoc.priority, newDoc.version, JSON.stringify(newDoc.versionHistory),
        JSON.stringify(newDoc.signatures), JSON.stringify(newDoc.comments), JSON.stringify(newDoc.approvalWorkflow), newDoc.createdAt, newDoc.updatedAt,
        newDoc.deadline, newDoc.expiryDate
      ]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'upload', 'สร้างเอกสารใหม่', newDoc.id, newDoc.title, req.ip);

    res.json({ success: true, document: newDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างเอกสาร' });
  }
};

exports.downloadDocument = async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);
    if (!doc.fileStorageName) return res.status(404).json({ error: 'ไม่มีไฟล์แนบ' });

    const filePath = path.join(uploadsDir, doc.fileStorageName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'ไม่พบไฟล์' });

    await logActivity(req.session.user.id, req.session.user.name, 'download', 'ดาวน์โหลดเอกสาร', doc.id, doc.title, req.ip);

    // If original file is requested explicitly or no signatures exist, send raw file
    if (req.query.original === 'true' || !doc.signatures || !doc.signatures.length) {
      return res.download(filePath, doc.fileName);
    }

    // Embed signature stamps directly on the PDF
    try {
      const existingPdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      if (pages.length > 0) {
        for (const targetPage of pages) {
          const { width } = targetPage.getSize();
          for (let i = 0; i < doc.signatures.length; i++) {
            const sig = doc.signatures[i];
            const stampWidth = 210;
            const stampHeight = 88;
            const xPos = width - stampWidth - 25;
            const yPos = 25 + (i * (stampHeight + 12));

            const imgData = sig.stampImage || sig.signatureData;
            if (imgData && imgData.startsWith('data:image')) {
              try {
                const base64Data = imgData.split(',')[1];
                const imgBuffer = Buffer.from(base64Data, 'base64');
                const isPng = imgData.includes('png');
                const embeddedImg = isPng ? await pdfDoc.embedPng(imgBuffer) : await pdfDoc.embedJpg(imgBuffer);
                
                if (sig.stampImage || imgData.length > 30000) {
                  targetPage.drawImage(embeddedImg, {
                    x: xPos,
                    y: yPos,
                    width: stampWidth,
                    height: stampHeight
                  });
                } else {
                  targetPage.drawRectangle({
                    x: xPos, y: yPos, width: stampWidth, height: stampHeight,
                    borderColor: rgb(0.15, 0.39, 0.92), borderWidth: 1.5, color: rgb(1, 1, 1)
                  });
                  targetPage.drawRectangle({
                    x: xPos, y: yPos + stampHeight - 20, width: stampWidth, height: 20, color: rgb(0.93, 0.96, 1)
                  });
                  targetPage.drawImage(embeddedImg, {
                    x: xPos + 8, y: yPos + 10, width: 80, height: 48
                  });
                }
              } catch (e) {
                console.error('Embed signature image error:', e);
              }
            }
          }
        }

        const stampedPdfBytes = await pdfDoc.save();
        const signedFilename = `[Signed]_${doc.fileName || 'document.pdf'}`;
        const encodedFilename = encodeURIComponent(signedFilename);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
        return res.send(Buffer.from(stampedPdfBytes));
      }
    } catch (stampErr) {
      console.error('Backend PDF Stamping Error:', stampErr);
    }

    res.download(filePath, doc.fileName);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดาวน์โหลดเอกสาร' });
  }
};

exports.uploadVersion = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'กรุณาแนบไฟล์' });

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });

    const doc = formatDoc(docs[0]);
    const history = doc.versionHistory || [];
    history.push({
      version: doc.version,
      fileName: doc.fileName,
      fileStorageName: doc.fileStorageName,
      fileSize: doc.fileSize,
      uploadedBy: doc.uploadedBy,
      uploadedByName: doc.uploadedByName,
      uploadedAt: doc.updatedAt
    });

    const newVersion = (doc.version || 1) + 1;
    const updatedAt = new Date().toISOString();

    const newVersionName = fixMojibake(Buffer.from(req.file.originalname, 'latin1').toString('utf8'));
    await db.query(
      `UPDATE documents SET version = ?, fileName = ?, fileStorageName = ?, fileSize = ?, versionHistory = ?, updatedAt = ? WHERE id = ?`,
      [newVersion, newVersionName, req.file.filename, req.file.size, JSON.stringify(history), updatedAt, doc.id]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'upload_version', `อัพโหลดเวอร์ชัน ${newVersion}`, doc.id, doc.title, req.ip);

    doc.assignedTo.forEach(uid => {
      if (uid !== req.session.user.id) {
        createNotification(uid, 'status_change', 'เอกสารเวอร์ชันใหม่', `เอกสาร "${doc.title}" ถูกอัพเดทเป็นเวอร์ชัน ${newVersion}`, doc.id);
      }
    });

    doc.version = newVersion;
    doc.fileName = req.file.originalname;
    doc.fileStorageName = req.file.filename;
    doc.fileSize = req.file.size;
    doc.versionHistory = history;
    doc.updatedAt = updatedAt;

    res.json({ success: true, document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปโหลดเวอร์ชันใหม่' });
  }
};

exports.getVersions = async (req, res) => {
  try {
    const docs = await db.query('SELECT version, versionHistory FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);
    res.json({
      currentVersion: doc.version,
      history: doc.versionHistory || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.updateDocument = async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });

    const updates = req.body;
    const title = updates.title ? sanitize(updates.title) : docs[0].title;
    const description = updates.description !== undefined ? sanitize(updates.description) : docs[0].description;
    const category = updates.category || docs[0].category;
    const priority = updates.priority || docs[0].priority;
    const deadline = updates.deadline !== undefined ? updates.deadline : docs[0].deadline;
    const expiryDate = updates.expiryDate !== undefined ? updates.expiryDate : docs[0].expiryDate;
    const updatedAt = new Date().toISOString();

    await db.query(
      `UPDATE documents SET title = ?, description = ?, category = ?, priority = ?, deadline = ?, expiryDate = ?, updatedAt = ? WHERE id = ?`,
      [title, description, category, priority, deadline, expiryDate, updatedAt, req.params.id]
    );

    const updated = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    res.json({ success: true, document: formatDoc(updated[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการแก้ไขเอกสาร' });
  }
};

exports.submitDocument = async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    const updatedAt = new Date().toISOString();
    await db.query('UPDATE documents SET status = "pending_approval", statusText = "รออนุมัติ", updatedAt = ? WHERE id = ?', [updatedAt, doc.id]);

    await logActivity(req.session.user.id, req.session.user.name, 'submit', 'ส่งเอกสารเพื่ออนุมัติ', doc.id, doc.title, req.ip);

    doc.assignedTo.forEach(uid => {
      createNotification(uid, 'status_change', 'เอกสารรออนุมัติ', `เอกสาร "${doc.title}" ถูกส่งเพื่อรออนุมัติ`, doc.id);
    });

    doc.status = 'pending_approval';
    doc.statusText = 'รออนุมัติ';
    doc.updatedAt = updatedAt;
    res.json({ success: true, document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.approveDocument = async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    const updatedAt = new Date().toISOString();
    const comments = doc.comments || [];
    if (req.body.comment) {
      comments.push({
        by: req.session.user.id,
        byName: req.session.user.name,
        text: sanitize(req.body.comment),
        at: updatedAt
      });
    }

    let isFullyApproved = true;
    let workflow = doc.approvalWorkflow || [];
    if (workflow.length > 0) {
      const currentStepIndex = workflow.findIndex(w => w.status === 'pending');
      if (currentStepIndex !== -1) {
        workflow[currentStepIndex].status = 'approved';
        workflow[currentStepIndex].name = req.session.user.name;
        workflow[currentStepIndex].timestamp = updatedAt;
        
        if (currentStepIndex < workflow.length - 1) {
          isFullyApproved = false;
        }
      }
    }

    const newStatus = isFullyApproved ? 'approved' : 'pending_approval';
    const newStatusText = isFullyApproved ? 'อนุมัติแล้ว' : 'รออนุมัติตามสายงาน';

    // Record signature and stamp PDF on approval if signature data or saved profile signature exists
    let signatures = doc.signatures || [];
    let sigData = req.body.signatureData;
    let stampImg = req.body.stampImage;
    if (!sigData) {
      const userSigs = await db.query('SELECT * FROM signatures WHERE userId = ? ORDER BY createdAt DESC', [req.session.user.id]);
      if (userSigs.length && userSigs[0].signatureData) {
        sigData = userSigs[0].signatureData;
      }
    }

    if (sigData || stampImg) {
      const certs = await db.query('SELECT * FROM certificates WHERE userId = ? AND certStatus = "active" ORDER BY createdAt DESC', [req.session.user.id]);
      const userCert = certs[0];
      signatures.push({
        signedBy: req.session.user.id,
        signedByName: req.session.user.name,
        signedRoleName: req.session.user.roleName || (req.session.user.role === 'executive' ? 'บริหาร' : 'ผู้มีอำนาจอนุมัติ'),
        signedAt: updatedAt,
        signatureData: sigData || 'signed',
        stampImage: stampImg || null,
        serverTimestamp: updatedAt,
        certificateId: userCert ? userCert.id : 'CERT-' + Date.now().toString(36).toUpperCase(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || 'Unknown Device'
      });

      if (doc.fileStorageName) {
        const filePath = path.join(uploadsDir, doc.fileStorageName);
        if (fs.existsSync(filePath) && filePath.toLowerCase().endsWith('.pdf')) {
          try {
            const existingPdfBytes = fs.readFileSync(filePath);
            const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
            const pages = pdfDoc.getPages();
            if (pages.length > 0) {
              for (const targetPage of pages) {
                const { width } = targetPage.getSize();
                const i = signatures.length - 1;
                const sig = signatures[i];

                const stampWidth = 210;
                const stampHeight = 88;
                const xPos = width - stampWidth - 25;
                const yPos = 25 + (i * (stampHeight + 12));

                const imgData = sig.stampImage || sig.signatureData;
                if (imgData && imgData.startsWith('data:image')) {
                  try {
                    const base64Data = imgData.split(',')[1];
                    const imgBuffer = Buffer.from(base64Data, 'base64');
                    const isPng = imgData.includes('png');
                    const embeddedImg = isPng ? await pdfDoc.embedPng(imgBuffer) : await pdfDoc.embedJpg(imgBuffer);
                    
                    targetPage.drawImage(embeddedImg, {
                      x: xPos,
                      y: yPos,
                      width: stampWidth,
                      height: stampHeight
                    });
                  } catch (imgErr) {
                    console.error('Embed signature image error on approve:', imgErr);
                  }
                }
              }

              const stampedPdfBytes = await pdfDoc.save();
              fs.writeFileSync(filePath, Buffer.from(stampedPdfBytes));
            }
          } catch (stampErr) {
            console.error('Failed to stamp PDF on approve:', stampErr);
          }
        }
      }
    }

    await db.query(
      `UPDATE documents SET status = ?, statusText = ?, signatures = ?, comments = ?, approvalWorkflow = ?, updatedAt = ? WHERE id = ?`,
      [newStatus, newStatusText, JSON.stringify(signatures), JSON.stringify(comments), JSON.stringify(workflow), updatedAt, doc.id]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'approve', isFullyApproved ? 'อนุมัติเอกสารเสร็จสิ้น' : 'อนุมัติเอกสาร (ตามสายงาน)', doc.id, doc.title, req.ip);

    createNotification(doc.uploadedBy, 'status_change', isFullyApproved ? 'เอกสารได้รับอนุมัติ' : 'เอกสารผ่านการอนุมัติตามสายงาน', `เอกสาร "${doc.title}" ${isFullyApproved ? 'ได้รับอนุมัติเสร็จสิ้นแล้ว' : 'ได้รับการอนุมัติขั้นต้น และรอการอนุมัติขั้นต่อไป'}`, doc.id);

    doc.status = newStatus;
    doc.statusText = newStatusText;
    doc.signatures = signatures;
    doc.comments = comments;
    doc.approvalWorkflow = workflow;
    doc.updatedAt = updatedAt;
    res.json({ success: true, document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.rejectDocument = async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    const reason = sanitize(req.body.reason || req.body.comment || '');
    const updatedAt = new Date().toISOString();
    const comments = doc.comments || [];
    if (reason) {
      comments.push({
        by: req.session.user.id,
        byName: req.session.user.name,
        text: `[ปฏิเสธ] ${reason}`,
        at: updatedAt
      });
    }

    let workflow = doc.approvalWorkflow || [];
    if (workflow.length > 0) {
      const currentStepIndex = workflow.findIndex(w => w.status === 'pending');
      if (currentStepIndex !== -1) {
        workflow[currentStepIndex].status = 'rejected';
        workflow[currentStepIndex].name = req.session.user.name;
        workflow[currentStepIndex].timestamp = updatedAt;
      }
    }

    await db.query(
      `UPDATE documents SET status = "rejected", statusText = "ปฏิเสธ", rejectReason = ?, comments = ?, approvalWorkflow = ?, updatedAt = ? WHERE id = ?`,
      [reason, JSON.stringify(comments), JSON.stringify(workflow), updatedAt, doc.id]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'reject', 'ปฏิเสธเอกสาร', doc.id, doc.title, req.ip);

    createNotification(doc.uploadedBy, 'status_change', 'เอกสารไม่ได้รับอนุมัติ', `เอกสาร "${doc.title}" ถูกปฏิเสธ: ${reason}`, doc.id);

    doc.status = 'rejected';
    doc.statusText = 'ปฏิเสธ';
    doc.rejectReason = reason;
    doc.comments = comments;
    doc.approvalWorkflow = workflow;
    doc.updatedAt = updatedAt;
    res.json({ success: true, document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.signDocument = async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    // ✅ เพิ่ม: ดึงลายเซ็นที่ user บันทึกไว้ล่วงหน้า จากตาราง signatures
    const savedSigs = await db.query(
      'SELECT signatureData FROM signatures WHERE userId = ?',
      [req.session.user.id]
    );
    const userSignatureData = savedSigs.length ? savedSigs[0].signatureData : null;

    const timestamp = new Date().toISOString();
    const certs = await db.query('SELECT * FROM certificates WHERE userId = ? AND certStatus = "active" ORDER BY createdAt DESC', [req.session.user.id]);
    const userCert = certs[0];

    const signatures = doc.signatures || [];
    signatures.push({
      signedBy: req.session.user.id,
      signedByName: req.session.user.name,
      signedRoleName: req.session.user.roleName || (req.session.user.role === 'executive' ? 'บริหาร' : 'ผู้มีอำนาจลงนาม'),
      signedAt: timestamp,
      // ✅ แก้: ถ้า frontend ไม่ได้ส่งมา ให้ fallback ไปใช้ลายเซ็นที่บันทึกไว้แทน
      signatureData: req.body.signatureData || userSignatureData || 'signed',
      stampImage: req.body.stampImage || userSignatureData || null,
      serverTimestamp: timestamp,
      certificateId: userCert ? userCert.id : 'CERT-' + Date.now().toString(36).toUpperCase(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'Unknown Device'
    });

    let workflow = doc.approvalWorkflow || [];
    if (workflow.length > 0) {
      const currentStepIndex = workflow.findIndex(w => w.status === 'pending');
      if (currentStepIndex !== -1) {
        workflow[currentStepIndex].status = 'approved';
        workflow[currentStepIndex].name = req.session.user.name;
        workflow[currentStepIndex].timestamp = timestamp;
      }
    }

    // Permanently stamp PDF file on disk
    if (doc.fileStorageName) {
      const filePath = path.join(uploadsDir, doc.fileStorageName);
      if (fs.existsSync(filePath) && filePath.toLowerCase().endsWith('.pdf')) {
        try {
          const existingPdfBytes = fs.readFileSync(filePath);
          const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
          const pages = pdfDoc.getPages();
          if (pages.length > 0) {
            for (const targetPage of pages) {
              const { width } = targetPage.getSize();
              const i = signatures.length - 1;
              const sig = signatures[i];

              const stampWidth = 210;
              const stampHeight = 88;
              const xPos = width - stampWidth - 25;
              const yPos = 25 + (i * (stampHeight + 12));

              const imgData = sig.stampImage || sig.signatureData;
              if (imgData && imgData.startsWith('data:image')) {
                try {
                  const base64Data = imgData.split(',')[1];
                  const imgBuffer = Buffer.from(base64Data, 'base64');
                  const isPng = imgData.includes('png');
                  const embeddedImg = isPng ? await pdfDoc.embedPng(imgBuffer) : await pdfDoc.embedJpg(imgBuffer);
                  
                  if (sig.stampImage || imgData.length > 30000) {
                    targetPage.drawImage(embeddedImg, {
                      x: xPos,
                      y: yPos,
                      width: stampWidth,
                      height: stampHeight
                    });
                  } else {
                    targetPage.drawRectangle({
                      x: xPos, y: yPos, width: stampWidth, height: stampHeight,
                      borderColor: rgb(0.15, 0.39, 0.92), borderWidth: 1.5, color: rgb(1, 1, 1)
                    });
                    targetPage.drawRectangle({
                      x: xPos, y: yPos + stampHeight - 20, width: stampWidth, height: 20, color: rgb(0.93, 0.96, 1)
                    });
                    targetPage.drawImage(embeddedImg, {
                      x: xPos + 8, y: yPos + 10, width: 80, height: 48
                    });
                  }
                } catch (imgErr) {
                  console.error('Embed signature image error:', imgErr);
                }
              }
            }

            const stampedPdfBytes = await pdfDoc.save();
            fs.writeFileSync(filePath, Buffer.from(stampedPdfBytes));
          }
        } catch (stampErr) {
          console.error('Failed to permanently stamp PDF on disk:', stampErr);
        }
      }
    }

    await db.query(
      `UPDATE documents SET signatures = ?, status = "signed", statusText = "ลงนามแล้ว", approvalWorkflow = ?, updatedAt = ? WHERE id = ?`,
      [JSON.stringify(signatures), JSON.stringify(workflow), timestamp, doc.id]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'sign', 'ลงนามเอกสาร', doc.id, doc.title, req.ip);

    createNotification(doc.uploadedBy, 'status_change', 'เอกสารได้รับการลงนาม', `เอกสาร "${doc.title}" ได้รับการลงนามโดย ${req.session.user.name}`, doc.id);

    doc.signatures = signatures;
    doc.approvalWorkflow = workflow;
    doc.status = 'signed';
    doc.statusText = 'ลงนามแล้ว';
    doc.updatedAt = timestamp;
    res.json({ success: true, document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลงนาม' });
  }
};

exports.shareDocument = async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) return res.status(400).json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' });

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    const currentAssigned = new Set(doc.assignedTo || []);
    userIds.forEach(uid => currentAssigned.add(uid));
    const newAssigned = Array.from(currentAssigned);

    const updatedAt = new Date().toISOString();
    await db.query('UPDATE documents SET assignedTo = ?, updatedAt = ? WHERE id = ?', [JSON.stringify(newAssigned), updatedAt, doc.id]);

    userIds.forEach(uid => {
      createNotification(uid, 'status_change', 'ได้รับสิทธิ์เอกสาร', `คุณได้รับสิทธิ์เข้าถึงเอกสาร "${doc.title}"`, doc.id);
    });

    res.json({ success: true, assignedTo: newAssigned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = docs[0];

    if (doc.fileStorageName) {
      const p = path.join(uploadsDir, doc.fileStorageName);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    await db.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM document_access WHERE docId = ?', [req.params.id]);
    await db.query('DELETE FROM access_requests WHERE documentId = ?', [req.params.id]);

    await logActivity(req.session.user.id, req.session.user.name, 'delete_document', 'ลบเอกสาร', doc.id, doc.title, req.ip);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบเอกสาร' });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'กรุณากรอกข้อความความคิดเห็น' });

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    const comments = doc.comments || [];
    const newComment = {
      by: req.session.user.id,
      byName: req.session.user.name,
      text: sanitize(text),
      at: new Date().toISOString()
    };
    comments.push(newComment);

    await db.query('UPDATE documents SET comments = ? WHERE id = ?', [JSON.stringify(comments), doc.id]);

    res.json({ success: true, comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเพิ่มความคิดเห็น' });
  }
};
