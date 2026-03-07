# Guida Setup — SegnalaOra

Guida passo passo per configurare SegnalaOra dal fork al go-live.
Tempo stimato: 30-45 minuti.

## Indice

1. [Fork del repository](#1-fork-del-repository)
2. [Crea il Google Sheet](#2-crea-il-google-sheet)
3. [Pubblica i CSV del Google Sheet](#3-pubblica-i-csv-del-google-sheet)
4. [Crea il Google Apps Script](#4-crea-il-google-apps-script)
5. [Distribuisci lo script come Web App](#5-distribuisci-lo-script-come-web-app)
6. [Crea il Personal Access Token su GitHub](#6-crea-il-personal-access-token-su-github)
7. [Aggiungi i Secrets su GitHub](#7-aggiungi-i-secrets-su-github)
8. [Aggiorna il file config.js](#8-aggiorna-il-file-configjs)
9. [Aggiorna i workflow GitHub Actions](#9-aggiorna-i-workflow-github-actions)
10. [Abilita GitHub Pages](#10-abilita-github-pages)
11. [Verifica finale](#11-verifica-finale)

---

## 1. Fork del repository

1. Vai su `https://github.com/gbvitrano/Segnalazioni`
2. Clicca il pulsante **Fork** in alto a destra
3. Scegli il tuo account (o un'organizzazione) come destinazione
4. Lascia il nome del repo invariato oppure rinominalo (es. `segnalazioni-comune-nome`)
5. Clicca **Create fork**

> Il tuo fork sara' disponibile su `https://github.com/TUO-USERNAME/Segnalazioni`

---

## 2. Crea il Google Sheet

Lo sheet e' il database dell'app. Deve avere **3 fogli (tab)** nella stessa cartella di lavoro.

### 2a. Crea la cartella di lavoro

1. Vai su [sheets.google.com](https://sheets.google.com) e accedi con un account Google (preferibilmente quello che userai per Apps Script)
2. Clicca **Vuoto** per creare un nuovo foglio
3. Rinominalo: clicca su "Foglio senza titolo" in alto e scrivi `SegnalaOra — [Nome Comune]`

### 2b. Crea il foglio "Main"

Il foglio principale dove Apps Script scrivera' ogni nuova segnalazione.

1. In basso, fai doppio clic sulla tab `Foglio1` e rinominala **`Main`**
2. Lascialo vuoto: le intestazioni vengono create automaticamente dallo script al primo invio

> **Nota**: lo script aggiunge le intestazioni al primo utilizzo, quindi non serve inserire nulla manualmente.

### 2c. Crea il foglio "Aperte"

1. Clicca il **+** in basso a sinistra per aggiungere un nuovo foglio
2. Rinominalo **`Aperte`**
3. Nella cella **A1** incolla questa formula:

```
=IFERROR(
  FILTER(Main!A:AZ,
    (Main!A:A<>"") *
    (Main!A:A<>"ID_Segnalazione") *
    (Main!AE:AE<>"Risolta") *
    (Main!AE:AE<>"Chiusa")
  ),
  {"Nessuna segnalazione aperta"}
)
```

> Questa formula mostra tutte le righe del foglio Main dove la colonna `Stato` (AE) non e' "Risolta" o "Chiusa".
> Se la colonna Stato si trova in una posizione diversa, aggiorna `AE` con la lettera corretta dopo il primo invio di test.

**Alternativa piu' semplice** (se hai poca dimestichezza con le formule):
usa `=Main!A:AZ` per mostrare tutto il Main e filtra direttamente dal JS — meno elegante ma sempre funzionante.

### 2d. Crea il foglio "Risolte"

1. Clicca il **+** e rinomina il foglio **`Risolte`**
2. Nella cella **A1** incolla:

```
=IFERROR(
  FILTER(Main!A:AZ,
    (Main!A:A<>"") *
    (Main!A:A<>"ID_Segnalazione") *
    ((Main!AE:AE="Risolta") + (Main!AE:AE="Chiusa"))
  ),
  {"Nessuna segnalazione risolta"}
)
```

### 2e. Salva l'ID del foglio

Dalla barra degli indirizzi del browser copia l'**ID del foglio** (la stringa lunga tra `/d/` e `/edit`):

```
https://docs.google.com/spreadsheets/d/  1AbCdEfGhIjKlMnOpQrStUvWxYz  /edit
                                          ───────────────────────────
                                          questo e' lo SHEET_ID
```

Salvalo: ti servira' nel passaggio 4.

---

## 3. Pubblica i CSV del Google Sheet

L'app legge i dati dai fogli "Aperte" e "Risolte" tramite URL CSV pubblici.

### 3a. Pubblica il foglio sul web

1. Menu **File** → **Condividi** → **Pubblica sul Web**
2. Nella prima dropdown seleziona **Intero documento**
3. Nella seconda dropdown seleziona **Valori separati da virgola (.csv)**
4. Clicca **Pubblica** e conferma con **OK**
5. Chiudi la finestra (l'URL mostrato e' generico, non ti serve)

### 3b. Ottieni gli URL CSV dei singoli fogli

Per ogni foglio hai bisogno di un URL specifico. Segui questi passaggi:

**URL foglio "Aperte":**

1. Clicca sulla tab **Aperte** in basso
2. Vai su **File** → **Condividi** → **Pubblica sul Web**
3. Nella prima dropdown seleziona **Aperte**
4. Nella seconda seleziona **Valori separati da virgola (.csv)**
5. Clicca **Pubblica**
6. Copia l'URL generato — sara' simile a:
   ```
   https://docs.google.com/spreadsheets/d/e/2PACX-1v.../pub?gid=XXXXXXXXX&single=true&output=csv
   ```

**URL foglio "Risolte":**

Ripeti gli stessi passi selezionando la tab **Risolte** al punto 3.

> Salva entrambi gli URL: ti serviranno in `config.js` come `sheetsCsvAperte` e `sheetsCsvRisolte`, e nei workflow GitHub Actions.

---

## 4. Crea il Google Apps Script

Lo script riceve i dati dal form, li scrive nello Sheet, carica le foto su GitHub e invia le email.

### 4a. Apri l'editor script

1. Dal Google Sheet, vai su **Estensioni** → **Apps Script**
2. Si apre l'editor. Rinomina il progetto (in alto a sinistra, dove c'e' "Progetto senza titolo") in `SegnalaOra`

### 4b. Incolla il codice

1. Cancella tutto il contenuto del file `Codice.gs` (seleziona tutto con `Ctrl+A` e cancella)
2. Apri il file `dati/apps-script.gs` dal repository
3. Copia tutto il contenuto e incollalo nell'editor

### 4c. Configura le variabili dello script

All'inizio del file, modifica queste righe:

```js
// ID del tuo Google Sheet (dalla URL: /spreadsheets/d/ID/edit)
const SHEET_ID = 'INCOLLA-QUI-LO-SHEET-ID-DEL-PASSAGGIO-2e';

// Nome del foglio (tab in basso nel foglio)
const SHEET_NAME = 'Main';

// Configurazione email
const NOME_COMUNE = 'Nome del tuo Comune';   // es. 'Palermo'
const EMAIL_NOREPLY = '';                     // opzionale — es. 'noreply@comune.it'

// Configurazione GitHub per upload immagini
const GITHUB_OWNER  = 'TUO-USERNAME-GITHUB';  // il tuo username o organizzazione
const GITHUB_REPO   = 'Segnalazioni';         // nome del repo (o quello che hai scelto al fork)
const GITHUB_BRANCH = 'master';               // branch principale (verifica: potrebbe essere 'main')
```

4. Salva con `Ctrl+S`

### 4d. Aggiungi il GitHub Token allo script (Script Properties)

Il token GitHub viene letto dallo script da una proprieta' sicura (non hardcoded nel codice).

1. Nell'editor Apps Script, clicca l'icona **ingranaggio** (Impostazioni progetto) nel menu a sinistra
2. Scorri fino a **Proprieta' script**
3. Clicca **Aggiungi proprieta'**
4. Inserisci:
   - Proprieta': `GITHUB_TOKEN`
   - Valore: il token che creerai nel passaggio 6 (torna qui dopo)
5. Clicca **Salva proprieta' script**

> Il token verra' letto con `PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN')`.
> In questo modo non appare mai nel codice sorgente.

---

## 5. Distribuisci lo script come Web App

### 5a. Prima distribuzione

1. Nell'editor Apps Script clicca **Distribuisci** (in alto a destra) → **Nuova distribuzione**
2. Clicca l'icona **ingranaggio** accanto a "Seleziona tipo" e scegli **App web**
3. Configura:
   - **Descrizione**: `SegnalaOra v1`
   - **Esegui come**: `Me` (il tuo account Google)
   - **Chi ha accesso**: `Chiunque`
4. Clicca **Distribuisci**
5. Potrebbe essere richiesta l'autorizzazione — clicca **Autorizza accesso** e segui le istruzioni
6. Copia l'**URL dell'app web** — sara' simile a:
   ```
   https://script.google.com/macros/s/AKfycbw.../exec
   ```

> Salva questo URL: e' il valore `appsScriptUrl` in `config.js`.

### 5b. Come aggiornare lo script in futuro

Ogni modifica al codice Apps Script richiede una nuova distribuzione:

1. Clicca **Distribuisci** → **Gestisci distribuzioni**
2. Accanto alla distribuzione esistente clicca l'icona **matita** (modifica)
3. In "Versione" seleziona **Nuova versione**
4. Clicca **Distribuisci**

> L'URL dell'app web rimane invariato — non serve aggiornare `config.js`.

### 5c. Test dello script

Per verificare che lo script funzioni:

1. Nel browser apri l'URL della Web App con `?test=1`:
   ```
   https://script.google.com/macros/s/AKfycbw.../exec
   ```
2. Dovresti ricevere la risposta JSON:
   ```json
   { "ok": true, "service": "SegnalaOra", "status": "attivo" }
   ```
   Se vedi questo, lo script e' attivo e raggiungibile.

---

## 6. Crea il Personal Access Token su GitHub

Il token permette allo script Apps Script di caricare le foto delle segnalazioni direttamente nel repository GitHub.

### 6a. Genera il token

1. Accedi a [github.com](https://github.com) con il tuo account
2. Clicca sulla tua **foto profilo** in alto a destra → **Settings**
3. Scorri in fondo al menu a sinistra → clicca **Developer settings**
4. Nel menu a sinistra: **Personal access tokens** → **Fine-grained tokens**
5. Clicca **Generate new token**

### 6b. Configura il token

Compila il form:

- **Token name**: `segnalaora-images` (o un nome descrittivo)
- **Expiration**: scegli una scadenza (consigliato: `No expiration` o `1 year`)
- **Resource owner**: il tuo account (o l'organizzazione proprietaria del repo)
- **Repository access**: seleziona **Only select repositories** → scegli il tuo fork di Segnalazioni

**Permissions da abilitare** (Repository permissions):
- `Contents` → **Read and write** ← obbligatorio per caricare le foto
- `Metadata` → **Read-only** ← abilitato automaticamente

Lascia tutto il resto su `No access`.

6. Clicca **Generate token**
7. **Copia subito il token** — viene mostrato una volta sola

> Il token ha la forma `github_pat_...`

### 6c. Torna ad Apps Script

Ora che hai il token:

1. Torna nell'editor Apps Script
2. Vai su **Impostazioni progetto** → **Proprieta' script**
3. Incolla il token nel campo valore della proprieta' `GITHUB_TOKEN` (passaggio 4d)
4. Salva

---

## 7. Aggiungi i Secrets su GitHub

I workflow GitHub Actions (che sincronizzano i CSV) non richiedono secrets aggiuntivi: usano il token automatico `GITHUB_TOKEN` fornito da GitHub stessa. Tuttavia, se volessi usare un token personalizzato anche per i workflow (es. per pushare su repository diversi), puoi aggiungerlo come segue.

> Per l'uso standard di SegnalaOra questo passaggio non e' necessario. I workflow usano il token automatico interno di GitHub Actions.

### Verifica permessi del workflow

1. Vai al tuo fork su GitHub
2. Clicca **Settings** → **Actions** → **General**
3. Scorri fino a **Workflow permissions**
4. Seleziona **Read and write permissions**
5. Clicca **Save**

> Questo e' necessario perche' i workflow eseguono `git push` per aggiornare i CSV nel repo.

---

## 8. Aggiorna il file config.js

Ora hai tutti i valori necessari. Apri (o crea) `js/config.js` e compila ogni campo:

```js
const APP_CONFIG = {

  // ── GOOGLE SERVICES ──────────────────────────────────────────
  appsScriptUrl:    'https://script.google.com/macros/s/INCOLLA-URL-WEBAPP/exec',
  sheetsCsvAperte:  'https://docs.google.com/spreadsheets/d/e/INCOLLA-URL-CSV-APERTE',
  sheetsCsvRisolte: 'https://docs.google.com/spreadsheets/d/e/INCOLLA-URL-CSV-RISOLTE',

  // ── IDENTITA' APP ─────────────────────────────────────────────
  app: {
    nome:          'SegnalaOra',              // nome visualizzato nell'header
    sottotitolo:   'Invia una nuova segnalazione',
    siteUrl:       'https://TUO-USERNAME.github.io/Segnalazioni/',
    ogImage:       'https://TUO-USERNAME.github.io/Segnalazioni/img/og-image.jpg',
    hashtag:       '#SegnalaOra',
    bannerCrediti: 'Un progetto di <a href="https://..." target="_blank">Nome Ente</a>',
  },

  // ── PUBBLICA AMMINISTRAZIONE ─────────────────────────────────
  pa: {
    nome:          'Comune di [Nome Comune]',
    sito:          'https://www.comune.[nome].it',
    emailDefault:  'protocollo@comune.[nome].it',
    twitterHandle: '@comune[nome]',
  },

  // ── MAPPA ────────────────────────────────────────────────────
  // Usa Google Maps o OpenStreetMap per trovare lat/lng del tuo comune
  mappa: {
    lat:          38.1157,   // latitudine centro comune
    lng:          13.3615,   // longitudine centro comune
    zoomForm:     14,
    zoomPubblica: 13,
    maxZoomForm:  20,
    maxZoom:      19,
    fitBoundsPad: 0.15,
    pageSize:     10,
    loadTimeout:  12000,
    popupDelay:   350,
  },

  // ── CATEGORIE E DESTINATARI ───────────────────────────────────
  // Modifica le email con quelle reali del tuo comune.
  // Puoi aggiungere, rimuovere o rinominare le categorie.
  // 'categoria' deve corrispondere al valore usato nei grafici.
  destinatari: [
    { id:'strade',    nome:'Buche stradali',      descrizione:'Buche, asfalto, marciapiedi',      categoria:'Buche e dissesti stradali',    email:'lavori@comune.[nome].it',       icon:'fa-solid fa-road-circle-exclamation', custom:false },
    { id:'luce',      nome:'Illuminazione',        descrizione:'Lampioni guasti, semafori',         categoria:'Illuminazione pubblica guasta', email:'illuminazione@comune.[nome].it', icon:'fa-solid fa-lightbulb',              custom:false },
    { id:'rifiuti',   nome:'Rifiuti',              descrizione:'Rifiuti abbandonati, degrado',      categoria:'Rifiuti abbandonati',           email:'ambiente@comune.[nome].it',     icon:'fa-solid fa-trash-can',              custom:false },
    { id:'verde',     nome:'Verde Pubblico',       descrizione:'Alberi, parchi, aree verdi',        categoria:'Alberi e verde pubblico',       email:'verde@comune.[nome].it',        icon:'fa-solid fa-tree',                   custom:false },
    { id:'acqua',     nome:'Perdite idriche',      descrizione:'Perdite, allagamenti, fognature',   categoria:'Perdite idriche',               email:'acqua@comune.[nome].it',        icon:'fa-solid fa-faucet-drip',            custom:false },
    { id:'deiezioni', nome:'Deiezioni',            descrizione:'Deiezioni animali non raccolte',    categoria:'Deiezioni non raccolte',        email:'ambiente@comune.[nome].it',     icon:'fa-solid fa-paw',                    custom:false },
    { id:'segnaletica',nome:'Segnaletica',         descrizione:'Cartelli danneggiati, strisce',     categoria:'Segnaletica danneggiata',       email:'lavori@comune.[nome].it',       icon:'fa-solid fa-signs-post',             custom:false },
    { id:'veicoli',   nome:'Veicoli abbandonati',  descrizione:'Auto, moto abbandonate',            categoria:'Veicoli abbandonati',           email:'polizia@comune.[nome].it',      icon:'fa-solid fa-car-side',               custom:false },
    { id:'sicurezza', nome:'Sicurezza',            descrizione:'Degrado, ordine pubblico',          categoria:'Degrado e sicurezza',           email:'polizia@comune.[nome].it',      icon:'fa-solid fa-shield-halved',          custom:false },
    { id:'barriere',  nome:'Barriere arch.',       descrizione:'Accessibilita disabili',            categoria:'Barriere architettoniche',      email:'lavori@comune.[nome].it',       icon:'fa-solid fa-wheelchair',             custom:false },
    { id:'immobile',  nome:'Immobile',             descrizione:'Edifici pericolanti, crolli',       categoria:'Immobile pericolante',          email:'lavori@comune.[nome].it',       icon:'fa-solid fa-house-crack',            custom:false },
    { id:'rumore',    nome:'Rumore',               descrizione:'Inquinamento acustico',             categoria:'Inquinamento acustico',         email:'polizia@comune.[nome].it',      icon:'fa-solid fa-volume-high',            custom:false },
    { id:'altro',     nome:'Altro',                descrizione:"Inserisci l'email destinatario",    categoria:'Altro',                         email:null,                            icon:'fa-solid fa-ellipsis',               custom:true  },
  ],

  // ── FORM ─────────────────────────────────────────────────────
  form: {
    maxFoto:           4,
    categorieVisibili: 6,
    maxRisoluzioneImg: 1280,
    qualitaJpeg:       0.85,
    maxStoriaProfilo:  50,
  },

  // ── SOCIAL SHARING ───────────────────────────────────────────
  // Rimuovi da 'piattaforme' quelle che non vuoi mostrare
  social: {
    piattaforme:   ['twitter', 'whatsapp', 'facebook', 'telegram', 'bluesky'],
    maxTestoChars: 120,
  },

  // ── COLORI MARKER ────────────────────────────────────────────
  marker: {
    Alta:    '#e53535',
    Normale: '#ff9900',
    Bassa:   '#3cb4d8',
    Risolta: '#3d5a47',
    default: '#d4820a',
  },

  // ── COLORI GRAFICI ───────────────────────────────────────────
  grafici: {
    paletteCategorie: [
      '#d4820a','#e09a2a','#c07020','#f0b040','#b06010',
      '#3cb4d8','#2a9ec0','#4dcae0','#1a8aaa','#5ad0e8',
      '#3d5a47','#2d4435',
    ],
    urgenza: { Alta:'#e53535', Normale:'#ff9900', Bassa:'#3cb4d8' },
    stato:   { Nuova:'#d4820a', 'In lavorazione':'#3cb4d8', Risolta:'#3d5a47', Chiusa:'#a8a090' },
    trend:   { sfondo:'rgba(212,130,10,0.75)', bordo:'#d4820a' },
  },
};
```

---

## 9. Aggiorna i workflow GitHub Actions

I workflow devono conoscere gli URL CSV del tuo sheet.

Apri `.github/workflows/sync-sheets.yml` e sostituisci i tre URL nella sezione `env`:

```yaml
env:
  CSV_APERTE:  "INCOLLA-URL-CSV-APERTE-DEL-PASSAGGIO-3b"
  CSV_RISOLTE: "INCOLLA-URL-CSV-RISOLTE-DEL-PASSAGGIO-3b"
  CSV_MAIN:    "INCOLLA-URL-CSV-MAIN-oppure-uguale-a-CSV-APERTE"
```

> `CSV_MAIN` e' il CSV del foglio "Main" (tutti i dati, senza filtri). Ottienilo con la stessa procedura del passaggio 3b selezionando il foglio **Main**.

---

## 10. Abilita GitHub Pages

1. Vai al tuo fork su GitHub
2. Clicca **Settings** → **Pages** (menu a sinistra)
3. In **Source** seleziona **Deploy from a branch**
4. In **Branch** seleziona `master` (o `main`) → cartella `/ (root)`
5. Clicca **Save**

Dopo 1-2 minuti il sito sara' disponibile su:
```
https://TUO-USERNAME.github.io/Segnalazioni/
```

> Se hai rinominato il repo al fork, sostituisci `Segnalazioni` con il nome che hai scelto.

### 10a. Dominio personalizzato (opzionale)

Se vuoi usare un dominio custom (es. `segnala.comune.it`):

1. Nella pagina Settings → Pages, inserisci il dominio nel campo **Custom domain**
2. Clicca **Save**
3. Dal tuo provider DNS, crea un record CNAME:
   - Nome: `segnala` (o il sottodominio scelto)
   - Destinazione: `TUO-USERNAME.github.io`
4. Aggiorna `siteUrl` in `config.js` con il nuovo dominio

---

## 11. Verifica finale

Esegui questi test nell'ordine indicato.

### Test 1 — Apps Script raggiungibile

Apri nel browser:
```
https://script.google.com/macros/s/TUO-SCRIPT-ID/exec
```
Risposta attesa: `{"ok":true,"service":"SegnalaOra","status":"attivo"}`

### Test 2 — CSV pubblici accessibili

Apri nel browser i due URL CSV:
- `sheetsCsvAperte` → deve mostrare le intestazioni CSV
- `sheetsCsvRisolte` → idem

### Test 3 — Invio segnalazione di prova

1. Apri la pagina `index.html` (o il sito su GitHub Pages)
2. Compila il form con dati fittizi
3. Invia

Verifica:
- [ ] Il Google Sheet "Main" ha una nuova riga con i dati
- [ ] L'email e' arrivata all'indirizzo della categoria selezionata
- [ ] L'email di conferma e' arrivata all'indirizzo del segnalante
- [ ] Le foto sono apparse nella cartella `img/` del repository GitHub

### Test 4 — Mappa pubblica

1. Apri `mappa.html`
2. Verifica che la mappa sia centrata sul tuo comune
3. Verifica che la segnalazione di test appaia come marker

### Test 5 — GitHub Actions

1. Vai a **Actions** nel tuo repo GitHub
2. Seleziona il workflow **Sincronizza Google Sheets**
3. Clicca **Run workflow** → **Run workflow** (avvio manuale)
4. Attendi il completamento (circa 30 secondi)
5. Verifica che `dati/segnalazioni.csv` sia stato aggiornato con la riga di test

### Test 6 — Risoluzione segnalazione

1. Apri `mappa.html`
2. Clicca il pulsante **Segna come risolta** (icona chiave inglese)
3. Inserisci l'ID della segnalazione di test
4. Conferma
5. Verifica che nel Google Sheet la colonna `Stato` sia diventata `Risolta` e `Data_Risoluzione` sia compilata

---

## Riepilogo valori da raccogliere

| Valore | Dove trovarlo | Dove usarlo |
|---|---|---|
| **SHEET_ID** | URL del Google Sheet (`/d/ID/edit`) | `apps-script.gs` |
| **URL CSV Aperte** | File → Pubblica sul web → foglio Aperte | `config.js` + `sync-sheets.yml` |
| **URL CSV Risolte** | File → Pubblica sul web → foglio Risolte | `config.js` + `sync-sheets.yml` |
| **URL CSV Main** | File → Pubblica sul web → foglio Main | `sync-sheets.yml` |
| **URL Web App** | Apps Script → Distribuisci → URL app web | `config.js` |
| **GitHub Token** | GitHub → Settings → Developer settings | Apps Script Properties |

---

## Problemi comuni

### Lo sheet non riceve dati
- Verifica che l'URL `appsScriptUrl` in `config.js` sia quello corretto (con `/exec` finale)
- Verifica che la Web App sia distribuita con accesso **Chiunque**
- Apri la console del browser (F12 → Console) durante l'invio e cerca errori

### Le foto non vengono caricate su GitHub
- Verifica che il `GITHUB_TOKEN` in Script Properties sia valido e non scaduto
- Verifica che il token abbia permesso `Contents: Read and write` sul repo corretto
- Verifica che `GITHUB_OWNER`, `GITHUB_REPO` e `GITHUB_BRANCH` in `apps-script.gs` siano corretti

### Le email non arrivano
- Google limita il numero di email giornaliere con Apps Script (100/giorno per account free, 1500/giorno per Workspace)
- Verifica che `Email_Destinatario` sia compilato: corrisponde alla prima email della categoria selezionata
- Controlla la cartella Spam

### Il CSV e' vuoto o non si aggiorna
- I CSV pubblici di Google Sheets hanno una cache di 1-3 minuti: aspetta prima di considerarlo un errore
- Verifica che il foglio "Aperte"/"Risolte" non mostri un errore nella formula FILTER

### GitHub Actions fallisce
- Vai su **Actions** → clicca sul run fallito → leggi il log dell'errore
- Verifica che i permessi del workflow siano impostati su **Read and write** (passaggio 7)
- Verifica che gli URL CSV nei workflow siano corretti e pubblicamente accessibili
