"""CPU energy estimates via Intel RAPL. Honest about missing sensors."""

from __future__ import annotations

import time
from pathlib import Path

RAPL_PATHS = [
    Path("/sys/class/powercap/intel-rapl/intel-rapl:0/energy_uj"),
    Path("/sys/class/powercap/intel-rapl:0/energy_uj"),
]


def _read_energy_uj():
    for path in RAPL_PATHS:
        try:
            return int(path.read_text().strip()), str(path)
        except (OSError, ValueError):
            continue
    return None, None


class EnergySampler:
    def __init__(self):
        self._t0 = None
        self._e0 = None
        self._path = None
        self._reason = None

    def start(self):
        energy, path = _read_energy_uj()
        self._t0 = time.perf_counter()
        self._e0 = energy
        self._path = path
        if energy is None:
            self._reason = (
                "RAPL energy_uj is not readable on this host "
                "(no intel-rapl sysfs, or permission denied). "
                "nvidia-smi is also unavailable. Energy per decision is not reported."
            )
        return self

    def stop(self, n=1):
        elapsed = time.perf_counter() - self._t0 if self._t0 is not None else None
        if self._e0 is None:
            return {
                "available": False,
                "reason": self._reason,
                "elapsed_s": elapsed,
                "sensor": "none",
                "uncertainty": "no sensor",
            }
        energy, path = _read_energy_uj()
        if energy is None:
            return {
                "available": False,
                "reason": "RAPL became unreadable during the run",
                "elapsed_s": elapsed,
                "sensor": self._path,
            }
        delta_j = max(0, energy - self._e0) / 1e6
        mean_w = delta_j / elapsed if elapsed else None
        per = delta_j / n if n else None
        return {
            "available": True,
            "sensor": path,
            "energy_j": delta_j,
            "mean_power_w": mean_w,
            "energy_per_decision_j": per,
            "elapsed_s": elapsed,
            "uncertainty": (
                "RAPL package energy. Background load is not subtracted; treat as an estimate."
            ),
        }
