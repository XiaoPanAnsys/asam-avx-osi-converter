import {
  CubePrimitive,
  LineType,
  ModelPrimitive,
  SceneEntityDeletionType,
  SceneUpdate,
  SpherePrimitive,
  Vector3,
  type Color,
  type FrameTransform,
  type FrameTransforms,
  type KeyValuePair,
  type LinePrimitive,
  type Point3,
} from "@foxglove/schemas";
import { Time } from "@foxglove/schemas/schemas/typescript/Time";
import type { DetectedMovingObject, DetectedStationaryObject } from "@lichtblick/asam-osi-types";
import {
  GroundTruth,
  LaneBoundary,
  MotionRequest,
  MovingObject,
  MovingObject_Type,
  MovingObject_VehicleClassification_Type,
  SensorData,
  SensorView,
  StatePoint,
  StationaryObject,
  Timestamp,
  TrafficLight,
  TrafficSign,
  MovingObject_VehicleClassification_LightState_GenericLightState,
  MovingObject_VehicleClassification_LightState_BrakeLightState,
  MovingObject_VehicleClassification_LightState_IndicatorState,
  Lane,
  RoadMarking,
  RoadMarking_Classification_Type,
  RoadMarking_Classification_Color,
  TrafficSign_MainSign_Classification_Type,
} from "@lichtblick/asam-osi-types";
import { ExtensionContext, Immutable, MessageEvent, PanelSettings } from "@lichtblick/suite";
import { eulerToQuaternion, quaternionMultiplication } from "@utils/geometry";
import { ColorCode, convertPathToFileUrl } from "@utils/helper";
import {
  objectToCubePrimitive,
  pointListToTriangleListPrimitive,
  objectToModelPrimitive,
} from "@utils/marker";
import { PartialSceneEntity, generateSceneEntityId } from "@utils/scene";
import { DeepPartial, DeepRequired } from "ts-essentials";

import {
  HOST_OBJECT_COLOR,
  MOVING_OBJECT_COLOR,
  STATIONARY_OBJECT_COLOR,
  STATIONARY_OBJECT_TYPE,
  STATIONARY_OBJECT_MATERIAL,
  STATIONARY_OBJECT_DENSITY,
  TRAFFIC_LIGHT_COLOR,
  ROAD_MARKING_COLOR,
} from "./config";
import {
  buildLaneEntity,
  buildLaneBoundaryEntity,
  PREFIX_LANE,
  PREFIX_LANE_BOUNDARY,
} from "./lanes";
import {
  buildBrakeLight,
  BrakeLightSide,
  buildIndicatorLight,
  IndicatorLightSide,
} from "./lightstates";
import {
  buildLogicalLaneEntity,
  buildLogicalLaneBoundaryEntity,
  PREFIX_LOGICAL_LANE,
  PREFIX_LOGICAL_LANE_BOUNDARY,
} from "./logical-lanes";
import { buildTrafficLightMetadata, buildTrafficLightModel } from "./trafficlights";
import { preloadDynamicTextures, buildTrafficSignModel } from "./trafficsigns";

// const ROS_ROOT_FRAME = "<root>"; // proper frame UUID aliases are not supported
const OSI_GLOBAL_FRAME = "global";
const OSI_EGO_VEHICLE_BB_CENTER_FRAME = "ego_vehicle_bb_center";
const OSI_EGO_VEHICLE_REAR_AXLE_FRAME = "ego_vehicle_rear_axle";

// Object-specific prefixes for scene entity ids
const PREFIX_MOVING_OBJECT = "moving_object";
const PREFIX_STATIONARY_OBJECT = "stationary_object";
const PREFIX_TRAFFIC_SIGN = "traffic_sign";
const PREFIX_TRAFFIC_LIGHT = "traffic_light";
const PREFIX_ROAD_MARKING = "road_marking";

// Prefixes for detected objects from SensorData
const PREFIX_DETECTED_MOVING_OBJECT = "detected_moving_object";
const PREFIX_DETECTED_STATIONARY_OBJECT = "detected_stationary_object";
const PREFIX_DETECTED_TRAFFIC_SIGN = "detected_traffic_sign";
const PREFIX_DETECTED_TRAFFIC_LIGHT = "detected_traffic_light";
const PREFIX_DETECTED_ROAD_MARKING = "detected_road_marking";
const PREFIX_DETECTED_LANE_BOUNDARY = "detected_lane_boundary";

type Config = {
  caching: boolean;
  showAxes: boolean;
  showPhysicalLanes: boolean;
  showLogicalLanes: boolean;
  showBoundingBox: boolean;
  show3dModels: boolean;
  defaultModelPath: string;
  trajectoryPointSize: number;
};

function createModelPrimitive(
  movingObject: DeepRequired<MovingObject>,
  modelFullPath: string,
): ModelPrimitive {
  const model_primitive = objectToModelPrimitive(
    movingObject.base.position.x,
    movingObject.base.position.y,
    movingObject.base.position.z - movingObject.base.dimension.height / 2,
    movingObject.base.orientation.roll,
    movingObject.base.orientation.pitch,
    movingObject.base.orientation.yaw,
    1,
    1,
    1,
    { r: 0, g: 0, b: 0, a: 0 },
    convertPathToFileUrl(modelFullPath),
  );
  return model_primitive;
}

function buildObjectEntity(
  osiObject: DeepRequired<MovingObject> | DeepRequired<StationaryObject>,
  color: Color,
  id_prefix: string,
  frame_id: string,
  time: Time,
  config: Config | undefined,
  modelCache: Map<string, ModelPrimitive>,
  metadata?: KeyValuePair[],
): PartialSceneEntity {
  const cube = objectToCubePrimitive(
    osiObject.base.position.x,
    osiObject.base.position.y,
    osiObject.base.position.z,
    osiObject.base.orientation.roll,
    osiObject.base.orientation.pitch,
    osiObject.base.orientation.yaw,
    osiObject.base.dimension.width,
    osiObject.base.dimension.length,
    osiObject.base.dimension.height,
    color,
  );

  const SHAFT_LENGTH = 0.154;
  const SHAFT_DIAMETER = 0.02;
  const HEAD_LENGTH = 0.046;
  const HEAD_DIAMETER = 0.05;
  const SCALE = 2.0;

  function buildAxisArrow(axis_color: Color, orientation: Vector3 = { x: 0, y: 0, z: 0 }) {
    const baseOrientation = eulerToQuaternion(
      osiObject.base.orientation.roll,
      osiObject.base.orientation.pitch,
      osiObject.base.orientation.yaw,
    );
    const localAxisOrientation = eulerToQuaternion(orientation.x, orientation.y, orientation.z);
    const globalAxisOrientation = quaternionMultiplication(baseOrientation, localAxisOrientation);
    return {
      pose: {
        position: {
          x: osiObject.base.position.x,
          y: osiObject.base.position.y,
          z: osiObject.base.position.z,
        },
        orientation: globalAxisOrientation,
      },
      shaft_length: SHAFT_LENGTH * SCALE,
      shaft_diameter: SHAFT_DIAMETER * SCALE,
      head_length: HEAD_LENGTH * SCALE,
      head_diameter: HEAD_DIAMETER * SCALE,
      color: axis_color,
    };
  }

  function buildAxes() {
    if (!(config?.showAxes ?? false)) {
      return [];
    }
    return [
      buildAxisArrow(ColorCode("r", 1), { x: 0, y: 0, z: 0 }),
      buildAxisArrow(ColorCode("g", 1), { x: 0, y: 0, z: Math.PI / 2 }),
      buildAxisArrow(ColorCode("b", 1), { x: 0, y: -Math.PI / 2, z: 0 }),
    ];
  }

  function hasBrakeLightState(obj: MovingObject | StationaryObject): obj is MovingObject {
    return (
      "vehicle_classification" in obj &&
      obj.vehicle_classification?.light_state?.brake_light_state != undefined
    );
  }

  function hasIndicatorState(obj: MovingObject | StationaryObject): obj is MovingObject {
    return (
      "vehicle_classification" in obj &&
      obj.vehicle_classification?.light_state?.indicator_state != undefined
    );
  }

  function buildVehicleLights() {
    const lights: CubePrimitive[] = [];

    if (hasBrakeLightState(osiObject)) {
      lights.push(buildBrakeLight(osiObject, BrakeLightSide.Left));
      lights.push(buildBrakeLight(osiObject, BrakeLightSide.Right));
    }
    if (hasIndicatorState(osiObject)) {
      lights.push(buildIndicatorLight(osiObject, IndicatorLightSide.FrontLeft));
      lights.push(buildIndicatorLight(osiObject, IndicatorLightSide.FrontRight));
      lights.push(buildIndicatorLight(osiObject, IndicatorLightSide.RearLeft));
      lights.push(buildIndicatorLight(osiObject, IndicatorLightSide.RearRight));
    }
    return lights;
  }

  function getUpdatedModelPrimitives(): ModelPrimitive[] {
    if (config != null && config.show3dModels) {
      const model_path = config.defaultModelPath + osiObject.model_reference;
      const model_primitive = modelCache.get(model_path);
      if (model_primitive == undefined) {
        return [];
      }

      model_primitive.pose.position.x = osiObject.base.position.x;
      model_primitive.pose.position.y = osiObject.base.position.y;
      model_primitive.pose.position.z =
        osiObject.base.position.z - osiObject.base.dimension.height / 2;
      model_primitive.pose.orientation = eulerToQuaternion(
        osiObject.base.orientation.roll,
        osiObject.base.orientation.pitch,
        osiObject.base.orientation.yaw,
      );

      return [model_primitive];
    }

    return [];
  }

  return {
    timestamp: time,
    frame_id,
    id: generateSceneEntityId(id_prefix, osiObject.id.value),
    lifetime: { sec: 0, nsec: 0 },
    frame_locked: true,
    cubes: config != null && config.showBoundingBox ? [cube, ...buildVehicleLights()] : [],
    arrows: buildAxes(),
    metadata,
    models: getUpdatedModelPrimitives(),
  };
}

