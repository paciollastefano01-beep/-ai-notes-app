const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const { Ollama } = require('ollama');

const app = express();
const port = 3000;
const ollama = new Ollama({ host: 'http://localhost:11434' });

// Middleware
app.use(cors());
app.use(bodyParser.json());

// === DATABASE SQL ===
const db = new Database('notes.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// === ROUTES API ===

// GET tutte le note
app.get('/api/notes', (req, res) => {
    const notes = db.prepare('SELECT * FROM notes ORDER BY created_at DESC').all();
    res.json(notes);
});

// GET singola nota
app.get('/api/notes/:id', (req, res) => {
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    if (!note) return res.status(404).json({ error: 'Nota non trovata' });
    res.json(note);
});

// POST crea nota
app.post('/api/notes', (req, res) => {
    const { title, content } = req.body;
    const result = db.prepare('INSERT INTO notes (title, content) VALUES (?, ?)').run(title, content);
    res.status(201).json({ id: result.lastInsertRowid, title, content });
});

// PUT aggiorna nota
app.put('/api/notes/:id', (req, res) => {
    const { title, content } = req.body;
    db.prepare('UPDATE notes SET title = ?, content = ? WHERE id = ?').run(title, content, req.params.id);
    res.json({ message: 'Nota aggiornata' });
});

// DELETE cancella nota
app.delete('/api/notes/:id', (req, res) => {
    db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
    res.status(204).send();
});

// === ROUTE AI con OLLAMA ===

// RIASSUMI
app.post('/api/ai/summarize', async (req, res) => {
    const { content } = req.body;
    try {
        const response = await ollama.chat({
            model: 'tinyllama',
            messages: [{ role: 'user', content: `Summarize in Italian in max 2 sentences: ${content}` }],
        });
        res.json({ summary: response.message.content });
    } catch (error) {
        res.status(500).json({ error: 'Errore AI: ' + error.message });
    }
});

// TRADUCI MULTI-LINGUA
// TRADUCI MULTI-LINGUA
app.post('/api/ai/translate', async (req, res) => {
    const { content, language } = req.body;
    console.log('Richiesta traduzione:', content, 'in', language);
    try {
        const response = await ollama.chat({
            model: 'llama3.1',  // ← Mantieni per traduzioni accurate
            messages: [{
                role: 'user',
                content: `Translate to ${language}: ${content}`
            }],
            options: {
                temperature: 0.3,  // ← Più deterministico = più veloce
                num_predict: 100   // ← Max 100 token di risposta
            }
        });
        console.log('Risposta Ollama:', response.message.content);
        res.json({ translation: response.message.content });
    } catch (error) {
        console.log('Errore:', error.message);
        res.status(500).json({ error: 'Errore traduzione: ' + error.message });
    }
});

// CHIEDI
app.post('/api/ai/ask', async (req, res) => {
    const { content, question } = req.body;
    try {
        const response = await ollama.chat({
            model: 'llama3.1',
            messages: [{ role: 'user', content: `Basandoti su questo testo: "${content}" Rispondi a questa domanda: ${question}` }],
        });
        res.json({ answer: response.message.content });
    } catch (error) {
        res.status(500).json({ error: 'Errore AI: ' + error.message });
    }
});

// Avvia server
app.listen(port, () => {
    console.log('=================================');
    console.log('Server in esecuzione su http://localhost:3000');
    console.log('Modello Ollama: llama3.1');
    console.log('=================================');
});
