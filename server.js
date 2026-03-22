const express = require("express");
const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.get("/", (req, res) => {
  res.send("Server çalışıyor!");
});

function money(value) {
  return `${Number(value || 0).toFixed(2)} ₺`;
}

function safe(value) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildPdfHtml(data) {
  const materialsRows = (data.materials || []).map(item => `
    <tr>
      <td>${safe(item.name)}</td>
      <td>${safe(item.serial)}</td>
      <td>${safe(item.qty)}</td>
      <td>${safe(item.unit)}</td>
      <td>${money(item.unitPrice)}</td>
      <td>${money(item.total)}</td>
    </tr>
  `).join("");

  const faultTypes = (data.faultTypes || []).join(", ");
  const serviceTypes = (data.serviceTypes || []).join(", ");

  return `
  <!DOCTYPE html>
  <html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <title>Servis Raporu</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        color: #111;
        padding: 28px;
        font-size: 12px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #111;
        padding-bottom: 12px;
        margin-bottom: 16px;
      }
      .title {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 6px;
      }
      .sub {
        font-size: 12px;
        line-height: 1.5;
      }
      .section-title {
        margin-top: 20px;
        margin-bottom: 8px;
        font-size: 15px;
        font-weight: 700;
        border-left: 4px solid #111;
        padding-left: 8px;
      }
      .grid-2, .grid-3, .grid-4 {
        display: grid;
        gap: 10px;
        margin-bottom: 10px;
      }
      .grid-2 { grid-template-columns: 1fr 1fr; }
      .grid-3 { grid-template-columns: 1fr 1fr 1fr; }
      .grid-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
      .field {
        border: 1px solid #ccc;
        padding: 8px;
        border-radius: 6px;
        min-height: 44px;
      }
      .label {
        font-size: 10px;
        color: #444;
        margin-bottom: 4px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .value {
        white-space: pre-wrap;
        word-break: break-word;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
      }
      th, td {
        border: 1px solid #ccc;
        padding: 8px;
        font-size: 11px;
        text-align: left;
      }
      th {
        background: #f3f4f6;
      }
      .totals {
        width: 320px;
        margin-left: auto;
        margin-top: 12px;
      }
      .totals-row {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px dashed #ccc;
        padding: 6px 0;
        gap: 16px;
      }
      .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-top: 28px;
      }
      .sig-card {
        border: 1px solid #ccc;
        padding: 12px;
        border-radius: 8px;
        min-height: 180px;
      }
      .sig-title {
        font-weight: 700;
        margin-bottom: 8px;
      }
      .sig-name {
        margin-bottom: 8px;
      }
      .sig-img {
        width: 100%;
        max-height: 100px;
        object-fit: contain;
        border-top: 1px dashed #999;
        padding-top: 10px;
      }
      .footer-note {
        margin-top: 24px;
        color: #666;
        font-size: 10px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="title">SERVİS RAPORU</div>
        <div class="sub">
          <strong>MONO CNC MAKİNALARI</strong><br>
          Bakım Onarım ve Teknik Servisi<br>
          Telefon: 0544 384 7225<br>
          E-Mail: info@monocnc.com
        </div>
      </div>
      <div class="sub" style="text-align:right;">
        <strong>Başlama:</strong> ${safe(data.startDate)}<br>
        <strong>Bitiş:</strong> ${safe(data.endDate)}
      </div>
    </div>

    <div class="section-title">Firma Bilgileri</div>
    <div class="grid-2">
      <div class="field">
        <div class="label">Firma Ünvanı</div>
        <div class="value">${safe(data.companyName)}</div>
      </div>
      <div class="field">
        <div class="label">Müşteri Kodu</div>
        <div class="value">${safe(data.customerCode)}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="field">
        <div class="label">Firma Adresi</div>
        <div class="value">${safe(data.companyAddress)}</div>
      </div>
      <div>
        <div class="field" style="margin-bottom:10px;">
          <div class="label">Vergi Dairesi</div>
          <div class="value">${safe(data.taxOffice)}</div>
        </div>
        <div class="field">
          <div class="label">Vergi No</div>
          <div class="value">${safe(data.taxNumber)}</div>
        </div>
      </div>
    </div>

    <div class="section-title">Servis Bilgileri</div>
    <div class="grid-3">
      <div class="field">
        <div class="label">Arıza Türü</div>
        <div class="value">${safe(faultTypes)}</div>
      </div>
      <div class="field">
        <div class="label">Servis Türü</div>
        <div class="value">${safe(serviceTypes)}</div>
      </div>
      <div class="field">
        <div class="label">Müşteri E-Posta</div>
        <div class="value">${safe(data.customerEmail)}</div>
      </div>
    </div>

    <div class="grid-3">
      <div class="field">
        <div class="label">Makina Modeli</div>
        <div class="value">${safe(data.machineModel)}</div>
      </div>
      <div class="field">
        <div class="label">Makina Seri No</div>
        <div class="value">${safe(data.machineSerial)}</div>
      </div>
      <div class="field">
        <div class="label">Kontrol Modeli</div>
        <div class="value">${safe(data.controlModel)}</div>
      </div>
    </div>

    <div class="field">
      <div class="label">Yapılan İşler</div>
      <div class="value">${safe(data.workDone)}</div>
    </div>

    <div class="section-title">Kullanılan Malzemeler</div>
    <table>
      <thead>
        <tr>
          <th>Malzeme</th>
          <th>Seri No</th>
          <th>Miktar</th>
          <th>Birim</th>
          <th>Birim Fiyat</th>
          <th>Toplam</th>
        </tr>
      </thead>
      <tbody>
        ${materialsRows || `<tr><td colspan="6">Malzeme girilmedi.</td></tr>`}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row"><span>Toplam Malzeme</span><strong>${money(data.totalMaterials)}</strong></div>
      <div class="totals-row"><span>İşçilik</span><strong>${money(data.laborCost)}</strong></div>
      <div class="totals-row"><span>Ulaşım</span><strong>${money(data.travelCost)}</strong></div>
      <div class="totals-row"><span>Konaklama</span><strong>${money(data.lodgingCost)}</strong></div>
      <div class="totals-row"><span>Ara Toplam</span><strong>${money(data.subTotal)}</strong></div>
      <div class="totals-row"><span>KDV %20</span><strong>${money(data.vat)}</strong></div>
      <div class="totals-row"><span>Genel Toplam</span><strong>${money(data.grandTotal)}</strong></div>
    </div>

    <div class="section-title">Süre Bilgileri</div>
    <div class="grid-4">
      <div class="field">
        <div class="label">Ulaşım Süresi</div>
        <div class="value">${safe(data.travelHours)} saat</div>
      </div>
      <div class="field">
        <div class="label">Çalışma Başlangıç</div>
        <div class="value">${safe(data.workStartTime)}</div>
      </div>
      <div class="field">
        <div class="label">Çalışma Bitiş</div>
        <div class="value">${safe(data.workEndTime)}</div>
      </div>
      <div class="field">
        <div class="label">Çalışma Süresi</div>
        <div class="value">${safe(data.workHours)} saat</div>
      </div>
    </div>

    <div class="section-title">Yetkililer ve İmzalar</div>
    <div class="grid-2">
      <div class="field">
        <div class="label">Servis Yetkilisi</div>
        <div class="value">${safe(data.serviceStaff)} - ${safe(data.serviceStaffEmail)}</div>
      </div>
      <div class="field">
        <div class="label">Firma Yetkilisi</div>
        <div class="value">${safe(data.companyOfficer)}</div>
      </div>
    </div>

    <div class="signatures">
      <div class="sig-card">
        <div class="sig-title">Firma Yetkilisi</div>
        <div class="sig-name">${safe(data.companyOfficer)}</div>
        ${data.companySignature ? `<img class="sig-img" src="${data.companySignature}" />` : `<div class="value">İmza yok</div>`}
      </div>
      <div class="sig-card">
        <div class="sig-title">Servis Yetkilisi</div>
        <div class="sig-name">${safe(data.serviceOfficerName || data.serviceStaff)}</div>
        ${data.serviceSignature ? `<img class="sig-img" src="${data.serviceSignature}" />` : `<div class="value">İmza yok</div>`}
      </div>
    </div>

    <div class="footer-note">
      Bu belge sistem üzerinden otomatik oluşturulmuştur.
    </div>
  </body>
  </html>
  `;
}

