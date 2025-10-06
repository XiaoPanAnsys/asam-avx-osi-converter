# Trajectory Orientation Visualization Feature

## Overview

Each trajectory waypoint now displays an **orientation arrow** showing the heading direction (yaw) from the `StatePoint.orientation` data.

## Visual Representation

```
Previous (spheres only):
    ○───○───○───○───○

New (spheres + orientation arrows):
    ○→──○→──○↗──○→──○→
    (cyan spheres with yellow arrows showing direction)
```

## Implementation Details

### **What Gets Visualized**

For each trajectory point, you now see:

1. **Cyan sphere** - Position marker (adjustable size)
2. **Yellow arrow** - Heading direction from `StatePoint.orientation.yaw`

### **Arrow Specifications**

```typescript
ARROW_SCALE = 1.5
Shaft Length: 0.3m × 1.5 = 0.45m
Shaft Diameter: 0.03m × 1.5 = 0.045m
Head Length: 0.1m × 1.5 = 0.15m
Head Diameter: 0.08m × 1.5 = 0.12m
```

**Arrow Color:** Yellow (RGB: 255, 255, 0) with 90% opacity

**Position:** Slightly elevated (0.1m above the trajectory point) for better visibility

### **Orientation Source**

The arrow orientation is extracted from `StatePoint.orientation`:

```typescript
StatePoint {
  position: { x, y, z }        // Used for arrow position
  orientation: {               // Used for arrow direction
    roll: number              // Usually 0 for ground vehicles
    pitch: number             // Usually 0 for ground vehicles
    yaw: number               // Main heading direction! ⭐
  }
  velocity: { x, y, z }
  acceleration: { x, y, z }
}
```

The **yaw angle** determines which direction the arrow points:
- **Yaw = 0°** → Arrow points in +X direction (forward)
- **Yaw = 90°** → Arrow points in +Y direction (left)
- **Yaw = 180°** → Arrow points in -X direction (backward)
- **Yaw = 270°** → Arrow points in -Y direction (right)

### **Fallback Behavior**

If `StatePoint.orientation` is missing or undefined:
```typescript
orientation: {
  roll: 0,   // Defaults to 0
  pitch: 0,  // Defaults to 0
  yaw: 0,    // Defaults to 0 (points in +X direction)
}
```

## Use Cases

### **1. Trajectory Planning Validation**

Verify that the planned trajectory has sensible heading directions:
- Arrows should point along the path direction
- Sharp turns should show changing arrow angles
- Reverse maneuvers show backward-pointing arrows

### **2. Lane Changes**

Visualize the vehicle's intended orientation during lane changes:
```
Lane 1: ○→──○→──○↗──○↗──○→
                  ↖ Lane change region
Lane 2:                 ○→──○→
```

### **3. Parking Maneuvers**

See the complex orientation changes during parking:
```
    ○→──○↗──○↑──○↖──○←
   (Forward, angle right, turn, angle left, reverse)
```

### **4. Debugging Motion Planning**

Identify issues:
- ❌ **Discontinuous orientations** - Sudden jumps in arrow direction
- ❌ **Backwards motion** - Arrows pointing away from travel direction
- ❌ **Zero orientation** - All arrows pointing in same direction (missing data)

## Visual Examples

### **Straight Path**
```
○→──○→──○→──○→──○→
(All arrows aligned, constant heading)
```

### **Curve to the Left**
```
○→──○↗──○↑──○↖──○←
(Arrows gradually rotate counterclockwise)
```

### **U-Turn**
```
     ○↖──○↑──○↗
    /          \
   ○←          ○→
    \          /
     ○↙──○↓──○↘
```

### **Parallel Parking**
```
Stage 1: ○→──○→──○↘ (Drive forward, turn right)
Stage 2:         ○↓ (Reverse into spot)
Stage 3:         ○↙ (Straighten out)
```

## Customization

### **Arrow Size**

Edit the `ARROW_SCALE` constant (line 848):

