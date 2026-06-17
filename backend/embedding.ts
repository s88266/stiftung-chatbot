import { pipeline } from "@huggingface/transformers";

let extractor: any;

// Lädt das lokale Feature-Extraction-Modell einmal beim Serverstart.
// Das Modell wandelt deutsche und mehrsprachige Texte in vergleichbare Zahlenvektoren um.
export async function initializeEmbeddings() {
    extractor = await pipeline(
        "feature-extraction",
        "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
    );
}

// Erstellt aus einem Text ein normalisiertes Embedding.
// Durch pooling: "mean" entsteht ein einzelner Vektor für den kompletten Satz.
export async function createEmbedding(text: string): Promise<number[]> {
    const output = await extractor(text, {
        pooling: "mean",
        normalize: true,
    });

    return Array.from(output.data);
}

// Vergleicht zwei Embeddings. Je näher der Wert an 1 ist, desto ähnlicher ist die Bedeutung.
export function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
