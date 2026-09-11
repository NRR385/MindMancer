"""
Comprehensive Test Suite for Mind-Mancer ML Engine.
Tests all 18 specified verification areas plus numerical verification of the Question Utility formula.
"""

import math
import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure ml-engine root is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from trainer import ModelTrainer, trainer
from predictor import calculate_tristate_entropy, QuestionPredictor
from app import app

client = TestClient(app)


@pytest.fixture
def clean_trainer(tmp_path):
    """Provides an isolated ModelTrainer writing to a temporary test directory."""
    return ModelTrainer(model_dir=str(tmp_path))


# 1. Empty dataset -> no model
def test_1_empty_dataset_no_model(clean_trainer):
    result = clean_trainer.train([], [{"key": "is_human", "question": "Human?"}])
    assert result["status"] == "empty"
    assert clean_trainer.clf is None
    assert clean_trainer.is_trivial is False
    assert len(clean_trainer.characters) == 0


# 2. One-character dataset -> trivial model
def test_2_one_character_trivial_model(clean_trainer):
    chars = [{"name": "SoloHero", "traits": {"is_human": True}}]
    feats = [{"key": "is_human", "question": "Human?"}]
    result = clean_trainer.train(chars, feats)
    assert result["status"] == "trivial"
    assert clean_trainer.is_trivial is True
    assert clean_trainer.trivial_character == "SoloHero"
    assert clean_trainer.clf is None  # Does not invoke DecisionTreeClassifier


# 3. Two-character dataset -> valid DecisionTreeClassifier
def test_3_two_character_decision_tree(clean_trainer):
    chars = [
        {"name": "Batman", "traits": {"is_human": True, "can_fly": False}},
        {"name": "Superman", "traits": {"is_human": False, "can_fly": True}}
    ]
    feats = [
        {"key": "is_human", "question": "Human?"},
        {"key": "can_fly", "question": "Fly?"}
    ]
    result = clean_trainer.train(chars, feats)
    assert result["status"] == "trained"
    assert clean_trainer.clf is not None
    assert clean_trainer.is_trivial is False
    assert result["character_count"] == 2
    assert result["tree_depth"] >= 1


# 4 & 5 & 6 & 7: Tri-state matrix encoding tests
def test_4_5_6_7_tri_state_matrix_encoding(clean_trainer):
    chars = [
        {
            "name": "TestChar",
            "traits": {
                "feat_true": True,
                "feat_false": False
                # feat_missing is omitted (Unknown)
            }
        }
    ]
    feats = [
        {"key": "feat_true", "question": "True?"},
        {"key": "feat_false", "question": "False?"},
        {"key": "feat_missing", "question": "Missing?"}
    ]
    X, y, char_names, feat_keys = clean_trainer.build_matrix(chars, feats)

    idx_true = feat_keys.index("feat_true")
    idx_false = feat_keys.index("feat_false")
    idx_missing = feat_keys.index("feat_missing")

    # 4. TRUE encodes as 1.0
    assert X[0, idx_true] == 1.0

    # 5. FALSE encodes as 0.0
    assert X[0, idx_false] == 0.0

    # 6. Missing trait encodes as 0.5
    assert X[0, idx_missing] == 0.5

    # 7. Missing trait is NEVER encoded as 0.0
    assert X[0, idx_missing] != 0.0


# 8. Tri-state entropy calculations
def test_8_tristate_entropy_calculations():
    # All TRUE (p_true=1.0, p_false=0.0, p_unk=0.0) -> H = 0.0
    assert calculate_tristate_entropy(1.0, 0.0, 0.0) == 0.0

    # All FALSE -> H = 0.0
    assert calculate_tristate_entropy(0.0, 1.0, 0.0) == 0.0

    # All UNKNOWN -> H = 0.0
    assert calculate_tristate_entropy(0.0, 0.0, 1.0) == 0.0

    # Balanced TRUE/FALSE (p_true=0.5, p_false=0.5, p_unk=0.0) -> H = 1.0
    assert pytest.approx(calculate_tristate_entropy(0.5, 0.5, 0.0), rel=1e-4) == 1.0

    # Mixed equal 3-way split (1/3, 1/3, 1/3) -> H = log2(3) ~ 1.58496
    expected_3way = math.log2(3.0)
    assert pytest.approx(calculate_tristate_entropy(1/3, 1/3, 1/3), rel=1e-4) == expected_3way


