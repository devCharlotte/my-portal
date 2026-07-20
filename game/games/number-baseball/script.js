// 게임의 정답을 생성하고 시도 횟수를 초기화
const answer = createAnswer();
let attempts = 0;

// 정답 생성 함수
function createAnswer() {
    const digits = new Set();
    while (digits.size < 4) {
        digits.add(Math.floor(Math.random() * 10));
    }
    return Array.from(digits).join('');
}

// 게임 실행 함수
function playGame() {
    const userInput = document.getElementById('userInput').value;
    const message = document.getElementById('message');
    const log = document.getElementById('log');

    if (!validateInput(userInput)) {
        message.textContent = '잘못된 입력입니다. 4개의 서로 다른 숫자를 입력하세요.';
        return;
    }

    attempts++;
    const { strike, ball } = evaluateGuess(userInput);

    if (strike === 4) {
        message.textContent = `축하합니다! 정답입니다. (${attempts}번 시도)`;
        log.innerHTML += `<li>${userInput} - 정답!</li>`;
    } else {
        message.textContent = `${strike} 스트라이크, ${ball} 볼`;
        log.innerHTML += `<li>${userInput} - ${strike}S ${ball}B</li>`;
    }
}

// 입력값 검증 함수
function validateInput(input) {
    if (input.length !== 4 || !/^[0-9]+$/.test(input)) return false;
    const uniqueDigits = new Set(input);
    return uniqueDigits.size === 4;
}

// 입력값과 정답 비교 함수
function evaluateGuess(input) {
    let strike = 0;
    let ball = 0;

    for (let i = 0; i < input.length; i++) {
        if (input[i] === answer[i]) {
            strike++;
        } else if (answer.includes(input[i])) {
            ball++;
        }
    }

    return { strike, ball };
}

// 디버깅용 정답 출력
console.log("정답:", answer);
