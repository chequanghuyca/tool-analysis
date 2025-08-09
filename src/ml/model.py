from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

import numpy as np
import pandas as pd


@dataclass
class StandardScaler:
    mean_: np.ndarray
    std_: np.ndarray

    @classmethod
    def fit(cls, X: np.ndarray) -> "StandardScaler":
        mean = X.mean(axis=0)
        std = X.std(axis=0)
        std[std == 0] = 1.0
        return cls(mean, std)

    def transform(self, X: np.ndarray) -> np.ndarray:
        return (X - self.mean_) / self.std_


@dataclass
class LogisticModel:
    weights: np.ndarray
    bias: float
    scaler: StandardScaler

    @staticmethod
    def _sigmoid(z: np.ndarray) -> np.ndarray:
        return 1.0 / (1.0 + np.exp(-z))

    @classmethod
    def fit(
        cls,
        X: pd.DataFrame,
        y: np.ndarray,
        lr: float = 0.05,
        epochs: int = 400,
        sample_weight: np.ndarray | None = None,
    ) -> "LogisticModel":
        Xn = X.values.astype(float)
        scaler = StandardScaler.fit(Xn)
        Xs = scaler.transform(Xn)
        n_features = Xs.shape[1]
        w = np.zeros(n_features)
        b = 0.0
        if sample_weight is None:
            sample_weight = np.ones(len(y))
        sample_weight = sample_weight.astype(float)
        for _ in range(epochs):
            z = np.dot(Xs, w) + b
            p = cls._sigmoid(z)
            diff = (p - y) * sample_weight
            grad_w = np.dot(Xs.T, diff) / sample_weight.sum()
            grad_b = diff.sum() / sample_weight.sum()
            w -= lr * grad_w
            b -= lr * grad_b
        return cls(w, b, scaler)

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        Xs = self.scaler.transform(X.values.astype(float))
        z = np.dot(Xs, self.weights) + self.bias
        return self._sigmoid(z)

    def predict(self, X: pd.DataFrame, threshold: float = 0.5) -> np.ndarray:
        proba = self.predict_proba(X)
        return (proba >= threshold).astype(int)


