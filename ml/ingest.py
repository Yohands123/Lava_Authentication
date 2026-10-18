"""Pinned, bounded, provenance-recorded source inspection and local dataset ingestion.
Never extracts archive paths or downloads restricted BeCAPTCHA data.
"""
import argparse
import csv
import hashlib
import io
import json
import math
import tarfile
import urllib.request
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
REV = "712a00ea994738b680b0b11bb4b518979385d07b"
BASE = f"https://raw.githubusercontent.com/chrisgdt/DELBOT-Mouse/{REV}/"
EXPECTED = {"LICENSE.md": "883ee7c97966cc2901adfaa012cdb62c0ba777228b3c5861c57b1f58c620b132",
            "python/sessions.json": "315b857c526ab5572f693cabdf6c3fbc28eef064f152c6ad847875b6d05ce580",
            "python/dataset.tar.gz": "cc6d763704b3abde1b46d848c56754cd0eae7a76619c53946e25b9cbec5d93fc"}
SOURCES = {
    "balabit": ("https://github.com/balabit/Mouse-Dynamics-Challenge", "human-only; impostors are other humans", "No explicit repository license found; metadata inspection only", False),
    "sapimouse": ("https://github.com/margitantal68/sapimouse", "human authentication, not bot labels", "Raw source linked by authors; no clear raw-data reuse license verified", False),
    "becaptcha": ("https://github.com/BiDAlab/BeCAPTCHA-Mouse", "synthetic benchmark", "Signed institutional agreement required; not downloaded", False),
    "delbot": ("https://github.com/chrisgdt/DELBOT-Mouse", "human/bot labels from upstream sessions.json", "Repository MIT; raw corpus excluded from Git; no separate corpus license located", True),
    "ghost-cursor": ("https://github.com/Xetera/ghost-cursor", "synthetic generator, not human data", "MIT code; local adversarial use only", False),
}

def fetch(url, maximum=12_000_000):
    req = urllib.request.Request(url, headers={"User-Agent": "LavaGuard-local-research"})
    with urllib.request.urlopen(req, timeout=45) as response:
        data = response.read(maximum + 1)
    if len(data) > maximum:
        raise ValueError("source exceeds permitted size")
    if url.startswith(BASE):
        name = url[len(BASE):]
        if name in EXPECTED and hashlib.sha256(data).hexdigest() != EXPECTED[name]:
            raise ValueError("pinned source integrity mismatch: " + name)
    return data

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--download-delbot", action="store_true")
    args = parser.parse_args()
    folder = ROOT / "ml/private"
    folder.mkdir(parents=True, exist_ok=True)
    manifest = {"schemaVersion": 1, "inspectedOn": "2026-10-17", "rawDataRedistributed": False,
                "sources": [{"id": key, "url": row[0], "labels": row[1], "licenseNotes": row[2], "permittedLocalLoader": row[3]} for key, row in SOURCES.items()], "integrity": []}
    # Source documentation is hashed for integrity; downloaded metadata is kept private.
    urls = [(key, row[0].replace("https://github.com/", "https://raw.githubusercontent.com/") + "/master/README.md") for key, row in SOURCES.items()]
    urls += [("delbot-license", BASE + "LICENSE.md"), ("delbot-sessions", BASE + "python/sessions.json")]
    urls += [("sapimouse-raw-source-page", "https://ms.sapientia.ro/~manyi/sapimouse/sapimouse.html")]
    for key, url in urls:
        try:
            data = fetch(url)
            manifest["integrity"].append({"id": key, "url": url, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
            (folder / (key + ".txt")).write_bytes(data)
        except Exception as error:
            manifest["integrity"].append({"id": key, "url": url, "error": str(error)})
    if args.download_delbot:
        license_text = fetch(BASE + "LICENSE.md")
        if b"MIT License" not in license_text:
            raise ValueError("upstream license changed; manual review required")
        archive = fetch(BASE + "python/dataset.tar.gz")
        manifest["integrity"].append({"id": "delbot-corpus", "revision": REV, "url": BASE + "python/dataset.tar.gz", "sha256": hashlib.sha256(archive).hexdigest(), "bytes": len(archive)})
        (folder / "dataset.tar.gz").write_bytes(archive)
        labels = json.loads(fetch(BASE + "python/sessions.json"))
        label_map = {}
        for label, paths in labels.items():
            for name in paths:
                parts = PurePosixPath(name).parts
                label_map["/".join(parts[-2:])] = label
        counts, formats = {}, []
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
            with (folder / "normalized.jsonl").open("w", encoding="utf-8") as out:
                for member in tar:
                    if not member.isfile() or member.size > 2_000_000 or not member.name.endswith(".txt"):
                        continue
                    key = "/".join(PurePosixPath(member.name).parts[-2:])
                    label = label_map.get(key)
                    if label not in ("human", "bot"):
                        continue
                    handle = tar.extractfile(member)
                    if handle is None:
                        continue
                    text = handle.read().decode("utf-8")
                    if len(formats) < 3:
                        formats.append({"file": key, "head": text.splitlines()[:4]})
                    try:
                        records = json.loads(text)
                    except json.JSONDecodeError:
                        # Original DELBOT format: resolution:w,h then time,type,x,y.
                        records = []
                        for row in csv.reader(text.splitlines()[1:]):
                            if len(row) >= 4:
                                try:
                                    records.append({"time": float(row[0]), "x": float(row[2]), "y": float(row[3])})
                                except ValueError:
                                    pass
                    if isinstance(records, dict):
                        records = records.get("records", records.get("data", []))
                    if not records or not isinstance(records[0], dict):
                        continue
                    records = [r for r in records if all(math.isfinite(float(r.get(k, float("nan")))) for k in ("x", "y")) and math.isfinite(float(r.get("time", r.get("t", float("nan")))))]
                    if len(records) < 2:
                        continue
                    xs = [float(r["x"]) for r in records]
                    ys = [float(r["y"]) for r in records]
                    scale = max(max(xs) - min(xs), max(ys) - min(ys), 1)
                    start = float(records[0].get("time", records[0].get("t", 0)))
                    xmin, ymin = min(xs), min(ys)
                    samples = [{"x": (x - xmin) / scale, "y": (y - ymin) / scale,
                                "t": float(r.get("time", r.get("t", 0))) - start} for r, x, y in zip(records, xs, ys)]
                    bounded, last = [], -float("inf")
                    for sample in samples:
                        if sample["t"] - last >= 32:
                            bounded.append(sample)
                            last = sample["t"]
                        if len(bounded) == 1024:
                            break
                    samples = bounded
                    # Upstream folders distinguish tasks, generator families and pc1/pc2.
                    group = PurePosixPath(key).parts[0]
                    out.write(json.dumps({"id": key, "source": "delbot", "label": label, "group": group, "device": "pc2" if "pc2" in group else "pc1" if "pc1" in group else "unspecified", "samples": samples}) + "\n")
                    counts[label] = counts.get(label, 0) + 1
        manifest["delbotNormalizedCounts"] = counts
        (folder / "format-inspection.json").write_text(json.dumps(formats, indent=2), encoding="utf-8")
    path = ROOT / "ml/datasets/manifest.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"manifest": str(path), "counts": manifest.get("delbotNormalizedCounts", {})}))

if __name__ == "__main__":
    main()
