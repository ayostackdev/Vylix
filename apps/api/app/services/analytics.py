from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


@dataclass(slots=True)
class GpaPredictionInput:
    study_hours_per_week: float
    attendance_rate: float
    assessment_score: float


class GpaPredictor:
    def __init__(self) -> None:
        self.pipeline = Pipeline(
            steps=[
                ("scaler", StandardScaler()),
                ("model", LinearRegression()),
            ]
        )
        self.is_fitted = False

    def fit(self, frame: pd.DataFrame, target_column: str = "gpa") -> None:
        features = frame.drop(columns=[target_column])
        target = frame[target_column]
        self.pipeline.fit(features, target)
        self.is_fitted = True

    def predict(self, payload: GpaPredictionInput) -> float:
        if not self.is_fitted:
            raise RuntimeError("Predictor must be fitted before calling predict")

        frame = pd.DataFrame(
            [
                {
                    "study_hours_per_week": payload.study_hours_per_week,
                    "attendance_rate": payload.attendance_rate,
                    "assessment_score": payload.assessment_score,
                }
            ]
        )
        prediction = self.pipeline.predict(frame)
        return float(np.clip(prediction[0], 0.0, 5.0))
