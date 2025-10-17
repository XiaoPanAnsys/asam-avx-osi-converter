# MotionRequest Visualization Feature

**Added to:** main branch (v0.0.8)
**Date:** 2025-10-12

## Overview

Added visualization support for `osi3.MotionRequest` messages in the Lichtblick 3D panel, focusing on the `DesiredTrajectory` field.

## What's New

### Visual Elements

The plugin now visualizes MotionRequest trajectory as:
- **Cyan spherical markers** at each trajectory waypoint
- **Cyan connecting line** between waypoints (line strip)
- Rendered in **global frame** (same coordinate system as other OSI objects)
- Adjustable sphere size via panel settings

### Visual Appearance

```
     ●────●────●────●────●
   (cyan spheres connected by cyan line)
```

## Implementation Details

### Data Source
- **Schema:** `osi3.MotionRequest`
- **Field:** `desired_trajectory.trajectory_point` (array of `StatePoint`)
- **Coordinates:** Global frame (x, y, z from `StatePoint.position`)

### Scene Entity Properties
- **Frame ID:** `global` (OSI_GLOBAL_FRAME)
- **Entity ID:** `motion_request_desired_trajectory`
- **Lifetime:** 0.1 seconds (100ms) for smooth transitions
- **Color:** Cyan (RGB: 0, 255, 255, Alpha: 1.0)
- **Line thickness:** 0.1 meters
- **Default sphere size:** 0.15 meters diameter

## Panel Settings

### Trajectory Point Size

A new configurable setting in the 3D panel:

- **Label:** "Trajectory Point Size (meters)"
- **Type:** Number slider
- **Range:** 0.05m to 2.0m
- **Step:** 0.05m
- **Default:** 0.15m
- **Help text:** "Size of the spheres marking trajectory waypoints"

### How to Adjust

1. Open Lichtblick and load an `osi3.MotionRequest` topic
2. In the 3D panel, click the **settings gear icon** (top-right)
3. Find **"Trajectory Point Size (meters)"**
4. Adjust the slider or enter a value
5. Changes apply immediately

### Recommended Sizes

| Size | Use Case | Visual Effect |
|------|----------|---------------|
| 0.05m | High precision, detailed paths | • Small, subtle markers |
| 0.15m | **Default** - balanced visibility | ● Medium, clear markers |
| 0.30m | Long distances, overview | ⬤ Large, prominent markers |
| 0.50m | Presentations, demos | ⬤ Very large, highly visible |

## Technical Changes

### Modified Files

**`src/index.ts`**

1. **Imports Added:**
   - `SpherePrimitive` from `@foxglove/schemas`
   - `MotionRequest`, `StatePoint` from `@lichtblick/asam-osi-types`

2. **Config Type Extended:**
   ```typescript
   type Config = {
     // ... existing fields ...
     trajectoryPointSize: number;
   };
   ```

3. **New Functions:**
   - `buildMotionRequestSceneEntities()` - Creates scene entities from MotionRequest data
   - `convertMotionRequestToSceneUpdate()` - Converter function for Lichtblick

4. **Message Converter Registration:**
   ```typescript
   extensionContext.registerMessageConverter({
     fromSchemaName: "osi3.MotionRequest",
     toSchemaName: "foxglove.SceneUpdate",
     converter: convertMotionRequestToSceneUpdate,
     panelSettings: { /* ... */ }
   });
   ```

### Code Structure

```
buildMotionRequestSceneEntities()
├── statePointToPoint3() - Convert OSI StatePoint to Foxglove Point3
├── createTrajectoryLine() - Create line primitive connecting points
├── createTrajectoryPoints() - Create sphere primitives at each point
└── Returns array of PartialSceneEntity with lines and spheres
```

## Usage

### Prerequisites

- Lichtblick with ASAM OSI Converter extension v0.0.8+
- MCAP/bag file containing `osi3.MotionRequest` messages
- MotionRequest messages must have `desired_trajectory.trajectory_point` populated

### Steps

1. **Open data source** containing `osi3.MotionRequest` topics
2. **Add 3D panel** (or use existing one)
3. **Subscribe to topic:**
   - In 3D panel settings, add the MotionRequest topic
   - Topic will appear as `foxglove.SceneUpdate` (converted)
4. **View trajectory:**
   - Cyan spheres appear at each trajectory waypoint
   - Connecting line shows path continuity
