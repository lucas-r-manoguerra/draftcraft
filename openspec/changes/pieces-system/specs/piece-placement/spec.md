# Piece Placement Specification

## Purpose

Defines the player-facing build loop: aim → ghost preview → face-snapped placement → rotate → remove.

## Requirements

### Requirement: Aim Targeting

Placement MUST target via a raycast from the center of the screen in the player's view direction, with an effective range of approximately 5 m. The ghost preview and final placement MUST use the raycast hit.

#### Scenario: Aim at ground

- GIVEN the player aims at the ground within 5 m
- WHEN the placement preview updates
- THEN the ghost appears at the hit point

#### Scenario: Aim beyond range

- GIVEN the player aims at a surface farther than 5 m
- WHEN the preview updates
- THEN no target is set and placement is unavailable

### Requirement: Face-Aligned Snap

Placement MUST snap to the hit face using the face normal and the piece extents, so faces sit flush. Rounding to whole centimeters MUST apply only to free placement (no face target) and MUST NOT apply to face-snapped placement, because the centimeter grid cannot represent 0.115 m.

#### Scenario: Brick snaps flush to a face

- GIVEN the player aims at the top face of a placed brick
- WHEN placing a new brick
- THEN the new brick rests flush on that face following the normal
- AND its position is not rounded to a centimeter grid

#### Scenario: Free placement rounds to centimeters

- GIVEN the player aims at the ground with no face target
- WHEN placing freely
- THEN the position is rounded to whole centimeters

### Requirement: Ghost Preview and Overlap Rejection

The system MUST render a ghost preview at the candidate pose. When the overlap query reports a collision with an existing piece, the ghost MUST render as invalid and placement MUST be blocked.

#### Scenario: Overlap blocks placement

- GIVEN the ghost overlaps an existing piece
- WHEN the player confirms placement
- THEN no piece is created
- AND the ghost renders invalid

#### Scenario: Valid placement succeeds

- GIVEN the ghost does not overlap any piece
- WHEN the player confirms placement
- THEN a piece is created at the ghost pose

### Requirement: Rotation

The player MUST be able to rotate the current piece 90° per press; four presses return to the original orientation. Rotation MUST be edge-triggered.

#### Scenario: Cycle four orientations

- GIVEN a selected piece
- WHEN the rotate input fires four times
- THEN the piece returns to its original orientation

#### Scenario: Held input does not repeat

- GIVEN the rotate input is held
- WHEN more than one frame passes
- THEN the piece rotates exactly once

### Requirement: Removal

The player MUST be able to remove a placed piece (right mouse button) targeted by the aim ray; removal MUST free both the collider and the mesh.

#### Scenario: Remove targeted piece

- GIVEN the player aims at a placed piece
- WHEN removal input fires
- THEN the piece disappears from the world
- AND its collider and mesh are released

#### Scenario: Removal with no target

- GIVEN the player aims at no piece
- WHEN removal input fires
- THEN nothing is removed
