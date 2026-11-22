import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { normalizeBody, type PoseSample, type RawBody } from "../domain/pose";

const JOINTS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

let loading: Promise<PoseLandmarker | null> | null = null;
let failures = 0;

function engine(): Promise<PoseLandmarker | null> {
  if (failures >= 2) return Promise.resolve(null);
  if (!loading) {
    loading = FilesetResolver.forVisionTasks("/pose/wasm")
      .then((wasm) =>
        PoseLandmarker.createFromOptions(wasm, {
          baseOptions: { modelAssetPath: "/pose/pose_landmarker_lite.task", delegate: "CPU" },
          runningMode: "IMAGE",
          numPoses: 1,
          minPoseDetectionConfidence: 0.3,
          minPosePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        }),
      )
      .catch(() => {
        failures += 1;
        loading = null;
        return null;
      });
  }
  return loading;
}

function rawBody(landmarks: NormalizedLandmark[]): RawBody {
  const joint = (index: number) => ({
    x: landmarks[index].x,
    y: landmarks[index].y,
    visibility: landmarks[index].visibility,
  });
  return {
    leftShoulder: joint(JOINTS.leftShoulder),
    rightShoulder: joint(JOINTS.rightShoulder),
    leftElbow: joint(JOINTS.leftElbow),
    rightElbow: joint(JOINTS.rightElbow),
    leftWrist: joint(JOINTS.leftWrist),
    rightWrist: joint(JOINTS.rightWrist),
    leftHip: joint(JOINTS.leftHip),
    rightHip: joint(JOINTS.rightHip),
    leftKnee: joint(JOINTS.leftKnee),
    rightKnee: joint(JOINTS.rightKnee),
    leftAnkle: joint(JOINTS.leftAnkle),
    rightAnkle: joint(JOINTS.rightAnkle),
  };
}

export async function detectPoses(
  frame: HTMLCanvasElement,
  time: number,
  side: "left" | "right",
): Promise<PoseSample | null> {
  const landmarker = await engine();
  if (!landmarker || frame.width < 2 || frame.height < 2) return null;
  let person: NormalizedLandmark[] | undefined;
  try {
    person = landmarker.detect(frame).landmarks?.[0];
  } catch {
    return null;
  }
  if (!person || person.length < 29) return null;
  const pose = normalizeBody(rawBody(person), side === "left" ? 1 : -1);
  if (!pose) return null;
  const hipX = (person[JOINTS.leftHip].x + person[JOINTS.rightHip].x) / 2;
  const screenX = side === "left" ? hipX * 0.5 : 0.5 + hipX * 0.5;
  return { time, side, pose, forward: side === "left" ? screenX : 1 - screenX };
}
