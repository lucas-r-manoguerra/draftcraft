# Piece Physics Specification

## Purpose

Defines physics behavior for building pieces: dynamic bodies with auto-sleep, query helpers used by placement, and collision grouping.

## Requirements

### Requirement: Dynamic Piece Bodies

Placed pieces MUST be created as dynamic rigid bodies with auto-sleep enabled, so resting pieces stop simulating. The system MUST keep applyImpulsesToDynamicBodies disabled in this milestone: the player cannot push pieces.

#### Scenario: Piece rests and sleeps

- GIVEN a placed piece at rest on the ground
- WHEN the physics world steps with a fixed timestep
- THEN the body enters sleep and its velocity becomes zero

#### Scenario: Pushing is disabled

- GIVEN the player capsule contacts a placed piece
- WHEN the player moves against it
- THEN the piece receives no impulse from the player
- AND applyImpulsesToDynamicBodies remains false

### Requirement: Collision Groups

The physics world MUST assign the player to group 1 and pieces to group 2. Pieces MUST collide with each other and with the ground. Ray queries MUST exclude the player group.

#### Scenario: Pieces stack and collide

- GIVEN two pieces resting on the ground
- WHEN a third piece is placed on top
- THEN the upper piece rests on the lower one without interpenetration

#### Scenario: Ray excludes player

- GIVEN a ray cast through the player capsule toward a piece behind it
- WHEN the raycast helper is invoked
- THEN the reported hit is the piece, not the player capsule

### Requirement: Raycast Helper

The physics layer MUST provide a raycast helper using castRayAndGetNormal that returns the hit point and face normal of the first collider intersecting the ray, up to a caller-supplied maximum distance. It MUST report no hit when the ray reaches that distance without contact.

#### Scenario: Raycast hits a piece face

- GIVEN a ray directed at a placed piece within 5 m
- WHEN the helper runs
- THEN a hit with point and face normal is returned

#### Scenario: Raycast beyond range

- GIVEN a ray with no collider before its maximum distance
- WHEN the helper runs
- THEN no hit is reported

### Requirement: Overlap Query Helper

The physics layer MUST provide an overlap query using castShape with stopAtPenetration enabled that reports whether a candidate shape pose overlaps any piece collider, enabling placement to reject overlapping poses.

#### Scenario: Overlap detected

- GIVEN a candidate pose intersecting an existing piece
- WHEN the overlap query runs
- THEN it reports an overlap

#### Scenario: Clear pose

- GIVEN a candidate pose with no intersecting piece
- WHEN the overlap query runs
- THEN it reports no overlap
