// ═══════════════════════════════════════════════════════════
//  Google Apps Script — SegnalaOra Backend v2
//  Funzionalità: Sheets + Email routing + Telegram
// ═══════════════════════════════════════════════════════════

// ─── ⚙️ CONFIGURAZIONE — MODIFICA QUI ────────────────────

const SHEET_ID        = 'INCOLLA_QUI_ID_DEL_TUO_GOOGLE_SHEET';
const SHEET_NAME      = 'Segnalazioni';
const DRIVE_FOLDER_ID = 'INCOLLA_QUI_ID_CARTELLA_DRIVE';

// Email di fallback se la categoria non ha un ufficio specifico
const EMAIL_DEFAULT   = 'protocollo@comune.it';

// Routing email per categoria → ufficio competente
const EMAIL_ROUTING = {
  'Buche/Asfalto':    'viabilita@comune.it',
  'Illuminazione':    'energia@comune.it',
  'Rifiuti':          'ambiente@comune.it',
  'Verde pubblico':   'verde@comune.it',
  'Vandalismi':       'polizia.municipale@comune.it',
  'Segnaletica':      'viabilita@comune.it',
  'Marciapiedi':      'viabilita@comune.it',
  'Acqua/Fognature':  'tecnico@comune.it',
  'Altro':            EMAIL_DEFAULT,
};

// Telegram — lascia vuoto ('') per disabilitare
// Come ottenere BOT_TOKEN: cerca @BotFather su Telegram → /newbot
// Come ottenere CHAT_ID: aggiungi il bot al gruppo, poi visita:
//   https://api.telegram.org/bot<TOKEN>/getUpdates
const TELEGRAM_BOT_TOKEN = '';   // es. '7123456789:AAGf...'
const TELEGRAM_CHAT_ID   = '';   // es. '-1001234567890'

const NOME_COMUNE = 'Comune di Roma';


// ═══════════════════════════════════════════════════════════
//  HANDLERS PRINCIPALI
// ═══════════════════════════════════════════════════════════