function buildTrafficSignEntity(
  obj: DeepRequired<TrafficSign>,
  id_prefix: string,
  frame_id: string,
  time: Time,
  metadata?: KeyValuePair[],
): PartialSceneEntity {
  const models = [];

  models.push(buildTrafficSignModel("main", obj.main_sign));

  if (obj.supplementary_sign.length > 0) {
    for (const item of obj.supplementary_sign) {
      models.push(buildTrafficSignModel("main", item));
    }
  }

  return {
    timestamp: time,
    frame_id,
    id: generateSceneEntityId(id_prefix, obj.id.value),
    lifetime: { sec: 0, nsec: 0 },
    frame_locked: true,
    // texts,
    models,
    metadata,
  };
}

function buildTrafficLightEntity(
  obj: DeepRequired<TrafficLight>,
  id_prefix: string,
  frame_id: string,
  time: Time,
  metadata?: KeyValuePair[],
): PartialSceneEntity {
  const models = [];

  models.push(buildTrafficLightModel(obj, TRAFFIC_LIGHT_COLOR[obj.classification.color].code));

  return {
    timestamp: time,
    frame_id,
    id: generateSceneEntityId(id_prefix, obj.id.value),
    lifetime: { sec: 0, nsec: 0 },
    frame_locked: true,
    // texts,
    models,
    metadata,
  };
}

function buildRoadMarkingEntity(
  roadMarking: DeepRequired<RoadMarking>,
  frame_id: string,
  time: Time,
): PartialSceneEntity | undefined {
  if (
    roadMarking.classification.traffic_main_sign_type !==
    TrafficSign_MainSign_Classification_Type.STOP
  ) {
    return undefined;
  }

  const roadMarkingPoints = [
    {
      position: {
        x: roadMarking.base.position.x,
        y: roadMarking.base.position.y,
        z: roadMarking.base.position.z,
      } as Point3,
      width: roadMarking.base.dimension.width,
      height: roadMarking.base.dimension.height,
    },
    {
      position: {
        x: roadMarking.base.position.x + roadMarking.base.dimension.length,
        y: roadMarking.base.position.y,
        z: roadMarking.base.position.z,
      } as Point3,
      width: roadMarking.base.dimension.width,
      height: roadMarking.base.dimension.height,
    },
  ];

  // Define color and opacity based on OSI classification
  const rgb = ROAD_MARKING_COLOR[roadMarking.classification.monochrome_color];
  const color = { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 };

  // Set option for dashed lines
  const options = {
    dashed: false,
    arrows: false,
    invertArrows: false,
  };

  return {
    timestamp: time,
    frame_id,
    id: generateSceneEntityId(PREFIX_ROAD_MARKING, roadMarking.id.value),
    lifetime: { sec: 0, nsec: 0 },
    frame_locked: true,
    triangles: [pointListToTriangleListPrimitive(roadMarkingPoints, color, options)],
    metadata: buildRoadMarkingMetadata(roadMarking),
  };
}

interface IlightStateEnumStringMaps {
  generic_light_state: typeof MovingObject_VehicleClassification_LightState_GenericLightState;
  [key: string]: Record<number, string>;
}

const lightStateEnumStringMaps: IlightStateEnumStringMaps = {
  indicator_state: MovingObject_VehicleClassification_LightState_IndicatorState,
  brake_light_state: MovingObject_VehicleClassification_LightState_BrakeLightState,
  generic_light_state: MovingObject_VehicleClassification_LightState_GenericLightState,
};

export function buildMovingObjectMetadata(
  moving_object: DeepRequired<MovingObject>,
): KeyValuePair[] {
  const metadata: KeyValuePair[] = [
    { key: "moving_object_type", value: MovingObject_Type[moving_object.type] },
    {
      key: "acceleration",
      value: `${moving_object.base.acceleration.x}, ${moving_object.base.acceleration.y}, ${moving_object.base.acceleration.z}`,
    },
    {
      key: "velocity",
      value: `${moving_object.base.velocity.x}, ${moving_object.base.velocity.y}, ${moving_object.base.velocity.z}`,
    },
    {
      key: "assigned_lane_id",
      value:
        moving_object.moving_object_classification.assigned_lane_id.length > 0
          ? moving_object.moving_object_classification.assigned_lane_id
              .map((id) => id.value)
              .join(",")
          : "",
    },
  ];

  if (moving_object.type === MovingObject_Type.VEHICLE) {
    metadata.push(
      {
        key: "type",
        value: MovingObject_VehicleClassification_Type[moving_object.vehicle_classification.type],
      },
      ...Object.entries(moving_object.vehicle_classification.light_state).map(([key, value]) => {
        return {
          key: `light_state.${key}`,
          value:
            lightStateEnumStringMaps[key]?.[value] ??
            lightStateEnumStringMaps.generic_light_state[value]!,
        };
      }),
    );
  }
  return metadata;
}

export function buildStationaryMetadata(obj: DeepRequired<StationaryObject>): KeyValuePair[] {
  const metadata: KeyValuePair[] = [
    {
      key: "density",
      value: STATIONARY_OBJECT_DENSITY[obj.classification.density] || STATIONARY_OBJECT_DENSITY[0],
    },
    {
      key: "material",
      value:
        STATIONARY_OBJECT_MATERIAL[obj.classification.material] || STATIONARY_OBJECT_MATERIAL[0],
    },
    {
      key: "color",
      value:
        STATIONARY_OBJECT_COLOR[obj.classification.color].name || STATIONARY_OBJECT_COLOR[0].name,
    },
    {
      key: "type",
      value: STATIONARY_OBJECT_TYPE[obj.classification.type] || STATIONARY_OBJECT_TYPE[0],
    },
  ];

  return metadata;
}

