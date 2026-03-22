const express = require("express");
const puppeteer = require("puppeteer-core");
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
      @page {
        size: A4;
        margin: 5mm;
      }

      body {
        font-family: Arial, sans-serif;
        color: #111;
        padding: 8px;
        font-size: 9px;
        line-height: 1.2;
        page-break-inside: avoid;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 1.5px solid #111;
        padding-bottom: 6px;
        margin-bottom: 8px;
      }

      .title {
        font-size: 17px;
        font-weight: 700;
        margin-bottom: 3px;
      }

      .sub {
        font-size: 9px;
        line-height: 1.25;
      }

      .section-title {
        margin-top: 7px;
        margin-bottom: 4px;
        font-size: 10px;
        font-weight: 700;
        border-left: 3px solid #111;
        padding-left: 6px;
        page-break-inside: avoid;
      }

      .grid-2, .grid-3, .grid-4 {
        display: grid;
        gap: 5px;
        margin-bottom: 5px;
      }

      .grid-2 { grid-template-columns: 1fr 1fr; }
      .grid-3 { grid-template-columns: 1fr 1fr 1fr; }
      .grid-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }

      .field {
        border: 1px solid #ccc;
        padding: 4px 5px;
        border-radius: 4px;
        min-height: 24px;
        page-break-inside: avoid;
      }

      .label {
        font-size: 8px;
        color: #444;
        margin-bottom: 2px;
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
        margin-top: 4px;
        page-break-inside: avoid;
      }

      th, td {
        border: 1px solid #ccc;
        padding: 3px 4px;
        font-size: 8px;
        text-align: left;
        vertical-align: top;
      }

      th {
        background: #f3f4f6;
      }

      .totals {
        width: 260px;
        margin-left: auto;
        margin-top: 6px;
        page-break-inside: avoid;
      }

      .totals-row {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px dashed #ccc;
        padding: 2px 0;
        gap: 8px;
        font-size: 8px;
      }

      .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 8px;
        page-break-inside: avoid;
      }

      .sig-card {
        border: 1px solid #ccc;
        padding: 6px;
        border-radius: 5px;
        min-height: 78px;
        page-break-inside: avoid;
      }

      .sig-title {
        font-weight: 700;
        margin-bottom: 4px;
        font-size: 8px;
      }

      .sig-name {
        margin-bottom: 4px;
        font-size: 8px;
      }

      .sig-img {
        width: 100%;
        max-height: 40px;
        object-fit: contain;
        border-top: 1px dashed #999;
        padding-top: 5px;
      }

      .footer-note {
        margin-top: 6px;
        color: #666;
        font-size: 7px;
      }

      .logo-wrap {
        display: flex;
        gap: 10px;
        align-items: flex-start;
      }

      .logo {
        width: 62px;
        height: auto;
      }

      .header-right {
        text-align: right;
        font-size: 9px;
      }

      .compact {
        margin-top: 4px;
      }

      .avoid-break {
        page-break-inside: avoid;
      }
    </style>
  </head>
  <body>
    <div class="header avoid-break">
      <div class="logo-wrap">
        <img
          src="https://raw.githubusercontent.com/irfannkoklu-bot/servis-saas-frontend/main/logo.png"
          class="logo"
        />

        <div>
          <div class="title">SERVİS RAPORU</div>
          <div class="sub">
            <strong>MONO CNC MAKİNALARI</strong><br>
            Bakım Onarım ve Teknik Servisi<br>
            Telefon: 0544 384 7225<br>
            E-Mail: info@monocnc.com
          </div>
        </div>
      </div>

      <div class="header-right">
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
        <div class="field" style="margin-bottom:5px;">
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

    <div class="field compact">
      <div class="label">Yapılan İşler</div>
      <div class="value">${safe(data.workDone)}</div>
    </div>

    <div class="section-title">Kullanılan Malzemeler</div>
    <table class="avoid-break">
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
  let pdfPath = null;

  try {
    const data = req.body;

    const fileName = `servis-raporu-${Date.now()}.pdf`;
    pdfPath = path.join(__dirname, fileName);

    const html = buildPdfHtml(data);

    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "5mm",
        right: "5mm",
        bottom: "5mm",
        left: "5mm"
      }
    });

    await browser.close();
    browser = null;

    if (!fs.existsSync(pdfPath)) {
      return res.status(500).send("PDF oluşturulamadı.");
    }

    res.download(pdfPath, fileName, (err) => {
      try {
        if (pdfPath && fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }
      } catch (_) {}

      if (err && !res.headersSent) {
        res.status(500).send("PDF indirilemedi.");
      }
    });
  } catch (error) {
    console.error("SERVER HATASI:", error);

    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }

    if (pdfPath) {
      try {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }
      } catch (_) {}
    }

    return res.status(500).send("Hata: " + error.message);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server çalışıyor!");
});