function doGet(e) {
  const action = (e.parameter.action || 'list');
  if (action === 'list') return handleList(e.parameter);
  return jsonResponse({ status: 'error', message: 'Azione non riconosciuta' });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.action === 'submit') return handleSubmit(payload);
    return jsonResponse({ status: 'error', message: 'Azione non riconosciuta' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}


// ═══════════════════════════════════════════════════════════
//  SUBMIT — salva + notifica
// ═══════════════════════════════════════════════════════════

function handleSubmit(data) {
  const sheet   = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  const id      = 'SG' + new Date().getFullYear() + '-' + String(lastRow).padStart(5, '0');

  // Salva foto su Drive
  let fotoUrl = '';
  if (data.foto && data.foto.startsWith('data:image')) {
    try { fotoUrl = salvaFotoSuDrive(data.foto, id); } catch (e) { console.error(e); }
  }

  // Ufficio competente per categoria
  const ufficio = EMAIL_ROUTING[data.categoria] || EMAIL_DEFAULT;

  // Scrivi riga nel foglio
  sheet.appendRow([
    id,
    new Date(data.timestamp),
    data.categoria  || '',
    data.note       || '',
    data.indirizzo  || '',
    data.lat        || '',
    data.lng        || '',
    fotoUrl,
    'Aperta',
    data.deviceId   || '',
    ufficio,
    '',
  ]);

  // Link utili
  const mapsLink  = (data.lat && data.lng)
    ? `https://maps.google.com/?q=${data.lat},${data.lng}` : null;
  const sheetLink = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;

  // ── Lancia tutte le notifiche ──────────────────────────
  try { inviaEmailUfficio(id, data, ufficio, fotoUrl, mapsLink, sheetLink);       } catch(e) { console.error('Email ufficio:', e);     }
  try { inviaEmailProtocollo(id, data, ufficio, sheetLink);                        } catch(e) { console.error('Email protocollo:', e);  }
  try { inviaTelegram(id, data, ufficio, fotoUrl, mapsLink);                       } catch(e) { console.error('Telegram:', e);          }

  return jsonResponse({ status: 'ok', id: id });
}


// ═══════════════════════════════════════════════════════════
//  EMAIL 1 — Ufficio competente
// ═══════════════════════════════════════════════════════════

function inviaEmailUfficio(id, data, emailDest, fotoUrl, mapsLink, sheetLink) {
  const dataOra = new Date(data.timestamp).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const html = `
<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1);">

  <div style="background:#0d1117;padding:22px 28px;">
    <div style="color:#00e5a0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">SegnalaOra — ${NOME_COMUNE}</div>
    <div style="color:#fff;font-size:20px;font-weight:900;margin-top:4px;">📍 Nuova segnalazione ricevuta</div>
  </div>

  <div style="padding:24px 28px;">
    <table style="width:100%;border-collapse:collapse;background:#f8f9fc;border-radius:8px;overflow:hidden;">
      <tr style="border-bottom:1px solid #eee;">
        <td style="font-size:12px;color:#888;padding:10px 14px;width:130px;">ID</td>
        <td style="font-size:14px;font-weight:700;padding:10px 14px;color:#0d1117;">#${id}</td>
      </tr>
      <tr style="border-bottom:1px solid #eee;">
        <td style="font-size:12px;color:#888;padding:10px 14px;">Categoria</td>
        <td style="font-size:14px;font-weight:700;padding:10px 14px;">${data.categoria}</td>
      </tr>
      <tr style="border-bottom:1px solid #eee;">
        <td style="font-size:12px;color:#888;padding:10px 14px;">Indirizzo</td>
        <td style="font-size:14px;padding:10px 14px;">${data.indirizzo || 'Non disponibile'}</td>
      </tr>
      <tr style="border-bottom:1px solid #eee;">
        <td style="font-size:12px;color:#888;padding:10px 14px;">Data/Ora</td>
        <td style="font-size:14px;padding:10px 14px;">${dataOra}</td>
      </tr>
      ${data.note ? `
      <tr>
        <td style="font-size:12px;color:#888;padding:10px 14px;vertical-align:top;">Note</td>
        <td style="font-size:14px;padding:10px 14px;">${data.note}</td>
      </tr>` : ''}
    </table>

    <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
      ${mapsLink ? `<a href="${mapsLink}" style="background:#00e5a0;color:#0d1117;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">📍 Apri su Maps</a>` : ''}
      <a href="${sheetLink}" style="background:#0d1117;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">📊 Foglio segnalazioni</a>
      ${fotoUrl ? `<a href="${fotoUrl}" style="background:#eeeeee;color:#0d1117;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">🖼️ Vedi foto</a>` : ''}
    </div>

    <div style="margin-top:18px;background:#fffbeb;border:1px solid #ffd32a;border-radius:8px;padding:12px 16px;font-size:13px;color:#7a5f00;">
      ⚠️ Segnalazione assegnata automaticamente al tuo ufficio. Apri il foglio e aggiorna lo <strong>Stato</strong> quando la prendi in carico.
    </div>
  </div>

  <div style="background:#f4f4f4;padding:12px 28px;font-size:11px;color:#aaa;text-align:center;">
    SegnalaOra · ${NOME_COMUNE} · Sistema automatico, non rispondere a questa email
  </div>
</div>
</body></html>`;

  MailApp.sendEmail({ to: emailDest, subject: `[SegnalaOra] #${id} — ${data.categoria}`, htmlBody: html });
}


// ═══════════════════════════════════════════════════════════
//  EMAIL 2 — Protocollo (copia archivio)
// ═══════════════════════════════════════════════════════════

function inviaEmailProtocollo(id, data, ufficio, sheetLink) {
  if (ufficio === EMAIL_DEFAULT) return; // evita duplicato se già va a protocollo
  MailApp.sendEmail({
    to:      EMAIL_DEFAULT,
    subject: `[Protocollo] SegnalaOra #${id} → ${ufficio}`,
    body:    `Riepilogo segnalazione automatica:\n\nID: #${id}\nCategoria: ${data.categoria}\nLuogo: ${data.indirizzo || 'N/D'}\nInstradato a: ${ufficio}\n\nFoglio: ${sheetLink}`,
  });
}


// ═══════════════════════════════════════════════════════════
//  TELEGRAM
// ═══════════════════════════════════════════════════════════

function inviaTelegram(id, data, ufficio, fotoUrl, mapsLink) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const EMO = {
    'Buche/Asfalto':'🕳️','Illuminazione':'💡','Rifiuti':'🗑️','Verde pubblico':'🌳',
    'Vandalismi':'🚧','Segnaletica':'🚦','Marciapiedi':'🧱','Acqua/Fognature':'💧','Altro':'📌',
  };

  let testo = `${EMO[data.categoria]||'📌'} *Nuova segnalazione \\#${id}*\n`;
  testo += `━━━━━━━━━━━━━━━━━\n`;
  testo += `📂 *Categoria:* ${data.categoria}\n`;
  testo += `📍 *Luogo:* ${data.indirizzo || 'N/D'}\n`;
  if (data.note) testo += `💬 *Note:* ${data.note}\n`;
  testo += `🏢 *Ufficio:* ${ufficio}\n`;
  if (mapsLink) testo += `\n[📍 Apri su Maps](${mapsLink})`;
  if (fotoUrl)  testo += `  [🖼️ Foto](${fotoUrl})`;

  UrlFetchApp.fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: testo, parse_mode: 'MarkdownV2' }),
    muteHttpExceptions: true,
  });
}


