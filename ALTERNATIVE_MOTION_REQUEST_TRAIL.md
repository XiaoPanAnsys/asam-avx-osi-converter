# Alternative: Motion Request Trail Visualization

If you want to show a **history/trail** of past motion request trajectories (instead of just smooth transitions), use this alternative implementation:

## Code Modification (Optional)

Replace the scene entity creation in `buildMotionRequestSceneEntities()`:

```typescript
// Original (smooth single trajectory):
sceneEntities.push({
  timestamp: time,
  frame_id: ROOT_FRAME,
  id: "motion_request_desired_trajectory",
  lifetime: { sec: 0, nsec: 200_000_000 }, // Smooth transition
  frame_locked: true,
  lines: [trajectoryLine],
  cubes: trajectoryMarkers,
});

// Alternative (trail with history):
sceneEntities.push({
  timestamp: time,
  frame_id: ROOT_FRAME,
  id: `motion_request_trajectory_${time.sec}_${time.nsec}`, // Unique ID per timestamp
  lifetime: { sec: 3, nsec: 0 }, // Keep for 3 seconds - shows history
  frame_locked: true,
  lines: [trajectoryLine],
  cubes: trajectoryMarkers,
});
```

## Visual Comparison

### Current Implementation (Smooth Transition)
```
Shows: Most recent trajectory with smooth fade-in/out
Effect: Clean, single trajectory that updates smoothly
```

### Trail Implementation
```
Shows: Last 3 seconds of trajectories (at 10Hz = ~30 trajectories)
Effect: History trail showing how planning evolved
```

## When to Use Each

**Smooth Transition (Current - Recommended):**
- ✅ Clean visualization of current plan
- ✅ Less visual clutter
- ✅ Better for real-time monitoring
- ✅ Easier to follow the active trajectory

**Trail/History:**
- ✅ See how planning changed over time
- ✅ Debug trajectory instability
- ✅ Analyze replanning behavior
- ✅ Post-analysis and review

## Optional: Fading Trail

For an even better trail effect, add opacity based on age:

```typescript
// Calculate age-based opacity
const trajectoryAge = 0; // You'd track this from message timestamps
const maxAge = 3.0; // 3 seconds trail
const opacity = Math.max(0.2, 1.0 - (trajectoryAge / maxAge));

// Use in color
const trajectoryLine = createTrajectoryLine(
  trajectoryPoints,
  ColorCode("cyan", opacity * 0.8), // Fade out over time
  0.1,
);
```

This creates a **ghost trail effect** where older trajectories fade away gradually.