```typescript
const ARROW_SCALE = 1.5;  // Default

// Larger arrows (2x size)
const ARROW_SCALE = 3.0;

// Smaller arrows (half size)
const ARROW_SCALE = 0.75;
```

### **Arrow Color**

Change the color (line 908):

```typescript
ColorCode("yellow", 0.9),  // Default: yellow, 90% opacity

// Alternative colors:
ColorCode("red", 1.0),     // Red arrows
ColorCode("green", 0.8),   // Green arrows
ColorCode("white", 1.0),   // White arrows
ColorCode("orange", 0.9),  // Orange arrows
```

### **Arrow Height Offset**

Adjust vertical position (line 867):

```typescript
z: point.position.z + 0.1,  // Default: 10cm above point

// Ground level
z: point.position.z,

// Higher for better visibility
z: point.position.z + 0.3,
```

## Technical Implementation

### **Code Structure**

```typescript
function createTrajectoryOrientationArrows(
  trajectoryPoints: DeepRequired<StatePoint>[],
  color: Color,
) {
  return trajectoryPoints.map((point) => {
    // Convert Euler angles to quaternion
    const orientation = eulerToQuaternion(
      point.orientation?.roll ?? 0,
      point.orientation?.pitch ?? 0,
      point.orientation?.yaw ?? 0,    // ⭐ Main heading
    );

    return {
      pose: {
        position: {
          x: point.position.x,
          y: point.position.y,
          z: point.position.z + 0.1,  // Slightly elevated
        },
        orientation,                   // Arrow points in yaw direction
      },
      shaft_length: 0.45,
      shaft_diameter: 0.045,
      head_length: 0.15,
      head_diameter: 0.12,
      color,
    };
  });
}
```

### **Integration**

The arrows are added to the scene entity along with the trajectory line and point markers:

```typescript
sceneEntities.push({
  timestamp: time,
  frame_id: ROOT_FRAME,
  id: "motion_request_desired_trajectory",
  lifetime: { sec: 0, nsec: 100_000_000 },
  frame_locked: true,
  lines: [trajectoryLine],           // Cyan path line
  cubes: trajectoryMarkers,          // Cyan spheres
  arrows: trajectoryOrientationArrows, // Yellow orientation arrows ⭐
});
```

## Benefits

✅ **Visual heading feedback** - See intended vehicle orientation at each waypoint
✅ **Intuitive direction** - Arrows point where the vehicle should be facing
✅ **Planning verification** - Quickly spot orientation issues
✅ **Debugging aid** - Identify discontinuities and errors
✅ **Documentation** - Better visualization for presentations and reports

## Comparison: Before vs After

### **Before (Position Only)**
```
Visualization: ○───○───○───○
Information:   Position only
Issues:        Cannot see heading direction
```

### **After (Position + Orientation)**
```
Visualization: ○→──○→──○↗──○→
Information:   Position + heading
Benefits:      Complete trajectory understanding
```

## Performance Notes

- **Arrow count** = Number of trajectory points
- **Typical scenario**: 20-50 arrows per trajectory
- **Performance impact**: Minimal (arrows are lightweight primitives)
- **Rendering**: Hardware-accelerated by Lichtblick's 3D engine

## Future Enhancements

Potential improvements:

- 🎯 **Velocity arrows** - Show speed with arrow length/color
- 🎯 **Acceleration indicators** - Visual cues for accel/decel zones
- 🎯 **Configurable arrow size** - Panel setting for arrow scale
- 🎯 **Color gradient** - Arrows colored by speed/curvature
- 🎯 **Toggle arrows on/off** - Optional display via panel settings

## Summary

🎉 **New Feature: Orientation Visualization**

- **Yellow arrows** show heading direction at each trajectory point
- Uses `StatePoint.orientation.yaw` from OSI data
- Automatically included with every MotionRequest trajectory
- Provides complete 6-DOF visualization (position + orientation)
- Makes trajectory planning easier to understand and debug

---

**Your trajectories now show WHERE to go AND which way to face!** 🎯🚗
