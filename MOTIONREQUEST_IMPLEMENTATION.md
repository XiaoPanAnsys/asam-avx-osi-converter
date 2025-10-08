# MotionRequest Visualization Implementation

## Summary

This document describes the implementation for visualizing OSI MotionRequest messages, specifically the `DesiredTrajectory` field, in Lichtblick's 3D panel.

## Changes Made

### 1. Type Imports (src/index.ts, lines 39-40)
Added imports for OSI MotionRequest types:
```typescript
import {
  // ... existing imports
  MotionRequest,
  StatePoint,
} from "@lichtblick/asam-osi-types";
```

### 2. Trajectory Visualization Function (src/index.ts, lines 778-876)
Created `buildMotionRequestSceneEntities()` function that:
- Converts `StatePoint` trajectory points to 3D `Point3` coordinates
- Creates a **cyan line strip** connecting all trajectory points
- Adds **cyan spheres** (0.15m radius) at each trajectory point for visibility
- Visualizes trajectory in the `ego_vehicle_bb_center` frame (relative to ego vehicle)

### 3. Converter Function (src/index.ts, lines 1175-1194)
Implemented `convertMotionRequestToSceneUpdate()` to:
- Convert OSI MotionRequest messages to Foxglove SceneUpdate format
- Handle errors gracefully with console logging
- Return scene entities for 3D rendering

### 4. Message Converter Registration (src/index.ts, lines 1348-1352)
Registered the converter with Lichtblick:
```typescript
extensionContext.registerMessageConverter({
  fromSchemaName: "osi3.MotionRequest",
  toSchemaName: "foxglove.SceneUpdate",
  converter: convertMotionRequestToSceneUpdate,
});
```

## Visualization Details

### What Gets Visualized
- **Trajectory Line**: Cyan colored line (80% opacity, 0.1m thickness) connecting trajectory points
- **Trajectory Points**: Cyan colored circular markers (100% opacity, adjustable size) at each waypoint
- **Reference Frame**: `<root>` (global frame, same as all OSI GroundTruth objects)

### Data Source
- Field: `MotionRequest.desired_trajectory.trajectory_point`
- Type: `repeated StatePoint`
- Position data: `StatePoint.position.{x, y, z}`

## Usage

1. **Load an MCAP file** containing `osi3.MotionRequest` messages in Lichtblick
2. **Open the 3D panel**
3. **Enable the MotionRequest topic** in the 3D panel settings
4. The desired trajectory will appear as:
   - A **cyan line** showing the planned path
   - **Cyan spheres** marking each waypoint
   - Rendered relative to the ego vehicle position

## Technical Notes

- The visualization uses `LINE_STRIP` primitive for efficient rendering
- Trajectory is in global frame (ROOT_FRAME), same coordinate system as all OSI GroundTruth objects
- Empty or missing trajectory_point arrays are handled gracefully (no visualization)
- Frame reference is consistent with other OSI visualizations in the extension

## Example Data Structure

```protobuf
message MotionRequest {
  optional Timestamp timestamp = 1;
  optional DesiredTrajectory desired_trajectory = 2;

  message DesiredTrajectory {
    repeated StatePoint trajectory_point = 1;
  }
}

message StatePoint {
  optional Timestamp timestamp = 1;
  optional Vector3d position = 2;
  optional Orientation3d orientation = 3;
  optional Vector3d velocity = 4;
  optional Vector3d acceleration = 5;
}
```

## Future Enhancements

Potential improvements for future versions:
- Add velocity vectors at each trajectory point
- Visualize orientation (heading arrows)
- Display acceleration information
- Add metadata panel showing timestamp, velocity, acceleration at each point
- Support for multiple trajectory alternatives
- Configurable colors and sizes via panel settings
- Visualize confidence intervals if available

## References

- OSI MotionRequest Protobuf: https://github.com/OpenSimulationInterface/open-simulation-interface/blob/v3.7.0/osi_motionrequest.proto
- OSI StatePoint Definition: https://github.com/OpenSimulationInterface/open-simulation-interface/blob/42c2c2e227d285db06645f6727dfc914f5c3845f/osi_common.proto#L715