export function buildRoadMarkingMetadata(road_marking: DeepRequired<RoadMarking>): KeyValuePair[] {
  const metadata: KeyValuePair[] = [
    {
      key: "type",
      value: RoadMarking_Classification_Type[road_marking.classification.type],
    },
    {
      key: "color",
      value: RoadMarking_Classification_Color[road_marking.classification.monochrome_color],
    },
    {
      key: "width",
      value: road_marking.base.dimension.width.toString(),
    },
    {
      key: "height",
      value: road_marking.base.dimension.height.toString(),
    },
  ];

  return metadata;
}

function osiTimestampToTime(time: DeepRequired<Timestamp>): Time {
  return {
    sec: time.seconds,
    nsec: time.nanos,
  };
}

interface OSISceneEntities {
  movingObjects: PartialSceneEntity[];
  stationaryObjects: PartialSceneEntity[];
  trafficSigns: PartialSceneEntity[];
  trafficLights: PartialSceneEntity[];
  roadMarkings: PartialSceneEntity[];
  laneBoundaries: PartialSceneEntity[];
  logicalLaneBoundaries: PartialSceneEntity[];
  lanes: PartialSceneEntity[];
  logicalLanes: PartialSceneEntity[];
}

interface OSISceneEntitesUpdate {
  movingObjects: boolean;
  stationaryObjects: boolean;
  trafficSigns: boolean;
  trafficLights: boolean;
  roadMarkings: boolean;
  laneBoundaries: boolean;
  logicalLaneBoundaries: boolean;
  lanes: boolean;
  logicalLanes: boolean;
}

/**
 * Builds a PartialSceneEntity representing an OSI lane boundary.
 *
 * @param osiGroundTruth - The OSI GroundTruth object used to build scene entities.
 * @param updateFlags - Object containing flags to determine which entities need to be updated.
 * @returns A list of OSISceneEntities object containing scene entity lists for each entity type.
 * For each entity type with its corresponding update flag set to true, the scene entity list will be updated.
 * For each entity type with its corresponding update flag set to false, the scene entity list will be empty.
 */
function buildSceneEntities(
  osiGroundTruth: DeepRequired<GroundTruth>,
  updateFlags: OSISceneEntitesUpdate,
  config: Config | undefined,
  modelCache: Map<string, ModelPrimitive>,
): OSISceneEntities {
  const time: Time = osiTimestampToTime(osiGroundTruth.timestamp);

  // Moving objects
  let movingObjectSceneEntities: PartialSceneEntity[] = [];
  if (updateFlags.movingObjects) {
    movingObjectSceneEntities = osiGroundTruth.moving_object.map((obj) => {
      let entity;
      const metadata = buildMovingObjectMetadata(obj);

      const modelPathKey = config?.defaultModelPath + obj.model_reference;
      if (
        !modelCache.has(modelPathKey) &&
        obj.model_reference.length !== 0 &&
        convertPathToFileUrl(modelPathKey)
      ) {
        modelCache.set(modelPathKey, createModelPrimitive(obj, modelPathKey));
      }

      if (obj.id.value === osiGroundTruth.host_vehicle_id.value) {
        entity = buildObjectEntity(
          obj,
          HOST_OBJECT_COLOR,
          PREFIX_MOVING_OBJECT,
          OSI_GLOBAL_FRAME,
          time,
          config,
          modelCache,
          metadata,
        );
      } else {
        const objectColor = MOVING_OBJECT_COLOR[obj.type];
        entity = buildObjectEntity(
          obj,
          objectColor,
          PREFIX_MOVING_OBJECT,
          OSI_GLOBAL_FRAME,
          time,
          config,
          modelCache,
          metadata,
        );
      }
      return entity;
    });
  }

  // Stationary objects
  let stationaryObjectSceneEntities: PartialSceneEntity[] = [];
  if (updateFlags.stationaryObjects) {
    stationaryObjectSceneEntities = osiGroundTruth.stationary_object.map((obj) => {
      const objectColor = STATIONARY_OBJECT_COLOR[obj.classification.color].code;
      const metadata = buildStationaryMetadata(obj);
      return buildObjectEntity(
        obj,
        objectColor,
        PREFIX_STATIONARY_OBJECT,
        OSI_GLOBAL_FRAME,
        time,
        config,
        modelCache,
        metadata,
      );
    });
  }

  // Traffic Sign objects
  const trafficsignObjectSceneEntities = osiGroundTruth.traffic_sign.map((obj) => {
    return buildTrafficSignEntity(obj, PREFIX_TRAFFIC_SIGN, OSI_GLOBAL_FRAME, time);
  });

  // Traffic Light objects
  let trafficlightObjectSceneEntities: PartialSceneEntity[] = [];
  if (updateFlags.trafficLights) {
    trafficlightObjectSceneEntities = osiGroundTruth.traffic_light.map((obj) => {
      const metadata = buildTrafficLightMetadata(obj);
      return buildTrafficLightEntity(obj, PREFIX_TRAFFIC_LIGHT, OSI_GLOBAL_FRAME, time, metadata);
    });
  }

  // Road Marking objects
  let roadMarkingObjectSceneEntities: PartialSceneEntity[] = [];
  if (updateFlags.roadMarkings) {
    roadMarkingObjectSceneEntities = osiGroundTruth.road_marking.flatMap((road_marking) => {
      const result = buildRoadMarkingEntity(road_marking, OSI_GLOBAL_FRAME, time);

      if (result != undefined) {
        const partialEntity: PartialSceneEntity = result;
        return partialEntity;
      }

      return [];
    });
  }

  // Lane boundaries
  let laneBoundarySceneEntities: PartialSceneEntity[] = [];
  if (updateFlags.laneBoundaries && config != undefined && config.showPhysicalLanes) {
    laneBoundarySceneEntities = osiGroundTruth.lane_boundary.map((lane_boundary) => {
      return buildLaneBoundaryEntity(lane_boundary, OSI_GLOBAL_FRAME, time);
    });
  }

  // Lanes
  let laneSceneEntities: PartialSceneEntity[] = [];
  if (updateFlags.lanes && config != undefined && config.showPhysicalLanes) {
    // Re-generate lanes only when update.lanes is true
    laneSceneEntities = osiGroundTruth.lane.map((lane) => {
      const rightLaneBoundaryIds = lane.classification.right_lane_boundary_id.map((id) => id.value);
      const leftLaneBoundaryIds = lane.classification.left_lane_boundary_id.map((id) => id.value);
      const leftLaneBoundaries = osiGroundTruth.lane_boundary.filter((b) =>
        leftLaneBoundaryIds.includes(b.id.value),
      );
      const rightLaneBoundaries = osiGroundTruth.lane_boundary.filter((b) =>
        rightLaneBoundaryIds.includes(b.id.value),
      );
      return buildLaneEntity(lane, OSI_GLOBAL_FRAME, time, leftLaneBoundaries, rightLaneBoundaries);
    });
  }

  // Logical lane boundaries
  let logicalLaneBoundarySceneEntities: PartialSceneEntity[] = [];
  if (updateFlags.laneBoundaries && config != undefined && config.showLogicalLanes) {
    logicalLaneBoundarySceneEntities = osiGroundTruth.logical_lane_boundary.map((lane_boundary) => {
      return buildLogicalLaneBoundaryEntity(lane_boundary, OSI_GLOBAL_FRAME, time);
    });
  }

  // Logical lanes
  let logicalLaneSceneEntities: PartialSceneEntity[] = [];
  if (updateFlags.logicalLanes && config != undefined && config.showLogicalLanes) {
    logicalLaneSceneEntities = osiGroundTruth.logical_lane.map((logical_lane) => {
      const rightLaneBoundaryIds = logical_lane.right_boundary_id.map((id) => id.value);
      const leftLaneBoundaryIds = logical_lane.left_boundary_id.map((id) => id.value);
      const leftLaneBoundaries = osiGroundTruth.logical_lane_boundary.filter((b) =>
        leftLaneBoundaryIds.includes(b.id.value),
      );
      const rightLaneBoundaries = osiGroundTruth.logical_lane_boundary.filter((b) =>
        rightLaneBoundaryIds.includes(b.id.value),
      );

      return buildLogicalLaneEntity(
        logical_lane,
        OSI_GLOBAL_FRAME,
        time,
        leftLaneBoundaries,
        rightLaneBoundaries,
      );
    });
  }

  return {
    movingObjects: movingObjectSceneEntities,
    stationaryObjects: stationaryObjectSceneEntities,
    trafficSigns: trafficsignObjectSceneEntities,
    trafficLights: trafficlightObjectSceneEntities,
    roadMarkings: roadMarkingObjectSceneEntities,
    laneBoundaries: laneBoundarySceneEntities,
    logicalLaneBoundaries: logicalLaneBoundarySceneEntities,
    lanes: laneSceneEntities,
    logicalLanes: logicalLaneSceneEntities,
  };
}