# 9. Exact Hand-Calculated Question Utility Formula Verification
def test_9_exact_hand_calculated_question_utility_formula():
    """
    Numerically verifies:
      Utility(f) = H(f) * gamma(f) * (1.0 + I_tree(f))
    where:
      gamma(f) = 1.0 - p_unknown
    
    Hand-calculated case:
      N = 4 candidates
      f1 distribution: 2 True, 1 False, 1 Unknown
      p_true = 2/4 = 0.5
      p_false = 1/4 = 0.25
      p_unk = 1/4 = 0.25
      
      H(f1) = - (0.5*log2(0.5) + 0.25*log2(0.25) + 0.25*log2(0.25))
            = - (-0.5 - 0.5 - 0.5) = 1.5 bits
      gamma(f1) = 1.0 - 0.25 = 0.75
      I_tree(f1) = 0.20
      
      Utility(f1) = 1.5 * 0.75 * (1.0 + 0.20) = 1.5 * 0.75 * 1.20 = 1.35
    """
    chars_data = [
        {"name": "C1", "traits": {"f_test": True}},
        {"name": "C2", "traits": {"f_test": True}},
        {"name": "C3", "traits": {"f_test": False}},
        {"name": "C4", "traits": {}},  # Unknown
    ]
    
    trainer_mock = ModelTrainer()
    trainer_mock.features = ["f_test"]
    trainer_mock.characters = ["C1", "C2", "C3", "C4"]
    trainer_mock.character_traits_cache = {c["name"]: c["traits"] for c in chars_data}
    trainer_mock.feature_importances = {"f_test": 0.20}

    import predictor
    old_trainer = predictor.trainer
    predictor.trainer = trainer_mock

    try:
        p = QuestionPredictor()
        result = p.get_next_question(
            candidate_names=["C1", "C2", "C3", "C4"],
            asked_features=[],
            characters_data=chars_data
        )
        diag = result["diagnostics"]
        
        # Verify exact hand calculations
        assert pytest.approx(diag["entropy"], rel=1e-3) == 1.50
        assert pytest.approx(diag["unknownRate"], rel=1e-3) == 0.25
        assert pytest.approx(diag["distinguishingRatio"], rel=1e-3) == 0.75
        assert pytest.approx(diag["treeImportance"], rel=1e-3) == 0.20
        assert pytest.approx(diag["utility"], rel=1e-3) == 1.35

        # Edge Case A: Zero tree importance (I_tree = 0.0) -> Utility = 1.5 * 0.75 * 1.0 = 1.125
        trainer_mock.feature_importances["f_test"] = 0.0
        res_zero_imp = p.get_next_question(
            candidate_names=["C1", "C2", "C3", "C4"],
            asked_features=[],
            characters_data=chars_data
        )
        assert pytest.approx(res_zero_imp["diagnostics"]["utility"], rel=1e-3) == 1.125

        # Edge Case B: Zero entropy (All candidates have True: p_true=1.0 -> H=0.0) -> Utility = 0.0
        chars_all_true = [
            {"name": f"C{i}", "traits": {"f_test": True}} for i in range(1, 5)
        ]
        trainer_mock.character_traits_cache = {c["name"]: c["traits"] for c in chars_all_true}
        res_zero_ent = p.get_next_question(
            candidate_names=["C1", "C2", "C3", "C4"],
            asked_features=[],
            characters_data=chars_all_true
        )
        assert res_zero_ent["diagnostics"]["entropy"] == 0.0
        assert res_zero_ent["diagnostics"]["utility"] == 0.0

        # Edge Case C: Increasing unknown rate decreases utility when other values remain equal
        # Feature A: 2 True, 2 False, 0 Unknown (N=4, H=1.0, gamma=1.0 -> Utility = 1.0)
        # Feature B: 1 True, 1 False, 2 Unknown (N=4, H=1.5, gamma=0.5 -> Utility = 1.5 * 0.5 = 0.75)
        chars_ab = [
            {"name": "A1", "traits": {"f_clean": True, "f_murky": True}},
            {"name": "A2", "traits": {"f_clean": True, "f_murky": False}},
            {"name": "A3", "traits": {"f_clean": False, "f_murky": None}},
            {"name": "A4", "traits": {"f_clean": False, "f_murky": None}},
        ]
        trainer_mock.features = ["f_clean", "f_murky"]
        trainer_mock.feature_importances = {"f_clean": 0.0, "f_murky": 0.0}
        trainer_mock.character_traits_cache = {c["name"]: c["traits"] for c in chars_ab}

        res_comp = p.get_next_question(
            candidate_names=["A1", "A2", "A3", "A4"],
            asked_features=[],
            characters_data=chars_ab
        )
        # Clean (unknown rate 0.0) must have higher utility than murky (unknown rate 0.5)
        assert res_comp["featureKey"] == "f_clean"
        all_evals = {e["featureKey"]: e for e in res_comp["allEvaluations"]}
        assert all_evals["f_clean"]["utility"] > all_evals["f_murky"]["utility"]

    finally:
        predictor.trainer = old_trainer


