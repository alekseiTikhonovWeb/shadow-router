#!/usr/bin/env python3
"""Load tester for the LiteLLM proxy. /v1/models (default) has no provider cost; --path /v1/chat/completions --model loadtest-echo runs the full billing path.

Usage:
  python scripts/loadtest.py --key sk-... --concurrency 25 --seconds 10
  python scripts/loadtest.py --key sk-... --ramp 10,25,50 --seconds 6
"""
import argparse
import asyncio
import statistics
import time

import httpx

BASE = "https://api.shadowrouter.ca"


async def worker(client, url, headers, body, stop_at, lat, errs):
    while time.monotonic() < stop_at:
        t = time.monotonic()
        try:
            r = await client.post(url, headers=headers, json=body) if body else \
                await client.get(url, headers=headers)
            lat.append(time.monotonic() - t)  # latency is measured for every response, errors included
            if r.status_code >= 400:
                errs.append(r.status_code)
        except Exception as e:  # noqa: BLE001
            errs.append(type(e).__name__)


async def run_stage(base, path, key, model, concurrency, seconds):
    url = f"{base}{path}"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    body = None
    if path.endswith("/chat/completions"):
        body = {"model": model, "messages": [{"role": "user", "content": "ping"}],
                "mock_response": "pong", "max_tokens": 8}
    lat, errs = [], []
    stop_at = time.monotonic() + seconds
    limits = httpx.Limits(max_connections=concurrency + 10, max_keepalive_connections=concurrency)
    async with httpx.AsyncClient(timeout=30, limits=limits) as client:
        await asyncio.gather(*[
            worker(client, url, headers, body, stop_at, lat, errs) for _ in range(concurrency)
        ])
    ok = len(lat) - sum(1 for e in errs if isinstance(e, int))  # responses minus HTTP errors
    rps = ok / seconds
    p = lambda q: (statistics.quantiles(lat, n=100)[q - 1] * 1000) if len(lat) > 5 else (max(lat) * 1000 if lat else 0)
    print(f"  conc={concurrency:>4} | ok={ok:>5} | {rps:>7.1f} req/s | "
          f"p50={p(50):>6.0f}ms p95={p(95):>6.0f}ms p99={p(99):>6.0f}ms | errors={len(errs)}")
    return rps, p(95), len(errs)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", required=True)
    ap.add_argument("--base", default=BASE)
    ap.add_argument("--path", default="/v1/models")
    ap.add_argument("--model", default="loadtest-echo")
    ap.add_argument("--concurrency", type=int, default=25)
    ap.add_argument("--seconds", type=int, default=8)
    ap.add_argument("--ramp", default="") 
    args = ap.parse_args()

    print(f"target: {args.base}{args.path}  ({args.seconds}s/stage)")
    stages = [int(x) for x in args.ramp.split(",")] if args.ramp else [args.concurrency]
    for c in stages:
        await run_stage(args.base, args.path, args.key, args.model, c, args.seconds)


if __name__ == "__main__":
    asyncio.run(main())
