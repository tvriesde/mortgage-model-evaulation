"""Custom evaluator: does the agent's verdict match the ground-truth label?"""
from __future__ import annotations


class VerdictMatchEvaluator:
    """Returns 1.0 when the agent verdict equals the expected verdict, else 0.0.

    Also reports whether the miss is 'severe' (approved <-> declined), which flips
    an accept/reject outcome, versus an adjacent miss involving needs_review.
    """

    _SEVERE = {frozenset({"approved", "declined"})}

    def __call__(self, *, verdict: str, expected_verdict: str, **kwargs) -> dict:
        actual = (verdict or "").strip().lower()
        expected_norm = (expected_verdict or "").strip().lower()
        match = actual == expected_norm
        severe = (not match) and (frozenset({actual, expected_norm}) in self._SEVERE)
        return {
            "verdict_match": 1.0 if match else 0.0,
            "severe_mismatch": 1.0 if severe else 0.0,
            "actual_verdict": actual,
            "expected_verdict": expected_norm,
        }
