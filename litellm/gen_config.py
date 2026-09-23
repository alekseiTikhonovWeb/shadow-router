#!/usr/bin/env python3
"""Writes the litellm config: every enabled catalog model x every key in the provider's env list, priced at catalog x MARKUP.
Run before litellm starts:  python gen_config.py /app/config.yaml"""
import os
import re
import sys
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOG = os.path.join(HERE, "catalog.yaml")


def parse_keys(raw: str):
    if not raw:
        return []
    return [p.strip() for p in re.split(r"[,\s]+", raw.strip()) if p.strip()]


def legacy_keys(prefix: str):
    # Back-compat with the indexed PREFIX_N env vars, sorted by suffix.
    if not prefix:
        return []
    pat = re.compile(rf"^{re.escape(prefix)}(?:_(\d+))?$")
    found = []
    for k, v in os.environ.items():
        m = pat.match(k)
        if m and v.strip():
            found.append((int(m.group(1) or 0), v.strip()))
    found.sort(key=lambda x: x[0])
    return [v for _, v in found]


def dedup(seq):
    seen, out = set(), []
    for x in seq:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "/app/config.yaml"
    catalog = yaml.safe_load(open(CATALOG))
    markup = float(os.environ.get(catalog.get("markup_env", "MARKUP"), "1.0") or "1.0")

    model_list = []
    per_provider_models = {}  # provider -> [(model_id, in_per_tok)], for fallback ordering
    summary = []

    for pname, prov in (catalog.get("providers") or {}).items():
        keys = dedup(parse_keys(os.environ.get(prov["keys_env"], ""))
                     + legacy_keys(prov.get("legacy_prefix", "")))
        if not keys:
            summary.append(f"  {pname}: NO keys ({prov['keys_env']}), skipped")
            continue
        gen_models = []
        for m in prov.get("models") or []:
            if not m.get("enabled"):
                continue
            in_tok = float(m["in"]) / 1_000_000 * markup
            out_tok = float(m["out"]) / 1_000_000 * markup
            # No model ships without a confirmed price; the load-test mock is exempt because it bills nothing.
            if (in_tok <= 0 or out_tok <= 0) and not m.get("mock"):
                continue
            for key in keys:
                params = {
                    "model": f"{prov['prefix']}/{m['id']}",
                    "api_key": key,
                    "input_cost_per_token": in_tok,
                    "output_cost_per_token": out_tok,
                }
                # Mock: canned response, no provider call, full proxy path.
                if m.get("mock"):
                    params["mock_response"] = str(m["mock"])
                model_list.append({"model_name": m["id"], "litellm_params": params})
            gen_models.append((m["id"], in_tok))
        per_provider_models[pname] = gen_models
        summary.append(f"  {pname}: {len(keys)} key(s) x {len(gen_models)} model(s)")

    # Fallbacks stay within a provider, from expensive to cheaper.
    fallbacks = []
    for pname, models in per_provider_models.items():
        ordered = sorted(models, key=lambda x: x[1])  # cheapest first
        ids = [mid for mid, _ in ordered]
        for i, mid in enumerate(ids):
            cheaper = ids[:i][::-1]  # cheaper models, nearest price first
            if cheaper:
                fallbacks.append({mid: cheaper})

    cfg = {
        "model_list": model_list,
        "router_settings": {
            **(catalog.get("router") or {}),
            "redis_host": "os.environ/REDIS_HOST",
            "redis_port": "os.environ/REDIS_PORT",
            "redis_password": "os.environ/REDIS_PASSWORD",
            "fallbacks": fallbacks,
        },
        "litellm_settings": {"drop_params": True},
        "general_settings": {
            "master_key": "os.environ/LITELLM_MASTER_KEY",
            "database_url": "os.environ/DATABASE_URL",
        },
    }

    with open(out_path, "w") as f:
        yaml.safe_dump(cfg, f, sort_keys=False, default_flow_style=False)

    print(f"[gen_config] MARKUP={markup} → {len(model_list)} deployments, {out_path}")
    print("\n".join(summary))
    if not model_list:
        print("[gen_config] WARNING: no provider keys set; the proxy will start with no models.")


if __name__ == "__main__":
    main()