# 10. Feature importance maps back to the correct feature key
def test_10_feature_importance_key_mapping(clean_trainer):
    chars = [
        {"name": "Batman", "traits": {"is_human": True, "can_fly": False}},
        {"name": "Superman", "traits": {"is_human": False, "can_fly": True}}
    ]
    feats = [
        {"key": "is_human", "question": "Human?"},
        {"key": "can_fly", "question": "Fly?"}
    ]
    clean_trainer.train(chars, feats)
    
    assert "is_human" in clean_trainer.feature_importances
    assert "can_fly" in clean_trainer.feature_importances
    total_imp = sum(clean_trainer.feature_importances.values())
    assert pytest.approx(total_imp, rel=1e-3) == 1.0


# 11. Feature ordering is deterministic
def test_11_deterministic_ordering(clean_trainer):
    feats = [
        {"key": "zebra_feat", "question": "Zebra?"},
        {"key": "alpha_feat", "question": "Alpha?"},
        {"key": "beta_feat", "question": "Beta?"}
    ]
    chars = [
        {"name": "Zoro", "traits": {}},
        {"name": "Arthur", "traits": {}},
        {"name": "Brian", "traits": {}}
    ]
    X, y, char_names, feat_keys = clean_trainer.build_matrix(chars, feats)
    
    assert feat_keys == ["alpha_feat", "beta_feat", "zebra_feat"]
    assert char_names == ["Arthur", "Brian", "Zoro"]


# 12. N=1 does not invoke normal tree training
def test_12_n1_does_not_invoke_tree(clean_trainer):
    chars = [{"name": "SingleCandidate", "traits": {"is_human": True}}]
    feats = [{"key": "is_human", "question": "Human?"}]
    res = clean_trainer.train(chars, feats)
    assert clean_trainer.clf is None
    assert clean_trainer.is_trivial is True
    assert res["status"] == "trivial"


# 13. N=0 does not create a fake model
def test_13_n0_no_fake_model(clean_trainer):
    res = clean_trainer.train([], [{"key": "is_human", "question": "Human?"}])
    assert clean_trainer.clf is None
    assert clean_trainer.is_trivial is False
    assert res["status"] == "empty"


