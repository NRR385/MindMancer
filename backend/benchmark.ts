/**
 * Empirical Performance Benchmark for Mind-Mancer Backend.
 * Clearly separates and distinguishes:
 * 1. Internal Game Engine processing latency (in-memory execution without HTTP overhead).
 * 2. Express HTTP API round-trip latency (over local TCP loopback with native fetch).
 * 3. Session memory footprint for 1,000 active concurrent sessions.
 * 
 * Note: Database/ML integration latency is not fabricated when MongoDB is offline.
 */

import http from 'http';
import { app } from './src/app';
import { gameService } from './src/game/game.service';
import { sessionManager } from './src/game/session.manager';
import { IFeatureDomain } from './src/types/domain.types';

const SAMPLE_FEATURES: IFeatureDomain[] = Array.from({ length: 16 }, (_, i) => ({
  key: `feat_${i}`,
  question: `Question for feature ${i}?`,
  category: 'general',
}));

const SAMPLE_CHARACTERS = Array.from({ length: 12 }, (_, i) => ({
  name: `Char_${i}`,
  playCount: i * 2,
  traits: Object.fromEntries(
    Array.from({ length: 16 }, (_, j) => [
      `feat_${j}`,
      (i + j) % 2 === 0 ? true : (i + j) % 3 === 0 ? false : undefined,
    ])
  ),
}));

async function runBenchmarks() {
  console.log('==================================================');
  console.log('MIND-MANCER BACKEND EMPIRICAL BENCHMARK');
  console.log('==================================================');

  // ----------------------------------------------------
  // Benchmark 1: Internal Game Engine Processing Latency
  // ----------------------------------------------------
  const engineLatenciesMs: number[] = [];
  const startEngine = await gameService.startGame(SAMPLE_CHARACTERS, SAMPLE_FEATURES);

  for (let i = 0; i < 50; i++) {
    const t0 = performance.now();
    await gameService.answerQuestion(startEngine.sessionId, 'DONT_KNOW', SAMPLE_FEATURES);
    const t1 = performance.now();
    engineLatenciesMs.push(t1 - t0);

    const session = sessionManager.getSession(startEngine.sessionId);
    if (session) {
      session.questionCount = 1;
      session.status = 'ACTIVE';
      session.askedFeatures = [];
    }
  }

  engineLatenciesMs.sort((a, b) => a - b);
  const meanEngine = engineLatenciesMs.reduce((a, b) => a + b, 0) / engineLatenciesMs.length;
  const p95Index = Math.floor(engineLatenciesMs.length * 0.95);
  const p95Engine = engineLatenciesMs[p95Index];
  const maxEngine = engineLatenciesMs[engineLatenciesMs.length - 1];

  console.log(`\n1. Internal Game Engine Processing Latency (50 rounds, in-memory):`);
  console.log(`  - Mean: ${meanEngine.toFixed(2)} ms`);
  console.log(`  - p95:  ${p95Engine.toFixed(2)} ms`);
  console.log(`  - Max:  ${maxEngine.toFixed(2)} ms`);
  console.log(`  - Target Requirement (<= 100ms): ${p95Engine <= 100 ? 'PASS' : 'FAIL'}`);

  // ----------------------------------------------------
  // Benchmark 2: Express HTTP API Round-Trip Latency (with in-memory knowledge)
  // ----------------------------------------------------
  const server: http.Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr: any = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const httpLatenciesMs: number[] = [];
  const startHttp = await gameService.startGame(SAMPLE_CHARACTERS, SAMPLE_FEATURES);

  // Mock Feature.find during HTTP benchmark if MongoDB is offline to prevent connection buffering
  const { Feature } = await import('./src/models/Feature.model');
  const origFind = Feature.find;
  Feature.find = (() => Promise.resolve(SAMPLE_FEATURES)) as any;

  try {
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      const res = await fetch(`${baseUrl}/api/game/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: startHttp.sessionId, answer: 'DONT_KNOW' }),
      });
      const t1 = performance.now();
      await res.json();
      httpLatenciesMs.push(t1 - t0);

      const session = sessionManager.getSession(startHttp.sessionId);
      if (session) {
        session.questionCount = 1;
        session.status = 'ACTIVE';
        session.askedFeatures = [];
      }
    }
  } finally {
    Feature.find = origFind;
    server.close();
  }

  httpLatenciesMs.sort((a, b) => a - b);
  const meanHttp = httpLatenciesMs.reduce((a, b) => a + b, 0) / httpLatenciesMs.length;
  const p95Http = httpLatenciesMs[Math.floor(httpLatenciesMs.length * 0.95)];
  const maxHttp = httpLatenciesMs[httpLatenciesMs.length - 1];

  console.log(`\n2. Express HTTP API Round-Trip Latency (50 rounds, local loopback):`);
  console.log(`  - Mean: ${meanHttp.toFixed(2)} ms`);
  console.log(`  - p95:  ${p95Http.toFixed(2)} ms`);
  console.log(`  - Max:  ${maxHttp.toFixed(2)} ms`);
  console.log(`  - Target Requirement (p95 <= 100ms): ${p95Http <= 100 ? 'PASS' : 'FAIL'}`);

  // ----------------------------------------------------
  // Benchmark 3: Session Memory Footprint (1,000 sessions)
  // ----------------------------------------------------
  sessionManager.clearAll();
  if (global.gc) {
    global.gc();
  }
  const memBefore = process.memoryUsage().heapUsed;

  for (let i = 0; i < 1000; i++) {
    sessionManager.createSession(
      SAMPLE_CHARACTERS.map((c) => ({
        name: c.name,
        score: 1 / 12,
        playCount: c.playCount,
        traits: c.traits,
      })),
      'feat_0',
      'ACTIVE'
    );
  }

  const memAfter = process.memoryUsage().heapUsed;
  const memDiffMB = (memAfter - memBefore) / (1024 * 1024);

  console.log(`\n3. Session Memory Footprint (1,000 concurrent sessions):`);
  console.log(`  - Total Active Sessions: ${sessionManager.activeCount}`);
  console.log(`  - Heap delta: ${memDiffMB.toFixed(2)} MB`);
  console.log(`  - Target Requirement (<= 50MB): ${memDiffMB <= 50 ? 'PASS' : 'FAIL'}`);

  sessionManager.clearAll();
  sessionManager.stopCleanup();
}

runBenchmarks().catch(console.error);
