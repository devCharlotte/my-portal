import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const TIP_IDS = [4, 8, 12, 16, 20];
const PIP_IDS = [3, 6, 10, 14, 18];
const PALM_IDS = [0, 5, 9, 13, 17];

export class GestureWheel {
  constructor(videoEl) {
    this.videoEl = videoEl;
    this.landmarker = null;
    this.lastVideoTime = -1;
    this.results = null;
    this.state = { steer: 0, throttle: 0, brake: false, handsOn: false, hands: [] };
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
    });
  }

  async startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 960, height: 720, facingMode: "user" },
      audio: false,
    });
    this.videoEl.srcObject = stream;
    await new Promise((resolve) => { this.videoEl.onloadedmetadata = resolve; });
    await this.videoEl.play();
  }

  getSnapshot() {
    return this.state;
  }

  step(timestamp) {
    if (!this.landmarker || this.videoEl.readyState < 2) return this.state;

    if (this.videoEl.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.videoEl.currentTime;
      this.results = this.landmarker.detectForVideo(this.videoEl, timestamp);
    }

    const hands = this.results?.landmarks ?? [];
    let steerTarget = 0;
    let throttleTarget = 0;
    let brake = false;
    const handsOn = hands.length >= 2;

    if (handsOn) {
      const centers = hands.map((hand) => this.#palmCenter(hand));
      const left = centers[0].x <= centers[1].x ? centers[0] : centers[1];
      const right = centers[0].x <= centers[1].x ? centers[1] : centers[0];
      const wheelAngle = Math.atan2(right.y - left.y, right.x - left.x);
      steerTarget = this.#clamp(wheelAngle / 0.62, -1, 1);

      const gripAvg = hands.reduce((sum, hand) => sum + this.#gripAmount(hand), 0) / hands.length;
      throttleTarget = this.#clamp((gripAvg - 0.22) / 0.64, 0, 1);

      const averageHeight = (left.y + right.y) * 0.5;
      if (averageHeight < 0.28) {
        brake = true;
        throttleTarget = 0;
      }
    }

    this.state = {
      steer: this.state.steer + (steerTarget - this.state.steer) * 0.34,
      throttle: this.state.throttle + (throttleTarget - this.state.throttle) * 0.18,
      brake,
      handsOn,
      hands,
    };
    return this.state;
  }

  draw(canvas, ctx) {
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const hands = this.results?.landmarks ?? [];
    if (!hands.length) return;

    const links = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],[0,17],
    ];

    ctx.strokeStyle = "rgba(106, 240, 255, 0.92)";
    ctx.fillStyle = "rgba(255, 113, 185, 0.95)";
    ctx.lineWidth = 3;

    for (const hand of hands) {
      for (const [a, b] of links) {
        ctx.beginPath();
        ctx.moveTo(hand[a].x * width, hand[a].y * height);
        ctx.lineTo(hand[b].x * width, hand[b].y * height);
        ctx.stroke();
      }
      for (const point of hand) {
        ctx.beginPath();
        ctx.arc(point.x * width, point.y * height, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  #palmCenter(landmarks) {
    let x = 0;
    let y = 0;
    for (const index of PALM_IDS) {
      x += landmarks[index].x;
      y += landmarks[index].y;
    }
    return { x: 1 - x / PALM_IDS.length, y: y / PALM_IDS.length };
  }

  #gripAmount(landmarks) {
    const dx = landmarks[9].x - landmarks[0].x;
    const dy = landmarks[9].y - landmarks[0].y;
    const handScale = Math.hypot(dx, dy) || 1e-3;
    let extended = 0;
    for (let finger = 1; finger < 5; finger += 1) {
      const tip = landmarks[TIP_IDS[finger]];
      const pip = landmarks[PIP_IDS[finger]];
      const tipDistance = Math.hypot(tip.x - landmarks[0].x, tip.y - landmarks[0].y);
      const pipDistance = Math.hypot(pip.x - landmarks[0].x, pip.y - landmarks[0].y);
      if (tipDistance > pipDistance + handScale * 0.15) extended += 1;
    }
    return 1 - extended / 4;
  }

  #clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}