export function buildEgoVehicleBBCenterFrameTransform(
  osiGroundTruth: DeepRequired<GroundTruth>,
): FrameTransform {
  const hostIdentifier = osiGroundTruth.host_vehicle_id.value;
  const hostObject = osiGroundTruth.moving_object.find((obj) => {
    return obj.id.value === hostIdentifier;
  })!;

  // Pose of EGO BB-CENTER in GLOBAL (parent -> child)
  return {
    timestamp: osiTimestampToTime(osiGroundTruth.timestamp),
    parent_frame_id: OSI_GLOBAL_FRAME,
    child_frame_id: OSI_EGO_VEHICLE_BB_CENTER_FRAME,
    translation: {
      x: hostObject.base.position.x,
      y: hostObject.base.position.y,
      z: hostObject.base.position.z,
    },
    rotation: eulerToQuaternion(
      hostObject.base.orientation.roll,
      hostObject.base.orientation.pitch,
      hostObject.base.orientation.yaw,
    ),
  };
}

export function buildEgoVehicleRearAxleFrameTransform(
  osiGroundTruth: DeepRequired<GroundTruth>,
): FrameTransform {
  const hostIdentifier = osiGroundTruth.host_vehicle_id.value;
  const hostObject = osiGroundTruth.moving_object.find((obj) => {
    return obj.id.value === hostIdentifier;
  })!;

  // OSI tree: BB_CENTER (parent) -> REAR_AXLE (child) with a pure translation in body frame
  return {
    timestamp: osiTimestampToTime(osiGroundTruth.timestamp),
    parent_frame_id: OSI_EGO_VEHICLE_BB_CENTER_FRAME,
    child_frame_id: OSI_EGO_VEHICLE_REAR_AXLE_FRAME,
    translation: {
      x: hostObject.vehicle_attributes.bbcenter_to_rear.x,
      y: hostObject.vehicle_attributes.bbcenter_to_rear.y,
      z: hostObject.vehicle_attributes.bbcenter_to_rear.z,
    },
    rotation: eulerToQuaternion(0, 0, 0),
  };
}

/**
 * Transform a position from sensor frame to vehicle frame using mounting position
 */
function transformSensorToVehicleFrame(
  sensorPosition: { x: number; y: number; z: number },
  mountingPosition: {
    position: { x: number; y: number; z: number };
    orientation: { roll: number; pitch: number; yaw: number };
  },
): { x: number; y: number; z: number } {
  const { x: sx, y: sy, z: sz } = sensorPosition;
  const { position: mp, orientation: mo } = mountingPosition;

  // Apply rotation (yaw, pitch, roll) - simplified for yaw only (most common case)
  const cosYaw = Math.cos(mo.yaw);
  const sinYaw = Math.sin(mo.yaw);

  // Rotate point around Z-axis (yaw)
  const rotatedX = sx * cosYaw - sy * sinYaw;
  const rotatedY = sx * sinYaw + sy * cosYaw;
  const rotatedZ = sz; // Simplified: ignoring pitch/roll for now

  // Translate to vehicle frame
  return {
    x: rotatedX + mp.x,
    y: rotatedY + mp.y,
    z: rotatedZ + mp.z,
  };
}

/**
 * Builds scene entities for SensorData, visualizing all detected objects
 * similar to GroundTruth visualization.
 *
 * @param osiSensorData - The OSI SensorData object containing detected objects
 * @param config - Configuration options for visualization
 * @param modelCache - Cache for 3D models
 * @returns An array of PartialSceneEntity objects representing detected objects
 */
