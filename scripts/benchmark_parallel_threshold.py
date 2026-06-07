#!/usr/bin/env python3
"""Benchmark the LJ force serial/parallel switch threshold.

Writes `scripts/parallel_threshold.csv` and prints the fastest worker count for
each particle count. The benchmark uses the current constants from
`assets/js/lj-md-worker.js` and the optimized worker backend, matching the
default animation backend.
"""

from __future__ import annotations

import csv
import json
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "scripts" / "parallel_threshold.csv"


NODE_BENCHMARK = r"""
const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");
const { performance } = require("perf_hooks");

const repoRoot = process.cwd();
const workerPath = path.join(repoRoot, "assets/js/lj-force-worker-optimized.js");
const mdWorkerSource = fs.readFileSync(path.join(repoRoot, "assets/js/lj-md-worker.js"), "utf8");

const config = Function(`
  const self = { postMessage() {} };
  const setInterval = () => 0;
  const clearInterval = () => {};
  const Worker = function() {};
  ${mdWorkerSource}
  return {
    particleTypes: LJ_MD_PARTICLE_TYPES,
    pairSigma: LJ_MD_PAIR_SIGMA_ANGSTROM,
    pairR0: LJ_MD_PAIR_R0_ANGSTROM,
    pairEpsilon: LJ_MD_PAIR_EPSILON_EV,
    pairMode: LJ_MD_PAIR_MODE,
    density: LJ_MD_DENSITY_2D,
    mouseWallEnabled: LJ_MD_MOUSE_WALL_ENABLED,
    mouseWallRadius: LJ_MD_MOUSE_WALL_RADIUS_ANGSTROM,
    mouseWallSoftness: LJ_MD_MOUSE_WALL_SOFTNESS_ANGSTROM,
    mouseWallEpsilon: LJ_MD_MOUSE_WALL_EPSILON_EV,
    mouseWallMaxForce: LJ_MD_MOUSE_WALL_MAX_FORCE_EV_PER_A,
    wallMode: LJ_MD_WALL_MODE,
    reflectiveWallPadding: LJ_MD_REFLECTIVE_WALL_PADDING_ANGSTROM,
    wallSigmaScale: LJ_MD_WALL_SIGMA_SCALE,
    wallAppearanceDistance: LJ_MD_WALL_APPEARANCE_DISTANCE_ANGSTROM,
    wallMaxForce: LJ_MD_WALL_MAX_FORCE_EV_PER_A
  };
`)();

const counts = process.argv[2].split(",").map(Number);
const iterations = Number(process.argv[3] || 30);
const maxWorkers = Number(process.argv[4] || 4);
const SQRT2_1_6 = Math.pow(2, 1 / 6);

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

function buildTables() {
  const types = config.particleTypes;
  const typeCount = types.length;
  const typeSigma = new Float32Array(typeCount);
  const typeEpsilon = new Float32Array(typeCount);
  const pairSigma = new Float32Array(typeCount * typeCount);
  const pairEpsilon = new Float32Array(typeCount * typeCount);
  const pairMode = new Int8Array(typeCount * typeCount);
  const pairSigma2 = new Float32Array(typeCount * typeCount);
  const pairCutoff2 = new Float32Array(typeCount * typeCount);
  const pairCoeff = new Float32Array(typeCount * typeCount);
  let maxPairCutoff = 0;

  for (let i = 0; i < typeCount; i += 1) {
    typeSigma[i] = types[i].sigmaAngstrom;
    typeEpsilon[i] = types[i].epsilonEv;
  }

  for (let a = 0; a < typeCount; a += 1) {
    for (let b = 0; b < typeCount; b += 1) {
      const p = a * typeCount + b;
      const sigmaOverride = config.pairSigma && config.pairSigma[a] ? config.pairSigma[a][b] : null;
      const r0Override = config.pairR0 && config.pairR0[a] ? config.pairR0[a][b] : null;
      const epsilonOverride = config.pairEpsilon && config.pairEpsilon[a] ? config.pairEpsilon[a][b] : null;
      pairSigma[p] = r0Override == null ? (sigmaOverride == null ? 0.5 * (typeSigma[a] + typeSigma[b]) : sigmaOverride) : r0Override / SQRT2_1_6;
      pairEpsilon[p] = epsilonOverride == null ? Math.sqrt(typeEpsilon[a] * typeEpsilon[b]) : epsilonOverride;
      pairMode[p] = config.pairMode && config.pairMode[a] && config.pairMode[a][b] === "repulsive" ? 1 : 0;
      pairSigma2[p] = pairSigma[p] * pairSigma[p];
      pairCutoff2[p] = pairMode[p] === 1 ? 1.2599210498948732 * pairSigma2[p] : 6.25 * pairSigma2[p];
      pairCoeff[p] = 24 * pairEpsilon[p] / pairSigma2[p];
      maxPairCutoff = Math.max(maxPairCutoff, Math.sqrt(pairCutoff2[p]));
    }
  }

  return { typeSigma, typeEpsilon, pairSigma, pairEpsilon, pairMode, pairSigma2, pairCutoff2, pairCoeff, maxPairCutoff, typeCount };
}

function makeSnapshot(n) {
  const tables = buildTables();
  const aspect = 1.6;
  const height = Math.sqrt(n / (config.density * aspect));
  const width = height * aspect;
  const positions = new Float32Array(n * 2);
  const typeIds = new Int16Array(n);
  let totalFraction = 0;

  for (const type of config.particleTypes) totalFraction += Math.max(0, type.fraction || 0);

  let idx = 0;
  for (let t = 0; t < config.particleTypes.length; t += 1) {
    const count = t === config.particleTypes.length - 1 ? n - idx : Math.round(n * Math.max(0, config.particleTypes[t].fraction || 0) / totalFraction);
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
    typeCount: tables.typeCount,
    typeSigma: tables.typeSigma,
    typeEpsilon: tables.typeEpsilon,
    pairSigma: tables.pairSigma,
    pairEpsilon: tables.pairEpsilon,
    pairMode: tables.pairMode,
    pairSigma2: tables.pairSigma2,
    pairCutoff2: tables.pairCutoff2,
    pairCoeff: tables.pairCoeff,
    maxPairCutoff: tables.maxPairCutoff,
    boxWidth: width,
    boxHeight: height,
    mouseActive: true,
    mouseX: width * 0.53,
    mouseY: height * 0.47,
    mouseWallEnabled: config.mouseWallEnabled,
    mouseWallRadius: config.mouseWallRadius,
    mouseWallSoftness: config.mouseWallSoftness,
    mouseWallEpsilon: config.mouseWallEpsilon,
    mouseWallMaxForce: config.mouseWallMaxForce,
    mouseWallMode: "repulsive",
    wallMode: config.wallMode,
    reflectiveWallPadding: config.reflectiveWallPadding,
    wallSigmaScale: config.wallSigmaScale,
    wallAppearanceDistance: config.wallAppearanceDistance,
    wallMaxForce: config.wallMaxForce,
    approxTableBits: 9
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
    mouseWallMode: base.mouseWallMode,
    wallMode: base.wallMode,
    reflectiveWallPadding: base.reflectiveWallPadding,
    wallSigmaScale: base.wallSigmaScale,
    wallAppearanceDistance: base.wallAppearanceDistance,
    wallMaxForce: base.wallMaxForce,
    approxTableBits: base.approxTableBits
  };
}

function computeSerial(base, cache) {
  const forces = new Float32Array(base.n * 2);
  const cellSize = Math.max(1e-9, base.maxPairCutoff);
  const cols = Math.max(1, Math.ceil(base.boxWidth / cellSize));
  const rows = Math.max(1, Math.ceil(base.boxHeight / cellSize));
  const cellCount = cols * rows;
  let sink = 0;

  if (!cache.heads || cache.cellCapacity < cellCount) {
    cache.heads = new Int32Array(cellCount);
    cache.cellCapacity = cellCount;
  }

  if (!cache.next || cache.particleCapacity < base.n) {
    cache.next = new Int32Array(base.n);
    cache.particleCapacity = base.n;
  }

  const heads = cache.heads;
  const next = cache.next;

  heads.fill(-1, 0, cellCount);

  for (let i = 0; i < base.n; i += 1) {
    const cx = Math.max(0, Math.min(cols - 1, Math.floor(base.positions[2 * i] / cellSize)));
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(base.positions[2 * i + 1] / cellSize)));
    const cell = cy * cols + cx;
    next[i] = heads[cell];
    heads[cell] = i;
  }

  function addPair(i, j) {
    const dx = base.positions[2 * i] - base.positions[2 * j];
    const dy = base.positions[2 * i + 1] - base.positions[2 * j + 1];
    let r2 = dx * dx + dy * dy;
    const pair = base.typeIds[i] * base.typeCount + base.typeIds[j];
    const sigma2 = base.pairSigma2[pair];

    if (r2 >= base.pairCutoff2[pair]) return;

    r2 = Math.max(r2, 0.4225 * sigma2);
    const invU = sigma2 / r2;
    const invU3 = invU * invU * invU;
    const invU6 = invU3 * invU3;
    const scalar = base.pairCoeff[pair] * (2 * invU6 - invU3) * invU;
    const fx = scalar * dx;
    const fy = scalar * dy;
    forces[2 * i] += fx;
    forces[2 * i + 1] += fy;
    forces[2 * j] -= fx;
    forces[2 * j + 1] -= fy;
    sink += fx + fy;
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const baseCell = row * cols + col;

      for (let a = heads[baseCell]; a !== -1; a = next[a]) {
        for (let b = next[a]; b !== -1; b = next[b]) addPair(a, b);
      }

      for (let oy = 0; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (oy === 0 && ox <= 0) continue;
          const nx = col + ox;
          const ny = row + oy;
          if (nx < 0 || nx >= cols || ny >= rows) continue;
          const otherCell = ny * cols + nx;

          for (let c = heads[baseCell]; c !== -1; c = next[c]) {
            for (let d = heads[otherCell]; d !== -1; d = next[d]) addPair(c, d);
          }
        }
      }
    }
  }

  return sink + forces[0];
}

async function runSerial(base, iterations) {
  const cache = {};
  computeSerial(base, cache);
  const t0 = performance.now();
  let sink = 0;
  for (let i = 0; i < iterations; i += 1) sink += computeSerial(base, cache);
  const t1 = performance.now();
  return { mode: "serial", workerCount: 0, particleCount: base.n, iterations, msPerForce: (t1 - t0) / iterations, sink };
}

async function runWorkerPool(base, workerCount, iterations) {
  const source = workerSource(workerPath);
  const workers = Array.from({ length: workerCount }, () => new Worker(source, { eval: true }));
  const chunk = Math.ceil(base.n / workerCount);

  await Promise.all(workers.map((worker, i) => new Promise(resolve => {
    worker.once("message", resolve);
    worker.postMessage(cloneTask(base, i * chunk, Math.min(base.n, (i + 1) * chunk)));
  })));

  const t0 = performance.now();
  for (let iter = 0; iter < iterations; iter += 1) {
    await Promise.all(workers.map((worker, i) => new Promise(resolve => {
      worker.once("message", resolve);
      worker.postMessage(cloneTask(base, i * chunk, Math.min(base.n, (i + 1) * chunk)));
    })));
  }
  const t1 = performance.now();
  await Promise.all(workers.map(worker => worker.terminate()));

  return { mode: "parallel", workerCount, particleCount: base.n, iterations, msPerForce: (t1 - t0) / iterations };
}

async function main() {
  const rows = [];
  for (const count of counts) {
    const base = makeSnapshot(count);
    rows.push(await runSerial(base, iterations));
    for (let workers = 1; workers <= maxWorkers; workers += 1) {
      rows.push(await runWorkerPool(base, workers, iterations));
    }
  }
  console.log(JSON.stringify({ rows }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""


def run_benchmark(counts: list[int], iterations: int, max_workers: int) -> list[dict]:
    with tempfile.TemporaryDirectory() as tmpdir:
        benchmark_path = Path(tmpdir) / "bench_parallel_threshold.js"
        benchmark_path.write_text(NODE_BENCHMARK, encoding="utf-8")
        completed = subprocess.run(
            [
                "node",
                str(benchmark_path),
                ",".join(str(count) for count in counts),
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
            fieldnames=["mode", "workerCount", "particleCount", "iterations", "msPerForce"],
            extrasaction="ignore",
        )
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    rows = run_benchmark(counts=[200, 400, 600, 800, 1000, 1200], iterations=30, max_workers=4)
    write_csv(rows)
    print(f"wrote {CSV_PATH.relative_to(ROOT)}")

    first_parallel_win = None
    for count in sorted({int(row["particleCount"]) for row in rows}):
      subset = [row for row in rows if int(row["particleCount"]) == count]
      best = min(subset, key=lambda row: float(row["msPerForce"]))
      serial = next(row for row in subset if row["mode"] == "serial")
      print(
          f"N={count}: serial={float(serial['msPerForce']):.3f}ms "
          f"best={best['mode']} {int(best['workerCount'])}w {float(best['msPerForce']):.3f}ms"
      )
      if best["mode"] == "parallel" and first_parallel_win is None:
          first_parallel_win = count

    if first_parallel_win is not None:
        print(f"recommended LJ_MD_PARALLEL_THRESHOLD ~= {first_parallel_win}")
    else:
        print("recommended LJ_MD_PARALLEL_THRESHOLD above tested range")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
