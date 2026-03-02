# 🚀 Guida Deploy — SegnalaOra

Tempo stimato: **20-30 minuti**. Non serve saper programmare.

---

## STEP 1 — Crea il Google Sheet

1. Vai su [sheets.google.com](https://sheets.google.com) e crea un nuovo foglio
2. Chiamalo **"SegnalaOra Database"** (o come preferisci)
3. Copia l'**ID del foglio** dall'URL:
   ```
   https://docs.google.com/spreadsheets/d/  👉 QUESTO_È_L_ID  /edit
   ```
4. Tienilo da parte — ti servirà tra poco

---

## STEP 2 — Crea una cartella Drive per le foto

1. Vai su [drive.google.com](https://drive.google.com)
2. Crea una nuova cartella chiamata **"SegnalaOra Foto"**
3. Apri la cartella e copia il suo **ID** dall'URL:
   ```
   https://drive.google.com/drive/folders/  👉 QUESTO_È_L_ID
   ```

---

## STEP 3 — Configura Google Apps Script

1. Vai su [script.google.com](https://script.google.com)
2. Clicca **"Nuovo progetto"**
3. Cancella tutto il codice preesistente
4. Incolla il contenuto del file **`apps-script/Code.gs`**
5. Sostituisci le due costanti in cima al file:
   ```javascript
   const SHEET_ID = 'INCOLLA_QUI_ID_DEL_TUO_GOOGLE_SHEET';
   // → metti l'ID copiato nello Step 1

   const DRIVE_FOLDER_ID = 'INCOLLA_QUI_ID_CARTELLA_DRIVE';
   // → metti l'ID copiato nello Step 2
   ```
6. Salva il progetto (Ctrl+S) — chiamalo **"SegnalaOra Backend"**

---

## STEP 4 — Setup del foglio

1. Nello stesso editor Apps Script, in alto seleziona la funzione **`setupSheet`**
2. Clicca **▶ Esegui**
3. Autorizza l'accesso quando richiesto (è normale, è il tuo account)
4. Vedrai una finestra di conferma: **"Foglio configurato correttamente!"**

> ✅ Il tuo Google Sheet avrà ora tutte le colonne e la formattazione automatica.

---

## STEP 5 — Deploy dello script come API

1. In Apps Script, clicca **"Deploy" → "Nuovo deployment"**
2. Clicca l'icona ⚙️ accanto a "Tipo" e seleziona **"App web"**
3. Configura così:
   - **Descrizione**: SegnalaOra API v1
   - **Esegui come**: Me (il tuo account Google)
   - **Chi può accedere**: **Chiunque** ← IMPORTANTE
4. Clicca **"Esegui il deployment"**
5. Autorizza di nuovo se richiesto
6. Copia l'**URL del deployment** che appare — è tipo:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

---

## STEP 6 — Configura la web app

1. Apri il file **`js/config.js`**
2. Incolla l'URL copiato nello Step 5:
   ```javascript
   APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbx.../exec",
   ```
3. Personalizza anche `COMUNE` e `APP_NAME` se vuoi:
   ```javascript
   COMUNE: "Comune di Milano",
   APP_NAME: "SegnalaMilano",
   ```

---

## STEP 7 — Pubblica su GitHub Pages

### Se non hai ancora un account GitHub:
1. Registrati gratis su [github.com](https://github.com)

### Crea il repository:
1. Clicca **"New repository"**
2. Chiamalo `segnalaora` (o nome del comune)
3. Spunta **"Public"** e **"Add a README file"**
4. Clicca **"Create repository"**

### Carica i file:
1. Apri il repository appena creato
2. Clicca **"Add file" → "Upload files"**
3. Trascina TUTTA la cartella `segnalaora/` (i file: `index.html`, `manifest.json`, la cartella `js/`)
4. Clicca **"Commit changes"**

### Attiva GitHub Pages:
1. Nel repository, vai su **Settings** (⚙️)
2. Nel menu laterale clicca **"Pages"**
3. In "Source" seleziona **"Deploy from a branch"**
4. Branch: **main**, Folder: **/ (root)**
5. Clicca **Save**
6. Dopo 1-2 minuti il sito è online su:
   ```
   https://tuonome.github.io/segnalaora/
   ```

---

## ✅ Test finale

1. Apri l'URL del tuo sito su smartphone
2. Tocca **"NUOVA SEGNALAZIONE"**
3. Scatta una foto, seleziona una categoria, invia
4. Controlla il tuo **Google Sheet** — la riga deve apparire!

---

## 📊 Gestire le segnalazioni (pannello admin)

Il Google Sheet **è** il tuo pannello admin:

| Cosa fare | Come |
|---|---|
| Cambiare stato | Clicca cella colonna **I (Stato)** e scegli dal menu |
| Assegnare ufficio | Scrivi nella colonna **K (Ufficio)** |
| Filtrare per categoria | Usa i filtri automatici di Sheets |
| Esportare report | File → Scarica → .xlsx o .csv |
| Ricevere email notifiche | Vedi sezione avanzata sotto |

---

## 🔔 Notifiche email opzionali (avanzato)

Per ricevere un'email ogni volta che arriva una segnalazione, aggiungi questo in Apps Script:

```javascript
function inviaNotificaEmail(id, categoria, indirizzo) {
  const email = 'tuamail@comune.it';  // ← cambia con la tua email
  MailApp.sendEmail({
    to: email,
    subject: `[SegnalaOra] Nuova segnalazione #${id}`,
    body: `Categoria: ${categoria}\nLuogo: ${indirizzo}\n\nVedi il foglio: https://docs.google.com/spreadsheets/d/${SHEET_ID}`,
  });
}
```

E richiamala dentro `handleSubmit`, dopo `sheet.appendRow(...)`:
```javascript
inviaNotificaEmail(id, data.categoria, data.indirizzo);
```

---

## 🆘 Problemi comuni

| Problema | Soluzione |
|---|---|
| "Errore invio" nell'app | Controlla che l'URL in config.js sia corretto e il deploy sia "Chiunque" |
| GPS non funziona | Il sito deve essere HTTPS (GitHub Pages lo è automaticamente) |
| Le foto non si salvano | Controlla DRIVE_FOLDER_ID in Code.gs |
| Sito non raggiungibile | Aspetta 2-3 minuti dopo aver attivato GitHub Pages |
| Devo aggiornare l'app | Modifica i file e riesegui "Upload files" su GitHub |
| Devo aggiornare lo script | In Apps Script: Deploy → Gestisci deployment → ✏️ Modifica → Crea nuova versione |

---

## 📁 Struttura file

```
segnalaora/
├── index.html          ← web app principale
├── manifest.json       ← rende l'app installabile (PWA)
├── js/
│   ├── config.js       ← ⚠️ MODIFICA QUESTO FILE
│   └── app.js          ← logica applicazione
└── apps-script/
    └── Code.gs         ← incolla su script.google.com
```
