# OSI SensorData Visualization - Current Limitations

**Extension Version:** v0.0.8
**Last Updated:** 2025-10-12

## Current Implementation Status

### ✅ What IS Visualized

**Only 1 field out of many:**
- **`lane_boundary`** (type: `DetectedLaneBoundary[]`)
  - Rendered as: Green line strips (LINE_STRIP)
  - Z-coordinate: Flattened to 0
  - Frame: `ego_vehicle_rear_axle`
  - Thickness: 1.0 meter
  - Color: Green (RGB: 0, 255, 0)

**Info text:**
- Shows: "SensorData not supported yet" (billboard text at origin)
- Indicates: Limited implementation status

### ❌ What is NOT Visualized

According to the OSI 3.7.0 specification, `SensorData` contains many fields that are **not currently implemented**:

#### **1. Detected Objects (Major Gap)**

**`moving_object` (DetectedMovingObject[])**
- Detected vehicles, pedestrians, animals
- Bounding boxes
- Position, velocity, acceleration
- Classification (type, color, lights)
- Detection confidence

**`stationary_object` (DetectedStationaryObject[])**
- Detected static obstacles
- Traffic signs, barriers, poles
- Position and dimensions
- Classification

#### **2. Environmental Features**

**`traffic_sign` (DetectedTrafficSign[])**
- Detected traffic signs
- Sign type, value, position
- Detection confidence

**`traffic_light` (DetectedTrafficLight[])**
- Detected traffic lights
- Light state (red, yellow, green)
- Position and orientation
- Detection confidence

**`road_marking` (DetectedRoadMarking[])**
- Detected road markings
- Markings type, color, position
- Lane dividers, crosswalks, arrows

#### **3. Sensor-Specific Data**

**`feature_data` (FeatureData)**
- Raw sensor features
- Keypoints, descriptors
- Sensor-specific detections

**`radar_detection` (RadarDetection[])**
- Raw radar detections
- Range, azimuth, elevation
- RCS, Doppler velocity

**`lidar_detection` (LidarDetection[])**
- Raw lidar point clouds
- Individual point detections
- Intensity values

**`ultrasonic_detection` (UltrasonicDetection[])**
- Ultrasonic sensor detections
- Range measurements

**`camera_detection` (CameraDetection[])**
- Camera-based detections
- Image-space coordinates

#### **4. Metadata & Attribution**

**`sensor_id` (Identifier)**
- Which sensor produced this data
- Not displayed in visualization

**`mounting_position` (MountingPosition)**
- Sensor mounting location
- Not used for frame transforms

**`timestamp` (Timestamp)**
- Currently used for scene entity timestamp
- But not displayed to user

**`sensor_view` (repeated SensorView)**
- Related sensor views
- Not visualized

## Detailed Limitations

### Frame Transform Issues

**Problem:** SensorData uses `ego_vehicle_rear_axle` frame
- Requires GroundTruth to be present for ego vehicle frame
- If only SensorData is available → frame errors (fixed in v0.0.8)
- Now uses global frame, but ego-relative would be more intuitive

### Z-Coordinate Flattening

**Problem:** Lane boundaries forced to z=0
```typescript
const ToPoint3 = (boundary: DeepRequired<LaneBoundary_BoundaryPoint>): Point3 => {
  return { x: boundary.position.x, y: boundary.position.y, z: 0 }; // Z forced to 0!
};
```

**Impact:**
- No elevation information for lanes on slopes/hills
- 3D position data is lost
- Bridges/overpasses not correctly represented

### No Configuration Options

**Problem:** SensorData has NO panel settings
- Can't toggle visibility of different elements
- Can't change colors
- Can't adjust line thickness
- No filtering by detection confidence

**Comparison:**
- GroundTruth/SensorView: Has panel settings (lanes, models, axes, etc.)
- MotionRequest: Has panel settings (point size)
- **SensorData: No settings at all** ❌

### No Object Detection Visualization

**Major Gap:** Detected objects are completely ignored
- Vehicles, pedestrians, obstacles not shown
- No bounding boxes
- No confidence indicators
- No classification labels

**Impact:**
- Can't visualize what the sensor "sees"
- Can't compare detections vs ground truth
- Can't evaluate sensor performance
- Limited utility for sensor validation

### Limited Use Cases

**What you CAN do:**
- View detected lane boundaries (if present)
- See if SensorData is being published

