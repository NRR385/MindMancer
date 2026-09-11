"""
Empirical Performance Benchmark for Mind-Mancer ML Engine.
Measures:
1. Retrain latency for N=12 characters, M=16 features across 50 iterations.
2. Question selection latency (/next-question) across 50 iterations.
"""

import time
import statistics
from fastapi.testclient import TestClient
from app import app
from trainer import trainer

client = TestClient(app)

# Test dataset representative of the 12 seeded characters and 16 features
SAMPLE_FEATURES = [
    {"key": f"feat_{i}", "question": f"Question {i}?"} for i in range(16)
]
SAMPLE_CHARACTERS = [
    {
        "name": f"Char_{i}",
        "traits": {
            f"feat_{j}": (True if (i + j) % 2 == 0 else False if (i + j) % 3 == 0 else None)
            for j in range(16)
        }
    }
    for i in range(12)
]

def run_benchmarks():
    print("==================================================")
    print("MIND-MANCER ML ENGINE BENCHMARK RUNNER")
    print("==================================================")

    # Benchmark 1: Retraining Latency (Atomic build + fit + dump + replace)
    retrain_latencies = []
    for _ in range(50):
        t0 = time.perf_counter()
        res = trainer.train(
            characters_data=SAMPLE_CHARACTERS,
            features_data=SAMPLE_FEATURES
        )
        t1 = time.perf_counter()
        assert res["status"] == "trained"
        retrain_latencies.append((t1 - t0) * 1000.0)

    mean_retrain = statistics.mean(retrain_latencies)
    p95_retrain = statistics.quantiles(retrain_latencies, n=20)[18]  # ~95th percentile
    max_retrain = max(retrain_latencies)

    print(f"Retrain Latency (N=12, M=16, 50 rounds):")
    print(f"  - Mean: {mean_retrain:.2f} ms")
    print(f"  - p95:  {p95_retrain:.2f} ms")
    print(f"  - Max:  {max_retrain:.2f} ms")
    print(f"  - Target Requirement (<=1000ms): {'PASS' if p95_retrain <= 1000 else 'FAIL'}")

    # Benchmark 2: Next Question Latency (/next-question endpoint)
    question_latencies = []
    candidate_pool = [c["name"] for c in SAMPLE_CHARACTERS]
    asked = []

    for round_idx in range(50):
        t0 = time.perf_counter()
        res = client.post("/next-question", json={
            "candidateNames": candidate_pool,
            "askedFeatures": asked[:(round_idx % 10)],
            "charactersData": SAMPLE_CHARACTERS
        })
        t1 = time.perf_counter()
        assert res.status_code == 200
        question_latencies.append((t1 - t0) * 1000.0)

    mean_q = statistics.mean(question_latencies)
    p95_q = statistics.quantiles(question_latencies, n=20)[18]
    max_q = max(question_latencies)

    print(f"\nQuestion Selection Latency (50 rounds):")
    print(f"  - Mean: {mean_q:.2f} ms")
    print(f"  - p95:  {p95_q:.2f} ms")
    print(f"  - Max:  {max_q:.2f} ms")
    print(f"  - Target Requirement (p95 <=100ms): {'PASS' if p95_q <= 100 else 'FAIL'}")

if __name__ == "__main__":
    run_benchmarks()
