"""Shared JSON-extraction helpers for LLM output parsing."""


def extract_json_object(text: str) -> str:
    """Return the first balanced JSON object from text, handling prose preamble and fences.

    Raises ValueError if no complete JSON object is found.
    """
    text = text.strip()
    start = text.find("{")
    if start == -1:
        raise ValueError("No JSON object found in LLM response")
    depth = 0
    in_string = False
    escape_next = False
    for i, ch in enumerate(text[start:], start):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    raise ValueError("Incomplete JSON object in LLM response")


def extract_json_array(text: str) -> str:
    """Return the first balanced JSON array from text, handling prose preamble and fences.

    Uses the same depth-tracking state machine as extract_json_object so that
    brackets inside string values or nested objects are handled correctly.

    Raises ValueError if no complete JSON array is found.
    """
    text = text.strip()
    start = text.find("[")
    if start == -1:
        raise ValueError("No JSON array found in LLM response")
    depth = 0
    in_string = False
    escape_next = False
    for i, ch in enumerate(text[start:], start):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    raise ValueError("Incomplete JSON array in LLM response")
