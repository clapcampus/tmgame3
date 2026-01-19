/**
 * gameEngine.js
 * Fruit Catcher 게임 로직 구현
 *
 * 3개 레일(왼쪽, 중앙, 오른쪽)에서 떨어지는 과일을 받는 게임
 * - 포즈: '왼쪽', '정면', '오른쪽'
 * - 아이템: 사과(+100), 포도(+200), 폭탄(GameOver)
 */

class GameEngine {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.timeLimit = 60;
    this.isGameActive = false;

    // 게임 상태
    this.basketPosition = 1; // 0: Left, 1: Center, 2: Right
    this.items = []; // 떨어지는 아이템 배열
    this.spawnTimer = 0;

    // 설정 (600x600 해상도 기준)
    this.lanes = [100, 300, 500]; // 3개 구역의 중심점 (0~200, 200~400, 400~600)
    this.spawnInterval = 60; // 아이템 생성 주기 (프레임 단위)
    this.dropSpeed = 3; // 화면이 커졌으니 속도도 약간 증가

    // 콜백
    this.onGameEnd = null;
  }

  /**
   * 게임 시작
   * @param {Object} config 
   */
  start(config = {}) {
    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.timeLimit = config.timeLimit || 60;

    this.items = [];
    this.basketPosition = 1; // 중앙 시작
    this.spawnTimer = 0;

    // 타이머 시작
    this.startTime = Date.now();
  }

  /**
   * 게임 중지
   */
  stop() {
    this.isGameActive = false;
    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level);
    }
  }

  /**
   * 게임 종료 콜백 설정
   */
  setGameEndCallback(callback) {
    this.onGameEnd = callback;
  }

  /**
   * 포즈 감지 시 호출
   * @param {string} poseName 
   */
  onPoseDetected(poseName) {
    if (!this.isGameActive) return;

    // 포즈에 따라 바구니 위치 변경 (즉시 이동)
    if (poseName === "왼쪽") {
      this.basketPosition = 0;
    } else if (poseName === "정면") {
      this.basketPosition = 1;
    } else if (poseName === "오른쪽") {
      this.basketPosition = 2;
    }
  }

  /**
   * 게임 상태 업데이트 (매 프레임 호출)
   */
  update() {
    if (!this.isGameActive) return;

    // 1. 시간 체크
    const elapsed = (Date.now() - this.startTime) / 1000;
    const remaining = this.timeLimit - elapsed;

    // 레벨 업데이트 (20초마다)
    if (elapsed < 20) this.level = 1;
    else if (elapsed < 40) this.level = 2;
    else this.level = 3;

    if (remaining <= 0) {
      this.stop();
      return;
    }

    // 2. 아이템 생성 (레벨에 따라 속도 조절)
    this.spawnTimer++;
    const currentSpawnInterval = Math.max(20, 60 - (this.level * 10)); // 레벨 높을수록 자주 생성

    if (this.spawnTimer > currentSpawnInterval) {
      this.spawnItem();
      this.spawnTimer = 0;
    }

    // 3. 아이템 이동 및 충돌 처리
    this.updateItems();
  }

  /**
   * 아이템 생성
   */
  spawnItem() {
    const laneIndex = Math.floor(Math.random() * 3); // 0, 1, 2 중 랜덤
    const typeRoll = Math.random();

    let type = "apple";
    if (this.level >= 2 && typeRoll > 0.8) {
      // 레벨 2 이상, 20% 확률로 폭탄
      type = "bomb";
    } else if (typeRoll > 0.6) {
      // 40% 확률로 포도 (폭탄 아닐 때)
      type = "grape";
    }

    this.items.push({
      x: this.lanes[laneIndex],
      y: -50, // 시작 위치 조금 더 위
      lane: laneIndex,
      type: type,
      active: true
    });
  }

  /**
   * 아이템 이동 및 로직
   */
  updateItems() {
    // 낙하 속도 (레벨 비례)
    const speed = 3 + (this.level * 2); // 속도 스케일링

    for (let i = 0; i < this.items.length; i++) {
      let item = this.items[i];
      if (!item.active) continue;

      item.y += speed;

      // 충돌 체크 (바구니 Y위치: 500 근처)
      // 판정 범위: 500~560
      if (item.y > 500 && item.y < 560 && item.lane === this.basketPosition) {
        this.handleCollision(item);
      }

      // 화면 밖으로 나가면 제거 (600px 기준)
      if (item.y > 650) {
        item.active = false;
      }
    }

    // 비활성 아이템 제거
    this.items = this.items.filter(item => item.active);
  }

  /**
   * 충돌 처리
   */
  handleCollision(item) {
    if (item.type === "bomb") {
      item.active = false;
      this.stop(); // 게임 오버
    } else {
      item.active = false;
      if (item.type === "apple") this.score += 100;
      if (item.type === "grape") this.score += 200;

      // 효과음이나 파티클 효과 추가 가능
    }
  }

  /**
   * 화면 그리기
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    // 0. 가이드라인 그리기 (선택)
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(200, 0); ctx.lineTo(200, 600);
    ctx.moveTo(400, 0); ctx.lineTo(400, 600);
    ctx.stroke();

    // 1. 바구니 그리기
    const basketX = this.lanes[this.basketPosition];
    ctx.fillStyle = "orange";
    ctx.font = "80px sans-serif"; // 크기 확대
    ctx.textAlign = "center";
    ctx.fillText("🧺", basketX, 550); // 위치 조정

    // 2. 아이템 그리기
    for (let item of this.items) {
      let icon = "🍎";
      if (item.type === "grape") icon = "🍇";
      if (item.type === "bomb") icon = "💣";

      ctx.font = "60px sans-serif"; // 크기 확대
      ctx.fillText(icon, item.x, item.y);
    }

    // 3. UI 그리기 (점수, 시간)
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 4;
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "left";

    // 점수
    const scoreText = `Score: ${this.score}`;
    ctx.strokeText(scoreText, 20, 50);
    ctx.fillText(scoreText, 20, 50);

    // 시간
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const remaining = Math.max(0, this.timeLimit - elapsed);
    const timeText = `Time: ${remaining}`;
    ctx.strokeText(timeText, 450, 50);
    ctx.fillText(timeText, 450, 50);

    // 레벨 표시
    ctx.fillStyle = "yellow";
    ctx.fillText(`Lv.${this.level}`, 20, 90);
  }
}

// 전역으로 내보내기
window.GameEngine = GameEngine;
