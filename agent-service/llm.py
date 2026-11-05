import os
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

def get_api_key():
    """
    Retrieves the Gemini API Key, trying primary, secondary, and standard Google variables.
    """
    key = os.getenv("GEMINI_API_KEY")
    if key and key.strip():
        return key.strip()
        
    key = os.getenv("GEMINI_API_KEY_SECONDARY")
    if key and key.strip():
        return key.strip()
        
    key = os.getenv("GOOGLE_API_KEY")
    if key and key.strip():
        return key.strip()
        
    raise ValueError("No Gemini API key found in environment variables. Please set GEMINI_API_KEY or GEMINI_API_KEY_SECONDARY.")

def get_llm(temperature=0.0):
    api_key = get_api_key()
    from langchain_google_genai import ChatGoogleGenerativeAI
    
    # Using gemini-1.5-flash for fast and cost-effective operations
    model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    return ChatGoogleGenerativeAI(
        model=model_name,
        temperature=temperature,
        google_api_key=api_key
    )

import requests
from langchain_core.embeddings import Embeddings

class GeminiEmbeddings(Embeddings):
    """
    Direct REST-based Gemini Embeddings implementation.
    Bypasses gRPC transport issues on Windows/containerized platforms,
    and supports batch embedding via GenerativeLanguage v1beta API.
    """
    def __init__(self, api_key: str, model: str = "models/gemini-embedding-001"):
        self.api_key = api_key
        # Ensure clean model prefix
        if not model.startswith("models/"):
            model = f"models/{model}"
        self.model = model
        self.endpoint = f"https://generativelanguage.googleapis.com/v1beta/{self.model}"

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        # Google Gemini batchEmbedContents endpoint accepts up to 100 texts per request
        batch_size = 50
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            chunk = texts[i : i + batch_size]
            payload = {
                "requests": [
                    {
                        "model": self.model,
                        "content": {"parts": [{"text": t}]}
                    }
                    for t in chunk
                ]
            }
            import time
            url = f"{self.endpoint}:batchEmbedContents?key={self.api_key}"
            
            max_retries = 3
            backoff_sec = 2.0
            data = None

            for attempt in range(max_retries):
                response = requests.post(url, json=payload, timeout=45)
                if response.status_code == 200:
                    data = response.json()
                    break
                elif response.status_code in (429, 503):
                    if attempt < max_retries - 1:
                        time.sleep(backoff_sec)
                        backoff_sec *= 2.0
                        continue
                    else:
                        raise RuntimeError(
                            f"Gemini embedding API rate limit/busy ({response.status_code}) after {max_retries} retries: {response.text}"
                        )
                else:
                    raise RuntimeError(
                        f"Gemini embedding API error ({response.status_code}): {response.text}"
                    )

            chunk_embeddings = [item["values"] for item in data.get("embeddings", [])]
            all_embeddings.extend(chunk_embeddings)

        return all_embeddings

    def embed_query(self, text: str) -> list[float]:
        results = self.embed_documents([text])
        if not results:
            return []
        return results[0]

def get_embeddings():
    """
    Returns an Embeddings instance configured with the Gemini API key
    and the model from GEMINI_EMBEDDING_MODEL (default: models/gemini-embedding-001).
    """
    api_key = get_api_key()
    model_name = os.getenv("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001")
    return GeminiEmbeddings(api_key=api_key, model=model_name)