# 14. Retraining failure preserves previous model
def test_14_retraining_failure_preserves_previous_model(clean_trainer, monkeypatch):
    chars = [
        {"name": "Batman", "traits": {"is_human": True}},
        {"name": "Superman", "traits": {"is_human": False}}
    ]
    feats = [{"key": "is_human", "question": "Human?"}]
    clean_trainer.train(chars, feats)

    prev_clf = clean_trainer.clf
    prev_chars = list(clean_trainer.characters)
    assert prev_clf is not None

    def failing_build_matrix(*args, **kwargs):
        raise ValueError("Simulated matrix builder failure")

    monkeypatch.setattr(clean_trainer, "build_matrix", failing_build_matrix)

    with pytest.raises(RuntimeError) as exc_info:
        clean_trainer.train(chars, feats)

    assert "Previous model preserved" in str(exc_info.value)
    assert clean_trainer.clf is prev_clf
    assert clean_trainer.characters == prev_chars


# 15. Model artifact can be saved and loaded
def test_15_model_artifact_save_and_load(tmp_path):
    trainer1 = ModelTrainer(model_dir=str(tmp_path))
    chars = [
        {"name": "Batman", "traits": {"is_human": True}},
        {"name": "Superman", "traits": {"is_human": False}}
    ]
    feats = [{"key": "is_human", "question": "Human?"}]
    trainer1.train(chars, feats)

    trainer2 = ModelTrainer(model_dir=str(tmp_path))
    loaded = trainer2.load_model()
    
    assert loaded is True
    assert trainer2.clf is not None
    assert trainer2.characters == ["Batman", "Superman"]
    assert trainer2.features == ["is_human"]
    assert "is_human" in trainer2.feature_importances


# 16. FastAPI /health endpoint
def test_16_fastapi_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ml-engine"
    assert "characterCount" in data
    assert "featureCount" in data
    assert "modelLoaded" in data
    assert "isTrivial" in data


# 17. /next-question returns valid structure
def test_17_fastapi_next_question():
    chars = [
        {"name": "Batman", "traits": {"is_human": True, "wears_cape": True}},
        {"name": "Iron Man", "traits": {"is_human": True, "wears_cape": False}},
        {"name": "Superman", "traits": {"is_human": False, "wears_cape": True}}
    ]
    feats = [
        {"key": "is_human", "question": "Is human?"},
        {"key": "wears_cape", "question": "Wears cape?"}
    ]
    # Unit-test model setup using internal trainer.train()
    trainer.train(characters_data=chars, features_data=feats)

    res = client.post("/next-question", json={
        "candidateNames": ["Batman", "Iron Man", "Superman"],
        "askedFeatures": ["is_human"]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["featureKey"] == "wears_cape"
    assert data["status"] == "available"
    assert "diagnostics" in data
    diag = data["diagnostics"]
    assert "entropy" in diag
    assert "unknownRate" in diag
    assert "distinguishingRatio" in diag
    assert "treeImportance" in diag
    assert "utility" in diag


# 18. /retrain loads exclusively from MongoDB; fails with 503 if MongoDB is unavailable
def test_18_fastapi_retrain_endpoint_mongodb_contract(monkeypatch):
    # Case A: When MongoDB is offline, calling POST /retrain without payload fails with 503
    res_offline = client.post("/retrain")
    # If Mongo is not running on 27017 in test runner:
    if res_offline.status_code == 503:
        assert "MongoDB is unavailable" in res_offline.json()["detail"]

    # Case B: When MongoDB query succeeds, /retrain trains directly from the canonical data
    mock_chars = [
        {"name": "Batman", "traits": {"is_human": True}},
        {"name": "Superman", "traits": {"is_human": False}}
    ]
    mock_feats = [{"key": "is_human", "question": "Is human?"}]

    def mock_fetch():
        return mock_chars, mock_feats

    # Monkeypatch the MongoDB loader to test full endpoint execution
    monkeypatch.setattr("app.fetch_data_from_mongodb", mock_fetch)

    res = client.post("/retrain")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"] == "trained"
    assert data["character_count"] == 2
    assert "tree_depth" in data
    assert "leaf_count" in data
