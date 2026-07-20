import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// HandLandmarker landmark indices
const WRIST = 0;
const TIPS = [4, 8, 12, 16, 20];      // 손가락 끝
const PIPS = [3, 6, 10, 14, 18];      // 그 아래 관절
const PALM = [0, 5, 9, 13, 17];       // 손바닥 둘레(중심 계산용)

// ----- 입력 튜닝 파라미터 -----
const STEER_MAX_ANGLE = 0.6;   // 약 34°에서 풀 조향
const STEER_DEADZONE  = 0.045; // 중앙 미세 떨림 제거
const STEER_TAU       = 0.075; // 조향 시정수(작을수록 즉각적)
const THROTTLE_TAU    = 0.16;  // 가속 시정수(클수록 부드러움)
const GRIP_LOW        = 0.25;  // 이 이하 grip은 0% 가속
const GRIP_SPAN       = 0.6;   // grip 0.25~0.85 → 가속 0~100%
const BRAKE_ON_Y      = 0.26;  // 양손 평균 높이가 이보다 위면 브레이크 진입
const BRAKE_OFF_Y     = 0.33;  // 이보다 내려오면 브레이크 해제(히스테리시스)
const HANDS_GRACE     = 0.18;  // 양손 일시 유실 시 입력 유지 시간(s)

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp11 = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);

/**
 * 웹캠 + MediaPipe 손 추적을 캡슐화한다.
 * 매 프레임 read(ts)를 호출하면 조향/스로틀/브레이크 상태를 돌려준다.
 * 스무딩은 프레임레이트와 무관하게 동일한 느낌이 나도록 시정수 기반(지수 감쇠)으로 처리한다.
 */
export class HandController {
  constructor(video) {
    this.video = video;
    this.landmarker = null;
    this.lastVideoTime = -1;
    this.lastDetectTs = -1;
    this.results = null;

    // 부드러운 입력값(시정수 기반 저역통과 필터)
    this.steer = 0;     // -1(좌) ~ +1(우)
    this.throttle = 0;  // 0 ~ 1
    this.handsOn = false;
    this.brake = false;

    // 타이밍/안정화 상태
    this.lastTs = -1;
    this.lastTwoHandsTs = -1e9;
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(WASM);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
      // 추적 안정성 향상(깜빡임/오검출 감소)
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  async startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = stream;
    await new Promise((res) => (this.video.onloadedmetadata = res));
    await this.video.play();
  }

  /**
   * 탭 전환 등으로 시간 흐름이 끊긴 뒤 호출하면 dt 급변·타임스탬프 역행을 방지한다.
   */
  resetTiming() {
    this.lastTs = -1;
    this.lastVideoTime = -1;
  }

  /** 손바닥 중심 (거울 좌표: x는 1-x 로 반전) */
  _palmCenter(lm) {
    let x = 0, y = 0;
    for (const i of PALM) { x += lm[i].x; y += lm[i].y; }
    return { x: 1 - x / PALM.length, y: y / PALM.length };
  }

  /** 주먹 쥔 정도 0(활짝) ~ 1(꽉) */
  _grip(lm) {
    // 손 크기(손목→중지 첫 관절)로 정규화
    const dx = lm[9].x - lm[0].x, dy = lm[9].y - lm[0].y;
    const size = Math.hypot(dx, dy) || 1e-3;
    let extended = 0;
    // 엄지 제외 네 손가락: 끝이 PIP보다 손목에서 멀면 '펴짐'
    for (let f = 1; f < 5; f++) {
      const tip = lm[TIPS[f]], pip = lm[PIPS[f]];
      const dTip = Math.hypot(tip.x - lm[0].x, tip.y - lm[0].y);
      const dPip = Math.hypot(pip.x - lm[0].x, pip.y - lm[0].y);
      if (dTip > dPip + size * 0.15) extended++;
    }
    return 1 - extended / 4; // 펴진 손가락이 적을수록 grip↑
  }

  /** 중앙 데드존 적용 후 -1~1 범위를 그대로 유지하도록 재정규화 */
  _applyDeadzone(v) {
    const a = Math.abs(v);
    if (a < STEER_DEADZONE) return 0;
    const sign = v < 0 ? -1 : 1;
    return sign * (a - STEER_DEADZONE) / (1 - STEER_DEADZONE);
  }

