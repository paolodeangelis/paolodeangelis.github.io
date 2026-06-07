#!/usr/bin/env python3
"""Benchmark LJ force-worker scalability and memory use.

This uses a synthetic 1000-particle snapshot and measures exact/approx force
workers from 1 to 6 workers. It writes:

- `scripts/worker_scalability_1000.csv`
"""

from __future__ import annotations

import csv
import json
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "scripts" / "worker_scalability_1000.csv"


NODE_BENCHMARK = r"""
const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");
const { performance } = require("perf_hooks");

const repoRoot = process.cwd();
const exactWorkerPath = path.join(repoRoot, "assets/js/lj-force-worker.js");
const approxWorkerPath = path.join(repoRoot, "assets/js/lj-force-worker-approx.js");
const optimizedWorkerPath = path.join(repoRoot, "assets/js/lj-force-worker-optimized.js");
const mdWorkerSource = fs.readFileSync(path.join(repoRoot, "assets/js/lj-md-worker.js"), "utf8");

function getConstant(name, fallback) {
  const re = new RegExp(`var ${name} = ([^;]+);`);
  const match = mdWorkerSource.match(re);
  if (!match) return fallback;
  return Function(`return (${match[1]});`)();
}

const particleTypes = Function(`
  const self = { postMessage() {} };
  const setInterval = () => 0;
  const clearInterval = () => {};
  ${mdWorkerSource};
  return LJ_MD_PARTICLE_TYPES;
`)();

const particleCount = Number(process.argv[2] || 1000);
const iterations = Number(process.argv[3] || 30);
const maxWorkers = Number(process.argv[4] || 6);
const approxTableBits = getConstant("LJ_MD_APPROX_FORCE_TABLE_BITS", 9);

function makeSnapshot(n) {
  const width = 155;
  const height = 100;
  const positions = new Float32Array(n * 2);
  const typeIds = new Int16Array(n);
  const typeCount = particleTypes.length;
  const typeSigma = new Float32Array(typeCount);
  const typeEpsilon = new Float32Array(typeCount);
  const pairSigma = new Float32Array(typeCount * typeCount);
  const pairEpsilon = new Float32Array(typeCount * typeCount);
  const pairMode = new Int8Array(typeCount * typeCount);

  for (let t = 0; t < typeCount; t += 1) {
    typeSigma[t] = particleTypes[t].sigmaAngstrom;
    typeEpsilon[t] = particleTypes[t].epsilonEv;
  }

  for (let a = 0; a < typeCount; a += 1) {
    for (let b = 0; b < typeCount; b += 1) {
      const p = a * typeCount + b;
      pairSigma[p] = 0.5 * (typeSigma[a] + typeSigma[b]);
      pairEpsilon[p] = Math.sqrt(typeEpsilon[a] * typeEpsilon[b]);
    }
  }

  let totalFraction = 0;
  for (const type of particleTypes) totalFraction += Math.max(0, type.fraction || 0);

  let idx = 0;
  for (let t = 0; t < typeCount; t += 1) {
    const count = t === typeCount - 1 ? n - idx : Math.round(n * Math.max(0, particleTypes[t].fraction || 0) / totalFraction);
    for (let k = 0; k < count && idx < n; k += 1) typeIds[idx++] = t;
  }

  const cols = Math.ceil(Math.sqrt(n * width / height));
  const rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[2 * i] = 1 + (col + 0.37) * (width - 2) / cols;
    positions[2 * i + 1] = 1 + (row + 0.61) * (height - 2) / rows;
  }

  return {
    positions,
    typeIds,
    n,
    typeCount,
    typeSigma,
    typeEpsilon,
    pairSigma,
    pairEpsilon,
    pairMode,
    boxWidth: width,
    boxHeight: height,
    mouseActive: true,
    mouseX: width * 0.53,
    mouseY: height * 0.47,
    mouseWallEnabled: true,
    mouseWallRadius: getConstant("LJ_MD_MOUSE_WALL_RADIUS_ANGSTROM", 2.2),
    mouseWallSoftness: getConstant("LJ_MD_MOUSE_WALL_SOFTNESS_ANGSTROM", 6.0),
    mouseWallEpsilon: getConstant("LJ_MD_MOUSE_WALL_EPSILON_EV", 0.15),
    mouseWallMaxForce: getConstant("LJ_MD_MOUSE_WALL_MAX_FORCE_EV_PER_A", 0.3),
    wallMode: getConstant("LJ_MD_WALL_MODE", "reflective"),
    reflectiveWallPadding: getConstant("LJ_MD_REFLECTIVE_WALL_PADDING_ANGSTROM", 0),
    wallSigmaScale: getConstant("LJ_MD_WALL_SIGMA_SCALE", 0.75),
    wallAppearanceDistance: getConstant("LJ_MD_WALL_APPEARANCE_DISTANCE_ANGSTROM", 0),
    wallMaxForce: getConstant("LJ_MD_WALL_MAX_FORCE_EV_PER_A", 0.9),
    approxTableBits
  };
}

function cloneTask(base, start, end) {
  return {
    positions: base.positions.slice().buffer,
    typeIds: base.typeIds.slice().buffer,
    n: base.n,
    start,
    end,
    typeCount: base.typeCount,
    typeSigma: base.typeSigma.slice().buffer,
    typeEpsilon: base.typeEpsilon.slice().buffer,
    pairSigma: base.pairSigma.slice().buffer,
    pairEpsilon: base.pairEpsilon.slice().buffer,
    pairMode: base.pairMode.slice().buffer,
    boxWidth: base.boxWidth,
    boxHeight: base.boxHeight,
    mouseActive: base.mouseActive,
    mouseX: base.mouseX,
    mouseY: base.mouseY,
    mouseWallEnabled: base.mouseWallEnabled,
    mouseWallRadius: base.mouseWallRadius,
    mouseWallSoftness: base.mouseWallSoftness,
    mouseWallEpsilon: base.mouseWallEpsilon,
    mouseWallMaxForce: base.mouseWallMaxForce,
    wallMode: base.wallMode,
    reflectiveWallPadding: base.reflectiveWallPadding,
    wallSigmaScale: base.wallSigmaScale,
    wallAppearanceDistance: base.wallAppearanceDistance,
    wallMaxForce: base.wallMaxForce,
    approxTableBits: base.approxTableBits
  };
}

function workerSource(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return `
    const { parentPort } = require("worker_threads");
    global.self = {
      postMessage(message, transferList) { parentPort.postMessage(message, transferList); }
    };
    ${source}
    parentPort.on("message", message => global.self.onmessage({ data: message }));
  `;
}

function memoryMB() {
  const m = process.memoryUsage();
  return {
    rssMB: m.rss / 1024 / 1024,
    heapUsedMB: m.heapUsed / 1024 / 1024
  };
}

async function runWorkerPool(filePath, backend, workerCount, iterations, base) {
  if (global.gc) global.gc();
  const before = memoryMB();
  const source = workerSource(filePath);
  const workers = Array.from({ length: workerCount }, () => new Worker(source, { eval: true }));
  const chunk = Math.ceil(base.n / workerCount);

  await Promise.all(workers.map((worker, i) => new Promise(resolve => {
    worker.once("message", resolve);
    worker.postMessage(cloneTask(base, i * chunk, Math.min(base.n, (i + 1) * chunk)));
  })));

  if (global.gc) global.gc();
  const afterWarmup = memoryMB();

  const t0 = performance.now();
  for (let iter = 0; iter < iterations; iter += 1) {
    await Promise.all(workers.map((worker, i) => new Promise(resolve => {
      worker.once("message", resolve);
      worker.postMessage(cloneTask(base, i * chunk, Math.min(base.n, (i + 1) * chunk)));
    })));
  }
  const t1 = performance.now();

  if (global.gc) global.gc();
  const afterRun = memoryMB();
  await Promise.all(workers.map(worker => worker.terminate()));
  if (global.gc) global.gc();
  const afterTerminate = memoryMB();

  return {
    backend,
    workerCount,
    particleCount: base.n,
    iterations,
    msPerForce: (t1 - t0) / iterations,
    rssWarmupMB: afterWarmup.rssMB,
    rssAfterRunMB: afterRun.rssMB,
    rssDeltaWarmupMB: afterWarmup.rssMB - before.rssMB,
    rssAfterTerminateMB: afterTerminate.rssMB,
    heapUsedAfterRunMB: afterRun.heapUsedMB
  };
}

async function main() {
  const base = makeSnapshot(particleCount);
  const rows = [];

  for (const workerCount of Array.from({ length: maxWorkers }, (_, i) => i + 1)) {
    rows.push(await runWorkerPool(exactWorkerPath, "exact", workerCount, iterations, base));
    rows.push(await runWorkerPool(optimizedWorkerPath, "optimized", workerCount, iterations, base));
    rows.push(await runWorkerPool(approxWorkerPath, "approx", workerCount, iterations, base));
  }

  console.log(JSON.stringify({ rows }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""


def run_benchmark(particles: int, iterations: int, max_workers: int) -> list[dict]:
    with tempfile.TemporaryDirectory() as tmpdir:
        benchmark_path = Path(tmpdir) / "bench_worker_scalability.js"
        benchmark_path.write_text(NODE_BENCHMARK, encoding="utf-8")
        completed = subprocess.run(
            [
                "node",
                "--expose-gc",
                str(benchmark_path),
                str(particles),
                str(iterations),
                str(max_workers),
            ],
            check=True,
            capture_output=True,
            text=True,
            cwd=ROOT,
        )

    return json.loads(completed.stdout)["rows"]


def write_csv(rows: list[dict]) -> None:
    with CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "backend",
                "workerCount",
                "particleCount",
                "iterations",
                "msPerForce",
                "rssWarmupMB",
                "rssAfterRunMB",
                "rssDeltaWarmupMB",
                "rssAfterTerminateMB",
                "heapUsedAfterRunMB",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    rows = run_benchmark(particles=1000, iterations=25, max_workers=6)
    write_csv(rows)

    print(f"wrote {CSV_PATH.relative_to(ROOT)}")
    for backend in ["exact", "optimized", "approx"]:
        subset = [row for row in rows if row["backend"] == backend]
        best = min(subset, key=lambda row: row["msPerForce"])
        one = next(row for row in subset if row["workerCount"] == 1)
        print(
            f"{backend}: 1w={one['msPerForce']:.3f}ms "
            f"best={best['workerCount']}w {best['msPerForce']:.3f}ms "
            f"speedup={one['msPerForce'] / best['msPerForce']:.2f}x "
            f"rss@best={best['rssAfterRunMB']:.1f}MB"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
