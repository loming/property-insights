"""Canonical feature metadata.

One list drives request validation, training, warnings and the portal's form, so adding a
feature means adding one entry here (plus a retrain).
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
TARGET = "price"

# Test-CSV row 1: the Swagger example. Training rows make poor examples (doc 02, B10).
EXAMPLE_HOUSE = {
    "square_footage": 1550,
    "bedrooms": 3,
    "bathrooms": 2,
    "year_built": 1997,
    "lot_size": 6800,
    "distance_to_city_center": 4.1,
    "school_rating": 7.6,
}

# The 10 rows of the provided test file, in order: the batch example.
EXAMPLE_BATCH = [
    dict(zip(FEATURE_NAMES, row, strict=True))
    for row in [
        (1550, 3, 2, 1997, 6800, 4.1, 7.6),
        (2200, 4, 2.5, 2008, 9600, 7.0, 8.8),
        (1180, 2, 1, 1982, 5100, 2.5, 6.7),
        (1870, 3, 2.5, 2001, 7900, 5.5, 8.3),
        (1430, 3, 1.5, 1990, 6200, 3.3, 7.2),
        (2300, 4, 3, 2013, 10300, 8.0, 9.2),
        (1650, 3, 2, 1999, 7100, 4.2, 7.8),
        (1020, 2, 1, 1979, 4400, 2.0, 6.5),
        (2100, 4, 2.5, 2005, 9200, 6.8, 8.6),
        (1350, 3, 1, 1988, 5700, 3.1, 7.0),
    ]
]
