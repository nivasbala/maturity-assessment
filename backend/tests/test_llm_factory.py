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


# --- per-agent wrapper tests ---

class TestGetResearchAgentLlm:
    def test_uses_override_model_when_env_set(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        monkeypatch.setenv("OLLAMA_MODEL", "llama3.1:8b")
        monkeypatch.setenv("RESEARCH_AGENT_MODEL", "llama3.2:latest")
        from langchain_ollama import ChatOllama
        from app.core.llm_factory import get_research_agent_llm
        llm = get_research_agent_llm()
        assert isinstance(llm, ChatOllama)
        assert llm.model == "llama3.2:latest"

    def test_falls_back_to_provider_default_when_env_unset(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        monkeypatch.setenv("OLLAMA_MODEL", "llama3.1:8b")
        monkeypatch.delenv("RESEARCH_AGENT_MODEL", raising=False)
        from langchain_ollama import ChatOllama
        from app.core.llm_factory import get_research_agent_llm
        llm = get_research_agent_llm()
        assert isinstance(llm, ChatOllama)
        assert llm.model == "llama3.1:8b"

    def test_logs_warning_when_env_unset(self, monkeypatch, caplog):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        monkeypatch.setenv("OLLAMA_MODEL", "llama3.1:8b")
        monkeypatch.delenv("RESEARCH_AGENT_MODEL", raising=False)
        import logging
        from app.core.llm_factory import get_research_agent_llm
        with caplog.at_level(logging.WARNING, logger="app.core.llm_factory"):
            get_research_agent_llm()
        assert "RESEARCH_AGENT_MODEL not set" in caplog.text

    def test_no_warning_when_env_set(self, monkeypatch, caplog):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        monkeypatch.setenv("OLLAMA_MODEL", "llama3.1:8b")
        monkeypatch.setenv("RESEARCH_AGENT_MODEL", "llama3.1:8b")
        import logging
        from app.core.llm_factory import get_research_agent_llm
        with caplog.at_level(logging.WARNING, logger="app.core.llm_factory"):
            get_research_agent_llm()
        assert "RESEARCH_AGENT_MODEL not set" not in caplog.text


class TestGetQuestionSelectionAgentLlm:
    def test_uses_override_model_when_env_set(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        monkeypatch.setenv("OLLAMA_MODEL", "llama3.1:8b")
        monkeypatch.setenv("QUESTION_SELECTION_AGENT_MODEL", "llama3.2:latest")
        from langchain_ollama import ChatOllama
        from app.core.llm_factory import get_question_selection_agent_llm
        llm = get_question_selection_agent_llm()
        assert isinstance(llm, ChatOllama)
        assert llm.model == "llama3.2:latest"

    def test_falls_back_to_provider_default_when_env_unset(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        monkeypatch.setenv("OLLAMA_MODEL", "llama3.1:8b")
        monkeypatch.delenv("QUESTION_SELECTION_AGENT_MODEL", raising=False)
        from langchain_ollama import ChatOllama
        from app.core.llm_factory import get_question_selection_agent_llm
        llm = get_question_selection_agent_llm()
        assert isinstance(llm, ChatOllama)
        assert llm.model == "llama3.1:8b"

    def test_logs_warning_when_env_unset(self, monkeypatch, caplog):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        monkeypatch.setenv("OLLAMA_MODEL", "llama3.1:8b")
        monkeypatch.delenv("QUESTION_SELECTION_AGENT_MODEL", raising=False)
        import logging
        from app.core.llm_factory import get_question_selection_agent_llm
        with caplog.at_level(logging.WARNING, logger="app.core.llm_factory"):
            get_question_selection_agent_llm()
        assert "QUESTION_SELECTION_AGENT_MODEL not set" in caplog.text

    def test_no_warning_when_env_set(self, monkeypatch, caplog):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        monkeypatch.setenv("OLLAMA_MODEL", "llama3.1:8b")
        monkeypatch.setenv("QUESTION_SELECTION_AGENT_MODEL", "llama3.1:8b")
        import logging
        from app.core.llm_factory import get_question_selection_agent_llm
        with caplog.at_level(logging.WARNING, logger="app.core.llm_factory"):
            get_question_selection_agent_llm()
        assert "QUESTION_SELECTION_AGENT_MODEL not set" not in caplog.text


class TestGetReportAgentLlm:
    def test_uses_override_model_when_env_set(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        monkeypatch.setenv("OLLAMA_MODEL", "llama3.1:8b")
        monkeypatch.setenv("REPORT_AGENT_MODEL", "llama3.2:latest")
        from langchain_ollama import ChatOllama
        from app.core.llm_factory import get_report_agent_llm
        llm = get_report_agent_llm()
        assert isinstance(llm, ChatOllama)
        assert llm.model == "llama3.2:latest"

    def test_falls_back_to_provider_default_when_env_unset(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        monkeypatch.setenv("OLLAMA_MODEL", "llama3.1:8b")
        monkeypatch.delenv("REPORT_AGENT_MODEL", raising=False)
        from langchain_ollama import ChatOllama
        from app.core.llm_factory import get_report_agent_llm
        llm = get_report_agent_llm()
        assert isinstance(llm, ChatOllama)
        assert llm.model == "llama3.1:8b"

    def test_logs_warning_when_env_unset(self, monkeypatch, caplog):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        monkeypatch.setenv("OLLAMA_MODEL", "llama3.1:8b")
        monkeypatch.delenv("REPORT_AGENT_MODEL", raising=False)
        import logging
        from app.core.llm_factory import get_report_agent_llm
        with caplog.at_level(logging.WARNING, logger="app.core.llm_factory"):
            get_report_agent_llm()
        assert "REPORT_AGENT_MODEL not set" in caplog.text

    def test_no_warning_when_env_set(self, monkeypatch, caplog):
        monkeypatch.setenv("LLM_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        monkeypatch.setenv("OLLAMA_MODEL", "llama3.1:8b")
        monkeypatch.setenv("REPORT_AGENT_MODEL", "llama3.1:8b")
        import logging
        from app.core.llm_factory import get_report_agent_llm
        with caplog.at_level(logging.WARNING, logger="app.core.llm_factory"):
            get_report_agent_llm()
        assert "REPORT_AGENT_MODEL not set" not in caplog.text
