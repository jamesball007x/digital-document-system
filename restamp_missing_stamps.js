/**
 * Script: restamp_missing_stamps.js
 * Fix documents that have signatureData but no stampImage embedded on PDF
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'backend/.env' });
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'docms_db'
  });

  const uploadsDir = path.resolve(__dirname, 'uploads');

  // Find all signed documents where signatures exist but stampImage is null/missing
  const [allDocs] = await conn.query(
    "SELECT id, title, fileStorageName, signatures FROM documents WHERE status = 'signed' AND signatures IS NOT NULL AND signatures != '[]'"
  );

  console.log(`Found ${allDocs.length} signed documents to check...`);

  let stamped = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of allDocs) {
    let sigs = [];
    try {
      sigs = typeof row.signatures === 'string' ? JSON.parse(row.signatures) : row.signatures;
    } catch (e) {
      console.log(`[SKIP] ${row.title}: Invalid signatures JSON`);
      skipped++;
      continue;
    }

    if (!Array.isArray(sigs) || sigs.length === 0) {
      skipped++;
      continue;
    }

    // Check if any sig is missing stampImage
    const needsRestamp = sigs.some(s => !s.stampImage);
    if (!needsRestamp) {
      console.log(`[OK] ${row.title}: Already has stampImage`);
      skipped++;
      continue;
    }

    // Check file exists
    const filePath = path.join(uploadsDir, row.fileStorageName);
    if (!fs.existsSync(filePath) || !filePath.toLowerCase().endsWith('.pdf')) {
      console.log(`[SKIP] ${row.title}: File not found or not PDF`);
      skipped++;
      continue;
    }

    console.log(`[STAMP] Processing: ${row.title} (${sigs.length} signatures)...`);

    try {
      const existingPdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();

      let embeddedCount = 0;

      for (const targetPage of pages) {
        const { width, height } = targetPage.getSize();
        
        for (let i = 0; i < sigs.length; i++) {
          const sig = sigs[i];
          const imgData = sig.stampImage || sig.signatureData;

          if (!imgData || !imgData.startsWith('data:image')) {
            // Draw text-based stamp box as fallback
            const stampWidth = 200;
            const stampHeight = 80;
            const xPos = width - stampWidth - 20;
            const yPos = 20 + (i * (stampHeight + 10));

            targetPage.drawRectangle({
              x: xPos, y: yPos, width: stampWidth, height: stampHeight,
              borderColor: rgb(0.15, 0.39, 0.92), borderWidth: 1.5,
              color: rgb(0.97, 0.98, 1)
            });
            targetPage.drawRectangle({
              x: xPos, y: yPos + stampHeight - 20, width: stampWidth, height: 20,
              color: rgb(0.13, 0.30, 0.72)
            });

            try {
              const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
              const font2 = await pdfDoc.embedFont(StandardFonts.Helvetica);
              targetPage.drawText('DIGITALLY SIGNED', {
                x: xPos + 6, y: yPos + stampHeight - 14, size: 8,
                font, color: rgb(1, 1, 1)
              });
              const signerAscii = (sig.signedByName || 'Signer').replace(/[^\x00-\x7F]/g, '?');
              targetPage.drawText(`By: ${signerAscii}`, {
                x: xPos + 6, y: yPos + stampHeight - 36, size: 8, font: font2, color: rgb(0.1, 0.1, 0.4)
              });
              const dateStr = sig.signedAt ? new Date(sig.signedAt).toLocaleDateString('en-GB') : 'N/A';
              targetPage.drawText(`Date: ${dateStr}`, {
                x: xPos + 6, y: yPos + stampHeight - 50, size: 7, font: font2, color: rgb(0.3, 0.3, 0.3)
              });
              const certId = (sig.certificateId || 'CERT').replace(/[^\x00-\x7F]/g, '?');
              targetPage.drawText(`Cert: ${certId}`, {
                x: xPos + 6, y: yPos + stampHeight - 64, size: 7, font: font2, color: rgb(0.3, 0.3, 0.3)
              });
            } catch (textErr) {
              // ignore font errors
            }
            embeddedCount++;
            continue;
          }

          try {
            const base64Data = imgData.split(',')[1];
            const imgBuffer = Buffer.from(base64Data, 'base64');
            const isPng = imgData.includes('png');
            const embeddedImg = isPng ? await pdfDoc.embedPng(imgBuffer) : await pdfDoc.embedJpg(imgBuffer);

            const stampWidth = 210;
            const stampHeight = 88;
            const xPos = width - stampWidth - 25;
            const yPos = 25 + (i * (stampHeight + 12));

            targetPage.drawImage(embeddedImg, { x: xPos, y: yPos, width: stampWidth, height: stampHeight });
            embeddedCount++;
          } catch (imgErr) {
            console.warn(`  Image embed error for sig ${i}:`, imgErr.message);
          }
        }
      }

      const stampedBytes = await pdfDoc.save();
      fs.writeFileSync(filePath, Buffer.from(stampedBytes));
      console.log(`  ✅ Stamped ${embeddedCount} signature(s) on ${pages.length} pages - ${row.title}`);
      stamped++;
    } catch (err) {
      console.error(`  ❌ Error stamping ${row.title}:`, err.message);
      errors++;
    }
  }

  console.log(`\n=== Done: ${stamped} stamped, ${skipped} skipped, ${errors} errors ===`);
  await conn.end();
}

run().catch(console.error);
