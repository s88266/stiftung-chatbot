// Dieses Modul nutzt externe Embedding-APIs.
// Vorteil: Der Server muss kein grosses Modell lokal laden und spart so RAM.

type EmbeddingProvider = "huggingface" | "openai";

const HF_API_TOKEN = process.env.HF_API_TOKEN || "";
const HF_MODEL = process.env.HF_MODEL || "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

function getEmbeddingProvider(): EmbeddingProvider {
    const configuredProvider = process.env.EMBEDDING_PROVIDER?.toLowerCase();

    if (configuredProvider === "openai" || configuredProvider === "huggingface") {
        return configuredProvider;
    }

    if (HF_API_TOKEN) {
        return "huggingface";
    }

    if (OPENAI_API_KEY) {
        return "openai";
    }

    return "huggingface";
}

export function getEmbeddingProviderName(): string {
    return getEmbeddingProvider();
}

export function hasEmbeddingCredentials(): boolean {
    const provider = getEmbeddingProvider();

    if (provider === "openai") {
        return Boolean(OPENAI_API_KEY);
    }

    return Boolean(HF_API_TOKEN);
}

export async function initializeEmbeddings(): Promise<void> {
    // Keine lokale Initialisierung notwendig beim Einsatz externer APIs.
    return;
}

export async function createEmbedding(text: string): Promise<number[]> {
    const provider = getEmbeddingProvider();

    if (provider === "openai") {
        return createOpenAIEmbedding(text);
    }

    return createHuggingFaceEmbedding(text);
}

async function createHuggingFaceEmbedding(text: string): Promise<number[]> {
    if (!HF_API_TOKEN) {
        throw new Error("HF_API_TOKEN fehlt. Setze die Umgebungsvariable fuer die Hugging Face Inference API.");
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
    const embedding = extractHuggingFaceEmbedding(data);

    return normalizeVector(embedding);
}

async function createOpenAIEmbedding(text: string): Promise<number[]> {
    if (!OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY fehlt. Setze die Umgebungsvariable fuer OpenAI Embeddings.");
    }

    const resp = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            input: text,
            model: OPENAI_EMBEDDING_MODEL,
        }),
    });

    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`OpenAI Embeddings API Fehler: ${resp.status} ${resp.statusText} - ${body}`);
    }

    const data = await resp.json();
    const embedding = data?.data?.[0]?.embedding;

    if (!Array.isArray(embedding)) {
        throw new Error("Unerwartetes Antwortformat von OpenAI Embeddings API");
    }

    return normalizeVector(embedding as number[]);
}

function extractHuggingFaceEmbedding(data: unknown): number[] {
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === "number") {
        return data as number[];
    }

    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0]) && typeof data[0][0] === "number") {
        return meanPool(data as number[][]);
    }

    if (
        Array.isArray(data) &&
        data.length > 0 &&
        Array.isArray(data[0]) &&
        Array.isArray(data[0][0])
    ) {
        return meanPool(data[0] as number[][]);
    }

    if (data && typeof data === "object" && Array.isArray((data as any).features)) {
        return meanPool((data as any).features as number[][]);
    }

    throw new Error("Unerwartetes Antwortformat von HF Inference API");
}

function meanPool(vectors: number[][]): number[] {
    if (vectors.length === 0 || vectors[0].length === 0) {
        throw new Error("Leeres Embedding erhalten");
    }

    const dim = vectors[0].length;
    const pooled = new Array(dim).fill(0);

    for (const tokenVec of vectors) {
        for (let i = 0; i < dim; i++) {
            pooled[i] += tokenVec[i];
        }
    }

    for (let i = 0; i < dim; i++) {
        pooled[i] /= vectors.length;
    }

    return pooled;
}

function normalizeVector(vector: number[]): number[] {
    let norm = 0;

    for (let i = 0; i < vector.length; i++) {
        norm += vector[i] * vector[i];
    }

    norm = Math.sqrt(norm) || 1;

    return vector.map((value) => value / norm);
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
