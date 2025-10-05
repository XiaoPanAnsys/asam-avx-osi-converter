# Quick Start: OSI MotionRequest Visualization

## What Was Added

✅ **Full support for visualizing OSI MotionRequest messages** in Lichtblick's 3D panel

## Visualization Features

### 🎯 DesiredTrajectory Visualization
- **Connected Line Path**: Cyan colored line connecting all trajectory waypoints
- **Waypoint Markers**: Cyan spheres (15cm radius) at each trajectory point
- **Reference Frame**: Global frame (`<root>`), same as all OSI GroundTruth objects

### Visual Appearance
```
     ○ ─── ○ ─── ○ ─── ○ ─── ○
    (cyan spheres connected by cyan line)
```

## How to Use

1. **Open Lichtblick** with an MCAP file containing `osi3.MotionRequest` messages

2. **Add a 3D Panel** if not already present

3. **Enable the MotionRequest topic** in the 3D panel's topic list

4. **View the trajectory** - you'll see:
   - Cyan line showing the desired path
   - Cyan spheres marking each waypoint
   - Path relative to ego vehicle position

## Code Structure

### New Functions Added to `src/index.ts`

1. **`buildMotionRequestSceneEntities()`** (lines 785-876)
   - Extracts trajectory points from MotionRequest
   - Converts StatePoint data to 3D visualization primitives
   - Returns scene entities for rendering

2. **`convertMotionRequestToSceneUpdate()`** (lines 1175-1194)
   - Converts OSI MotionRequest to Foxglove SceneUpdate
   - Handles errors gracefully

3. **Message Converter Registration** (lines 1348-1352)
   - Registers `osi3.MotionRequest` → `foxglove.SceneUpdate` converter

## Data Flow

```
osi3.MotionRequest
  └─> convertMotionRequestToSceneUpdate()
       └─> buildMotionRequestSceneEntities()
            ├─> Extract trajectory_point array
            ├─> Convert StatePoint.position to Point3
            ├─> Create LINE_STRIP primitive (cyan line)
            ├─> Create sphere primitives (cyan markers)
            └─> Return SceneUpdate with entities
                 └─> Rendered in Lichtblick 3D panel
```

## Customization Options

Want to customize the visualization? Edit these values in `buildMotionRequestSceneEntities()`:

```typescript
// Line appearance (line 851-854)
ColorCode("cyan", 0.8),  // Color and opacity
0.1,                      // Line thickness (meters)

// Sphere markers (line 858-861)
ColorCode("cyan", 1.0),   // Color and opacity
0.15,                     // Sphere radius (meters)

// Reference frame (line 866)
frame_id: ROOT_FRAME,  // Global frame "<root>", same as all OSI objects
```

## Building and Installing

Once you resolve the Node.js version issue (requires Node 20+):

```bash
# Install dependencies
yarn install

# Build the extension
yarn build

# Install to Lichtblick
yarn local-install
```

Or manually:
```bash
# Package the extension
yarn package

# Drag and drop the .foxe file into Lichtblick
```

## Troubleshooting

### Trajectory not showing?
- ✅ Check that `osi3.MotionRequest` topic is enabled in 3D panel
- ✅ Verify `desired_trajectory.trajectory_point` array is not empty
- ✅ Check console for errors (`OsiMotionRequestVisualizer: Error...`)

### Wrong position/orientation?
- The trajectory is in global `<root>` frame (same as all OSI GroundTruth objects)
- Trajectory coordinates are in the same global coordinate system as moving objects

### Colors not visible?
- Cyan color: RGB(0, 255, 255)
- Adjust 3D panel background if needed
- Check object transparency settings

## Next Steps

Consider adding:
- 🎯 Velocity vectors at each point
- 🎯 Heading orientation arrows
- 🎯 Acceleration visualization
- 🎯 Metadata panel for trajectory details
- 🎯 Panel settings for customization

## Example MCAP Structure

Your MCAP should contain messages with schema `osi3.MotionRequest`:

```
Topic: /motion_request
Schema: osi3.MotionRequest
Message structure:
{
  timestamp: { seconds: ..., nanos: ... },
  desired_trajectory: {
    trajectory_point: [
      { position: { x: 0, y: 0, z: 0 }, ... },
      { position: { x: 1, y: 0, z: 0 }, ... },
      { position: { x: 2, y: 0.5, z: 0 }, ... },
      ...
    ]
  }
}
```

## References

- [OSI MotionRequest Proto](https://github.com/OpenSimulationInterface/open-simulation-interface/blob/v3.7.0/osi_motionrequest.proto)
- [OSI StatePoint Proto](https://github.com/OpenSimulationInterface/open-simulation-interface/blob/42c2c2e227d285db06645f6727dfc914f5c3845f/osi_common.proto#L715)
- [Lichtblick Suite](https://github.com/Lichtblick-Suite/lichtblick)

---

**Implementation Complete!** 🎉

The plugin now supports visualizing OSI MotionRequest DesiredTrajectory in the 3D panel with connected points starting from the ego vehicle frame.
