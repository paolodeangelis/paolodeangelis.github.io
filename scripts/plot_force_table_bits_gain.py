#!/usr/bin/env python3
"""Benchmark LJ force approximation table sizes with speed and error.

This uses a 1000-particle synthetic snapshot, repeats each case several times,
and compares exact, optimized-exact, and lookup-table approximate workers.

Outputs:
- scripts/force_table_bits_gain.csv
- scripts/force_table_bits_gain.png if matplotlib is installed
"""

from __future__ import annotations

import csv
import json
import math
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "scripts" / "force_table_bits_gain.csv"
PNG_PATH = ROOT / "scripts" / "force_table_bits_gain.png"


NODE_BENCHMARK = r"""
const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");
const { performance } = require("perf_hooks");

const repoRoot = process.cwd();
const workersByBackend = {
  exact: path.join(repoRoot, "assets/js/lj-force-worker.js"),
  optimized: path.join(repoRoot, "assets/js/lj-force-worker-optimized.js"),
  approx: path.join(repoRoot, "assets/js/lj-force-worker-approx.js")
};
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
const iterations = Number(process.argv[3] || 20);
const repeats = Number(process.argv[4] || 5);
const minBits = Number(process.argv[5] || 5);
const maxBits = Number(process.argv[6] || 12);

function makeSnapshot(n, tableBits) {
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
    approxTableBits: tableBits
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

function sumForces(buffers, n) {
  const total = new Float32Array(n * 2);
  for (const buffer of buffers) {
    const part = new Float32Array(buffer);
    for (let i = 0; i < total.length; i += 1) total[i] += part[i];
  }
  return total;
}

async function runWorkerPool(backend, workerCount, iterations, base) {
  const source = workerSource(workersByBackend[backend]);
  const workers = Array.from({ length: workerCount }, () => new Worker(source, { eval: true }));
  const chunk = Math.ceil(base.n / workerCount);
  let lastBuffers = null;

  async function once() {
    const messages = await Promise.all(workers.map((worker, i) => new Promise(resolve => {
      worker.once("message", resolve);
      worker.postMessage(cloneTask(base, i * chunk, Math.min(base.n, (i + 1) * chunk)));
    })));
    return messages.map(message => message.forces);
  }

  await once();
  const t0 = performance.now();
  for (let iter = 0; iter < iterations; iter += 1) lastBuffers = await once();
  const t1 = performance.now();

  await Promise.all(workers.map(worker => worker.terminate()));
  return {
    msPerForce: (t1 - t0) / iterations,
    forces: sumForces(lastBuffers, base.n)
  };
}

function stats(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

function errorMetrics(reference, test) {
  let diff2 = 0;
  let ref2 = 0;
  let maxAbs = 0;
  for (let i = 0; i < reference.length; i += 1) {
    const diff = test[i] - reference[i];
    diff2 += diff * diff;
    ref2 += reference[i] * reference[i];
    maxAbs = Math.max(maxAbs, Math.abs(diff));
  }
  return {
    relL2Error: Math.sqrt(diff2 / Math.max(1e-30, ref2)),
    maxAbsError: maxAbs
  };
}

async function repeated(backend, workerCount, bits) {
  const times = [];
  let forces = null;
  for (let r = 0; r < repeats; r += 1) {
    const base = makeSnapshot(particleCount, bits);
    const result = await runWorkerPool(backend, workerCount, iterations, base);
    times.push(result.msPerForce);
    forces = result.forces;
  }
  return { ...stats(times), forces };
}

async function main() {
  const rows = [];

  for (const workerCount of [1, 2]) {
    const exact = await repeated("exact", workerCount, minBits);
    const optimized = await repeated("optimized", workerCount, minBits);
    const optimizedError = errorMetrics(exact.forces, optimized.forces);
    rows.push({
      backend: "optimized",
      bits: 0,
      tableSize: 0,
      workerCount,
      exactMeanMs: exact.mean,
      exactStdMs: exact.std,
      backendMeanMs: optimized.mean,
      backendStdMs: optimized.std,
      speedGain: exact.mean / optimized.mean,
      relL2Error: optimizedError.relL2Error,
      maxAbsError: optimizedError.maxAbsError
    });

    for (let bits = minBits; bits <= maxBits; bits += 1) {
      const approx = await repeated("approx", workerCount, bits);
      const err = errorMetrics(exact.forces, approx.forces);
      rows.push({
        backend: "approx",
        bits,
        tableSize: 1 << bits,
        workerCount,
        exactMeanMs: exact.mean,
        exactStdMs: exact.std,
        backendMeanMs: approx.mean,
        backendStdMs: approx.std,
        speedGain: exact.mean / approx.mean,
        relL2Error: err.relL2Error,
        maxAbsError: err.maxAbsError
      });
    }
  }

  console.log(JSON.stringify({ particleCount, iterations, repeats, rows }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""


def run_benchmark(particles: int, iterations: int, repeats: int, min_bits: int, max_bits: int) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        benchmark_path = Path(tmpdir) / "bench_force_table_bits.js"
        benchmark_path.write_text(NODE_BENCHMARK, encoding="utf-8")
        completed = subprocess.run(
            [
                "node",
                str(benchmark_path),
                str(particles),
                str(iterations),
                str(repeats),
                str(min_bits),
                str(max_bits),
            ],
            check=True,
            capture_output=True,
            text=True,
            cwd=ROOT,
        )

    return json.loads(completed.stdout)


def write_csv(rows: list[dict]) -> None:
    with CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "backend",
                "bits",
                "tableSize",
                "workerCount",
                "exactMeanMs",
                "exactStdMs",
                "backendMeanMs",
                "backendStdMs",
                "speedGain",
                "relL2Error",
                "maxAbsError",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)


def write_plot(rows: list[dict]) -> bool:
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        return False

    fig, (speed_ax, error_ax) = plt.subplots(2, 1, figsize=(8, 8), dpi=150, sharex=True)

    for worker_count in [1, 2]:
        subset = [
            row for row in rows
            if row["workerCount"] == worker_count and row["backend"] == "approx"
        ]
        speed_ax.errorbar(
            [row["bits"] for row in subset],
            [row["speedGain"] for row in subset],
            yerr=[
                row["speedGain"] * math.sqrt(
                    (row["exactStdMs"] / row["exactMeanMs"]) ** 2 +
                    (row["backendStdMs"] / row["backendMeanMs"]) ** 2
                )
                for row in subset
            ],
            marker="o",
            capsize=3,
            label=f"{worker_count} worker{'s' if worker_count > 1 else ''}",
        )
        error_ax.plot(
            [row["bits"] for row in subset],
            [row["relL2Error"] for row in subset],
            marker="o",
            label=f"{worker_count} worker{'s' if worker_count > 1 else ''}",
        )

    speed_ax.axhline(1.0, color="0.4", linewidth=1, linestyle="--")
    speed_ax.set_ylabel("speed gain: exact / approx")
    speed_ax.grid(True, alpha=0.25)
    speed_ax.legend()

    error_ax.set_xlabel("LJ_MD_APPROX_FORCE_TABLE_BITS")
    error_ax.set_ylabel("relative L2 force error")
    error_ax.set_yscale("log")
    error_ax.grid(True, alpha=0.25)
    error_ax.legend()

    fig.suptitle("LJ lookup-table force approximation, N=1000")
    fig.tight_layout()
    fig.savefig(PNG_PATH)
    return True


def main() -> int:
    data = run_benchmark(particles=1000, iterations=20, repeats=5, min_bits=5, max_bits=12)
    rows = data["rows"]

    write_csv(rows)
    plotted = write_plot(rows)

    print(
        f"particleCount={data['particleCount']} "
        f"iterations={data['iterations']} repeats={data['repeats']}"
    )
    print(f"wrote {CSV_PATH.relative_to(ROOT)}")
    print(f"wrote {PNG_PATH.relative_to(ROOT)}" if plotted else "matplotlib not available; skipped PNG")

    for worker_count in [1, 2]:
        subset = [
            row for row in rows
            if row["workerCount"] == worker_count and row["backend"] == "approx"
        ]
        best_speed = max(subset, key=lambda row: row["speedGain"])
        best_balanced = min(subset, key=lambda row: row["relL2Error"] / max(row["speedGain"], 1e-9))
        opt = next(
            row for row in rows
            if row["workerCount"] == worker_count and row["backend"] == "optimized"
        )
        print(
            f"{worker_count} worker optimized: exact={opt['exactMeanMs']:.3f}+/-{opt['exactStdMs']:.3f}ms "
            f"opt={opt['backendMeanMs']:.3f}+/-{opt['backendStdMs']:.3f}ms "
            f"gain={opt['speedGain']:.2f}x relL2={opt['relL2Error']:.3e}"
        )
        print(
            f"{worker_count} worker approx fastest: bits={best_speed['bits']} table={best_speed['tableSize']} "
            f"exact={best_speed['exactMeanMs']:.3f}+/-{best_speed['exactStdMs']:.3f}ms "
            f"approx={best_speed['backendMeanMs']:.3f}+/-{best_speed['backendStdMs']:.3f}ms "
            f"gain={best_speed['speedGain']:.2f}x relL2={best_speed['relL2Error']:.3e}"
        )
        print(
            f"{worker_count} worker approx balanced: bits={best_balanced['bits']} "
            f"gain={best_balanced['speedGain']:.2f}x relL2={best_balanced['relL2Error']:.3e}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
