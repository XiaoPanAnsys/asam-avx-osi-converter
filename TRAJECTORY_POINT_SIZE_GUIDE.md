# Trajectory Point Size Configuration Guide

## Overview

The size of trajectory waypoint markers (spheres) is now **fully adjustable** through the 3D panel settings in Lichtblick.

## How to Adjust Point Size

### **Method 1: Using the 3D Panel UI** ⭐ (Recommended)

1. Open your MCAP file with `osi3.MotionRequest` messages in Lichtblick
2. Open or add the **3D panel**
3. Click the **gear icon** (⚙️) in the top-right corner
4. Find your **MotionRequest topic** in the topic list
5. Look for the setting:
   ```
   Trajectory Point Size (meters)
   [0.15] ◄─────────────────►
   ```
6. **Adjust the slider** or enter a value directly

### **Settings Range**

- **Minimum:** 0.05 meters (5 cm) - Very small dots
- **Maximum:** 2.0 meters (2 m) - Very large spheres
- **Step:** 0.05 meters - Fine-grained control
- **Default:** 0.15 meters (15 cm) - Good visibility

### **Recommended Sizes by Use Case**

| Use Case | Size (m) | Description |
|----------|----------|-------------|
| **Close-up view** | 0.05 - 0.10 | Small, precise markers |
| **Normal view** | 0.15 - 0.25 | Default, good balance ⭐ |
| **Far view** | 0.30 - 0.50 | Large, easy to spot |
| **Presentation** | 0.40 - 0.80 | Very visible |
| **Debug/emphasis** | 1.0 - 2.0 | Huge markers |

### **Visual Examples**

```
Size 0.05m:  •───•───•───•    (Subtle, precise)
Size 0.15m:  ●───●───●───●    (Default, balanced)
Size 0.30m:  ⬤───⬤───⬤───⬤    (Large, visible)
Size 0.50m:  ⬤───⬤───⬤───⬤    (Very large)
```

## Method 2: Quick Size Presets

If you want to quickly switch between sizes, here are some good presets:

| Preset | Value | When to Use |
|--------|-------|-------------|
| **Tiny** | 0.05 | Dense trajectories, many points |
| **Small** | 0.10 | Clean, minimal visualization |
| **Normal** | 0.15 | Default, general purpose |
| **Medium** | 0.25 | Good for presentations |
| **Large** | 0.40 | Far camera distance |
| **Huge** | 0.80 | Emphasis or debugging |

## Implementation Details

### Code Changes

The trajectory point size is now:

1. **Configurable** via panel settings
2. **Stored** in topic configuration
3. **Applied** dynamically to all trajectory markers

### Configuration Type

```typescript
type Config = {
  // ... other settings
  trajectoryPointSize: number; // Size in meters (0.05 - 2.0)
};
```

### Default Configuration

```typescript
defaultConfig: {
  // ... other defaults
  trajectoryPointSize: 0.15, // 15cm spheres
}
```

## Tips & Tricks

### **1. Adjust Based on Trajectory Density**

- **Dense trajectories** (many points close together): Use smaller sizes (0.05-0.10m)
- **Sparse trajectories** (points far apart): Use larger sizes (0.25-0.40m)

### **2. Camera Distance Matters**

- **Close camera**: 0.10-0.20m
- **Medium distance**: 0.15-0.30m
- **Far camera**: 0.30-0.60m

### **3. Match Your Scene Scale**

If your scene is:
- **Urban (small)**: 0.10-0.20m
- **Highway (medium)**: 0.20-0.40m
- **Large test track**: 0.40-0.80m

### **4. Layered Visualization**

If you're showing multiple trajectories (e.g., different planning layers):
- Use **different sizes** to distinguish them
- Current implementation uses one size for all points

### **5. Performance Considerations**

- Larger sizes = More pixels to render
- If experiencing performance issues with many points, use smaller sizes
- Size doesn't affect number of primitives, just visual complexity

## Troubleshooting

### Points too small to see?
```
✅ Increase size to 0.3-0.5 meters
✅ Check that cyan color (0, 255, 255) contrasts with background
✅ Verify points aren't occluded by other objects
```

### Points too large and cluttered?
```
✅ Decrease size to 0.05-0.10 meters
✅ Consider hiding bounding boxes if they overlap
✅ Adjust camera angle/distance
```

### Setting not appearing?
```
✅ Make sure you're configuring the MotionRequest topic (not GroundTruth)
✅ Rebuild the extension with the latest code
✅ Refresh Lichtblick (Ctrl+R) after installing
```

### Change not taking effect?
```
✅ Click outside the input field to apply
✅ Scrub timeline to force re-render
✅ Check browser console (F12) for errors
```

## Advanced: Programmatic Control

If you want to set the size programmatically (e.g., in test scripts), you can modify the defaultConfig in `src/index.ts`:

```typescript
// Line ~1470
defaultConfig: {
  trajectoryPointSize: 0.30, // Change this value
}
```

Or create a custom build with different defaults for different use cases.

## Future Enhancements

Potential improvements for future versions:

- 🎯 **Per-point size variation** based on velocity/importance
- 🎯 **Color gradient** based on time/distance
- 🎯 **Auto-scaling** based on camera distance
- 🎯 **Different shapes** (spheres, cubes, arrows)
- 🎯 **Outline/glow effects** for better visibility

## Summary

✅ **Fully adjustable** point size (0.05 - 2.0 meters)
✅ **Real-time updates** via 3D panel settings
✅ **Intuitive slider** with min/max/step constraints
✅ **Default 0.15m** works well for most cases
✅ **No rebuild needed** - adjust on the fly!

---

**Happy trajectory visualization!** 🎯✨
