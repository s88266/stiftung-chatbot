import express, { Request, Response } from "express";
import cors from "cors";
import knowledgeBase from "./knowledgeBase.json";
import { initializeEmbeddings, createEmbedding, cosineSimilarity } from "./embedding";
// Struktur der Wissenseinträge in knowledgeBase.json.

interface KnowledgeEntry {
    keywords: string[];
    category: string;
    answer: string;
    source: string;
    contact?: string;
}

interface EmbeddedKnowledgeEntry extends KnowledgeEntry {
    embedding: number[];
    searchText: string;
}

let embeddedKnowledgeBase: EmbeddedKnowledgeEntry[] = [];

// Struktur des Anfragekörpers, der vom Frontend gesendet wird.
interface ChatRequestBody {
    message: string;
}

interface MatchResult {
    entry: KnowledgeEntry;
    score: number;
    confidence: number;
    matchedKeywords: string[];
}

interface KeywordDebugResult {
    category: string;
    score: number;
    confidence: number;
    matchedKeywords: string[];
    source: string;
}

interface EmbeddingDebugResult {
    category: string;
    embeddingScore: number;
    keywordConfidence: number;
    combinedScore: number;
    matchedKeywords: string[];
    source: string;
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
const MIN_COMBINED_SCORE = 0.3;

// Gewichtung für die semantische Suche:
// Embeddings tragen den Hauptteil, Keyword-Treffer geben bei exakten Begriffen einen Bonus.
const KEYWORD_WEIGHT = 0.25;
const EMBEDDING_WEIGHT = 0.75;

// Text normalisieren: Kleinbuchstaben, Umlaute/Diakritika vereinheitlichen,
// Satzzeichen entfernen und mehrere Leerzeichen zusammenfassen.
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Sammelt alle Keywords eines Wissenseintrags, die in der Nutzerfrage vorkommen.
// Mehrwort-Keywords werden als Phrase gesucht, einzelne Wörter als exaktes Wort.
function getMatchedKeywords(message: string, keywords: string[]): string[] {
    const normalizedMessage = normalizeText(message);
    const words = normalizedMessage.split(" ");

    const matchedKeywords: string[] = [];

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
            matchedKeywords.push(keyword);
        }
    }

    return matchedKeywords;
}

// Bewertet gefundene Keywords. Längere Keywords zählen etwas stärker als kurze Wörter.
function getKeywordScoreFromMatches(matchedKeywords: string[]): number {
    return matchedKeywords.reduce((score, keyword) => {
        const normalizedKeyword = normalizeText(keyword);
        return score + 100 + normalizedKeyword.length;
    }, 0);
}

// Hilfsfunktion für einfache Score-Abfragen ohne zusätzliche Match-Details.
function getKeywordScore(message: string, keywords: string[]): number {
    return getKeywordScoreFromMatches(getMatchedKeywords(message, keywords));
}

// Maximal möglicher Keyword-Score eines Eintrags, um daraus eine Confidence zu berechnen.
function getMaxKeywordScore(keywords: string[]): number {
    return keywords.reduce((sum, keyword) => {
        const normalizedKeyword = normalizeText(keyword);

        if (!normalizedKeyword) {
            return sum;
        }

        return sum + 100 + normalizedKeyword.length;
    }, 0);
}

