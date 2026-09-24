const SIZE = 8;
const TYPES = ["red", "yellow", "green", "blue", "purple", "orange"];
const GOAL = 2500;
let board = [];
let score = 0;
let moves = 25;
let selected = null;
let busy = false;
let streak = 0;
let soundOn = true;

const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const movesElement = document.querySelector("#moves");
const streakElement = document.querySelector("#streak");
const scoreBar = document.querySelector("#score-bar-fill");
const goalProgress = document.querySelector("#goal-progress");
const goalLabel = document.querySelector("#goal-label");
const toast = document.querySelector("#toast");
const winModal = document.querySelector("#win-modal");

function randomType() {
  return TYPES[Math.floor(Math.random() * TYPES.length)];
}

function getType(candy) {
  if (!candy) return null;
  return typeof candy === "string" ? candy : candy.type;
}

function getMatchType(candy) {
  return candy?.special ? `special-${candy.type}` : getType(candy);
}

function hasMatchAt(grid, row, col) {
  const type = getMatchType(grid[row][col]);
  return (col >= 2 && getMatchType(grid[row][col - 1]) === type && getMatchType(grid[row][col - 2]) === type)
    || (row >= 2 && getMatchType(grid[row - 1][col]) === type && getMatchType(grid[row - 2][col]) === type);
}

function createBoard() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      do { board[row][col] = randomType(); } while (hasMatchAt(board, row, col));
    }
  }
}

function renderBoard() {
  boardElement.innerHTML = "";
  board.forEach((row, rowIndex) => row.forEach((candyData, colIndex) => {
    const type = getType(candyData);
    const candy = document.createElement("button");
    candy.className = `candy ${type}${candyData.special ? " special" : ""}`;
    candy.type = "button";
    candy.dataset.row = rowIndex;
    candy.dataset.col = colIndex;
    candy.setAttribute("role", "gridcell");
    candy.setAttribute("aria-label", `${type} candy, row ${rowIndex + 1}, column ${colIndex + 1}`);
    candy.addEventListener("click", () => selectCandy(rowIndex, colIndex));
    boardElement.appendChild(candy);
  }));
}

function selectCandy(row, col) {
  if (busy || moves <= 0) return;
  const clicked = boardElement.children[row * SIZE + col];
  if (!selected) {
    selected = { row, col };
    clicked.classList.add("selected");
    return;
  }
  const distance = Math.abs(selected.row - row) + Math.abs(selected.col - col);
  if (distance !== 1) {
    document.querySelector(".candy.selected")?.classList.remove("selected");
    selected = { row, col };
    clicked.classList.add("selected");
    return;
  }
  document.querySelector(".candy.selected")?.classList.remove("selected");
  const first = selected;
  selected = null;
  swap(first, { row, col });
}

async function swap(first, second) {
  busy = true;
  [board[first.row][first.col], board[second.row][second.col]] =
    [board[second.row][second.col], board[first.row][first.col]];
  renderBoard();
  if (board[second.row][second.col]?.special || board[first.row][first.col]?.special) {
    moves -= 1;
    streak += 1;
    updateStats();
    await activateSpecial(board[second.row][second.col]?.special ? second : first);
    busy = false;
    return;
  }
  const matches = findMatches();
  if (!matches.size) {
    await wait(190);
    [board[first.row][first.col], board[second.row][second.col]] =
      [board[second.row][second.col], board[first.row][first.col]];
    renderBoard();
    showToast("That swap doesn't make a match");
    busy = false;
    return;
  }
  moves -= 1;
  streak += 1;
  updateStats();
  await resolveMatches(matches);
  busy = false;
  if (moves === 0 && score < GOAL) showToast("Out of moves — try a new game!");
}