app.post("/api/pdf", async (req, res) => {
  let browser;

  try {
    const data = req.body;

    const fileName = `servis-raporu-${Date.now()}.pdf`;
    const pdfPath = path.join(__dirname, fileName);

    const html = buildPdfHtml(data);

    browser = await puppeteer.launch({
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "12mm",
        right: "10mm",
        bottom: "12mm",
        left: "10mm"
      }
    });

    await browser.close();
    browser = null;

    if (!fs.existsSync(pdfPath)) {
      return res.status(500).send("PDF oluşturulamadı.");
    }

    const gmailUser = "MAILIN@gmail.com";
    const gmailPass = "APP_PASSWORD";

    if (data.customerEmail && gmailUser !== "MAILIN@gmail.com" && gmailPass !== "APP_PASSWORD") {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      });

      await transporter.sendMail({
        from: `"MONO CNC Servis" <${gmailUser}>`,
        to: data.customerEmail,
        subject: "Servis Raporu PDF",
        text: "Hazırlanan servis raporu ektedir.",
        attachments: [
          {
            filename: fileName,
            path: pdfPath
          }
        ]
      });

      return res.send(`PDF oluşturuldu ve ${data.customerEmail} adresine gönderildi.`);
    }

    return res.send(`PDF oluşturuldu. Mail göndermek için server.js içindeki Gmail bilgilerini doldur. Dosya: ${fileName}`);
  } catch (error) {
    console.error("SERVER HATASI:", error);

    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }

    return res.status(500).send("Hata: " + error.message);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server çalışıyor!");
});
