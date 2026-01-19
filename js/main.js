/**
 * main.js
 * 포즈 인식과 게임 로직을 초기화하고 서로 연결하는 진입점
 *
 * PoseEngine, GameEngine, Stabilizer를 조합하여 애플리케이션을 구동
 */

// 전역 변수
let poseEngine;
let gameEngine;
let stabilizer;
let ctx;
let labelContainer;

/**
 * 애플리케이션 초기화
 */
async function init() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  startBtn.disabled = true;

  try {
    // 1. PoseEngine 초기화
    poseEngine = new PoseEngine("./my_model/");
    const { maxPredictions, webcam } = await poseEngine.init({
      size: 200,
      flip: true
    });

    // 2. Stabilizer 초기화
    stabilizer = new PredictionStabilizer({
      threshold: 0.7,
      smoothingFrames: 3
    });

    // 3. GameEngine 초기화
    gameEngine = new GameEngine();

    // 4. 캔버스 설정 (게임 화면)
    const canvas = document.getElementById("canvas");
    canvas.width = 600;
    canvas.height = 600;
    ctx = canvas.getContext("2d");

    // 4-1. 웹캠 캔버스 배치
    const webcamContainer = document.getElementById("webcam-container");
    webcamContainer.innerHTML = "";
    webcamContainer.appendChild(poseEngine.webcam.canvas); // 웹캠 화면을 왼쪽에 배치

    // 5. Label Container 설정
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = ""; // 초기화
    for (let i = 0; i < maxPredictions; i++) {
      labelContainer.appendChild(document.createElement("div"));
    }

    // 6. PoseEngine 콜백 설정
    poseEngine.setPredictionCallback(handlePrediction);
    poseEngine.setDrawCallback(drawPose);

    // 7. PoseEngine 시작
    poseEngine.start();

    // 8. 게임 모드 자동 시작
    startGameMode({
      timeLimit: 60,
      commands: ["왼쪽", "정면", "오른쪽"]
    });

    stopBtn.disabled = false;
  } catch (error) {
    console.error("초기화 중 오류 발생:", error);
    alert("초기화에 실패했습니다. 콘솔을 확인하세요.");
    startBtn.disabled = false;
  }
}

/**
 * 애플리케이션 중지
 */
function stop() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (poseEngine) {
    poseEngine.stop();
  }

  if (gameEngine && gameEngine.isGameActive) {
    gameEngine.stop();
  }

  if (stabilizer) {
    stabilizer.reset();
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
}

/**
 * 예측 결과 처리 콜백
 * @param {Array} predictions - TM 모델의 예측 결과
 * @param {Object} pose - PoseNet 포즈 데이터
 */
function handlePrediction(predictions, pose) {
  // 1. Stabilizer로 예측 안정화
  const stabilized = stabilizer.stabilize(predictions);

  // 2. Label Container 업데이트
  for (let i = 0; i < predictions.length; i++) {
    const classPrediction =
      predictions[i].className + ": " + predictions[i].probability.toFixed(2);
    labelContainer.childNodes[i].innerHTML = classPrediction;
  }

  // 3. 최고 확률 예측 표시
  const maxPredictionDiv = document.getElementById("max-prediction");
  maxPredictionDiv.innerHTML = stabilized.className || "감지 중...";

  // 4. GameEngine에 포즈 전달
  if (gameEngine && gameEngine.isGameActive && stabilized.className) {
    gameEngine.onPoseDetected(stabilized.className);
  }
}

/**
 * 포즈 그리기 콜백
 * @param {Object} pose - PoseNet 포즈 데이터
 */
function drawPose(pose) {
  // 1. 웹캠 캔버스에 스켈레톤 그리기 (선택사항)
  if (poseEngine.webcam && poseEngine.webcam.canvas && pose) {
    const webcamCtx = poseEngine.webcam.canvas.getContext("2d");
    // 웹캠 이미지는 이미 update()에서 그려짐 (TM 라이브러리 내부) -> 아님, TM Webcam play()는 비디오를 캔버스에 그리는 루프를 돌리지 않음. PoseEngine.loop에서 this.webcam.update()가 그 역할을 함.
    // PoseEngine.loop -> webcam.update() -> draws video to webcam.canvas

    // 따라서 여기서는 스켈레톤만 덧칠하면 됨
    const minPartConfidence = 0.5;
    tmPose.drawKeypoints(pose.keypoints, minPartConfidence, webcamCtx);
    tmPose.drawSkeleton(pose.keypoints, minPartConfidence, webcamCtx);
  }

  // 2. 게임 엔진 렌더링 (게임 화면)
  // 게임 캔버스는 매 프레임 클리어 필요 (웹캠 이미지가 안 깔리므로)
  if (gameEngine && gameEngine.isGameActive) {
    ctx.clearRect(0, 0, 600, 600); // 이전 프레임 지우기

    // 이펙트나 배경이 필요하면 여기서 그림
    // ctx.fillStyle = "#111";
    // ctx.fillRect(0,0,600,600);

    gameEngine.update(); // 게임 상태 업데이트
    gameEngine.render(ctx); // 게임 화면 그리기
  }
}

// 게임 모드 시작 함수
function startGameMode(config) {
  if (!gameEngine) {
    console.warn("GameEngine이 초기화되지 않았습니다.");
    return;
  }

  gameEngine.setGameEndCallback((finalScore, finalLevel) => {
    // 100ms 딜레이 후 알림 (렌더링 꼬임 방지)
    setTimeout(() => {
      alert(`게임 종료!\n최종 점수: ${finalScore}\n최종 레벨: ${finalLevel}`);
    }, 100);
  });

  gameEngine.start(config);
}
