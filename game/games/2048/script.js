// HTML 구조와 연결된 주요 요소
const gameBoard = document.getElementById('game-container');
const resetBtn = document.getElementById('reset-button');
const directionBtns = document.querySelectorAll('.control-btn');

// 게임 설정
const boardSize = 4;
let board = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));

// 게임 초기화
function startGame() {
    board = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
    spawnTile();
    spawnTile();
    updateBoard();
}

// 빈 공간에 새 타일 추가
function spawnTile() {
    const emptyCells = [];
    board.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (cell === 0) emptyCells.push({ row: rowIndex, col: colIndex });
        });
    });

    if (emptyCells.length === 0) return;

    const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    board[row][col] = Math.random() > 0.1 ? 2 : 4;
}

// 화면에 보드 렌더링
function updateBoard() {
    gameBoard.innerHTML = '';
    board.forEach(row => {
        row.forEach(value => {
            const tile = document.createElement('div');
            tile.classList.add('grid');
            if (value > 0) {
                tile.classList.add(`tile-${value}`);
                tile.textContent = value;
            }
            gameBoard.appendChild(tile);
        });
    });
}

// 방향 이동 처리
function moveTiles(direction) {
    const before = JSON.stringify(board);
    switch (direction) {
        case 'up':
            moveUp();
            break;
        case 'down':
            moveDown();
            break;
        case 'left':
            moveLeft();
            break;
        case 'right':
            moveRight();
            break;
    }
    if (JSON.stringify(board) !== before) {
        spawnTile();
    }
    updateBoard();
}

function mergeLine(line) {
    const filtered = line.filter(val => val !== 0);
    const merged = [];
    for (let i = 0; i < filtered.length; i++) {
        if (filtered[i] === filtered[i + 1]) {
            merged.push(filtered[i] * 2);
            i++;
        } else {
            merged.push(filtered[i]);
        }
    }
    return merged;
}

// 왼쪽으로 이동
function moveLeft() {
    board.forEach((row, rowIndex) => {
        const merged = mergeLine(row);
        board[rowIndex] = [...merged, ...Array(boardSize - merged.length).fill(0)];
    });
}

// 오른쪽으로 이동
function moveRight() {
    board.forEach((row, rowIndex) => {
        const merged = mergeLine([...row].reverse()).reverse();
        board[rowIndex] = [...Array(boardSize - merged.length).fill(0), ...merged];
    });
}

// 위로 이동
function moveUp() {
    for (let col = 0; col < boardSize; col++) {
        const column = board.map(row => row[col]);
        const merged = mergeLine(column);
        const updated = [...merged, ...Array(boardSize - merged.length).fill(0)];
        board.forEach((row, rowIndex) => {
            row[col] = updated[rowIndex];
        });
    }
}

// 아래로 이동
function moveDown() {
    for (let col = 0; col < boardSize; col++) {
        const column = board.map(row => row[col]);
        const merged = mergeLine([...column].reverse()).reverse();
        const updated = [...Array(boardSize - merged.length).fill(0), ...merged];
        board.forEach((row, rowIndex) => {
            row[col] = updated[rowIndex];
        });
    }
}

// 이벤트 설정
resetBtn.addEventListener('click', startGame);
directionBtns.forEach(button => {
    button.addEventListener('click', () => moveTiles(button.dataset.direction));
});

document.addEventListener('keydown', (event) => {
    const keyMap = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
    };
    if (keyMap[event.key]) {
        event.preventDefault();
        moveTiles(keyMap[event.key]);
    }
});

// 게임 시작
startGame();
