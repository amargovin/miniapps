"""Pack/unpack roundtrip tests. These don't load the model — pure numpy."""
import numpy as np

from app.enrich.embed import pack, unpack


def test_pack_unpack_roundtrip():
    v = np.random.rand(384).astype(np.float32)
    blob = pack(v)
    out = unpack(blob)
    np.testing.assert_array_equal(out, v)


def test_pack_size():
    v = np.zeros(384, dtype=np.float32)
    assert len(pack(v)) == 384 * 4  # 4 bytes per float32


def test_unpack_dim_mismatch_raises():
    blob = np.zeros(100, dtype=np.float32).tobytes()
    try:
        unpack(blob, dim=384)
    except ValueError:
        return
    raise AssertionError("expected ValueError on dim mismatch")
