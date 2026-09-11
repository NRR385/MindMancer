"""
ML Engine Model Trainer for Mind-Mancer.
Owns DecisionTreeClassifier training, deterministic data matrix construction,
model persistence with metadata, and atomic model replacement.

Tri-State Encoding Semantics:
- TRUE    = 1.0
- FALSE   = 0.0
- UNKNOWN = 0.5 (Numerical proxy heuristic for decision tree splits; missing traits MUST NEVER be treated as FALSE)
"""

import os
import copy
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
import numpy as np
from sklearn.tree import DecisionTreeClassifier
import joblib


class ModelTrainer:
    def __init__(self, model_dir: Optional[str] = None):
        if model_dir is None:
            self.model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
        else:
            self.model_dir = model_dir
            
        os.makedirs(self.model_dir, exist_ok=True)
        self.model_path = os.path.join(self.model_dir, "model.joblib")
        
        # In-memory active model state
        self.clf: Optional[DecisionTreeClassifier] = None
        self.characters: List[str] = []
        self.features: List[str] = []
        self.feature_importances: Dict[str, float] = {}
        self.character_traits_cache: Dict[str, Dict[str, Optional[bool]]] = {}
        self.is_trivial: bool = False
        self.trivial_character: Optional[str] = None
        self.model_version: str = "2.0.0"
        self.trained_at: Optional[str] = None

    def build_matrix(
        self, characters_data: List[Dict[str, Any]], features_data: List[Dict[str, Any]]
    ) -> Tuple[np.ndarray, np.ndarray, List[str], List[str]]:
        """
        Builds a deterministic numerical feature matrix X and class labels y.
        Rows = characters (sorted by name ascending).
        Columns = features (sorted by key ascending).
        """
        # Deterministic sorting
        sorted_features = sorted([f["key"] for f in features_data])
        sorted_characters = sorted([c["name"] for c in characters_data])

        n_samples = len(sorted_characters)
        n_features = len(sorted_features)

        # Initialize matrix with 0.5 (Unknown)
        X = np.full((n_samples, n_features), 0.5, dtype=np.float32)
        y = np.arange(n_samples, dtype=np.int32)

        char_data_map = {c["name"]: c.get("traits", {}) for c in characters_data}
        feat_idx_map = {feat: idx for idx, feat in enumerate(sorted_features)}

        for i, char_name in enumerate(sorted_characters):
            traits = char_data_map.get(char_name, {})
            # Handle both dict and Map representation
            if isinstance(traits, dict):
                trait_items = traits.items()
            else:
                trait_items = getattr(traits, "items", lambda: [])()

            for feat_key, val in trait_items:
                if feat_key in feat_idx_map:
                    j = feat_idx_map[feat_key]
                    if val is True:
                        X[i, j] = 1.0
                    elif val is False:
                        X[i, j] = 0.0
                    # None or missing remains 0.5 (UNKNOWN)

        return X, y, sorted_characters, sorted_features

    def train(
        self, characters_data: List[Dict[str, Any]], features_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Trains or updates the model using atomic state replacement.
        If training fails, the previous working model remains active.
        """
        n_characters = len(characters_data)

        # Snapshot current working state in case of failure
        backup_state = {
            "clf": self.clf,
            "characters": list(self.characters),
            "features": list(self.features),
            "feature_importances": dict(self.feature_importances),
            "character_traits_cache": copy.deepcopy(self.character_traits_cache),
            "is_trivial": self.is_trivial,
            "trivial_character": self.trivial_character,
            "trained_at": self.trained_at
        }

        try:
            # Case 1: N = 0
            if n_characters == 0:
                new_state = {
                    "clf": None,
                    "characters": [],
                    "features": sorted([f["key"] for f in features_data]),
                    "feature_importances": {},
                    "character_traits_cache": {},
                    "is_trivial": False,
                    "trivial_character": None,
                    "model_version": self.model_version,
                    "trained_at": datetime.now(timezone.utc).isoformat(),
                    "tree_depth": 0,
                    "leaf_count": 0
                }
                self._persist_and_swap(new_state)
                return {
                    "status": "empty",
                    "character_count": 0,
                    "feature_count": len(new_state["features"]),
                    "message": "No characters available to train; model cleared."
                }

            # Case 2: N = 1 (Trivial sole-candidate model)
            if n_characters == 1:
                sole_name = characters_data[0]["name"]
                sorted_features = sorted([f["key"] for f in features_data])
                traits_cache = {sole_name: characters_data[0].get("traits", {})}
                
                new_state = {
                    "clf": None,
                    "characters": [sole_name],
                    "features": sorted_features,
                    "feature_importances": {f: 0.0 for f in sorted_features},
                    "character_traits_cache": traits_cache,
                    "is_trivial": True,
                    "trivial_character": sole_name,
                    "model_version": self.model_version,
                    "trained_at": datetime.now(timezone.utc).isoformat(),
                    "tree_depth": 0,
                    "leaf_count": 1
                }
                self._persist_and_swap(new_state)
                return {
                    "status": "trivial",
                    "character_count": 1,
                    "feature_count": len(sorted_features),
                    "sole_character": sole_name,
                    "message": "Trivial model initialized for single candidate."
                }

            # Case 3: N >= 2 (Train DecisionTreeClassifier)
            X, y, sorted_characters, sorted_features = self.build_matrix(characters_data, features_data)

            clf = DecisionTreeClassifier(
                criterion="entropy",
                splitter="best",
                max_depth=None,
                min_samples_split=2,
                random_state=42
            )
            clf.fit(X, y)

            # Map feature importances deterministically back to feature keys
            raw_importances = clf.feature_importances_
            feature_importances = {
                feat_key: float(raw_importances[i]) for i, feat_key in enumerate(sorted_features)
            }

            # Build character traits cache for fast inference
            traits_cache = {}
            for c in characters_data:
                traits_cache[c["name"]] = c.get("traits", {})

            new_state = {
                "clf": clf,
                "characters": sorted_characters,
                "features": sorted_features,
                "feature_importances": feature_importances,
                "character_traits_cache": traits_cache,
                "is_trivial": False,
                "trivial_character": None,
                "model_version": self.model_version,
                "trained_at": datetime.now(timezone.utc).isoformat(),
                "tree_depth": int(clf.get_depth()),
                "leaf_count": int(clf.get_n_leaves())
            }

            self._persist_and_swap(new_state)

            return {
                "status": "trained",
                "character_count": n_characters,
                "feature_count": len(sorted_features),
                "tree_depth": new_state["tree_depth"],
                "leaf_count": new_state["leaf_count"],
                "trained_at": new_state["trained_at"]
            }

        except Exception as e:
            # Revert to backup state upon any training/persistence failure
            self.clf = backup_state["clf"]
            self.characters = backup_state["characters"]
            self.features = backup_state["features"]
            self.feature_importances = backup_state["feature_importances"]
            self.character_traits_cache = backup_state["character_traits_cache"]
            self.is_trivial = backup_state["is_trivial"]
            self.trivial_character = backup_state["trivial_character"]
            self.trained_at = backup_state["trained_at"]
            raise RuntimeError(f"Model training failed: {str(e)}. Previous model preserved.")

    def _persist_and_swap(self, new_state: Dict[str, Any]) -> None:
        """
        Persists state to a temporary file, verifies it, then atomically replaces
        the target artifact file and updates in-memory pointers.
        """
        tmp_path = self.model_path + ".tmp"
        
        # Save to temporary file first
        joblib.dump(new_state, tmp_path)

        # Verify readability
        loaded = joblib.load(tmp_path, mmap_mode=None)
        if "model_version" not in loaded or "characters" not in loaded:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise ValueError("Corrupt model artifact detected during verification.")
        del loaded

        # Atomic file replacement with retry for Windows/OneDrive file lock contention
        if os.path.exists(tmp_path):
            import time
            for attempt in range(10):
                try:
                    os.replace(tmp_path, self.model_path)
                    break
                except (PermissionError, OSError):
                    if attempt == 9:
                        raise
                    time.sleep(0.02)

        # Atomically activate in-memory state
        self.clf = new_state["clf"]
        self.characters = new_state["characters"]
        self.features = new_state["features"]
        self.feature_importances = new_state["feature_importances"]
        self.character_traits_cache = new_state["character_traits_cache"]
        self.is_trivial = new_state["is_trivial"]
        self.trivial_character = new_state["trivial_character"]
        self.trained_at = new_state["trained_at"]

    def load_model(self) -> bool:
        """
        Loads the persisted model artifact from disk safely.
        """
        if not os.path.exists(self.model_path):
            return False

        try:
            state = joblib.load(self.model_path)
            self.clf = state.get("clf")
            self.characters = state.get("characters", [])
            self.features = state.get("features", [])
            self.feature_importances = state.get("feature_importances", {})
            self.character_traits_cache = state.get("character_traits_cache", {})
            self.is_trivial = state.get("is_trivial", False)
            self.trivial_character = state.get("trivial_character")
            self.model_version = state.get("model_version", "2.0.0")
            self.trained_at = state.get("trained_at")
            return True
        except Exception as e:
            print(f"[ModelTrainer] Warning: Failed to load model artifact: {e}")
            return False


# Global singleton instance
trainer = ModelTrainer()
# Attempt loading existing model artifact on startup if present
trainer.load_model()
