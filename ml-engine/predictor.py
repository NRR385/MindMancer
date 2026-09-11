"""
ML Engine Predictor and Question Selector for Mind-Mancer.
Evaluates candidate questions using tri-state entropy, unknown penalization,
and DecisionTreeClassifier feature importances.
"""

import math
from typing import Dict, List, Optional, Any
from trainer import trainer


def calculate_tristate_entropy(p_true: float, p_false: float, p_unknown: float) -> float:
    """
    Calculates tri-state Shannon entropy across True, False, and Unknown probabilities.
    H = - sum(p * log2(p)) for p > 0.
    """
    entropy = 0.0
    for p in (p_true, p_false, p_unknown):
        if p > 0.0:
            entropy -= p * math.log2(p)
    return float(entropy)


class QuestionPredictor:
    def __init__(self):
        pass

    def get_next_question(
        self,
        candidate_names: List[str],
        asked_features: List[str],
        characters_data: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Evaluates unasked features across the candidate pool using:
        Utility(f) = Entropy(f) * DistinguishingRatio(f) * (1.0 + TreeImportance(f))
        """
        available_features = trainer.features
        if not available_features:
            return {
                "featureKey": None,
                "status": "no_features_available",
                "diagnostics": None
            }

        unasked = [f for f in available_features if f not in asked_features]
        if not unasked:
            return {
                "featureKey": None,
                "status": "questions_exhausted",
                "diagnostics": None
            }

        # Determine candidate pool traits
        if characters_data:
            traits_source = {c["name"]: c.get("traits", {}) for c in characters_data}
            all_names = [c["name"] for c in characters_data]
        else:
            traits_source = trainer.character_traits_cache
            all_names = trainer.characters

        # Filter candidate pool
        if candidate_names:
            valid_candidates = [name for name in candidate_names if name in traits_source]
            if not valid_candidates:
                valid_candidates = all_names
        else:
            valid_candidates = all_names

        n_candidates = len(valid_candidates)
        if n_candidates == 0:
            return {
                "featureKey": None,
                "status": "no_candidates_remain",
                "diagnostics": None
            }

        evaluations: List[Dict[str, Any]] = []

        for feat in unasked:
            n_true = 0
            n_false = 0
            n_unknown = 0

            for char_name in valid_candidates:
                traits = traits_source.get(char_name, {})
                if isinstance(traits, dict):
                    val = traits.get(feat)
                else:
                    val = getattr(traits, "get", lambda k: None)(feat)

                if val is True:
                    n_true += 1
                elif val is False:
                    n_false += 1
                else:
                    n_unknown += 1

            p_true = n_true / n_candidates
            p_false = n_false / n_candidates
            p_unknown = n_unknown / n_candidates

            entropy = calculate_tristate_entropy(p_true, p_false, p_unknown)
            distinguishing_ratio = 1.0 - p_unknown  # gamma(f)
            tree_importance = trainer.feature_importances.get(feat, 0.0)

            # Combined Utility Formula
            utility = entropy * distinguishing_ratio * (1.0 + tree_importance)

            evaluations.append({
                "featureKey": feat,
                "entropy": round(entropy, 4),
                "unknownRate": round(p_unknown, 4),
                "distinguishingRatio": round(distinguishing_ratio, 4),
                "treeImportance": round(tree_importance, 4),
                "utility": round(utility, 6)
            })

        # Sort features deterministically:
        # Primary: highest utility (descending)
        # Secondary: lowest unknown rate (ascending)
        # Tertiary: feature key alphabetical (ascending)
        evaluations.sort(
            key=lambda x: (-x["utility"], x["unknownRate"], x["featureKey"])
        )

        top_feature = evaluations[0]

        # If best utility is 0 (all remaining questions are completely uninformative for this pool)
        if top_feature["utility"] == 0.0:
            return {
                "featureKey": top_feature["featureKey"],
                "status": "low_utility_warning",
                "diagnostics": top_feature,
                "allEvaluations": evaluations[:5]
            }

        return {
            "featureKey": top_feature["featureKey"],
            "status": "available",
            "diagnostics": top_feature,
            "allEvaluations": evaluations[:5]
        }


predictor = QuestionPredictor()
