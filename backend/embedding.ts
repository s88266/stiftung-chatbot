// Dieses Modul nutzt die Hugging Face Inference API zum Erstellen von Embeddings.
// Vorteil: Der Server muss kein großes Modell lokal laden und spart so RAM.

const HF_API_TOKEN = process.env.HF_API_TOKEN || "";
const HF_MODEL = process.env.HF_MODEL || "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";

export async function initializeEmbeddings(): Promise<void> {
    // Keine lokale Initialisierung notwendig beim Einsatz der Inference API.
    return;
}

export async function createEmbedding(text: string): Promise<number[]> {
    if (!HF_API_TOKEN) {
        throw new Error("HF_API_TOKEN fehlt. Setze die Umgebungsvariable für die Hugging Face Inference API.");
    }

    const url = `https://api-inference.huggingface.co/pipeline/feature-extraction/${encodeURIComponent(HF_MODEL)}`;

    const resp = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${HF_API_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    });

    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`HF Inference API Fehler: ${resp.status} ${resp.statusText} - ${body}`);
    }

    const data = await resp.json();

    // Erwartetes Format: Array von Token-Vektoren: [[...], [...], ...]
    let vectors: number[][] = [];

    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
        vectors = data as number[][];
    } else if (data && Array.isArray((data as any).features)) {
        vectors = (data as any).features as number[][];
    } else {
        throw new Error("Unerwartetes Antwortformat von HF Inference API");
    }

    const dim = vectors[0].length;
    const pooled = new Array(dim).fill(0);

    for (const tokenVec of vectors) {
        for (let i = 0; i < dim; i++) pooled[i] += tokenVec[i];
    }
    for (let i = 0; i < dim; i++) pooled[i] /= vectors.length;

    // L2-Normalisierung
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += pooled[i] * pooled[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) pooled[i] = pooled[i] / norm;

    return pooled;
}

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
