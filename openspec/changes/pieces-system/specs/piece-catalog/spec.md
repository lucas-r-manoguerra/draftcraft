# Piece Catalog Specification

## Purpose

Defines the four building pieces with real-world metric dimensions and the player-facing selection flow that feeds placement.

## Requirements

### Requirement: Catalog Definition

The catalog MUST define exactly four pieces with integer millimeter dimensions: brick 240×115×52, block 400×200×200, beam 2400×100×100, plank 2400×200×25. The catalog MUST NOT define any other piece in this milestone.

#### Scenario: Catalog contains all four pieces

- GIVEN the piece catalog
- WHEN its entries are enumerated
- THEN exactly 4 pieces are returned
- AND each has the specified integer-mm dimensions

#### Scenario: No extra pieces

- GIVEN the piece catalog
- WHEN queried for all pieces
- THEN no piece outside the four defined ones exists

### Requirement: Metric Dimension Invariant

Every dimension MUST be stored in integer millimeters, and meter values MUST be derived as millimeters ÷ 1000. Meter values MUST NOT be expressed as literal floating-point constants, so 115 mm yields exactly 0.115 m without float drift.

#### Scenario: Exact meter derivation

- GIVEN brick dimensions 240/115/52 mm
- WHEN converted to meters
- THEN the values are exactly 0.24, 0.115, and 0.052 m
- AND no floating-point literal approximates 0.115 in the definition

#### Scenario: Non-centimeter dimension stays exact

- GIVEN the 115 mm brick height (not an integer number of centimeters)
- WHEN meters are derived
- THEN the value is exactly 115/1000 with no rounding error

### Requirement: Piece Selection

The player MUST be able to select one piece from the catalog, and placement MUST use the selected piece's dimensions. Selection MUST be edge-triggered: one press advances, holding MUST NOT repeat.

#### Scenario: Select a piece for placement

- GIVEN the catalog with four pieces
- WHEN the player selects the block
- THEN subsequent placement uses block dimensions 400×200×200 mm

#### Scenario: Single-step selection

- GIVEN the player holds the selection input
- WHEN several frames pass while held
- THEN the selection advances exactly once