function buildSensorDataSceneEntities(
  osiSensorData: DeepRequired<SensorData>,
  config: Config | undefined,
  modelCache: Map<string, ModelPrimitive>,
): PartialSceneEntity[] {
  const time: Time = osiTimestampToTime(osiSensorData.timestamp);
  const sceneEntities: PartialSceneEntity[] = [];

  // Get sensor mounting position for coordinate transformation
  const mountingPosition = osiSensorData.mounting_position;
  const hasMountingPosition = mountingPosition && mountingPosition.position && mountingPosition.orientation;

  // Log mounting position info for debugging
  if (hasMountingPosition) {
    console.log(
      "[SensorData] Applying coordinate transformation from sensor frame to vehicle frame:",
      {
        mounting: {
          position: mountingPosition.position,
          orientation: mountingPosition.orientation,
        },
      },
    );
  } else {
    console.warn(
      "[SensorData] No mounting_position found - detected objects will be in sensor's local frame",
    );
  }

  // Helper function to convert DetectedMovingObject to MovingObject-like structure
  // DetectedMovingObject has similar structure but with additional detection metadata
  const buildDetectedMovingObjectEntity = (
    detectedObj: DeepRequired<DetectedMovingObject>,
  ): PartialSceneEntity => {
    // DetectedMovingObject structure: base + candidate
    // Need to combine them to create a MovingObject-like structure
    const mainCandidate = detectedObj.candidate[0];
    if (!mainCandidate || !detectedObj.base) {
      throw new Error("Missing candidate or base data");
    }

    // Transform position from sensor frame to vehicle/global frame if mounting position available
    let transformedBase = detectedObj.base;
    if (hasMountingPosition && detectedObj.base.position) {
      const transformedPos = transformSensorToVehicleFrame(
        detectedObj.base.position,
        mountingPosition as any,
      );
      transformedBase = {
        ...detectedObj.base,
        position: transformedPos,
      };
    }

    // Construct a MovingObject-like structure from detected data
    const baseObj = {
      id: detectedObj.header?.ground_truth_id?.[0] ?? { value: BigInt(Date.now()) },
      base: transformedBase,
      type: mainCandidate.type ?? 0,
      vehicle_classification: mainCandidate.vehicle_classification ?? {},
      vehicle_attributes: {},
      model_reference: "",
    } as unknown as DeepRequired<MovingObject>;

    // Create metadata including detection confidence
    const metadata: KeyValuePair[] = [
      {
        key: "type",
        value: MovingObject_Type[mainCandidate.type ?? 0] ?? "UNKNOWN",
      },
      {
        key: "detection_confidence",
        value: (mainCandidate.probability ?? 0).toFixed(2),
      },
      {
        key: "existence_probability",
        value: (detectedObj.header?.existence_probability ?? 0).toFixed(2),
      },
    ];

    // Use cyan color to distinguish detected objects from ground truth
    const objectColor = ColorCode("cyan", 0.7);

    return buildObjectEntity(
      baseObj,
      objectColor,
      PREFIX_DETECTED_MOVING_OBJECT,
      OSI_GLOBAL_FRAME,
      time,
      config,
      modelCache,
      metadata,
    );
  };

  // Helper function for DetectedStationaryObject
  const buildDetectedStationaryObjectEntity = (
    detectedObj: DeepRequired<DetectedStationaryObject>,
  ): PartialSceneEntity => {
    // DetectedStationaryObject structure: base + candidate
    const mainCandidate = detectedObj.candidate[0];
    if (!mainCandidate || !detectedObj.base) {
      throw new Error("Missing candidate or base data");
    }

    // Transform position from sensor frame to vehicle/global frame if mounting position available
    let transformedBase = detectedObj.base;
    if (hasMountingPosition && detectedObj.base.position) {
      const transformedPos = transformSensorToVehicleFrame(
        detectedObj.base.position,
        mountingPosition as any,
      );
      transformedBase = {
        ...detectedObj.base,
        position: transformedPos,
      };
    }

    // Construct a StationaryObject-like structure from detected data
    const baseObj = {
      id: detectedObj.header?.ground_truth_id?.[0] ?? { value: BigInt(Date.now()) },
      base: transformedBase,
      classification: mainCandidate.classification ?? { type: 0, color: 0 },
      model_reference: "",
    } as unknown as DeepRequired<StationaryObject>;

    const metadata: KeyValuePair[] = [
      {
        key: "type",
        value: mainCandidate.classification?.type?.toString() ?? "unknown",
      },
      {
        key: "detection_confidence",
        value: (mainCandidate.probability ?? 0).toFixed(2),
      },
      {
        key: "existence_probability",
        value: (detectedObj.header?.existence_probability ?? 0).toFixed(2),
      },
    ];

    // Use yellow color for detected stationary objects
    const objectColor = ColorCode("yellow", 0.7);

    return buildObjectEntity(
      baseObj,
      objectColor,
      PREFIX_DETECTED_STATIONARY_OBJECT,
      OSI_GLOBAL_FRAME,
      time,
      config,
      modelCache,
      metadata,
    );
  };

  // Detected Moving Objects
  if (osiSensorData.moving_object && osiSensorData.moving_object.length > 0) {
    const detectedMovingObjects = osiSensorData.moving_object
      .map((obj) => {
        try {
          return buildDetectedMovingObjectEntity(obj);
        } catch (error) {
          console.warn("Failed to build detected moving object entity:", error);
          return null;
        }
      })
      .filter((entity): entity is PartialSceneEntity => entity !== null);
    sceneEntities.push(...detectedMovingObjects);
  }

  // Detected Stationary Objects
  if (osiSensorData.stationary_object && osiSensorData.stationary_object.length > 0) {
    const detectedStationaryObjects = osiSensorData.stationary_object
      .map((obj) => {
        try {
          return buildDetectedStationaryObjectEntity(obj);
        } catch (error) {
          console.warn("Failed to build detected stationary object entity:", error);
          return null;
        }
      })
      .filter((entity): entity is PartialSceneEntity => entity !== null);
    sceneEntities.push(...detectedStationaryObjects);
  }

  // Detected Traffic Signs
  if (osiSensorData.traffic_sign && osiSensorData.traffic_sign.length > 0) {
    const detectedTrafficSigns = osiSensorData.traffic_sign
      .map((detectedSign) => {
        try {
          // DetectedTrafficSign structure: use the most likely classification candidate
          const mainCandidate = detectedSign.main_sign.candidate[0];
          if (!mainCandidate || !detectedSign.main_sign.base) {
            return null;
          }

          // Build a TrafficSign-like structure from detected sign
          const baseSign = {
            id: detectedSign.header?.ground_truth_id?.[0] ?? { value: 0n },
            main_sign: {
              base: detectedSign.main_sign.base,
              classification: mainCandidate.classification,
              model_reference: "",
            },
            supplementary_sign: detectedSign.supplementary_sign?.map((suppSign) => ({
              base: suppSign.base,
              classification: suppSign.candidate[0]?.classification ?? {},
              model_reference: "",
            })) ?? [],
            source_reference: {},
          } as unknown as DeepRequired<TrafficSign>;

          return buildTrafficSignEntity(
            baseSign,
            PREFIX_DETECTED_TRAFFIC_SIGN,
            OSI_GLOBAL_FRAME,
            time,
          );
        } catch (error) {
          console.warn("Failed to build detected traffic sign entity:", error);
          return null;
        }
      })
      .filter((entity): entity is PartialSceneEntity => entity !== null);
    sceneEntities.push(...detectedTrafficSigns);
  }

  // Detected Traffic Lights
  if (osiSensorData.traffic_light && osiSensorData.traffic_light.length > 0) {
    const detectedTrafficLights = osiSensorData.traffic_light
      .map((detectedLight) => {
        try {
          const baseLight = detectedLight.base as unknown as DeepRequired<TrafficLight>;
          const metadata = buildTrafficLightMetadata(baseLight);
          return buildTrafficLightEntity(
            baseLight,
            PREFIX_DETECTED_TRAFFIC_LIGHT,
            OSI_GLOBAL_FRAME,
            time,
            metadata,
          );
        } catch (error) {
          console.warn("Failed to build detected traffic light entity:", error);
          return null;
        }
      })
      .filter((entity): entity is PartialSceneEntity => entity !== null);
    sceneEntities.push(...detectedTrafficLights);
  }

  // Detected Road Markings
  if (osiSensorData.road_marking && osiSensorData.road_marking.length > 0) {
    const detectedRoadMarkings = osiSensorData.road_marking
      .flatMap((detectedMarking) => {
        try {
          const baseMarking = detectedMarking.base as unknown as DeepRequired<RoadMarking>;
          const result = buildRoadMarkingEntity(baseMarking, OSI_GLOBAL_FRAME, time);
          if (result != undefined) {
            // Update the ID prefix for detected markings
            result.id = result.id.replace(PREFIX_ROAD_MARKING, PREFIX_DETECTED_ROAD_MARKING);
            return result;
          }
          return [];
        } catch (error) {
          console.warn("Failed to build detected road marking entity:", error);
          return [];
        }
      });
    sceneEntities.push(...detectedRoadMarkings);
  }

  // Detected Lane Boundaries (improved from previous implementation)
  if (
    config?.showPhysicalLanes !== false &&
    osiSensorData.lane_boundary &&
    osiSensorData.lane_boundary.length > 0
  ) {
    const detectedLaneBoundaries = osiSensorData.lane_boundary
      .map((detectedBoundary) => {
        try {
          // Convert DetectedLaneBoundary to LaneBoundary structure
          const baseBoundary: DeepRequired<LaneBoundary> = {
            id: detectedBoundary.header?.ground_truth_id?.[0] ?? { value: 0n },
            boundary_line: detectedBoundary.boundary_line.map((point) => {
              // Transform position from sensor frame to vehicle frame if mounting position available
              let transformedPos = {
                x: point.position.x,
                y: point.position.y,
                z: point.position.z,
              };

              if (hasMountingPosition && point.position) {
                transformedPos = transformSensorToVehicleFrame(
                  point.position,
                  mountingPosition as any,
                );
              }

    return {
                position: transformedPos,
                width: point.width,
                height: point.height,
                dash: point.dash,
              };
            }),
            classification: detectedBoundary.candidate?.[0]?.classification ?? {
              type: 0,
              color: 0,
              limiting_structure_id: [],
            },
          } as DeepRequired<LaneBoundary>;

          const entity = buildLaneBoundaryEntity(baseBoundary, OSI_GLOBAL_FRAME, time);
          // Update ID prefix for detected lane boundaries
          entity.id = entity.id.replace(PREFIX_LANE_BOUNDARY, PREFIX_DETECTED_LANE_BOUNDARY);
          return entity;
        } catch (error) {
          console.warn("Failed to build detected lane boundary entity:", error);
          return null;
        }
      })
      .filter((entity): entity is PartialSceneEntity => entity !== null);
    sceneEntities.push(...detectedLaneBoundaries);
  }

  return sceneEntities;
}

/**
 * Builds scene entities for MotionRequest, visualizing the desired trajectory
 * as connected points in 3D space in the global frame.
 *
 * @param osiMotionRequest - The OSI MotionRequest object containing trajectory data
 * @param config - Configuration options for visualization
 * @returns An array of PartialSceneEntity objects representing the trajectory
 */
