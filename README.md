# Stiftung Bildung Chatbot

Dieses Projekt ist ein Chatbot-Prototyp für die Stiftung Bildung. Das Frontend stellt eine Chat-Oberfläche bereit, das Backend beantwortet Fragen anhand einer lokalen Wissensbasis (`knowledgeBase.json`).

Der aktuelle Stand nutzt eine Hybrid-Suche: Zuerst werden direkte Keyword-Treffer geprüft, danach vergleicht eine lokale Embedding-Suche die Bedeutung der Frage mit den Wissenseinträgen. Dafür wird `@huggingface/transformers` lokal im Backend verwendet; es wird keine externe KI-API aufgerufen.

## Vorschau

![Screenshot des Chatbot-Prototyps](frontend/src/assets/Chatbot_Prototyp.png)

## Funktionen

- Chat-Oberfläche mit Startnachricht, Eingabefeld und Ladeanzeige
- Stiftung-Bildung-Logo im Header und als Bot-Avatar
- Design mit Stiftung-Bildung-Farben, Lucida-Sans-Unicode-Schrift und responsive Darstellung
- Senden per Button oder Enter-Taste
- Kommunikation vom Frontend zum Backend über `POST http://localhost:3001/chat`
- Keyword-Matching für direkte Treffer
- Semantische Suche mit lokalen HuggingFace-Embeddings für ähnliche Formulierungen und Synonyme
- Logging der Keyword- und Embedding-Gewichtung im Backend-Terminal
- Wissensbasis mit Themen wie Spenden, Förderung, Kontakt, Datenschutz, Programme, Transparenz und Gründung der Stiftung Bildung
- Fallback-Antwort, wenn keine passende Information gefunden wird
- Anzeige von Quellenlinks und Kontakt-E-Mail-Adressen
- Testskript für typische Fragen, Synonyme und Fallback-Fälle

## Projektstruktur

```text
stiftung-chatbot/
|-- backend/
|   |-- embedding.ts
|   |-- knowledgeBase.json
|   |-- package.json
|   |-- package-lock.json
|   |-- server.ts
|   |-- test.ts
|   |-- testQuestions.json
|   `-- tsconfig.json
`-- frontend/
    |-- public/
    |   |-- favicon.svg
    |   `-- icons.svg
    |-- src/
    |   |-- assets/
    |   |   |-- Chatbot_Prototyp.png
    |   |   |-- hero.png
    |   |   |-- Logo-Stiftung-Bildung-Bildmarke_quadratisch_RGB.png
    |   |   |-- react.svg
    |   |   `-- vite.svg
    |   |-- App.css
    |   |-- App.tsx
    |   |-- index.css
    |   `-- main.tsx
    |-- eslint.config.js
    |-- index.html
    |-- package.json
    |-- package-lock.json
    |-- tsconfig.app.json
    |-- tsconfig.json
    |-- tsconfig.node.json
    `-- vite.config.ts
```

## Was die Dateien tun

### Backend

- `backend/server.ts`: Startet den Express-Server auf Port `3001`, aktiviert CORS und JSON-Parsing, nimmt Chat-Anfragen unter `/chat` entgegen und sucht die beste Antwort in der Wissensbasis.
- `backend/embedding.ts`: Lädt das lokale HuggingFace-Modell, erstellt Embeddings für Texte und vergleicht sie per Cosine Similarity.
- `backend/knowledgeBase.json`: Enthält die Antworten des Chatbots. Jeder Eintrag besteht aus Keywords, Kategorie, Antworttext, Quelle und optional einer Kontaktadresse. Die Keywords enthalten auch Synonyme und typische Fragevarianten, z. B. zur Gründung der Stiftung Bildung am 24.09.2012.
- `backend/test.ts`: Führt Testfragen aus und prüft mit derselben Hybrid-Logik wie der Server, ob die jeweils erwartete Quelle gefunden wird.
- `backend/testQuestions.json`: Sammlung von Testfragen mit erwarteter Quelle, darunter Synonym- und Fallback-Fälle.
- `backend/package.json`: Definiert Backend-Abhängigkeiten und Skripte wie `dev`, `build`, `start` und `test`. Enthält unter anderem `@huggingface/transformers` für lokale Embeddings.
- `backend/tsconfig.json`: TypeScript-Konfiguration für das Backend.
- `backend/package-lock.json`: Fixiert die installierten npm-Versionen.

