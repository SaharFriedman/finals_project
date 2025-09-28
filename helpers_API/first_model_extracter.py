# oi_grab_pixels_only.py
# Downloads images from Open Images where any class name contains your search term
# Saves only JPGs - no labels are written

import os, csv, io, gzip, argparse, urllib.request, pathlib
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://storage.googleapis.com/openimages/annotations/v7"
CLASS_CSV = "https://storage.googleapis.com/openimages/2018_04/class-descriptions-boxable.csv"

SPLIT = {
    "train_boxes": f"{BASE}/oidv7-train-annotations-bbox.csv.gz",
    "val_boxes":   f"{BASE}/oidv7-val-annotations-bbox.csv.gz",
    "test_boxes":  f"{BASE}/oidv7-test-annotations-bbox.csv.gz",
    "train_meta":  f"{BASE}/oidv7-train-images-with-labels-with-rotation.csv",
    "val_meta":    f"{BASE}/oidv7-val-images-with-labels-with-rotation.csv",
    "test_meta":   f"{BASE}/oidv7-test-images-with-labels-with-rotation.csv",
}

def fetch(url, out_path):
    if not os.path.exists(out_path):
        urllib.request.urlretrieve(url, out_path)
    return out_path

def load_class_map():
    fetch(CLASS_CSV, "class-descriptions-boxable.csv")
    name_to_mid = {}
    with open("class-descriptions-boxable.csv", newline="", encoding="utf-8") as f:
        for mid, name in csv.reader(f):
            name_to_mid[name] = mid
    return name_to_mid

def find_mids(term, name_to_mid):
    term = term.lower()
    return {mid for name, mid in name_to_mid.items() if term in name.lower()}

def stream_gz(path_gz):
    with open(path_gz, "rb") as fh:
        gz = gzip.GzipFile(fileobj=io.BytesIO(fh.read()))
        yield from csv.DictReader(io.TextIOWrapper(gz, encoding="utf-8"))

def collect_image_ids(split, mids, cap_per_mid=None):
    boxes_gz = f"oidv7-{split}-annotations-bbox.csv.gz"
    fetch(SPLIT[f"{split}_boxes"], boxes_gz)
    counts = {m: 0 for m in mids}
    keep = set()
    for row in stream_gz(boxes_gz):
        m = row["LabelName"]
        if m in mids:
            if cap_per_mid is None or counts[m] < cap_per_mid:
                keep.add(row["ImageID"])
                counts[m] += 1
    return keep

def load_urls(split):
    meta_csv = f"oidv7-{split}-images-with-labels-with-rotation.csv"
    fetch(SPLIT[f"{split}_meta"], meta_csv)
    id2url = {}
    with open(meta_csv, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            u = row.get("OriginalURL") or ""
            if u:
                id2url[row["ImageID"]] = u
    return id2url

def sanitize(s):
    keep = "-_.() abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    return "".join(c if c in keep else "_" for c in s)[:120]

def download_one(iid, url, out_dir, timeout=30):
    out = out_dir / f"{sanitize(iid)}.jpg"
    if out.exists():
        return True
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r, open(out, "wb") as f:
            f.write(r.read())
        return True
    except Exception:
        return False

def main():
    ap = argparse.ArgumentParser(description="Grab pixels only from Open Images by label substring")
    ap.add_argument("--term", required=True, help="substring like 'pot' or 'plant'")
    ap.add_argument("--split", choices=["train","val","test"], default="train")
    ap.add_argument("--out", default="oi_pixels")
    ap.add_argument("--limit-per-class", type=int, default=None, help="max images per matched class")
    ap.add_argument("--max-workers", type=int, default=16)
    args = ap.parse_args()

    out_dir = pathlib.Path(args.out) / f"{args.term}_{args.split}"
    out_dir.mkdir(parents=True, exist_ok=True)

    name_to_mid = load_class_map()
    mids = find_mids(args.term, name_to_mid)
    if not mids:
        print(f"No classes matched '{args.term}'")
        return

    print(f"Matched {len(mids)} classes for '{args.term}'")
    img_ids = collect_image_ids(args.split, mids, args.limit_per_class)
    print(f"Found {len(img_ids)} image ids in {args.split}")

    id2url = load_urls(args.split)
    tasks = [(iid, id2url[iid]) for iid in img_ids if iid in id2url]
    print(f"{len(tasks)} have OriginalURL")

    ok = 0
    with ThreadPoolExecutor(max_workers=args.max_workers) as ex:
        futs = [ex.submit(download_one, iid, url, out_dir) for iid, url in tasks]
        for fut in as_completed(futs):
            ok += 1 if fut.result() else 0
    print(f"Downloaded {ok}/{len(tasks)} to {out_dir}")

if __name__ == "__main__":
    main()