5. **Adjust visualization:**
   - Use "Trajectory Point Size" slider in panel settings
   - Zoom/pan to view trajectory details

### Combined Visualization

MotionRequest trajectories work alongside other OSI messages:

```
GroundTruth (ego vehicle)  ──→ [Current position & state]
                             │
MotionRequest (trajectory) ──→ [Planned path ahead]
                             │
                             ●────●────●────●
```

## Coordinate Frame

### Global Frame (Root Frame)

MotionRequest trajectories use the **global coordinate frame** (`<root>`):

- **Why:** OSI MotionRequest positions are in global/world coordinates
- **Frame ID:** `global` (same as other OSI objects)
- **Parent:** `<root>` (Lichtblick's world frame)
- **Child frames:** None (trajectory is a world-space path)

### Frame Hierarchy

```
<root>
 ├── global (GroundTruth objects)
 │    ├── ego_vehicle_bb_center
 │    │    └── ego_vehicle_rear_axle
 │    ├── moving_objects
 │    ├── stationary_objects
 │    └── motion_request_trajectory  <-- NEW
 └── (other frames)
```

## Design Decisions

### Why Spheres?

- **Visibility:** Easily visible from all angles
- **Clarity:** Clear waypoint marking without directional bias
- **Performance:** Efficient rendering primitive
- **Simplicity:** No rotation/orientation needed

### Why Cyan Color?

- **Distinct:** Different from GroundTruth objects (typically gray/colored by type)
- **Visibility:** High contrast against typical road/environment colors
- **Convention:** Common color for planned paths in robotics/AV visualization

### Why Global Frame?

- **Data alignment:** OSI MotionRequest uses global coordinates
- **Consistency:** Matches GroundTruth object frame
- **Correctness:** Avoids incorrect ego-relative transformations

### Lifetime: 0.1 seconds

- **Smooth transitions:** New messages replace old without flashing
- **Performance:** Prevents accumulation of stale trajectories
- **Responsiveness:** Quick updates as new plans arrive

## Limitations

### Current Scope

- **Only DesiredTrajectory:** Other MotionRequest fields not visualized
- **No timestamps:** Individual point timestamps not shown
- **No velocity/acceleration:** Only position visualized
- **No confidence:** Uncertainty/probability not represented

### Not Implemented

- Orientation arrows at waypoints
- Velocity vectors
- Acceleration indicators
- Alternative trajectories
- Trajectory metadata (cost, feasibility, etc.)

## Future Enhancements

Potential improvements:

1. **Orientation visualization** - Arrows showing heading at each point
2. **Velocity encoding** - Color/size based on speed
3. **Multiple trajectories** - Visualize alternative paths
4. **Trajectory metadata** - Show costs, constraints, feasibility
5. **Temporal markers** - Timestamps along trajectory
6. **Interactive selection** - Click waypoint to see details

## Testing

### Verification Steps

1. ✅ Build succeeds without errors
2. ✅ Extension loads in Lichtblick
3. ✅ MotionRequest topics appear as SceneUpdate
4. ✅ Trajectory renders in 3D panel
5. ✅ Spheres visible and correctly positioned
6. ✅ Line connects all waypoints
7. ✅ Panel settings slider works
8. ✅ Size changes apply immediately
9. ✅ No frame transform errors

### Test Data Requirements

Minimum MotionRequest structure:
```protobuf
message MotionRequest {
  Timestamp timestamp = 1;
  DesiredTrajectory desired_trajectory = 2 {
    repeated StatePoint trajectory_point = 1 [
      { position { x: 10, y: 0, z: 0 } },
      { position { x: 20, y: 5, z: 0 } },
      { position { x: 30, y: 10, z: 0 } },
    ];
  };
}
```

## Compatibility

- **Lichtblick:** v1.0.0+
- **OSI Version:** 3.7.0+
- **Extension Version:** v0.0.8+
- **Node.js:** 18.0.0+ (as per package.json)

## Summary

✅ **Implemented:** MotionRequest visualization with spherical waypoint markers
✅ **Configurable:** Adjustable sphere size via panel settings
✅ **Integrated:** Works alongside existing GroundTruth/SensorView visualization
✅ **Performant:** Efficient rendering with proper lifetimes
✅ **Documented:** Comprehensive technical and user documentation

The feature is ready for testing and deployment in v0.0.8! 🎉
