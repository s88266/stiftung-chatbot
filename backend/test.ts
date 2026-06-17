import knowledgeBase from "./knowledgeBase.json";
import testQuestions from "./testQuestions.json";

// Struktur der Einträge aus der Wissensbasis.
interface KnowledgeEntry {
    keywords: string[];
    answer: string;
    category: string;
    source: string;
    contact?: string;
}

// Struktur der Testfälle, die im Testskript geprüft werden.
interface TestCase {
    question: string;
    expectedSource: string;
}

const FALLBACK_SOURCE = "https://www.stiftungbildung.org/kontakt/";

// Normalisiert Text wie im Backend, damit die Tests identisch arbeiten.
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// Findet den besten passenden Eintrag aus der Wissensbasis für die gegebene Frage.
function getBestMatch(message: string): KnowledgeEntry | null {
    const normalizedMessage = normalizeText(message);
    const words = normalizedMessage.split(" ");

    let bestMatch: KnowledgeEntry | null = null;
    let bestScore = 0;

    for (const entry of knowledgeBase as KnowledgeEntry[]) {
        if (!entry.keywords) {
            continue;
        }

        let finalScore = 0;

        for (const keyword of entry.keywords) {
            const normalizedKeyword = normalizeText(keyword);

            if (!normalizedKeyword) {
                continue;
            }

            const isPhrase = normalizedKeyword.includes(" ");

            const matches = isPhrase
                ? normalizedMessage.includes(normalizedKeyword)
                : words.includes(normalizedKeyword);

            if (matches) {
                finalScore += 100 + normalizedKeyword.length;
            }
        }

        if (finalScore > bestScore) {
            bestScore = finalScore;
            bestMatch = entry;
        }
    }

    return bestMatch;
}

// Führt alle Testfragen aus und prüft, ob die erwartete Quelle zurückgegeben wird.
function runTests() {
    let passed = 0;
    let failed = 0;

    console.log("🧪 Starte Tests für die Wissensbasis...\n");

    for (const test of testQuestions as TestCase[]) {
        const match = getBestMatch(test.question);
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

runTests();