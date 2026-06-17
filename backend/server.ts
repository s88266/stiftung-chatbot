import express, { Request, Response } from "express";
import cors from "cors";
import knowledgeBase from "./knowledgeBase.json";

// Struktur der Wissenseinträge in knowledgeBase.json.
interface KnowledgeEntry {
    keywords: string[];
    category: string;
    answer: string;
    source: string;
    contact?: string;
}

// Struktur des Anfragekörpers, der vom Frontend gesendet wird.
interface ChatRequestBody {
    message: string;
}

interface MatchResult {
    entry: KnowledgeEntry;
    score: number;
    confidence: number;
}

const app = express();

// CORS zulassen und JSON-Parsing aktivieren.
app.use(cors());
app.use(express.json());

// Fallback-Antwort, wenn keine passende Information gefunden wird.
const FALLBACK_ENTRY: KnowledgeEntry = {
    keywords: [],
    category: "kontakt",
    answer:
        "Dazu habe ich leider keine genaue Information gefunden. Bitte wende dich direkt an die Stiftung Bildung.",
    source: "https://www.stiftungbildung.org/kontakt/",
};

const MIN_CONFIDENCE = 0.1;

// Text normalisieren: Kleinbuchstaben, Sonderzeichen entfernen und mehrere Leerzeichen zusammenfassen.
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Bestimmt den Score eines Eintrags anhand der Schlüsselwörter.
function getKeywordScore(message: string, keywords: string[]): number {
    const normalizedMessage = normalizeText(message);
    const words = normalizedMessage.split(" ");

    let score = 0;

    for (const keyword of keywords) {
        const normalizedKeyword = normalizeText(keyword);

        if (!normalizedKeyword) {
            continue;
        }

        const isPhrase = normalizedKeyword.includes(" ");

        const matches = isPhrase
            ? normalizedMessage.includes(normalizedKeyword)
            : words.includes(normalizedKeyword);

        if (matches) {
            score += 100 + normalizedKeyword.length;
        }
    }

    return score;
}

function getMaxKeywordScore(keywords: string[]): number {
    return keywords.reduce((sum, keyword) => {
        const normalizedKeyword = normalizeText(keyword);

        if (!normalizedKeyword) {
            return sum;
        }

        return sum + 100 + normalizedKeyword.length;
    }, 0);
}

function getBestMatch(message: string): MatchResult | null {
    let bestEntry: KnowledgeEntry | null = null;
    let bestScore = 0;

    for (const entry of knowledgeBase as KnowledgeEntry[]) {
        if (!entry.keywords) {
            continue;
        }

        const score = getKeywordScore(message, entry.keywords);

        if (score > bestScore) {
            bestScore = score;
            bestEntry = entry;
        }
    }

    if (!bestEntry || bestScore === 0) {
        return null;
    }

    const maxScore = getMaxKeywordScore(bestEntry.keywords);
    const confidence = maxScore > 0 ? bestScore / maxScore : 0;

    return {
        entry: bestEntry,
        score: bestScore,
        confidence: Number(confidence.toFixed(2)),
    };
}

app.post("/chat", (req: Request<{}, {}, ChatRequestBody>, res: Response) => {
    console.log("Anfrage erhalten:", req.body);

    const userMessage = req.body.message;

    // Validierung der Eingabe: leere Nachrichten sind nicht erlaubt.
    if (!userMessage || userMessage.trim() === "") {
        return res.status(400).json({
            answer: "Bitte gib eine Nachricht ein.",
            source: FALLBACK_ENTRY.source,
            contact: FALLBACK_ENTRY.contact,
        });
    }

    // Wissensbasis nach der besten Übereinstimmung durchsuchen.
    const matchResult = getBestMatch(userMessage);
    const isConfidentMatch =
        matchResult !== null && matchResult.confidence >= MIN_CONFIDENCE;
    const match = isConfidentMatch ? matchResult.entry : FALLBACK_ENTRY;

    console.log("Match-Ergebnis:", {
        question: userMessage,
        category: match.category,
        confidence: matchResult?.confidence ?? 0,
        score: matchResult?.score ?? 0,
        usedFallback: !isConfidentMatch,
        source: match.source,
    });

    return res.json({
        answer: match.answer,
        source: match.source,
        contact: match.contact,
    });
});

// Backend-Server auf Port 3001 starten.
app.listen(3001, () => {
    console.log("Backend läuft auf http://localhost:3001");
});