// Findet den besten reinen Keyword-Treffer.
// Diese Treffer haben Vorrang, damit klare Begriffe wie "Datenschutz" stabil bleiben.
function getBestMatch(message: string): MatchResult | null {
    let bestEntry: KnowledgeEntry | null = null;
    let bestScore = 0;
    let bestMatchedKeywords: string[] = [];

    for (const entry of knowledgeBase as KnowledgeEntry[]) {
        if (!entry.keywords) {
            continue;
        }

        const matchedKeywords = getMatchedKeywords(message, entry.keywords);
        const score = getKeywordScoreFromMatches(matchedKeywords);

        if (score > bestScore) {
            bestScore = score;
            bestEntry = entry;
            bestMatchedKeywords = matchedKeywords;
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
        matchedKeywords: bestMatchedKeywords,
    };
}

// Erstellt Debug-Daten für das Terminal-Logging.
// Damit sieht man, welche Kategorien über Keywords wie stark gewichtet wurden.
function getKeywordDebugResults(message: string): KeywordDebugResult[] {
    return (knowledgeBase as KnowledgeEntry[])
        .map((entry) => {
            const matchedKeywords = getMatchedKeywords(message, entry.keywords);
            const score = getKeywordScoreFromMatches(matchedKeywords);
            const maxScore = getMaxKeywordScore(entry.keywords);
            const confidence = maxScore > 0 ? score / maxScore : 0;

            return {
                category: entry.category,
                score,
                confidence: Number(confidence.toFixed(2)),
                matchedKeywords,
                source: entry.source,
            };
        })
        .sort((a, b) => b.score - a.score);
}

// Baut den Text, der als Embedding gespeichert wird.
// Keywords und Antwort werden kombiniert, damit Synonyme und natürliche Fragen besser passen.
function createSearchText(entry: KnowledgeEntry): string {
    return [
        entry.category,
        ...entry.keywords,
        entry.answer,
    ].join(". ");
}

app.post("/chat", async (req: Request<{}, {}, ChatRequestBody>, res: Response) => {
    console.log("Anfrage erhalten:", req.body);

    const userMessage = req.body.message;

    if (!userMessage || userMessage.trim() === "") {
        return res.status(400).json({
            answer: "Bitte gib eine Nachricht ein.",
            source: FALLBACK_ENTRY.source,
            contact: FALLBACK_ENTRY.contact,
        });
    }

    const keywordScores = getKeywordDebugResults(userMessage);

    console.log("Keyword-Gewichtung:", {
        question: userMessage,
        threshold: MIN_CONFIDENCE,
        topMatches: keywordScores.slice(0, 5),
    });

    const keywordMatch = getBestMatch(userMessage);

    if (keywordMatch && keywordMatch.score > 0) {
        console.log("Keyword-Ergebnis:", {
            question: userMessage,
            category: keywordMatch.entry.category,
            score: keywordMatch.score,
            confidence: keywordMatch.confidence,
            matchedKeywords: keywordMatch.matchedKeywords,
            source: keywordMatch.entry.source,
        });

        return res.json({
            answer: keywordMatch.entry.answer,
            source: keywordMatch.entry.source,
            contact: keywordMatch.entry.contact,
            confidence: keywordMatch.confidence,
            matchType: "keyword",
        });
    }

    // Wenn kein Keyword passt, übernimmt die semantische Suche über Embeddings.
    const userEmbedding = await createEmbedding(userMessage);

    let bestMatch: EmbeddedKnowledgeEntry | null = null;
    let bestCombinedScore = -1;
    let bestEmbeddingScore = -1;
    let bestKeywordConfidence = 0;
    let bestMatchedKeywords: string[] = [];
    const embeddingScores: EmbeddingDebugResult[] = [];

    for (const entry of embeddedKnowledgeBase) {
        const embeddingScore = cosineSimilarity(userEmbedding, entry.embedding);
        const matchedKeywords = getMatchedKeywords(userMessage, entry.keywords);
        const keywordScore = getKeywordScoreFromMatches(matchedKeywords);
        const maxKeywordScore = getMaxKeywordScore(entry.keywords);
        const keywordConfidence = maxKeywordScore > 0 ? keywordScore / maxKeywordScore : 0;
        const combinedScore =
            embeddingScore * EMBEDDING_WEIGHT +
            Math.min(keywordConfidence, 1) * KEYWORD_WEIGHT;

        embeddingScores.push({
            category: entry.category,
            embeddingScore: Number(embeddingScore.toFixed(4)),
            keywordConfidence: Number(keywordConfidence.toFixed(4)),
            combinedScore: Number(combinedScore.toFixed(4)),
            matchedKeywords,
            source: entry.source,
        });

        if (combinedScore > bestCombinedScore) {
            bestCombinedScore = combinedScore;
            bestEmbeddingScore = embeddingScore;
            bestKeywordConfidence = keywordConfidence;
            bestMatchedKeywords = matchedKeywords;
            bestMatch = entry;
        }
    }

    embeddingScores.sort((a, b) => b.combinedScore - a.combinedScore);

    const isConfidentMatch = bestMatch !== null && bestCombinedScore >= MIN_COMBINED_SCORE;
    const match: KnowledgeEntry = isConfidentMatch && bestMatch ? bestMatch : FALLBACK_ENTRY;

    console.log("Semantische Gewichtung:", {
        question: userMessage,
        threshold: MIN_COMBINED_SCORE,
        weights: {
            embedding: EMBEDDING_WEIGHT,
            keyword: KEYWORD_WEIGHT,
        },
        topMatches: embeddingScores.slice(0, 5),
    });

    console.log("Such-Ergebnis:", {
        question: userMessage,
        category: match.category,
        combinedScore: Number(bestCombinedScore.toFixed(4)),
        embeddingScore: Number(bestEmbeddingScore.toFixed(4)),
        keywordConfidence: Number(bestKeywordConfidence.toFixed(4)),
        matchedKeywords: bestMatchedKeywords,
        usedFallback: !isConfidentMatch,
        source: match.source,
    });

    return res.json({
        answer: match.answer,
        source: match.source,
        contact: match.contact,
        confidence: Number(bestCombinedScore.toFixed(4)),
        matchType: isConfidentMatch ? "semantic" : "fallback",
    });
});


// Backend-Server auf Port 3001 starten.
async function startServer() {
    await initializeEmbeddings();

    // Beim Start werden alle Wissenseinträge einmal vektorisiert.
    // Dadurch muss pro Anfrage nur noch die Nutzerfrage neu eingebettet werden.
    embeddedKnowledgeBase = await Promise.all(
        knowledgeBase.map(async (entry) => {
            const searchText = createSearchText(entry);

            return {
                ...entry,
                searchText,
                embedding: await createEmbedding(searchText),
            };
        })
    );

    const PORT = process.env.PORT || 3001;

    app.listen(PORT, () => {
        console.log(`Server läuft auf Port ${PORT}`);
    });
}

startServer();
