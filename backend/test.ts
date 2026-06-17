import knowledgeBase from "./knowledgeBase.json";
import testQuestions from "./testQuestions.json";
import { initializeEmbeddings, createEmbedding, cosineSimilarity } from "./embedding";

// Struktur der Einträge aus der Wissensbasis.
interface KnowledgeEntry {
    keywords: string[];
    answer: string;
    category: string;
    source: string;
    contact?: string;
}

interface EmbeddedKnowledgeEntry extends KnowledgeEntry {
    embedding: number[];
}

interface KeywordMatchResult {
    entry: KnowledgeEntry;
    score: number;
    confidence: number;
}

// Struktur der Testfälle, die im Testskript geprüft werden.
interface TestCase {
    question: string;
    expectedSource: string;
}

const FALLBACK_SOURCE = "https://www.stiftungbildung.org/kontakt/";
const MIN_COMBINED_SCORE = 0.3;

// Muss zur Serverlogik passen, damit die Tests dieselben Treffer bewerten.
const KEYWORD_WEIGHT = 0.25;
const EMBEDDING_WEIGHT = 0.75;

// Normalisiert Text wie im Backend, damit Umlaute, Tippvarianten und Satzzeichen gleich behandelt werden.
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Ermittelt, welche Keywords aus einem Wissenseintrag in der Testfrage vorkommen.
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

// Rechnet Keyword-Treffer in einen Score um.
function getKeywordScoreFromMatches(matchedKeywords: string[]): number {
    return matchedKeywords.reduce((score, keyword) => {
        const normalizedKeyword = normalizeText(keyword);
        return score + 100 + normalizedKeyword.length;
    }, 0);
}

// Berechnet den theoretisch maximalen Keyword-Score eines Eintrags.
function getMaxKeywordScore(keywords: string[]): number {
    return keywords.reduce((sum, keyword) => {
        const normalizedKeyword = normalizeText(keyword);

        if (!normalizedKeyword) {
            return sum;
        }

        return sum + 100 + normalizedKeyword.length;
    }, 0);
}

// Prüft zuerst exakte Keyword-Treffer, wie es auch der Server vor der Embedding-Suche tut.
function getBestKeywordMatch(message: string): KeywordMatchResult | null {
    let bestEntry: KnowledgeEntry | null = null;
    let bestScore = 0;

    for (const entry of knowledgeBase as KnowledgeEntry[]) {
        const matchedKeywords = getMatchedKeywords(message, entry.keywords);
        const score = getKeywordScoreFromMatches(matchedKeywords);

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
        confidence,
    };
}

// Erstellt denselben Suchtext wie im Server: Kategorie, Keywords und Antwort.
function createSearchText(entry: KnowledgeEntry): string {
    return [
        entry.category,
        ...entry.keywords,
        entry.answer,
    ].join(". ");
}

// Lädt das Embedding-Modell und vektorisiert alle Wissenseinträge für den Testlauf.
async function prepareKnowledgeBase(): Promise<EmbeddedKnowledgeEntry[]> {
    await initializeEmbeddings();

    return Promise.all(
        (knowledgeBase as KnowledgeEntry[]).map(async (entry) => ({
            ...entry,
            embedding: await createEmbedding(createSearchText(entry)),
        }))
    );
}

// Findet den besten passenden Eintrag:
// erst Keyword-Match, danach semantische Suche mit Embedding- und Keyword-Gewichtung.
async function getBestMatch(
    message: string,
    embeddedKnowledgeBase: EmbeddedKnowledgeEntry[]
): Promise<KnowledgeEntry | null> {
    const keywordMatch = getBestKeywordMatch(message);

    if (keywordMatch && keywordMatch.score > 0) {
        return keywordMatch.entry;
    }

    const userEmbedding = await createEmbedding(message);

    let bestMatch: KnowledgeEntry | null = null;
    let bestCombinedScore = -1;

    for (const entry of embeddedKnowledgeBase) {
        if (!entry.keywords) {
            continue;
        }

        const embeddingScore = cosineSimilarity(userEmbedding, entry.embedding);
        const matchedKeywords = getMatchedKeywords(message, entry.keywords);
        const keywordScore = getKeywordScoreFromMatches(matchedKeywords);
        const maxKeywordScore = getMaxKeywordScore(entry.keywords);
        const keywordConfidence = maxKeywordScore > 0 ? keywordScore / maxKeywordScore : 0;
        const combinedScore =
            embeddingScore * EMBEDDING_WEIGHT +
            Math.min(keywordConfidence, 1) * KEYWORD_WEIGHT;

        if (combinedScore > bestCombinedScore) {
            bestCombinedScore = combinedScore;
            bestMatch = entry;
        }
    }

    return bestCombinedScore >= MIN_COMBINED_SCORE ? bestMatch : null;
}

// Führt alle Testfragen aus und prüft, ob die erwartete Quelle zurückgegeben wird.
async function runTests() {
    let passed = 0;
    let failed = 0;

    console.log("🧪 Starte Tests für die Wissensbasis...\n");

    const embeddedKnowledgeBase = await prepareKnowledgeBase();

    for (const test of testQuestions as TestCase[]) {
        const match = await getBestMatch(test.question, embeddedKnowledgeBase);
        const actualSource = match ? match.source : FALLBACK_SOURCE;
        const success = actualSource === test.expectedSource;

        if (success) {
            passed++;
            console.log(`✅ "${test.question}"`);
        } else {
            failed++;
            console.log(`❌ "${test.question}"`);
            console.log(`   erwartet: ${test.expectedSource}`);
            console.log(`   erhalten: ${actualSource}`);
        }
    }

    console.log(
        `\n📊 Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen von ${passed + failed}`
    );

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch((error) => {
    console.error("Tests konnten nicht ausgeführt werden:", error);
    process.exit(1);
});
