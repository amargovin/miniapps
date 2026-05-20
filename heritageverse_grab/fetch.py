"""Fetch heritageverse.net artifacts → decompress Draco → export STL.

Usage: python3 fetch.py <slug-id> [<slug-id> ...]
"""
import json, os, re, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
API = "https://api.museumverse.net/api2/assets/artifacts"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) heritage-grab/1.0"


def fetch(url, dest=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    if dest:
        with open(dest, "wb") as f:
            f.write(data)
    return data


def extract_meta(slug):
    html = fetch(f"https://heritageverse.net/artifacts/{slug}").decode("utf-8", "replace")
    glbs = set(re.findall(r"[A-Za-z0-9_-]+\.glb", html))
    if not glbs:
        raise RuntimeError(f"no .glb reference found on page for {slug}")
    target_glb = next(iter(glbs))
    for m in re.finditer(r'\\?"uuid\\?":\\?"([A-Za-z0-9_]{15,30})\\?"', html):
        window = html[m.start() : m.start() + 4000]
        if target_glb not in window:
            continue
        info = {"uuid": m.group(1), "slug": slug}
        for k in ["mesh", "texture", "normal_map", "name", "material", "museum", "size"]:
            mm = re.search(r'\\?"%s\\?":\\?"?([^",}\\\\]*)' % k, window)
            if mm:
                info[k] = mm.group(1)
        return info
    raise RuntimeError(f"could not find uuid block matching {target_glb}")


def download_asset(uuid, filename, dest):
    url = f"{API}/{uuid}/{filename}"
    print(f"  ↓ {filename}")
    fetch(url, dest)


def decompress(in_glb, out_glb):
    subprocess.run(
        ["npx", "--yes", "@gltf-transform/cli", "cp", in_glb, out_glb],
        check=True, capture_output=True,
    )


def glb_to_stl(in_glb, out_stl):
    import trimesh
    m = trimesh.load(in_glb, force="mesh")
    m.export(out_stl)
    return len(m.faces), m.extents.tolist()


def process(slug_with_id):
    print(f"\n=== {slug_with_id} ===")
    info = extract_meta(slug_with_id)
    print(f"  name={info.get('name')!r} uuid={info['uuid']} mesh={info['mesh']}")

    glb_path = os.path.join(ROOT, "glb", f"{slug_with_id}.glb")
    decoded = os.path.join(ROOT, "intermediate", f"{slug_with_id}_decoded.glb")
    stl_path = os.path.join(ROOT, "stl", f"{slug_with_id}.stl")

    download_asset(info["uuid"], info["mesh"], glb_path)
    for key in ("texture", "normal_map"):
        fn = info.get(key)
        if fn:
            ext = os.path.splitext(fn)[1]
            suffix = "_albedo" if key == "texture" else "_normal"
            download_asset(info["uuid"], fn, os.path.join(ROOT, "textures", f"{slug_with_id}{suffix}{ext}"))

    print("  ⤷ decompressing Draco")
    decompress(glb_path, decoded)
    print("  ⤷ exporting STL")
    faces, extents = glb_to_stl(decoded, stl_path)
    print(f"  ✓ {faces} tris, extents={[round(x, 2) for x in extents]}")

    info["files"] = {
        "glb": f"glb/{slug_with_id}.glb",
        "stl": f"stl/{slug_with_id}.stl",
        "texture": next((f"textures/{f}" for f in os.listdir(os.path.join(ROOT, "textures"))
                        if f.startswith(f"{slug_with_id}_albedo")), None),
        "normal": next((f"textures/{f}" for f in os.listdir(os.path.join(ROOT, "textures"))
                       if f.startswith(f"{slug_with_id}_normal")), None),
    }
    info["faces"] = faces
    info["extents"] = [round(x, 2) for x in extents]
    return info


if __name__ == "__main__":
    out = {}
    for slug in sys.argv[1:]:
        try:
            out[slug] = process(slug)
        except Exception as e:
            print(f"  ✗ FAILED: {e}")
            out[slug] = {"error": str(e)}
    with open(os.path.join(ROOT, "metadata.json"), "w") as f:
        json.dump(out, f, indent=2)
