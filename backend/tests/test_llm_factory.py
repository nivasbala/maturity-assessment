import os

import pytest


def test_unknown_provider_raises_value_error():
    os.environ["LLM_PROVIDER"] = "unsupported_provider"
    from importlib import reload
    import app.core.llm_factory as factory
    with pytest.raises(ValueError, match="Unsupported LLM_PROVIDER"):
        factory.get_llm()


def test_ollama_provider_returns_chat_model(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_MODEL", "llama3.2")
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
    from langchain_ollama import ChatOllama
    from app.core.llm_factory import get_llm
    llm = get_llm()
    assert isinstance(llm, ChatOllama)


def test_anthropic_provider_returns_chat_model(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    from langchain_anthropic import ChatAnthropic
    from app.core.llm_factory import get_llm
    llm = get_llm()
    assert isinstance(llm, ChatAnthropic)


def test_openai_provider_returns_chat_model(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-4o")
    from langchain_openai import ChatOpenAI
    from app.core.llm_factory import get_llm
    llm = get_llm()
    assert isinstance(llm, ChatOpenAI)