function findMatches() {
  const matches = new Set();
  for (let row = 0; row < SIZE; row += 1) {
    let start = 0;
    for (let col = 1; col <= SIZE; col += 1) {
      if (col === SIZE || getMatchType(board[row][col]) !== getMatchType(board[row][start])) {
        if (col - start >= 3) for (let x = start; x < col; x += 1) matches.add(`${row},${x}`);
        start = col;
      }
    }
  }
  for (let col = 0; col < SIZE; col += 1) {
    let start = 0;
    for (let row = 1; row <= SIZE; row += 1) {
      if (row === SIZE || getMatchType(board[row][col]) !== getMatchType(board[start][col])) {
        if (row - start >= 3) for (let y = start; y < row; y += 1) matches.add(`${y},${col}`);
        start = row;
      }
    }
  }
  return matches;
}

async function resolveMatches(matches) {
  let combo = 0;
  while (matches.size) {
    combo += 1;
    const points = matches.size * 60 * combo;
    score += points;
    const specialKey = matches.size >= 4 ? matches.values().next().value : null;
    const specialType = specialKey
      ? getType(board[Number(specialKey.split(",")[0])][Number(specialKey.split(",")[1])])
      : null;
    matches.forEach((key) => {
      const [row, col] = key.split(",").map(Number);
      boardElement.children[row * SIZE + col]?.classList.add("matched");
      board[row][col] = null;
    });
    if (specialKey) {
      const [specialRow, specialCol] = specialKey.split(",").map(Number);
      board[specialRow][specialCol] = { type: specialType, special: true };
      showToast("Striped candy created!");
    }
    updateStats();
    if (combo > 1) showToast(`${combo}x combo! +${points}`);
    await wait(280);
    dropCandies();
    renderBoard();
    await wait(160);
    matches = findMatches();
  }

  async function activateSpecial(position) {
    const { row, col } = position;
    const type = getType(board[row][col]);
    let cleared = 0;
    for (let index = 0; index < SIZE; index += 1) {
      if (board[row][index]) {
        board[row][index] = null;
        cleared += 1;
      }
      if (board[index][col]) {
        board[index][col] = null;
        cleared += 1;
      }
    }
    score += cleared * 90;
    showToast(`Striped ${type} blast! +${cleared * 90}`);
    updateStats();
    renderBoard();
    await wait(280);
    dropCandies();
    renderBoard();
    await wait(160);
    const matches = findMatches();
    if (matches.size) await resolveMatches(matches);
  }
  if (score >= GOAL) {
    document.querySelector("#final-score").textContent = score.toLocaleString();
    winModal.hidden = false;
  }
}

function dropCandies() {
  for (let col = 0; col < SIZE; col += 1) {
    const remaining = board.map((row) => row[col]).filter(Boolean);
    while (remaining.length < SIZE) remaining.unshift(randomType());
    for (let row = 0; row < SIZE; row += 1) board[row][col] = remaining[row];
  }
}

function updateStats() {
  scoreElement.textContent = score.toLocaleString();
  movesElement.textContent = moves;
  streakElement.textContent = streak;
  const progress = Math.min(score / GOAL * 100, 100);
  scoreBar.style.width = `${progress}%`;
  goalProgress.style.width = `${progress}%`;
  goalLabel.textContent = `${Math.min(score, GOAL).toLocaleString()} / ${GOAL.toLocaleString()}`;
}

function newGame() {
  score = 0; moves = 25; streak = 0; selected = null; busy = false;
  winModal.hidden = true;
  createBoard(); renderBoard(); updateStats();
}

function shuffle() {
  if (busy || moves <= 0) return;
  createBoard(); renderBoard(); showToast("The board has been shuffled!");
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

document.querySelector("#shuffle-button").addEventListener("click", shuffle);
document.querySelector("#new-game-button").addEventListener("click", newGame);
document.querySelector("#play-again-button").addEventListener("click", newGame);
document.querySelector("#sound-toggle").addEventListener("click", (event) => {
  soundOn = !soundOn;
  event.currentTarget.classList.toggle("muted", !soundOn);
  event.currentTarget.textContent = soundOn ? "♫" : "♩";
});
document.querySelectorAll(".booster").forEach((button) => {
  button.addEventListener("click", () => showToast("Boosters are coming soon!"));
});

newGame();