  /**
   * 한 프레임 처리. ts = performance.now()
   * @returns {{steer:number, throttle:number, handsOn:boolean, brake:boolean, hands:Array}}
   */
  read(ts) {
    // dt 계산(프레임레이트 독립 스무딩용). 첫 호출/탭 복귀 시 dt 보호.
    const dt = this.lastTs < 0 ? 0.016 : Math.min(0.1, Math.max(0, (ts - this.lastTs) / 1000));
    this.lastTs = ts;

    if (!this.landmarker || this.video.readyState < 2) return this._state();

    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      // MediaPipe VIDEO 모드는 단조 증가 타임스탬프를 요구 → 역행 방지
      const stamp = ts <= this.lastDetectTs ? this.lastDetectTs + 1 : ts;
      this.lastDetectTs = stamp;
      try {
        this.results = this.landmarker.detectForVideo(this.video, stamp);
      } catch (_) {
        // 한 프레임 실패는 무시하고 직전 결과를 유지(루프가 끊기지 않도록)
      }
    }

    const lms = this.results?.landmarks ?? [];
    const twoHandsNow = lms.length >= 2;
    if (twoHandsNow) this.lastTwoHandsTs = ts;
    // 양손이 잠깐(1~2프레임) 사라져도 입력이 뚝 끊기지 않도록 유예
    const handsOn = twoHandsNow || (ts - this.lastTwoHandsTs) < HANDS_GRACE * 1000;

    let targetSteer = this.steer;   // 유예 구간 기본값: 직전 조향 유지
    let targetThrottle = 0;         // 유예 구간 기본값: 가속 해제(서서히 코스팅)
    let brake = this.brake;

    if (twoHandsNow) {
      // 두 손바닥 중심(거울 좌표) 중 화면상 좌/우 결정
      const a = this._palmCenter(lms[0]);
      const b = this._palmCenter(lms[1]);
      const left = a.x <= b.x ? a : b;
      const right = a.x <= b.x ? b : a;

      // 두 손을 잇는 선의 기울기 → 핸들 각도
      const angle = Math.atan2(right.y - left.y, right.x - left.x);
      targetSteer = this._applyDeadzone(clamp11(angle / STEER_MAX_ANGLE));

      // 양손 grip 평균 → 가속
      const grip = (this._grip(lms[0]) + this._grip(lms[1])) / 2;
      targetThrottle = clamp01((grip - GRIP_LOW) / GRIP_SPAN);

      // 양손을 화면 위쪽으로 높이 들면 브레이크(히스테리시스로 깜빡임 방지)
      const avgY = (left.y + right.y) / 2;
      if (!brake && avgY < BRAKE_ON_Y) brake = true;
      else if (brake && avgY > BRAKE_OFF_Y) brake = false;
      if (brake) targetThrottle = 0;
    } else {
      // 유예 구간: 조향은 중앙으로 서서히 복원, 브레이크는 해제
      targetSteer = this.steer * 0.9;
      brake = false;
    }

    // 시정수 기반 지수 스무딩(프레임레이트 무관)
    const aSteer = 1 - Math.exp(-dt / STEER_TAU);
    const aThrottle = 1 - Math.exp(-dt / THROTTLE_TAU);
    this.steer    += (targetSteer    - this.steer)    * aSteer;
    this.throttle += (targetThrottle - this.throttle) * aThrottle;
    if (Math.abs(this.steer) < 1e-3) this.steer = 0;
    this.handsOn = handsOn;
    this.brake = handsOn ? brake : false;
    return this._state();
  }

  _state() {
    return {
      steer: this.steer,
      throttle: this.throttle,
      handsOn: this.handsOn,
      brake: this.brake,
      hands: this.results?.landmarks ?? [],
    };
  }

  /** 미리보기 캔버스에 손 랜드마크 그리기 (거울 모드 캔버스 위) */
  drawOverlay(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    const lms = this.results?.landmarks ?? [];
    if (!lms.length) return;

    const conn = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],[0,17],
    ];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const lm of lms) {
      ctx.strokeStyle = "rgba(0,229,255,0.85)";
      ctx.lineWidth = 3;
      for (const [s, e] of conn) {
        ctx.beginPath();
        ctx.moveTo(lm[s].x * w, lm[s].y * h);
        ctx.lineTo(lm[e].x * w, lm[e].y * h);
        ctx.stroke();
      }
      ctx.fillStyle = "#ff3d7f";
      for (const p of lm) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
