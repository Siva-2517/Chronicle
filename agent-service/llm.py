import os
from dotenv import load_dotenv

load_dotenv()

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

def get_embeddings():
    api_key = get_api_key()
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    
    return GoogleGenerativeAIEmbeddings(
        model="models/text-embedding-004",
        google_api_key=api_key
    )