### Frontend

- `frontend/src/App.tsx`: Hauptkomponente der Chat-App. Verwaltet Nachrichten, Eingabe, Ladezustand, automatisches Scrollen und ruft das Backend auf.
- `frontend/src/App.css`: Styling für Chatkarte, Nachrichtenblasen, Header, Eingabebereich, Ladepunkte und mobile Ansicht. Enthält die aktuellen Markenfarben, Logo-Darstellung und Lucida-Sans-Unicode-Schrift.
- `frontend/src/main.tsx`: Einstiegspunkt der React-App. Rendert `App` in das HTML-Element `#root`.
- `frontend/src/index.css`: Globale Basisstyles für die Vite/React-Anwendung.
- `frontend/src/assets/`: Bild- und SVG-Dateien für das Frontend, darunter das Stiftung-Bildung-Logo und der Screenshot des Prototyps.
- `frontend/public/favicon.svg`: Browser-Icon der Anwendung.
- `frontend/public/icons.svg`: Öffentliche Icon-Datei.
- `frontend/index.html`: HTML-Grundgerüst, in das die React-App geladen wird.
- `frontend/vite.config.ts`: Vite-Konfiguration mit React-Plugin.
- `frontend/eslint.config.js`: ESLint-Konfiguration für Code-Checks.
- `frontend/package.json`: Definiert Frontend-Abhängigkeiten und Skripte wie `dev`, `build`, `lint` und `preview`.
- `frontend/tsconfig*.json`: TypeScript-Konfigurationen für App, Node/Vite und das Gesamtprojekt.
- `frontend/package-lock.json`: Fixiert die installierten npm-Versionen.

## Installation

Die Abhängigkeiten liegen getrennt in `backend` und `frontend`.

```bash
cd backend
npm install

cd ../frontend
npm install
```

## Entwicklung starten

Backend und Frontend können gemeinsam aus dem Projekt-Root gestartet werden:

```bash
npm run dev
```

Während der Entwicklung werden Änderungen automatisch übernommen: Das Backend startet bei Änderungen an TypeScript- oder JSON-Dateien über `nodemon` neu, das Frontend aktualisiert sich über Vite Hot Reload.

Alternativ kann man die beiden Teile einzeln starten. Zuerst das Backend:

```bash
cd backend
npm run dev
```

Danach in einem zweiten Terminal das Frontend starten:

```bash
cd frontend
npm run dev
```

Das Backend läuft standardmäßig auf:

```text
http://localhost:3001
```

Das Frontend wird von Vite gestartet. Die genaue URL steht nach dem Start im Terminal, typischerweise:

```text
http://localhost:5173
```

## Tests

Die Backend-Tests prüfen, ob Beispiel-Fragen, Synonyme und unpassende Fragen zur richtigen Quelle oder zum Fallback führen. Beim Testlauf wird das lokale Embedding-Modell geladen; der erste Lauf kann deshalb etwas länger dauern.

```bash
cd backend
npm test
```

## Build

Backend bauen:

```bash
cd backend
npm run build
```

Frontend bauen:

```bash
cd frontend
npm run build
```

## Hinweise zum aktuellen Stand

- Die Antworten sind nur so gut wie die Einträge in `backend/knowledgeBase.json`.
- Neue Themen können durch neue Einträge mit passenden Keywords, Synonymen und Antworttexten ergänzt werden.
- Sachinformationen mit Datum, z. B. zur Gründung, sollten bei Bedarf anhand der angegebenen Quelle aktualisiert werden.
- Beim Serverstart werden die Wissenseinträge einmal als Embeddings vorbereitet.
- Im Backend-Terminal zeigen `Keyword-Gewichtung`, `Semantische Gewichtung` und `Such-Ergebnis`, warum eine Antwort ausgewählt wurde.
- Die semantische Suche verbessert ähnliche Formulierungen, ersetzt aber keine vollständige generative KI-Antwort. Der Bot gibt weiterhin feste Antworten aus der Wissensbasis zurück.
