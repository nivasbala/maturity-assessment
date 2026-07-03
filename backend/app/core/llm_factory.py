import logging
import os

from langchain_core.language_models import BaseChatModel

logger = logging.getLogger(__name__)


def get_llm(json_mode: bool = False, model_env_var: str | None = None) -> BaseChatModel:
    """Return a configured LLM for the active provider.

    Args:
        json_mode: When True, instruct the model to emit only valid JSON.
                   For Ollama this sets format="json" at the API level.
                   Anthropic and OpenAI handle structured output separately
                   so this flag is a no-op for them (the system prompt is
                   sufficient).
        model_env_var: If provided, read this env var for the model name
                       instead of the provider default. Falls back to the
                       provider default if the var is unset.
    """
    provider = os.getenv("LLM_PROVIDER", "ollama")

    if provider == "ollama":
        from langchain_ollama import ChatOllama
        default_model = os.getenv("OLLAMA_MODEL", "llama3.2")
        model = os.getenv(model_env_var, default_model) if model_env_var else default_model
        kwargs: dict = dict(
            model=model,
            base_url=os.getenv("OLLAMA_BASE_URL", "http://ollama:11434"),
        )
        if json_mode:
            kwargs["format"] = "json"
        return ChatOllama(**kwargs)
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        default_model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
        model = os.getenv(model_env_var, default_model) if model_env_var else default_model
        return ChatAnthropic(
            model=model,
            api_key=os.getenv("ANTHROPIC_API_KEY"),
        )
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        default_model = os.getenv("OPENAI_MODEL", "gpt-4o")
        model = os.getenv(model_env_var, default_model) if model_env_var else default_model
        kwargs: dict = dict(
            model=model,
            api_key=os.getenv("OPENAI_API_KEY"),
        )
        if json_mode:
            kwargs["model_kwargs"] = {"response_format": {"type": "json_object"}}
        return ChatOpenAI(**kwargs)
    else:
        raise ValueError(f"Unsupported LLM_PROVIDER: {provider}")


def get_research_agent_llm(json_mode: bool = False) -> BaseChatModel:
    if not os.getenv("RESEARCH_AGENT_MODEL"):
        logger.warning("RESEARCH_AGENT_MODEL not set, using provider default model")
    return get_llm(json_mode, model_env_var="RESEARCH_AGENT_MODEL")


def get_question_selection_agent_llm(json_mode: bool = False) -> BaseChatModel:
    if not os.getenv("QUESTION_SELECTION_AGENT_MODEL"):
        logger.warning("QUESTION_SELECTION_AGENT_MODEL not set, using provider default model")
    return get_llm(json_mode, model_env_var="QUESTION_SELECTION_AGENT_MODEL")


def get_report_agent_llm(json_mode: bool = False) -> BaseChatModel:
    if not os.getenv("REPORT_AGENT_MODEL"):
        logger.warning("REPORT_AGENT_MODEL not set, using provider default model")
    return get_llm(json_mode, model_env_var="REPORT_AGENT_MODEL")