**What you CAN'T do:**
- Visualize detected objects
- Compare sensor detections vs ground truth
- Evaluate detection confidence
- See raw sensor detections (radar, lidar points)
- Analyze sensor coverage/field-of-view
- Debug false positives/negatives
- Validate sensor fusion

## Why These Limitations Exist

### Design Decision: Minimal Implementation

The current implementation appears to be a **placeholder/stub**:
```typescript
const makeInfoText = (): DeepPartial<TextPrimitive> => {
  return {
    // ...
    text: "SensorData not supported yet",  // <-- Explicit acknowledgment
  };
};
```

### Possible Reasons:

1. **Priority:** GroundTruth/SensorView are more commonly used
2. **Complexity:** SensorData has many fields, each needing custom rendering
3. **Use cases:** Ground truth visualization more critical than sensor detections
4. **Development time:** Full implementation would be substantial effort

## Comparison: SensorData vs GroundTruth

| Feature | GroundTruth | SensorData |
|---------|-------------|------------|
| Moving Objects | ✅ Full visualization | ❌ Not implemented |
| Stationary Objects | ✅ Full visualization | ❌ Not implemented |
| Lane Boundaries | ✅ Physical + Logical | ⚠️ Only detected lanes |
| Traffic Signs | ✅ Full visualization | ❌ Not implemented |
| Traffic Lights | ✅ Full visualization | ❌ Not implemented |
| Road Markings | ✅ Full visualization | ❌ Not implemented |
| Panel Settings | ✅ Rich configuration | ❌ None |
| 3D Models | ✅ Optional models | ❌ N/A |
| Frame Transforms | ✅ Ego frames | ⚠️ Uses rear axle |
| Z-coordinates | ✅ Preserved | ❌ Flattened to 0 |

## Impact on Users

### Workarounds

**If you need to visualize sensor detections:**

1. **Use GroundTruth instead of SensorData**
   - If available, GroundTruth provides full visualization
   - Most complete implementation

2. **Use SensorView**
   - Contains both GroundTruth and SensorData
   - Visualizes GroundTruth portion

3. **Custom visualization**
   - Export SensorData to other tools (RViz, etc.)
   - Write custom Lichtblick extension

### When SensorData Visualization IS Useful

**Current implementation works for:**
- Quick check: Is SensorData being published?
- Lane detection validation (if that's all you care about)
- Testing lane boundary detection algorithms
- Debugging lane detection issues

**Current implementation DOESN'T work for:**
- Object detection visualization
- Sensor fusion validation
- Perception system debugging
- False positive/negative analysis
- Comprehensive sensor performance evaluation

## Feature Request Suggestions

If you need enhanced SensorData visualization, consider requesting:

### **Priority 1: Detected Objects**
- Visualize `moving_object` and `stationary_object`
- Bounding boxes with confidence indicators
- Color by object type/classification
- Toggle visibility per object type

### **Priority 2: Configuration Panel**
- Show/hide detected objects
- Adjust colors, sizes
- Filter by confidence threshold
- Toggle lane boundaries

### **Priority 3: Frame Improvements**
- Support sensor-specific frames
- Visualize sensor mounting position
- Show field-of-view cones

### **Priority 4: Raw Sensor Data**
- Radar detections (points/blobs)
- Lidar point clouds
- Camera detections (2D → 3D projection)

### **Priority 5: Metadata Display**
- Detection confidence overlays
- Sensor ID labels
- Timestamp information
- Object tracking IDs

## Conclusion

### Summary of Limitations:

✅ **Implemented:** Lane boundaries only (green lines)
❌ **NOT Implemented:** Everything else (95% of SensorData fields)
⚠️ **Known Issue:** Z-coordinates flattened, no configuration options
📝 **Status:** Explicitly marked as "not supported yet"

### Recommendation:

**For production use:** Rely on GroundTruth/SensorView visualization
**For sensor validation:** Use specialized tools until SensorData support improves
**For development:** Submit feature requests for specific SensorData fields you need

The current SensorData implementation is a **minimal placeholder** rather than a full-featured visualization. It's functional for basic lane boundary viewing, but lacks the rich object detection and sensor data visualization needed for comprehensive perception system development and validation.

---

**Version:** v0.0.8
**Last Updated:** 2025-10-12
**Status:** Documented limitations, awaiting enhancement
