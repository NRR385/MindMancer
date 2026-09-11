"""
FastAPI Application for Mind-Mancer ML Microservice.
Provides /health, /next-question, and /retrain endpoints.
Connects exclusively to MongoDB 'mindmancer' database for production retraining.
"""

import os
import re
import asyncio
from typing import List, Dict, Optional, Any
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError

from trainer import trainer
from predictor import predictor

app = FastAPI(
    title="Mind-Mancer ML Microservice",
    description="Decoupled Decision Tree & Question Selection Engine",
    version="2.0.0"
)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/mindmancer")
DATABASE_NAME = "mindmancer"

# In-process lock to prevent concurrent retraining executions
retrain_lock = asyncio.Lock()


def mask_uri(uri: str) -> str:
    """Masks credentials in MongoDB connection string."""
    return re.sub(r'//[^@]+@', '//***:***@', uri)


class NextQuestionRequest(BaseModel):
    candidateNames: List[str] = Field(default_factory=list)
    askedFeatures: List[str] = Field(default_factory=list)
    charactersData: Optional[List[Dict[str, Any]]] = None


def fetch_data_from_mongodb() -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Fetches characters and features directly from MongoDB 'mindmancer' database.
    Production retraining always loads directly from this canonical store.
    """
    sanitized_uri = mask_uri(MONGODB_URI)
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2500)
        db = client[DATABASE_NAME]
        
        # Ping server to ensure connectivity
        client.admin.command('ping')

        characters_cursor = db["characters"].find({}, {"_id": 0, "name": 1, "traits": 1})
        features_cursor = db["features"].find({}, {"_id": 0, "key": 1, "question": 1, "category": 1})

        characters = list(characters_cursor)
        features = list(features_cursor)

        client.close()
        return characters, features
    except ServerSelectionTimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"MongoDB is unavailable at {sanitized_uri}."
        )
    except PyMongoError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database query failed during data fetch."
        )


@app.get("/health")
def health():
    """
    Lightweight health check endpoint returning model state, metadata, and character counts.
    Does NOT trigger retraining.
    """
    is_model_loaded = (trainer.clf is not None) or trainer.is_trivial
    return {
        "status": "healthy" if is_model_loaded else "degraded",
        "service": "ml-engine",
        "modelLoaded": is_model_loaded,
        "isTrivial": trainer.is_trivial,
        "trivialCharacter": trainer.trivial_character,
        "characterCount": len(trainer.characters),
        "featureCount": len(trainer.features),
        "modelVersion": trainer.model_version,
        "trainedAt": trainer.trained_at,
        "modelPath": trainer.model_path
    }


@app.post("/next-question")
def next_question(payload: NextQuestionRequest):
    """
    Evaluates unasked questions across current candidate pool using
    tri-state entropy and tree feature importances.
    """
    result = predictor.get_next_question(
        candidate_names=payload.candidateNames,
        asked_features=payload.askedFeatures,
        characters_data=payload.charactersData
    )
    return result


@app.post("/retrain")
async def retrain():
    """
    Retrains the DecisionTreeClassifier exclusively using the canonical
    knowledge base from MongoDB 'mindmancer' database.
    Protected by in-process asyncio lock to guarantee concurrency = 1.
    """
    if retrain_lock.locked():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="A retraining operation is already in progress."
        )

    async with retrain_lock:
        characters, features = fetch_data_from_mongodb()

        try:
            train_result = trainer.train(
                characters_data=characters,
                features_data=features
            )
            return {
                "success": True,
                **train_result
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(e)
            )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

