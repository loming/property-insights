"""The model's input features and their hard limits.

These mirror ml-api's features.py, so a bad input is rejected here with a field error before any
model call; tests/test_contract.py fails if the two drift apart.
"""

from dataclasses import dataclass
from datetime import date

CURRENT_YEAR = date.today().year


@dataclass(frozen=True)
class Feature:
    name: str
    label: str
    unit: str
    integer: bool
    hard_min: float
    hard_max: float
    step: float | None = None


FEATURES: tuple[Feature, ...] = (
    Feature("square_footage", "Living area", "sq ft", True, 200, 20_000, 1),
    Feature("bedrooms", "Bedrooms", "count", True, 0, 20, 1),
    Feature("bathrooms", "Bathrooms", "count", False, 0, 20, 0.5),
    Feature("year_built", "Year built", "year", True, 1800, CURRENT_YEAR, 1),
    Feature("lot_size", "Lot size", "sq ft", False, 0, 1_000_000),
    Feature("distance_to_city_center", "Distance to city centre", "miles", False, 0, 200),
    Feature("school_rating", "School rating", "0-10 scale", False, 0, 10),
)
FEATURE_NAMES: list[str] = [f.name for f in FEATURES]

# Test-CSV row 1, as in ml-api's Swagger.
EXAMPLE_HOUSE = {
    "square_footage": 1550,
    "bedrooms": 3,
    "bathrooms": 2,
    "year_built": 1997,
    "lot_size": 6800,
    "distance_to_city_center": 4.1,
    "school_rating": 7.6,
}
