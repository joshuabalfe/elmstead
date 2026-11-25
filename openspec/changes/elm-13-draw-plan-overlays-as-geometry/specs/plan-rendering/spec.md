# Spec Delta

## ADDED Requirements

### Requirement: Overlay drawings as primitives
The floor, wall-top and annotation overlays SHALL each be available as drawing primitives with the
plan area they cover. A primitive is a filled or stroked polygon, a polyline, a line or a text,
carrying its colours, stroke width and dash pattern explicitly, in drawing order. Each overlay's SVG
SHALL be serialised from those primitives, so the SVG and the primitives always agree.

#### Scenario: SVG and primitives agree
- **WHEN** an overlay is rendered for a storey
- **THEN** serialising its primitives gives exactly its SVG

#### Scenario: Explicit styling
- **WHEN** the annotation overlay is rendered
- **THEN** each dimension line carries its stroke colour and width, and each figure its halo, on the
  primitive itself rather than from a stylesheet, and the SVG renders as it did before

#### Scenario: Plan sheet unchanged
- **WHEN** `renderPlan` runs on a model after this change
- **THEN** its SVG is byte for byte what it was before, and the plan snapshot test passes unchanged
