"""
Phase 7 ML Engine Hardening Tests.
Verifies credential redaction, concurrency locks, and corrupt model handling.
"""

import os
import sys
import pytest

# Add parent directory to path so imports resolve
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app import app, mask_uri, retrain_lock
from trainer import ModelTrainer

client = TestClient(app)


def test_mask_uri_redacts_credentials():
    raw_uri = "mongodb://ml_admin:secretPassword456@db.internal:27017/mindmancer"
    masked = mask_uri(raw_uri)
    assert masked == "mongodb://***:***@db.internal:27017/mindmancer"
    assert "secretPassword456" not in masked
    assert "ml_admin" not in masked


def test_mask_uri_preserves_unauthenticated_uri():
    raw_uri = "mongodb://127.0.0.1:27017/mindmancer"
    masked = mask_uri(raw_uri)
    assert masked == "mongodb://127.0.0.1:27017/mindmancer"


def test_retrain_lock_prevents_concurrent_retraining():
    # Force retrain_lock into locked state
    # When locked, POST /retrain must return 429 Too Many Requests
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    async def acquire_and_test():
        await retrain_lock.acquire()
        try:
            response = client.post("/retrain")
            assert response.status_code == 429
            data = response.json()
            assert "already in progress" in data["detail"]
        finally:
            retrain_lock.release()

    loop.run_until_complete(acquire_and_test())
    loop.close()


def test_corrupt_model_artifact_sets_degraded_state(tmp_path):
    trainer_instance = ModelTrainer(model_dir=str(tmp_path))
    corrupt_file = os.path.join(str(tmp_path), "model.joblib")
    with open(corrupt_file, "wb") as f:
        f.write(b"NOT_A_VALID_JOBLIB_DATA_STREAM_CORRUPTED")

    success = trainer_instance.load_model()
    assert success is False
    assert trainer_instance.clf is None
    assert trainer_instance.is_trivial is False
