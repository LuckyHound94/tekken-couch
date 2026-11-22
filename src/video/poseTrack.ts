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
let clock = 0;

function engine(): Promise<PoseLandmarker | null> {
  if (!loading) {
    loading = FilesetResolver.forVisionTasks("/pose/wasm")
      .then((wasm) =>
        PoseLandmarker.createFromOptions(wasm, {
          baseOptions: { modelAssetPath: "/pose/pose_landmarker_lite.task", delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 2,
        }),
      )
      .catch(() => null);
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

export async function detectPoses(frame: HTMLCanvasElement, width: number, height: number, time: number): Promise<PoseSample[]> {
  const landmarker = await engine();
  if (!landmarker || width < 2 || height < 2) return [];
  clock = Math.max(clock + 1, Math.round(time * 1000));
  let landmarks: NormalizedLandmark[][] = [];
  try {
    landmarks = landmarker.detectForVideo(frame, clock).landmarks ?? [];
  } catch {
    return [];
  }
  const samples: PoseSample[] = [];
  for (const person of landmarks) {
    if (person.length < 29) continue;
    const hipX = (person[JOINTS.leftHip].x + person[JOINTS.rightHip].x) / 2;
    const side: "left" | "right" = hipX < 0.5 ? "left" : "right";
    const pose = normalizeBody(rawBody(person), side === "left" ? 1 : -1);
    if (!pose) continue;
    const forward = (side === "left" ? 1 : -1) * hipX;
    samples.push({ time, side, pose, forward });
  }
  return samples;
}
