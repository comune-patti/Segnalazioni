// ═══════════════════════════════════════════════════════════════
//  SegnalaOra — Google Apps Script
//  Incolla questo codice su https://script.google.com
//  poi: Distribuisci → Nuova distribuzione → App web
//       Esegui come: Me  |  Chi ha accesso: Chiunque
// ═══════════════════════════════════════════════════════════════

// ID del tuo Google Sheet (dalla URL: /spreadsheets/d/ID/edit)
const SHEET_ID = '1Wy86M342so7EHLi3F-G5UNvXFq058Zr5EKAPhjNS3FM';

// Nome del foglio (tab in basso nel foglio — di solito "Foglio1")
const SHEET_NAME = 'Main';

// Ordine colonne — deve corrispondere ESATTAMENTE all'intestazione del foglio
const COLUMNS = [
  'ID_Segnalazione',
  'Timestamp_UTC',
  'Data',
  'Ora',
  'Categoria',
  'Categoria_Emoji',
  'Urgenza',
  'Descrizione',
  'Nome_Segnalante',
  'Email_Segnalante',
  'Lat',
  'Long',
  'Indirizzo_Completo',
  'Via',
  'Numero_Civico',
  'CAP',
  'Comune',
  'Provincia',
  'Regione',
  'Fonte_Posizione',
  'Accuratezza_GPS_m',
  'Destinatari',
  'Canale_Email',
  'Canale_WhatsApp',
  'Canale_Twitter',
  'Canale_Facebook',
  'Ha_Immagine',
  'Dimensioni_Immagine',
  'Testo_Messaggio',
  'URL_Segnalazione',
  'Stato',
  'Note_Ufficio',
  'Operatore',
  'Data_Presa_Carico',
  'Data_Risoluzione',
  'Token_Risoluzione',   // UUID segreto — NON pubblicare questa colonna nel CSV pubblico
];

// ───────────────────────────────────────────────────────────────
//  ensureHeaders — verifica che il foglio abbia tutte le colonne
//  di COLUMNS come intestazione nella riga 1.
//  Se il foglio è vuoto le crea; se mancano colonne le aggiunge.
// ───────────────────────────────────────────────────────────────
function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
    const h = sheet.getRange(1, 1, 1, COLUMNS.length);
    h.setFontWeight('bold');
    h.setBackground('#1a1208');
    h.setFontColor('#f5f0e8');
    return;
  }

  // Foglio già popolato: aggiungi le colonne mancanti in fondo
  const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const missing  = COLUMNS.filter(col => !existing.includes(col));
  if (missing.length === 0) return;

  const startCol = existing.length + 1;
  const newRange = sheet.getRange(1, startCol, 1, missing.length);
  newRange.setValues([missing]);
  newRange.setFontWeight('bold');
  newRange.setBackground('#1a1208');
  newRange.setFontColor('#f5f0e8');
}

// ───────────────────────────────────────────────────────────────
//  doPost — riceve i dati dall'app e li scrive nel foglio
//           oppure aggiorna lo stato di una segnalazione esistente
// ───────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const sheet = SpreadsheetApp
      .openById(SHEET_ID)
      .getSheetByName(SHEET_NAME);

    // Azione "risolvi": aggiorna Stato e Data_Risoluzione di una riga esistente
    if (data.action === 'risolvi') {
      return risolviSegnalazione(sheet, data);
    }

    // Azione default: inserisci nuova segnalazione
    ensureHeaders(sheet);

    // Costruisci la riga nello stesso ordine di COLUMNS
    const row = COLUMNS.map(col => data[col] !== undefined ? data[col] : '');
    sheet.appendRow(row);

    // Email di conferma al segnalante (solo se ha fornito l'email)
    if (data.Email_Segnalante) {
      try {
        const subject = `[SegnalaOra] Segnalazione ricevuta — ${data.ID_Segnalazione}`;
        const body = [
          `Ciao ${data.Nome_Segnalante || 'Cittadino'},`,
          ``,
          `La tua segnalazione è stata registrata con successo nel sistema SegnalaOra.`,
          ``,
          `📋 ID segnalazione: ${data.ID_Segnalazione}`,
          `📍 Categoria: ${data.Categoria_Emoji} ${data.Categoria}`,
          `📌 Luogo: ${data.Indirizzo_Completo}`,
          `🕐 Data/ora: ${data.Data} ${data.Ora}`,
          ``,
          `Conserva questo ID per seguire l'evoluzione della segnalazione.`,
          ``,
          `— SegnalaOra`,
        ].join('\n');
        GmailApp.sendEmail(data.Email_Segnalante, subject, body);
      } catch(mailErr) {
        // Non bloccare l'invio se l'email fallisce
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, id: data.ID_Segnalazione }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ───────────────────────────────────────────────────────────────
//  risolviSegnalazione — trova la riga per token (sicuro) o per ID
//  (fallback per vecchie email pre-token)
// ───────────────────────────────────────────────────────────────
function risolviSegnalazione(sheet, data) {
  const token = (data.token || '').trim();
  const id    = (data.ID_Segnalazione || '').trim();

  if (!token && !id) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'Token o ID_Segnalazione mancante' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'Nessuna segnalazione nel foglio' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const tokenColIdx   = COLUMNS.indexOf('Token_Risoluzione') + 1;
  const idColIdx      = COLUMNS.indexOf('ID_Segnalazione') + 1;
  const statoColIdx   = COLUMNS.indexOf('Stato') + 1;
  const dataRisColIdx = COLUMNS.indexOf('Data_Risoluzione') + 1;

  // 1° tentativo: ricerca per Token_Risoluzione (più sicura)
  let foundRow = -1;
  if (token && tokenColIdx > 0) {
    const tokens = sheet.getRange(2, tokenColIdx, lastRow - 1, 1).getValues();
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i][0] === token) { foundRow = i + 2; break; }
    }
  }

  // 2° tentativo: fallback per ID (vecchie segnalazioni senza token)
  if (foundRow === -1 && id) {
    const ids = sheet.getRange(2, idColIdx, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === id) { foundRow = i + 2; break; }
    }
  }

  if (foundRow === -1) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'Segnalazione non trovata' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const oggi = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'dd/MM/yyyy'
  );

  sheet.getRange(foundRow, statoColIdx).setValue('Risolta');
  sheet.getRange(foundRow, dataRisColIdx).setValue(oggi);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: oggi }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ───────────────────────────────────────────────────────────────
//  doGet — risponde a GET (serve per testare che lo script funzioni)
// ───────────────────────────────────────────────────────────────
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'SegnalaOra', status: 'attivo' }))
    .setMimeType(ContentService.MimeType.JSON);
}
