# GitHub Issue: SensorData Frame Transform Error

Copy and paste this into a new GitHub issue at:
https://github.com/Lichtblick-Suite/asam-osi-converter/issues/new

---

## Title
```
fix: SensorData frame transform error - missing ego_vehicle_rear_axis
```

## Labels
- `bug`
- `visualization`

## Description

### **Bug Report**

When visualizing `osi3.SensorData` messages in the 3D panel, Lichtblick displays the following error:

```
Missing transform from frame <ego_vehicle_rear_axis> to frame <<root>>
```

This prevents SensorData lane boundaries from being visualized correctly.

---

## Steps to Reproduce

1. Open an MCAP file containing `osi3.SensorData` messages in Lichtblick
2. Add a 3D panel to the layout
3. Enable the `osi3.SensorData` topic in the 3D panel
4. Observe the frame transform error in the console

**Expected behavior:** SensorData lane boundaries should be visualized in green

**Actual behavior:** Frame transform error is thrown and visualization fails

---

## Root Cause

The issue is in `src/index.ts` in the `buildSensorDataSceneEntities` function (line ~769):

```typescript
const road_output_scene_update: PartialSceneEntity = {
  timestamp: { sec: osiSensorData.timestamp.seconds, nsec: osiSensorData.timestamp.nanos },
  frame_id: "ego_vehicle_rear_axis",  // ❌ Problem here
  id: "ra_ground_truth",
  lifetime: { sec: 0, nsec: 0 },
  frame_locked: true,
  lines: makePrimitiveLines(osiSensorData.lane_boundary, 1.0),
  texts: [makeInfoText()],
};
```

**Two issues:**

1. **Typo in frame name:** Uses `"ego_vehicle_rear_axis"` instead of the correct `"ego_vehicle_rear_axle"`
2. **Missing frame transform data:** `osi3.SensorData` messages don't contain GroundTruth information needed to generate ego vehicle frame transforms. The ego vehicle frames are only created when `osi3.GroundTruth` or `osi3.SensorView` (which contains `global_ground_truth`) messages are present.

---

## Proposed Solution

Change SensorData visualization to use the global `ROOT_FRAME` instead of the ego-relative frame:

```typescript
const road_output_scene_update: PartialSceneEntity = {
  timestamp: { sec: osiSensorData.timestamp.seconds, nsec: osiSensorData.timestamp.nanos },
  frame_id: ROOT_FRAME,  // ✅ Use global frame
  id: "sensor_data_lane_boundaries",  // Better naming
  lifetime: { sec: 0, nsec: 0 },
  frame_locked: true,
  lines: makePrimitiveLines(osiSensorData.lane_boundary, 1.0),
  texts: [makeInfoText()],
};
```

**Why this makes sense:**

- SensorData typically contains detections in global coordinates (same as GroundTruth objects)
- SensorData messages don't include ego vehicle information to create frame transforms
- Using `ROOT_FRAME` is consistent with how all other OSI GroundTruth objects are visualized
- Simpler and more robust - no dependency on simultaneous GroundTruth messages

---

## Files to Modify

- `src/index.ts` - Line ~767-776 in `buildSensorDataSceneEntities` function

---

## Testing

After fix:

1. ✅ Open MCAP with `osi3.SensorData` messages
2. ✅ Enable SensorData topic in 3D panel
3. ✅ Lane boundaries visualize in green without errors
4. ✅ Info text "SensorData not supported yet" displays correctly
5. ✅ No frame transform errors in console

---

## Additional Context

### Frame Transform Hierarchy

```
<root> (Global Frame)
  └─ ego_vehicle_bb_center (created from GroundTruth)
      └─ ego_vehicle_rear_axle (created from GroundTruth + vehicle_attributes)
```

**Note:** The ego vehicle frames are only generated when processing `osi3.GroundTruth` or `osi3.SensorView` messages that contain `global_ground_truth` data. SensorData alone cannot create these transforms.

### Related Code

Frame transform generation happens in:
- `buildEgoVehicleBBCenterFrameTransform()` - Line ~671
- `buildEgoVehicleRearAxleFrameTransform()` - Line ~695
- These require `GroundTruth.host_vehicle_id` and `GroundTruth.moving_object` data

---

## Environment

- **Extension version:** 0.0.7
- **Lichtblick version:** Latest
- **OS:** Linux/Windows/macOS
- **MCAP format:** OSI SensorData messages

---

## Priority

**Medium** - Affects SensorData visualization, but workaround exists (use SensorView instead)

---

## Checklist

- [ ] Issue reproduced
- [ ] Root cause identified
- [ ] Solution proposed and tested
- [ ] Ready for PR

---

**Would you like me to submit a PR with the fix?**
