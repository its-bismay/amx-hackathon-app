import re
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("security_guardrails")

class GuardrailCheckResult(BaseModel):
    is_safe: bool
    risk_score: float = Field(ge=0.0, le=1.0)
    attack_category: Optional[str] = None
    reason: Optional[str] = None
    matched_patterns: List[str] = Field(default_factory=list)

# Comprehensive Prompt Injection & System Override Signature Patterns
INJECTION_SIGNATURES = [
    # 1. System Prompt Override & Jailbreaks
    (
        r"(ignore|disregard|bypass|forget|override)\s+(all\s+)?(previous|prior|above|system)\s+(instructions|prompt|rules|constraints|directives)",
        "SYSTEM_PROMPT_OVERRIDE",
        "Attempt to override or bypass LLM system instructions"
    ),
    (
        r"(developer|admin|god|root|unrestricted|jailbreak|dan)\s+mode",
        "JAILBREAK_ATTEMPT",
        "Attempt to activate unrestricted or jailbroken developer mode"
    ),
    (
        r"act\s+as\s+(an?\s+)?(unrestricted|root|admin|system|super-user|hacker|bank\s+override)",
        "ROLEPLAY_JAILBREAK",
        "Roleplay attempt aiming to assume elevated administrative permissions"
    ),
    
    # 2. Unauthorized Account Override & Debit Injection
    (
        r"(transfer|send|pay|debit|pull|move|take)\s+(money|funds|\₹|\$)?\s*from\s+account\s*(\#|\:)?\s*\d+",
        "UNAUTHORIZED_SOURCE_DEBIT",
        "Attempt to force transfer from a specific third-party account number"
    ),
    (
        r"from\s+(victim|ceo|admin|other|target|another|someone\s+else('s)?)\s+account",
        "UNAUTHORIZED_SOURCE_DEBIT",
        "Attempt to initiate fund transfer from another customer's account"
    ),
    (
        r"override\s+(source|sender|origin)\s+account",
        "PARAMETER_TAMPERING",
        "Attempt to force override source account metadata"
    ),
    
    # 3. Delimiter & Structural Tag Injection
    (
        r"<\/?(system|override|admin|prompt|developer|instructions)>",
        "DELIMITER_INJECTION",
        "Injection of reserved system XML/HTML tags"
    ),
    (
        r"\[(SYSTEM|ADMIN|DEVELOPER)\_PROMPT\]",
        "DELIMITER_INJECTION",
        "Injection of reserved system prompt header brackets"
    ),
    
    # 4. System Prompt Extraction & Data Leakage
    (
        r"(show|reveal|display|print|output|dump|share)\s+(your\s+)?(system\s+prompt|initial\s+instructions|hidden\s+rules|internal\s+guidelines)",
        "PROMPT_LEAK_ATTEMPT",
        "Attempt to extract confidential system instructions or internal architecture prompts"
    )
]

def inspect_prompt_safety(prompt: str) -> GuardrailCheckResult:
    """
    Pre-LLM Security Guardrail Classifier.
    Analyzes raw user input for direct prompt injection attacks, jailbreak attempts,
    unauthorized debit instructions, and delimiter spoofing BEFORE calling Gemini or the SBF Gateway.
    """
    if not prompt or not prompt.strip():
        return GuardrailCheckResult(is_safe=True, risk_score=0.0)

    clean_prompt = prompt.strip()
    normalized = re.sub(r'\s+', ' ', clean_prompt.lower())

    matched_categories = []
    reasons = []
    matched_patterns = []

    for pattern, category, description in INJECTION_SIGNATURES:
        match = re.search(pattern, normalized, re.IGNORECASE)
        if match:
            matched_categories.append(category)
            reasons.append(description)
            matched_patterns.append(match.group(0))
            logger.warning(f"Guardrail Flagged: [{category}] Match '{match.group(0)}' in prompt: '{clean_prompt[:60]}...'")

    if matched_categories:
        primary_cat = matched_categories[0]
        primary_reason = reasons[0]
        # Calculate risk score based on matches
        risk = min(1.0, 0.75 + (0.1 * len(matched_categories)))

        return GuardrailCheckResult(
            is_safe=False,
            risk_score=risk,
            attack_category=primary_cat,
            reason=primary_reason,
            matched_patterns=matched_patterns
        )

    return GuardrailCheckResult(
        is_safe=True,
        risk_score=0.05
    )
