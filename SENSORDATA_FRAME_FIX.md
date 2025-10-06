# SensorData Frame Transform Fix

## Issue

When visualizing `osi3.SensorData` topics in Lichtblick, the following error occurred:

```
Missing transform from frame <ego_vehicle_rear_axis> to frame <<root>>
```

## Root Cause

The `buildSensorDataSceneEntities` function was using `"ego_vehicle_rear_axis"` as the frame_id, but:

1. **Typo**: Should be `"ego_vehicle_rear_axle"` (not "axis")
2. **Missing FrameTransform**: SensorData messages don't contain GroundTruth data, so the ego vehicle frame transforms cannot be generated
3. **Architecture mismatch**: SensorData typically represents sensor detections in global coordinates, not ego-relative coordinates

## The Fix

Changed the frame_id from `"ego_vehicle_rear_axis"` to `ROOT_FRAME` (which is `"<root>"`):

### Before (Broken)
```typescript
const road_output_scene_update: PartialSceneEntity = {
  timestamp: { sec: osiSensorData.timestamp.seconds, nsec: osiSensorData.timestamp.nanos },
  frame_id: "ego_vehicle_rear_axis",  // ❌ Missing transform!
  id: "ra_ground_truth",
  // ...
};
```

### After (Fixed)
```typescript
const road_output_scene_update: PartialSceneEntity = {
  timestamp: { sec: osiSensorData.timestamp.seconds, nsec: osiSensorData.timestamp.nanos },
  frame_id: ROOT_FRAME,  // ✅ Global frame, no transform needed
  id: "sensor_data_lane_boundaries",
  // ...
};
```

## Why This Works

### **ROOT_FRAME is the Global Coordinate System**

- All OSI GroundTruth objects (moving_object, stationary_object, etc.) use `ROOT_FRAME`
- SensorData detections are typically in the same global coordinate system
- No frame transform required - objects are directly positioned in the world frame

### **SensorData vs SensorView**

| Message Type | Contains | Frame Strategy |
|-------------|----------|----------------|
| **SensorData** | Sensor detections only | Use `ROOT_FRAME` ✅ |
| **SensorView** | Includes `global_ground_truth` | Can create ego frame transforms |
| **GroundTruth** | Complete world state | Includes ego vehicle for transforms |

### **Coordinate Frame Hierarchy**

```
<root> (Global Frame)
  └─ ego_vehicle_bb_center (requires GroundTruth)
      └─ ego_vehicle_rear_axle (requires vehicle_attributes)
```

**SensorData** doesn't have the data to create the ego vehicle frames, so we use the root frame directly.

## Impact

✅ **SensorData now visualizes correctly** without frame transform errors
✅ **Consistent with OSI architecture** - sensor data in global coordinates
✅ **Simpler implementation** - no need for complex frame transforms
✅ **Better ID naming** - Changed from "ra_ground_truth" to "sensor_data_lane_boundaries"

## Testing

After this fix:

1. ✅ Open MCAP with `osi3.SensorData` messages
2. ✅ Add 3D panel
3. ✅ Enable SensorData topic
4. ✅ Lane boundaries visualize in green
5. ✅ No frame transform errors
6. ✅ "SensorData not supported yet" message displays correctly

## Alternative Approach (Not Used)

We could have kept the ego-relative frame by:
1. Requiring both SensorData AND GroundTruth topics
2. Matching timestamps to find corresponding ego vehicle pose
3. Creating frame transforms dynamically

**Why we didn't do this:**
- More complex
- Requires both message types simultaneously
- SensorData is often independent of GroundTruth
- Global frame is more standard for sensor detections

## Related Code

### Frame Transform Generation (GroundTruth only)

```typescript
// Line ~708
export function buildEgoVehicleRearAxleFrameTransform(
  osiGroundTruth: DeepRequired<GroundTruth>,
): FrameTransform {
  // Requires GroundTruth with host_vehicle_id and vehicle_attributes
  return {
    child_frame_id: "ego_vehicle_rear_axle",  // ✅ Correct spelling
    parent_frame_id: "ego_vehicle_bb_center",
    // ...
  };
}
```

### SensorData Visualization (Now uses ROOT_FRAME)

```typescript
// Line ~767
const road_output_scene_update: PartialSceneEntity = {
  frame_id: ROOT_FRAME,  // ✅ Fixed - uses global frame
  id: "sensor_data_lane_boundaries",
  lines: makePrimitiveLines(osiSensorData.lane_boundary, 1.0),
  // ...
};
```

## Frame Name Reference

| Frame Name | Usage |
|-----------|--------|
| `<root>` or `ROOT_FRAME` | Global world coordinates |
| `ego_vehicle_bb_center` | Ego vehicle bounding box center |
| `ego_vehicle_rear_axle` | Ego vehicle rear axle ✅ Correct |
| `ego_vehicle_rear_axis` | ❌ Typo - don't use |

## Summary

🎉 **Fixed!**

- SensorData now uses `ROOT_FRAME` (global coordinates)
- No more "Missing transform" errors
- Consistent with OSI data model
- Simpler and more robust implementation

---

**Version:** Fixed in 0.0.8-avx-alpha.1
