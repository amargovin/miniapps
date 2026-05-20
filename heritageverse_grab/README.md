# Heritageverse 3D Artifact Grab

Downloaded 3D scans of Indian temple sculptures from [heritageverse.net](https://heritageverse.net) (a project by Varaha Heritage / Museumverse), converted to STL for offline viewing and 3D printing.

## Folder layout

```
heritageverse_grab/
├── glb/             original web-LOD .glb files (Draco-compressed) from the server
├── stl/             converted STLs (Bambu/Cura/PrusaSlicer ready)
├── textures/        baked albedo + normal maps (4096px JPG/WebP)
├── intermediate/    Draco-decompressed .glb files (used as the conversion bridge)
├── fetch.py         end-to-end pipeline: page → uuid → glb → STL
├── metadata.json    machine-readable index (uuid, mesh filename, face count, extents)
└── README.md        this file
```

## Catalogue

| Slug | Name | uuid | Triangles | Extents (glTF units) |
|---|---|---|---:|---|
| [`ganesha-441`](https://heritageverse.net/artifacts/ganesha-441) | Ganesha | `nwgqcAC1SmL7tq8uonzZ9R` | 501,036 | 30.53 × 11.74 × 38.53 |
| [`ganesha-463`](https://heritageverse.net/artifacts/ganesha-463) | Ganesha (six-armed, standing, iron) | `pltsW1MFfYLqLsLkQJZjiP` | 500,560 | 22.43 × 15.89 × 36.60 |
| [`kartikey-with-spear-1013`](https://heritageverse.net/artifacts/kartikey-with-spear-1013) | Kartikey With Spear | `44X95wuNOGE9Wu_ZzI7HR6` | 1,000,016 | 13.98 × 10.23 × 35.34 |
| [`narasimha-486`](https://heritageverse.net/artifacts/narasimha-486) | Narasimha | `PfQYXkDQ4VRfr5aO2LY8wq` | 500,034 | 21.83 × 12.93 × 46.00 |
| [`narvaraha-1119`](https://heritageverse.net/artifacts/narvaraha-1119) | Narvaraha | `AS3advMurAdoyun2y9IZd7` | 1,000,034 | 0.76 × 0.35 × 1.28 |
| [`nataraj-small-977`](https://heritageverse.net/artifacts/nataraj-small-977) | Nataraj (small) | `Yi8a9e2s1hPu6h0VEJEIK7` | 500,474 | 39.86 × 19.00 × 60.83 |
| [`nataraja-626`](https://heritageverse.net/artifacts/nataraja-626) | Nataraja | `P7QDoRv9LUCHrOGysodPfP` | 214,373 | 0.29 × 0.57 × 0.10 |
| [`natesh-1118`](https://heritageverse.net/artifacts/natesh-1118) | Natesh | `pKPcC0iDewESv3oJP0HvQ6` | 200,000 | 0.74 × 0.33 × 1.20 |
| [`saraswati-1061`](https://heritageverse.net/artifacts/saraswati-1061) | Saraswati | `t_3X2BYcE29qQWlU3TpOne` | 500,043 | 10.77 × 6.95 × 32.24 |
| [`sheshashayi-vishnu-1047`](https://heritageverse.net/artifacts/sheshashayi-vishnu-1047) | Sheshashayi Vishnu | `ak12VdPh6wvMEZ1sOJPecG` | 500,041 | 22.47 × 9.53 × 15.88 |
| [`uma-maheshvara-beri-400`](https://heritageverse.net/artifacts/uma-maheshvara-beri-400) | Uma Maheshvara, Beri | `owWaizPczYAF4Px27vDLoX` | 500,030 | 26.29 × 9.63 × 39.58 |
| [`vishnu-461`](https://heritageverse.net/artifacts/vishnu-461) | Vishnu | `DdOf742OxpuvK0r3rTDmKk` | 200,126 | 22.87 × 22.35 × 41.56 |

Extents are in the glTF's native units. Most are in centimetres (matches the museum's quoted physical size); a handful are in metres (`nataraja-626`, `natesh-1118`, `narvaraha-1119` — visibly sub-unit numbers). Slicers read STL units as mm, so multiply or rescale on import accordingly. See "Print scaling" below.

## How the assets were located

The artifact pages on heritageverse.net are server-rendered Next.js. Each page's HTML embeds the artifact's JSON (`ID`, `uuid`, `mesh`, `texture`, `normal_map`, etc.) — no API call needed to discover the asset names.

The 3D viewer is a popup that only requests the mesh on click, so opening DevTools and watching the Network tab during the user gesture reveals the request pattern:

```
https://api.museumverse.net/api2/assets/artifacts/{uuid}/{filename}
```

Both the `.glb` and its `.jpg`/`.webp` companion textures are served from this same endpoint, keyed by the artifact's uuid.

## Conversion pipeline

The web `.glb` uses `KHR_draco_mesh_compression`, which trimesh reads metadata for but cannot decode without a native Draco bridge — the result is a mesh with the right face/vertex *counts* but all positions collapsed to the origin (empty STL).

So the pipeline is:

```
artifact page HTML  →  parse uuid + mesh filename  (Python regex)
        ↓
api2/assets/artifacts/{uuid}/{filename}  →  Draco-compressed .glb  (urllib)
        ↓
gltf-transform cp  →  plain .glb in intermediate/  (Node, decompresses Draco)
        ↓
trimesh.load(force='mesh').export(.stl)  →  STL in stl/  (Python)
```

End-to-end driver: [`fetch.py`](fetch.py). Re-run for any new slug:

```bash
python3 fetch.py <slug-id> [<slug-id> ...]
```

Dependencies:
- Python: `trimesh`, `numpy` (`pip install --user trimesh numpy`)
- Node: `@gltf-transform/cli` (auto-fetched via `npx --yes` on first run)

## Important caveat: STL drops most of the visible detail

The web `.glb` is a **moderate-poly base mesh + 4096px normal map** — the carvings, jewellery, drapery, and surface micro-detail you see in the 3D viewer are *baked into the normal map texture*, not real bumps in the geometry. STL strips textures and keeps only geometry, so prints will look ~10–100× softer than the on-screen scan.

Three mitigations:

1. **Print bigger.** Detail scales linearly with size. Doubling print height halves the apparent softness.
2. **Bake normal map → displacement in Blender** before exporting STL. ~10 min with Subdivision Surface + Displace modifiers. Imperfect (normal maps are direction vectors, not heights) but recovers a lot.
3. **Ask the source.** Varaha Heritage / Rissala Collection presumably has the original 10–50M-poly photogrammetry. The web LOD is a public derivative.

## Print scaling and orientation

STLs export at the file's native scale and orientation, which doesn't always match a slicer's expectations (Z-up, mm units, bottom on build plate). For `narasimha-486` a print-ready version (`stl/narasimha-486_print-ready.stl`) is included: tallest axis aligned to Z, scaled to 200 mm height, base flush with Z=0. Same recipe applies to any other model:

```python
import trimesh, numpy as np
m = trimesh.load('stl/<name>.stl')
ext = m.extents
tallest = int(np.argmax(ext))
if tallest != 2:
    axis = [0,1,0] if tallest == 0 else [1,0,0]
    m.apply_transform(trimesh.transformations.rotation_matrix(np.radians(-90), axis))
m.apply_scale(200.0 / max(m.extents))
m.apply_translation([-m.centroid[0], -m.centroid[1], -m.bounds[0][2]])
m.export('stl/<name>_print-ready.stl')
```

## Licensing / attribution

These scans are public-facing assets from heritageverse.net (Museumverse / Varaha Heritage). They were not under a clearly posted Creative Commons licence at the time of download — treat them as "all rights reserved by the host" and confirm permissions with Varaha Heritage or the listed museum before redistributing the STLs, embedding them elsewhere, or selling derived prints. Personal study and 3D-printing for non-commercial use is the conservative default. Each artifact's source URL is in the catalogue above for re-checking the original page.
