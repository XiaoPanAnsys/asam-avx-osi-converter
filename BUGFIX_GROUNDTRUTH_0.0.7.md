# Bug Fix: GroundTruth Not Visible in 3D Panel (v0.0.7)

## Issue Summary

After upgrading from version **0.0.6** to **0.0.7**, `osi3.GroundTruth` messages were not displaying in the 3D panel.

## Root Cause

In version 0.0.7, panel settings with configuration options were added (PR #100: "add options for cache and object axes"). However, the `panelSettings` were only added to the `osi3.SensorView` converter, **not** to the `osi3.GroundTruth` converter.

### The Bug

**File:** `src/index.ts` (lines 1249-1253)

The `osi3.GroundTruth` converter registration was missing `panelSettings`:

```typescript
extensionContext.registerMessageConverter({
  fromSchemaName: "osi3.GroundTruth",
  toSchemaName: "foxglove.SceneUpdate",
  converter: convertGroundTruthToSceneUpdate,
  // ❌ Missing panelSettings!
});
```

### Why Objects Weren't Visible

In `buildObjectEntity()` function (line 248), the cubes are conditionally rendered:

```typescript
cubes: config != null && config.showBoundingBox ? [cube, ...buildVehicleLights()] : [],
```

**Flow:**
1. User loads `osi3.GroundTruth` message
2. Converter called with `config = undefined` (no panelSettings)
3. Condition `config != null && config.showBoundingBox` evaluates to `false`
4. `cubes: []` → **No objects rendered!**

Meanwhile, `osi3.SensorView` had panelSettings with `defaultConfig: { showBoundingBox: true }`, so it worked fine.

## The Fix

Added the same `panelSettings` configuration to the `osi3.GroundTruth` converter registration (lines 1249-1333):

```typescript
extensionContext.registerMessageConverter({
  fromSchemaName: "osi3.GroundTruth",
  toSchemaName: "foxglove.SceneUpdate",
  converter: convertGroundTruthToSceneUpdate,
  panelSettings: {  // ✅ Added panel settings
    "3D": generatePanelSettings({
      settings: (config) => ({ ... }),
      handler: (action, config) => { ... },
      defaultConfig: {
        caching: true,
        showAxes: true,
        showPhysicalLanes: true,
        showLogicalLanes: false,
        showBoundingBox: true,      // ✅ Enables object visibility
        show3dModels: false,
        defaultModelPath: "/opt/models/vehicles/",
      },
    }),
  },
});
```

## What This Fixes

✅ **GroundTruth messages now visible** in 3D panel
✅ **Bounding boxes** render correctly
✅ **Configuration options** available in panel settings for GroundTruth
✅ **Consistent behavior** between GroundTruth and SensorView

## Configuration Options Added

Users can now configure these settings for `osi3.GroundTruth` topics in the 3D panel:

- **Caching** - Enable/disable lane caching
- **Show axes** - Display object coordinate axes
- **Show Physical Lanes** - Display physical lane boundaries and lanes
- **Show Logical Lanes** - Display logical lane boundaries and lanes
- **Show Bounding Box** - Display object bounding boxes *(crucial for visibility!)*
- **Show 3D Models** - Display 3D models instead of bounding boxes
- **Default 3D Model Path** - Path to 3D model files

## Testing

After this fix:

1. ✅ Load MCAP with `osi3.GroundTruth` messages
2. ✅ Open 3D panel
3. ✅ Enable GroundTruth topic
4. ✅ Objects visible with bounding boxes
5. ✅ Configuration panel available with all options
6. ✅ Settings persist and work correctly

## Impact

- **Severity:** High - Complete loss of visualization for GroundTruth messages
- **Affected Versions:** 0.0.7 only
- **Fixed In:** 0.0.8-avx-alpha.1
- **Breaking Change:** No
- **Migration Required:** No - just update to fixed version

## Related Changes

This fix is included alongside the **MotionRequest visualization feature** in version `0.0.8-avx-alpha.1`.

## Prevention

To prevent similar issues in the future:

1. ✅ Ensure all message converters that share the same conversion function also share the same panelSettings
2. ✅ Test both direct message types (GroundTruth) and wrapper types (SensorView)
3. ✅ Add integration tests that verify object visibility with default configs
4. ✅ Document config dependencies in converter functions

## Version History

- **0.0.6** - Working (no panel settings)
- **0.0.7** - Broken (panel settings added only to SensorView)
- **0.0.8-avx-alpha.1** - Fixed (panel settings added to both)

---

**Issue Closed:** GroundTruth messages now render correctly in the 3D panel! 🎉
