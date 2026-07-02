import os

from langchain_core.language_models import BaseChatModel


def get_llm(json_mode: bool = False) -> BaseChatModel:
    """Return a configured LLM for the active provider.

    Args:
        json_mode: When True, instruct the model to emit only valid JSON.
                   For Ollama this sets format="json" at the API level.
                   Anthropic and OpenAI handle structured output separately
                   so this flag is a no-op for them (the system prompt is
                   sufficient).
    """
    provider = os.getenv("LLM_PROVIDER", "ollama")

    if provider == "ollama":
        from langchain_ollama import ChatOllama
        kwargs: dict = dict(
            model=os.getenv("OLLAMA_MODEL", "llama3.2"),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://ollama:11434"),
        )
        if json_mode:
            kwargs["format"] = "json"
        return ChatOllama(**kwargs)
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
            api_key=os.getenv("ANTHROPIC_API_KEY"),
        )
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        kwargs: dict = dict(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            api_key=os.getenv("OPENAI_API_KEY"),
        )
        if json_mode:
            kwargs["model_kwargs"] = {"response_format": {"type": "json_object"}}
        return ChatOpenAI(**kwargs)
    else:
        raise ValueError(f"Unsupported LLM_PROVIDER: {provider}")