function buildMotionRequestSceneEntities(
  osiMotionRequest: DeepRequired<MotionRequest>,
  config: Config | undefined,
): PartialSceneEntity[] {
  const time: Time = osiTimestampToTime(osiMotionRequest.timestamp);

  // Helper function to convert StatePoint to Point3
  const statePointToPoint3 = (statePoint: DeepRequired<StatePoint>): Point3 => {
    return {
      x: statePoint.position.x,
      y: statePoint.position.y,
      z: statePoint.position.z,
    };
  };

  // Helper function to create a line primitive from trajectory points
  const createTrajectoryLine = (
    trajectoryPoints: DeepRequired<StatePoint>[],
    color: Color,
    thickness: number,
  ): DeepPartial<LinePrimitive> => {
    const points = trajectoryPoints.map(statePointToPoint3);
    return {
      type: LineType.LINE_STRIP,
      pose: {
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      thickness,
      scale_invariant: false,
      points,
      color,
      indices: [],
    };
  };

  // Helper function to create sphere markers at trajectory points
  const createTrajectoryPoints = (
    trajectoryPoints: DeepRequired<StatePoint>[],
    color: Color,
    radius: number,
  ): SpherePrimitive[] => {
    return trajectoryPoints.map((point) => ({
      pose: {
        position: {
          x: point.position.x,
          y: point.position.y,
          z: point.position.z,
        },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      size: { x: radius * 2, y: radius * 2, z: radius * 2 }, // Diameter for spheres
      color,
    }));
  };

  const sceneEntities: PartialSceneEntity[] = [];

  // Visualize DesiredTrajectory if available
  if (
    osiMotionRequest.desired_trajectory &&
    osiMotionRequest.desired_trajectory.trajectory_point &&
    osiMotionRequest.desired_trajectory.trajectory_point.length > 0
  ) {
    const trajectoryPoints = osiMotionRequest.desired_trajectory.trajectory_point;

    // Create line connecting trajectory points (cyan color for desired trajectory)
    const trajectoryLine = createTrajectoryLine(
      trajectoryPoints,
      ColorCode("cyan", 1.0),
      0.1,
    );

    // Create spheres at each trajectory point
    const pointSize = config?.trajectoryPointSize ?? 0.15; // Use config or default to 0.15m
    const trajectoryMarkers = createTrajectoryPoints(
      trajectoryPoints,
      ColorCode("cyan", 1.0),
      pointSize,
    );

    sceneEntities.push({
      timestamp: time,
      frame_id: OSI_GLOBAL_FRAME,
      id: "motion_request_desired_trajectory",
      lifetime: { sec: 0, nsec: 100_000_000 }, // 0.1 seconds - smooth transition
    frame_locked: true,
      lines: [trajectoryLine],
      spheres: trajectoryMarkers,
    });
  }

  return sceneEntities;
}

/**
 * Hashing function to create a unique hash for lane objects.
 *
 * The hashLanes function creates a hash by:
 *
 * - Concatenating the id values of all Lane objects.
 * - Iterating over the concatenated string and updating a hash value using bitwise operations.
 *
 * Note: This mechanism is a temporary solution to demonstrate the feasibility of caching as it relies on the assumption that a lane with the same id will always have the same properties.
 * This might not be the case when using partial chunking of lanes/lane boundaries.
 */
const hashLanes = (lanes: Lane[]): string => {
  const hash = lanes.reduce((acc, lane) => acc + lane.id!.value!.toString(), "");
  let hashValue = 0;
  for (let i = 0; i < hash.length; i++) {
    const char = hash.charCodeAt(i);
    hashValue = (hashValue << 5) - hashValue + char;
    hashValue |= 0; // Convert to 32bit integer
  }
  return hashValue.toString();
};

/**
 * Hashing function to create a unique hash for lane boundary objects.
 *
 * The hashLanes function creates a hash by:
 *
 * - Concatenating the id values of all LaneBoundary objects.
 * - Iterating over the concatenated string and updating a hash value using bitwise operations.
 *
 * Note: This mechanism is a temporary solution to demonstrate the feasibility of caching as it relies on the assumption that a lane with the same id will always have the same properties.
 * This might not be the case when using partial chunking of lanes/lane boundaries.
 */
const hashLaneBoundaries = (laneBoundaries: LaneBoundary[]): string => {
  const hash = laneBoundaries.reduce(
    (acc, laneBoundary) => acc + laneBoundary.id!.value!.toString(),
    "",
  );
  let hashValue = 0;
  for (let i = 0; i < hash.length; i++) {
    const char = hash.charCodeAt(i);
    hashValue = (hashValue << 5) - hashValue + char;
    hashValue |= 0; // Convert to 32bit integer
  }
  return hashValue.toString();
};

/**
 * Identifies and returns entities that have been deleted between frames based on their IDs.
 * Updates the set of IDs from the current frame for future comparisons.
 *
 * @template T - The type of the entities, which must include an `id` property with a `value` of type `number`.
 *
 * @param osiEntities - The array of entities from the current frame, with all properties deeply required.
 * @param previousFrameIds - A set of IDs from the previous frame to compare against.
 * @param entityPrefix - A string prefix to prepend to the deleted entity IDs in the result.
 * @param timestamp - The timestamp to associate with the deleted entities.
 *
 * @returns An array of partial scene entities representing the deleted entities,
 *          each containing an ID, timestamp, and deletion type.
 */
function getDeletedEntities<T extends { id: { value: number } }>(
  osiEntities: DeepRequired<T[]>,
  previousFrameIds: Set<number>,
  entityPrefix: string,
  timestamp: Time,
): PartialSceneEntity[] {
  const currentIds = new Set(osiEntities.map((entity) => entity.id.value));
  const deletedIds = Array.from(previousFrameIds).filter((id) => !currentIds.has(id));
  previousFrameIds.clear();
  currentIds.forEach((id) => previousFrameIds.add(id));
  return deletedIds.map((id) => ({
    id: generateSceneEntityId(entityPrefix, id),
    timestamp,
    type: SceneEntityDeletionType.MATCHING_ID,
  }));
}

export function activate(extensionContext: ExtensionContext): void {
  preloadDynamicTextures();

  let groundTruthFrameCache = new WeakMap<GroundTruth, PartialSceneEntity[]>(); // Weakly stores scene entities for each individual OSI ground truth frame
  const laneBoundaryCache = new Map<string, PartialSceneEntity[]>(); // Note: A maximum of one entry is kept in this cache.
  const laneCache = new Map<string, PartialSceneEntity[]>(); // Note: A maximum of one entry is kept in this cache.
  const modelCache = new Map<string, ModelPrimitive>(); // This cache will hold the first time loaded models with model path key

  const state = {
    previousMovingObjectIds: new Set<number>(),
    previousStationaryObjectIds: new Set<number>(),
    previousLaneBoundaryIds: new Set<number>(),
    previousLogicalLaneBoundaryIds: new Set<number>(),
    previousLaneIds: new Set<number>(),
    previousLogicalLaneIds: new Set<number>(),
    previousTrafficSignIds: new Set<number>(),
    previousTrafficLightIds: new Set<number>(),
    previousRoadMarkingIds: new Set<number>(),
    previousConfig: {} as Config | undefined,
  };

  const convertGroundTruthToSceneUpdate = (
    osiGroundTruth: GroundTruth,
    event?: Immutable<MessageEvent<GroundTruth>>,
  ): DeepPartial<SceneUpdate> => {
    let sceneEntities: PartialSceneEntity[] = [];
    let updateFlags: OSISceneEntitesUpdate = {
      movingObjects: true,
      stationaryObjects: true,
      trafficSigns: true,
      trafficLights: true,
      roadMarkings: true,
      laneBoundaries: true,
      logicalLaneBoundaries: true,
      lanes: true,
      logicalLanes: true,
    };

    const config = event?.topicConfig as Config | undefined;
    if (config && config !== state.previousConfig) {
      // Reset caches if configuration changed
      laneBoundaryCache.clear();
      laneCache.clear();
      modelCache.clear();
      groundTruthFrameCache = new WeakMap<GroundTruth, PartialSceneEntity[]>();
    }
    state.previousConfig = config;
    const caching = config?.caching;

    const osiGroundTruthReq = osiGroundTruth as DeepRequired<GroundTruth>;
    const timestamp = osiTimestampToTime(osiGroundTruthReq.timestamp);

    // Check OSI ground truth object deletions and store ids in state for next frame
    const deletionsMovingObjects = getDeletedEntities(
      osiGroundTruthReq.moving_object,
      state.previousMovingObjectIds,
      PREFIX_MOVING_OBJECT,
      timestamp,
    );
    const deletionsStationaryObjects = getDeletedEntities(
      osiGroundTruthReq.stationary_object,
      state.previousStationaryObjectIds,
      PREFIX_STATIONARY_OBJECT,
      timestamp,
    );
    const deletionsTrafficSigns = getDeletedEntities(
      osiGroundTruthReq.traffic_sign,
      state.previousTrafficSignIds,
      PREFIX_TRAFFIC_SIGN,
      timestamp,
    );
    const deletionsTrafficLights = getDeletedEntities(
      osiGroundTruthReq.traffic_light,
      state.previousTrafficLightIds,
      PREFIX_TRAFFIC_LIGHT,
      timestamp,
    );
    const deletionsRoadMarkings = getDeletedEntities(
      osiGroundTruthReq.road_marking,
      state.previousRoadMarkingIds,
      PREFIX_ROAD_MARKING,
      timestamp,
    );
    const deletionsLaneBoundaries = getDeletedEntities(
      config?.showPhysicalLanes === true ? osiGroundTruthReq.lane_boundary : [],
      state.previousLaneBoundaryIds,
      PREFIX_LANE_BOUNDARY,
      timestamp,
    );
    const deletionsLogicalLaneBoundaries = getDeletedEntities(
      config?.showLogicalLanes === true ? osiGroundTruthReq.logical_lane_boundary : [],
      state.previousLogicalLaneBoundaryIds,
      PREFIX_LOGICAL_LANE_BOUNDARY,
      timestamp,
    );
    const deletionsLanes = getDeletedEntities(
      config?.showPhysicalLanes === true ? osiGroundTruthReq.lane : [],
      state.previousLaneIds,
      PREFIX_LANE,
      timestamp,
    );
    const deletionsLogicalLanes = getDeletedEntities(
      config?.showLogicalLanes === true ? osiGroundTruthReq.logical_lane : [],
      state.previousLogicalLaneIds,
      PREFIX_LOGICAL_LANE,
      timestamp,
    );

    const deletions = [
      ...deletionsMovingObjects,
      ...deletionsStationaryObjects,
      ...deletionsTrafficSigns,
      ...deletionsTrafficLights,
      ...deletionsRoadMarkings,
      ...deletionsLaneBoundaries,
      ...deletionsLogicalLaneBoundaries,
      ...deletionsLanes,
      ...deletionsLogicalLanes,
    ];

    // Use cached scene entities if that exact OSI ground truth frame is cached
    if (groundTruthFrameCache.has(osiGroundTruth)) {
      return {
        deletions,
        entities: groundTruthFrameCache.get(osiGroundTruth),
      };
    }

    // Build scene entities from OSI ground truth or re-use partially cached entities
    try {
      let laneBoundaryHash: string | undefined;
      let laneHash: string | undefined;
      if (caching === true) {
        // Check if lane boundary hash has changed
        laneBoundaryHash = hashLaneBoundaries(osiGroundTruthReq.lane_boundary);
        if (laneBoundaryCache.has(laneBoundaryHash)) {
          sceneEntities = sceneEntities.concat(laneBoundaryCache.get(laneBoundaryHash)!);
          updateFlags = { ...updateFlags, laneBoundaries: false };
        }

        // Check if lane hash has changed
        laneHash = hashLanes(osiGroundTruthReq.lane);
        if (laneCache.has(laneHash)) {
          sceneEntities = sceneEntities.concat(laneCache.get(laneHash)!);
          updateFlags = { ...updateFlags, lanes: false };
        }
      }

      // Build scene entities from OSI ground truth for update flags set to true
      const {
        movingObjects,
        stationaryObjects,
        trafficSigns,
        trafficLights,
        roadMarkings,
        laneBoundaries,
        logicalLaneBoundaries,
        lanes,
        logicalLanes,
      } = buildSceneEntities(osiGroundTruthReq, updateFlags, config, modelCache);

      // Concatenate newly generated and cached scene entities
      sceneEntities = [
        ...sceneEntities, // contains cached scene entities already
        ...movingObjects,
        ...stationaryObjects,
        ...trafficSigns,
        ...trafficLights,
        ...roadMarkings,
        ...laneBoundaries,
        ...logicalLaneBoundaries,
        ...lanes,
        ...logicalLanes,
      ];

      // Store lane boundaries in cache
      if (caching === true && updateFlags.laneBoundaries && laneBoundaryHash) {
        laneBoundaryCache.clear(); // keep only one lane boundary in cache
        laneBoundaryCache.set(laneBoundaryHash, laneBoundaries);
      }

      // Store lanes in cache
      if (caching === true && updateFlags.lanes && laneHash) {
        laneCache.clear(); // keep only one lane in cache
        laneCache.set(laneHash, lanes);
      }

      // Store scene entities for current OSI ground truth frame in cache
      groundTruthFrameCache.set(osiGroundTruth, sceneEntities);
    } catch (error) {
      console.error(
        "OsiGroundTruthVisualizer: Error during message conversion:\n%s\nSkipping message! (Input message not compatible?)",
        error,
      );
    }

    return {
      deletions,
      entities: sceneEntities,
    };
  };

  const convertSensorDataToSceneUpdate = (
    osiSensorData: SensorData,
    event?: Immutable<MessageEvent<SensorData>>,
  ): DeepPartial<SceneUpdate> => {
    let sceneEntities: PartialSceneEntity[] = [];
    const config = event?.topicConfig as Config | undefined;

    try {
      sceneEntities = buildSensorDataSceneEntities(
        osiSensorData as DeepRequired<SensorData>,
        config,
        modelCache,
      );
    } catch (error) {
      console.error(
        "OsiSensorDataVisualizer: Error during message conversion:\n%s\nSkipping message! (Input message not compatible?)",
        error,
      );
    }
    return {
      deletions: [],
      entities: sceneEntities,
    };
  };

  const convertMotionRequestToSceneUpdate = (
    osiMotionRequest: MotionRequest,
    event?: Immutable<MessageEvent<MotionRequest>>,
  ): DeepPartial<SceneUpdate> => {
    let sceneEntities: PartialSceneEntity[] = [];
    const config = event?.topicConfig as Config | undefined;

    try {
      sceneEntities = buildMotionRequestSceneEntities(
        osiMotionRequest as DeepRequired<MotionRequest>,
        config,
      );
    } catch (error) {
      console.error(
        "OsiMotionRequestVisualizer: Error during message conversion:\n%s\nSkipping message! (Input message not compatible?)",
        error,
      );
    }
    return {
      deletions: [],
      entities: sceneEntities,
    };
  };

  const convertGroundTruthToFrameTransforms = (message: GroundTruth): FrameTransforms => {
    const transforms = { transforms: [] } as FrameTransforms;

    try {
      // Return empty FrameTransforms if host vehicle id is not set
      if (!message.host_vehicle_id) {
        console.error(
          "Missing host vehicle id GroundTruth message. Can not build FrameTransforms.",
        );
        return transforms;
      }

      // Return empty FrameTransforms if host vehicle is not contained in moving objects
      if (
        message.moving_object &&
        message.moving_object.some((obj) => obj.id?.value === message.host_vehicle_id?.value)
      ) {
        transforms.transforms.push(
          buildEgoVehicleBBCenterFrameTransform(message as DeepRequired<GroundTruth>),
        );
      } else {
        console.error("Host vehicle not found in moving objects");
        return transforms;
      }

      // Add rear axle FrameTransform if bbcenter_to_rear is set in vehicle attributes of ego vehicle
      if (
        message.moving_object.some(
          (obj) =>
            obj.id?.value === message.host_vehicle_id?.value &&
            obj.vehicle_attributes?.bbcenter_to_rear,
        )
      ) {
        transforms.transforms.push(
          buildEgoVehicleRearAxleFrameTransform(message as DeepRequired<GroundTruth>),
        );
      } else {
        console.warn(
          "bbcenter_to_rear not found in ego vehicle attributes. Can not build rear axle FrameTransform.",
        );
      }
    } catch (error) {
      console.error(
        "Error during FrameTransform message conversion:\n%s\nSkipping message! (Input message not compatible?)",
        error,
      );
    }

    return transforms;
  };

  const generatePanelSettings = <T>(obj: PanelSettings<T>) => obj as PanelSettings<unknown>;

  extensionContext.registerMessageConverter({
    fromSchemaName: "osi3.GroundTruth",
    toSchemaName: "foxglove.SceneUpdate",
    converter: convertGroundTruthToSceneUpdate,
  });

  extensionContext.registerMessageConverter({
    fromSchemaName: "osi3.SensorView",
    toSchemaName: "foxglove.SceneUpdate",
    converter: (osiSensorView: SensorView, event: Immutable<MessageEvent<SensorView>>) =>
      convertGroundTruthToSceneUpdate(osiSensorView.global_ground_truth!, event),
    panelSettings: {
      "3D": generatePanelSettings({
        settings: (config) => ({
          fields: {
            caching: {
              label: "Caching",
              input: "boolean",
              value: config?.caching,
              help: "Enables caching of lanes and lane boundaries.",
            },
            showAxes: {
              label: "Show axes",
              input: "boolean",
              value: config?.showAxes,
            },
            showPhysicalLanes: {
              label: "Show Physical Lanes",
              input: "boolean",
              value: config?.showPhysicalLanes,
            },
            showLogicalLanes: {
              label: "Show Logical Lanes",
              input: "boolean",
              value: config?.showLogicalLanes,
            },
            showBoundingBox: {
              label: "Show Bounding Box",
              input: "boolean",
              value: config?.showBoundingBox,
            },
            show3dModels: {
              label: "Show 3D Models",
              input: "boolean",
              value: config?.show3dModels,
            },
            defaultModelPath: {
              label: "Default 3D Model Path",
              input: "autocomplete",
              value: config?.defaultModelPath,
              items: [],
            },
          },
        }),
        handler: (action, config: Config | undefined) => {
          if (config == undefined) {
            return;
          }
          if (action.action === "update" && action.payload.path[2] === "caching") {
            config.caching = action.payload.value as boolean;
          }
          if (action.action === "update" && action.payload.path[2] === "showAxes") {
            config.showAxes = action.payload.value as boolean;
          }
          if (action.action === "update" && action.payload.path[2] === "showPhysicalLanes") {
            config.showPhysicalLanes = action.payload.value as boolean;
          }
          if (action.action === "update" && action.payload.path[2] === "showLogicalLanes") {
            config.showLogicalLanes = action.payload.value as boolean;
          }
          if (action.action === "update" && action.payload.path[2] === "showBoundingBox") {
            config.showBoundingBox = action.payload.value as boolean;
          }
          if (action.action === "update" && action.payload.path[2] === "show3dModels") {
            config.show3dModels = action.payload.value as boolean;
          }
          if (action.action === "update" && action.payload.path[2] === "defaultModelPath") {
            config.defaultModelPath = action.payload.value as string;
          }
        },
        defaultConfig: {
          caching: true,
          showAxes: true,
          showPhysicalLanes: true,
          showLogicalLanes: false,
          showBoundingBox: true,
          show3dModels: false,
          defaultModelPath: "/opt/models/vehicles/",
          trajectoryPointSize: 0.15,
        },
      }),
    },
  });

  extensionContext.registerMessageConverter({
    fromSchemaName: "osi3.SensorData",
    toSchemaName: "foxglove.SceneUpdate",
    converter: convertSensorDataToSceneUpdate,
    panelSettings: {
      "3D": generatePanelSettings({
        settings: (config) => ({
          fields: {
            caching: {
              label: "Enable caching",
              input: "boolean",
              value: config?.caching ?? true,
            },
            showAxes: {
              label: "Show axes",
              input: "boolean",
              value: config?.showAxes ?? true,
            },
            showPhysicalLanes: {
              label: "Show detected lane boundaries",
              input: "boolean",
              value: config?.showPhysicalLanes ?? true,
              help: "Display detected lane boundaries from sensor data",
            },
            showBoundingBox: {
              label: "Show bounding boxes",
              input: "boolean",
              value: config?.showBoundingBox ?? true,
              help: "Display bounding boxes for detected objects",
            },
            show3dModels: {
              label: "Show 3D models",
              input: "boolean",
              value: config?.show3dModels ?? false,
            },
            defaultModelPath: {
              label: "Default model path",
              input: "string",
              value: config?.defaultModelPath ?? "/opt/models/vehicles/",
              items: [],
            },
          },
        }),
        handler: (action, config: Config | undefined) => {
          if (config == undefined) {
            return;
          }
          if (action.action === "update" && action.payload.path[2] === "caching") {
            config.caching = action.payload.value as boolean;
          }
          if (action.action === "update" && action.payload.path[2] === "showAxes") {
            config.showAxes = action.payload.value as boolean;
          }
          if (action.action === "update" && action.payload.path[2] === "showPhysicalLanes") {
            config.showPhysicalLanes = action.payload.value as boolean;
          }
          if (action.action === "update" && action.payload.path[2] === "showBoundingBox") {
            config.showBoundingBox = action.payload.value as boolean;
          }
          if (action.action === "update" && action.payload.path[2] === "show3dModels") {
            config.show3dModels = action.payload.value as boolean;
          }
          if (action.action === "update" && action.payload.path[2] === "defaultModelPath") {
            config.defaultModelPath = action.payload.value as string;
          }
        },
        defaultConfig: {
          caching: true,
          showAxes: true,
          showPhysicalLanes: true,
          showLogicalLanes: false,
          showBoundingBox: true,
          show3dModels: false,
          defaultModelPath: "/opt/models/vehicles/",
          trajectoryPointSize: 0.15,
        },
      }),
    },
  });

  extensionContext.registerMessageConverter({
    fromSchemaName: "osi3.MotionRequest",
    toSchemaName: "foxglove.SceneUpdate",
    converter: convertMotionRequestToSceneUpdate,
    panelSettings: {
      "3D": generatePanelSettings({
        settings: (config) => ({
          fields: {
            trajectoryPointSize: {
              label: "Trajectory Point Size (meters)",
              input: "number",
              value: config?.trajectoryPointSize ?? 0.15,
              min: 0.05,
              max: 2.0,
              step: 0.05,
              help: "Size of the spheres marking trajectory waypoints",
            },
          },
        }),
        handler: (action, config: Config | undefined) => {
          if (config == undefined) {
            return;
          }
          if (action.action === "update" && action.payload.path[2] === "trajectoryPointSize") {
            config.trajectoryPointSize = action.payload.value as number;
          }
        },
        defaultConfig: {
          caching: true,
          showAxes: true,
          showPhysicalLanes: true,
          showLogicalLanes: false,
          showBoundingBox: true,
          show3dModels: false,
          defaultModelPath: "/opt/models/vehicles/",
          trajectoryPointSize: 0.15,
        },
      }),
    },
  });

  extensionContext.registerMessageConverter({
    fromSchemaName: "osi3.GroundTruth",
    toSchemaName: "foxglove.FrameTransforms",
    converter: convertGroundTruthToFrameTransforms,
  });

  extensionContext.registerMessageConverter({
    fromSchemaName: "osi3.SensorView",
    toSchemaName: "foxglove.FrameTransforms",
    converter: (message: SensorView) =>
      convertGroundTruthToFrameTransforms(message.global_ground_truth!),
  });
}
