import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add parent directory to path so imports resolve
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
from trainer import trainer

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ml-engine"
    assert "characterCount" in data
    assert "featureCount" in data

def test_trainer_edge_case_n0():
    result = trainer.train(characters_data=[], features_data=[])
    assert result["status"] == "empty"
    assert result["character_count"] == 0

def test_trainer_edge_case_n1():
    result = trainer.train(
        characters_data=[{"name": "SoloChar", "traits": {"is_human": True}}],
        features_data=[{"key": "is_human", "question": "Is your character human?"}]
    )
    assert result["status"] == "trivial"
    assert result["sole_character"] == "SoloChar"

def test_trainer_edge_case_n2():
    result = trainer.train(
        characters_data=[
            {"name": "Batman", "traits": {"is_human": True, "has_cape": True}},
            {"name": "Superman", "traits": {"is_human": False, "has_cape": True}}
        ],
        features_data=[
            {"key": "is_human", "question": "Is your character human?"},
            {"key": "has_cape", "question": "Does your character wear a cape?"}
        ]
    )
    assert result["status"] == "trained"
    assert result["character_count"] == 2
    assert result["tree_depth"] >= 1