// ═══════════════════════════════════════════════════════════
//  LISTA
// ═══════════════════════════════════════════════════════════

function handleList(params) {
  const sheet    = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const limit    = parseInt(params.limit) || 20;
  const deviceId = params.deviceId || null;
  const lastRow  = sheet.getLastRow();

  if (lastRow < 2) return jsonResponse({ status:'ok', rows:[], stats:{aperte:0,incorso:0,risolte:0} });

  const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  let aperte=0, incorso=0, risolte=0;
  data.forEach(r => { if(r[8]==='Aperta') aperte++; if(r[8]==='In corso') incorso++; if(r[8]==='Risolta') risolte++; });

  let rows = (deviceId ? data.filter(r => r[9]===deviceId) : data)
    .reverse().slice(0, limit)
    .map(r => ({
      id: r[0], timestamp: r[1] instanceof Date ? r[1].toISOString() : r[1],
      categoria: r[2], note: r[3], indirizzo: r[4], lat: r[5], lng: r[6], fotoUrl: r[7], stato: r[8],
    }));

  return jsonResponse({ status:'ok', rows, stats:{aperte,incorso,risolte} });
}


// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

function salvaFotoSuDrive(base64DataUrl, id) {
  const match = base64DataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return '';
  const mime = match[1], ext = mime.split('/')[1]||'jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(match[2]), mime, `${id}.${ext}`);
  let folder;
  try { folder = DriveApp.getFolderById(DRIVE_FOLDER_ID); } catch { folder = DriveApp.getRootFolder(); }
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Esegui UNA VOLTA per configurare il foglio
function setupSheet() {
  const ss  = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  const h   = ['ID','Data/Ora','Categoria','Descrizione','Indirizzo','Lat','Lng','Foto','Stato','Device ID','Ufficio','Note interne'];
  sheet.getRange(1,1,1,h.length).setValues([h])
    .setBackground('#0d1117').setFontColor('#00e5a0').setFontWeight('bold');
  sheet.setFrozenRows(1);
  [120,160,140,250,220,90,90,200,100,150,160,200].forEach((w,i)=>sheet.setColumnWidth(i+1,w));
  const r = SpreadsheetApp.newDataValidation().requireValueInList(['Aperta','In corso','Risolta','Rigettata']).build();
  sheet.getRange('I2:I10000').setDataValidation(r);
  const mk = (txt,bg,fc) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(txt).setBackground(bg).setFontColor(fc).setRanges([sheet.getRange('I2:I10000')]).build();
  sheet.setConditionalFormatRules([mk('Risolta','#0d2e1a','#00e5a0'),mk('In corso','#2e2a00','#ffd32a'),mk('Aperta','#2e0d0d','#ff4757')]);
  SpreadsheetApp.getUi().alert('✅ Foglio pronto!');
}
