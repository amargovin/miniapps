"""MiniLM embedding wrapper. Lazy singleton, packed float32 storage."""
from __future__ import annotations

import logging
import threading

import numpy as np
from sentence_transformers import SentenceTransformer

from app import config

log = logging.getLogger(__name__)

_lock = threading.Lock()
_instance: "EmbeddingService | None" = None


class EmbeddingService:
    def __init__(self, model_name: str = config.EMBEDDING_MODEL):
        log.info("loading embedding model %s", model_name)
        self.model = SentenceTransformer(model_name)
        self.dim = self.model.get_sentence_embedding_dimension()

    def encode(self, text: str) -> np.ndarray:
        v = self.model.encode(text, normalize_embeddings=True, show_progress_bar=False)
        return np.asarray(v, dtype=np.float32)

    def encode_batch(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, self.dim), dtype=np.float32)
        v = self.model.encode(
            texts, normalize_embeddings=True, show_progress_bar=False, batch_size=32
        )
        return np.asarray(v, dtype=np.float32)

    @staticmethod
    def cosine(a: np.ndarray, b: np.ndarray) -> float:
        # both are L2-normalized
        return float(np.dot(a, b))


def get_service() -> EmbeddingService:
    global _instance
    if _instance is None:
        with _lock:
            if _instance is None:
                _instance = EmbeddingService()
    return _instance


def pack(v: np.ndarray) -> bytes:
    return np.asarray(v, dtype=np.float32).tobytes()


def unpack(blob: bytes, dim: int = 384) -> np.ndarray:
    arr = np.frombuffer(blob, dtype=np.float32)
    if arr.size != dim:
        raise ValueError(f"expected embedding of dim {dim}, got {arr.size}")
    return arr
