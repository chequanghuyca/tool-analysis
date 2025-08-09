from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

try:
    import lightgbm as lgb
except Exception:  # pragma: no cover
    lgb = None  # type: ignore


@dataclass
class LGBMBaseline:
    booster: Optional["lgb.Booster"]
    feature_names: list[str]

    @classmethod
    def fit(cls, X: pd.DataFrame, y: np.ndarray) -> "LGBMBaseline":
        if lgb is None:
            # Fallback: no training if LightGBM is unavailable
            return cls(None, list(X.columns))
        train = lgb.Dataset(X, label=y)
        params = {
            "objective": "multiclass",
            "num_class": 3,
            "metric": "multi_logloss",
            "learning_rate": 0.05,
            "num_leaves": 31,
            "feature_fraction": 0.9,
            "bagging_fraction": 0.8,
            "bagging_freq": 1,
            "min_data_in_leaf": 25,
            "verbosity": -1,
        }
        booster = lgb.train(params, train, num_boost_round=400)
        return cls(booster, list(X.columns))

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        if self.booster is None:
            # Return neutral probabilities
            return np.tile(np.array([1 / 3, 1 / 3, 1 / 3]), (len(X), 1))
        X = X[self.feature_names]
        return self.booster.predict(X)


