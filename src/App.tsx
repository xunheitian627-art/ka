
import { useState } from "react";
import "./App.css";

const SIZE = 7;
const MOVES = 25;

const CANDIES = ["🍓", "🍋", "🍇", "🍊", "🍏", "🫐"];

type Cell = string;
type Board = Cell[][];

type Position = {
  row: number;
  col: number;
};

function randomCandy(): Cell {
  return CANDIES[Math.floor(Math.random() * CANDIES.length)];
}

function createBoard(): Board {
  const board: Board = [];

  for (let row = 0; row < SIZE; row++) {
    const newRow: Cell[] = [];

    for (let col = 0; col < SIZE; col++) {
      let candy = randomCandy();
      let attempts = 0;

      while (attempts < 30) {
        const horizontalMatch =
          col >= 2 &&
          newRow[col - 1] === candy &&
          newRow[col - 2] === candy;

        const verticalMatch =
          row >= 2 &&
          board[row - 1][col] === candy &&
          board[row - 2][col] === candy;

        if (!horizontalMatch && !verticalMatch) break;

        candy = randomCandy();
        attempts++;
      }

      newRow.push(candy);
    }

    board.push(newRow);
  }

  return board;
}

function findMatches(board: Board): Set<string> {
  const matches = new Set<string>();

  // 横方向のチェック
  for (let row = 0; row < SIZE; row++) {
    let count = 1;

    for (let col = 1; col <= SIZE; col++) {
      if (
        col < SIZE &&
        board[row][col] === board[row][col - 1]
      ) {
        count++;
      } else {
        if (count >= 3) {
          for (let k = col - count; k < col; k++) {
            matches.add(`${row}-${k}`);
          }
        }
        count = 1;
      }
    }
  }

  // 縦方向のチェック
  for (let col = 0; col < SIZE; col++) {
    let count = 1;

    for (let row = 1; row <= SIZE; row++) {
      if (
        row < SIZE &&
        board[row][col] === board[row - 1][col]
      ) {
        count++;
      } else {
        if (count >= 3) {
          for (let k = row - count; k < row; k++) {
            matches.add(`${k}-${col}`);
          }
        }
        count = 1;
      }
    }
  }

  return matches;
}

function swapCells(
  board: Board,
  a: Position,
  b: Position
): Board {
  const next = board.map((row) => [...row]);

  const temp = next[a.row][a.col];
  next[a.row][a.col] = next[b.row][b.col];
  next[b.row][b.col] = temp;

  return next;
}

function resolveBoard(board: Board): {
  board: Board;
  points: number;
  chains: number;
} {
  let current = board.map((row) => [...row]);
  let points = 0;
  let chains = 0;

  // 連鎖の上限を設けて無限ループを防止
  for (let turn = 0; turn < 30; turn++) {
    const matches = findMatches(current);

    if (matches.size === 0) break;

    chains++;

    points += matches.size * 10 * chains;

    // マッチしたキャンディを消す
    for (const key of matches) {
      const [row, col] = key.split("-").map(Number);
      current[row][col] = "";
    }

    // 上からキャンディを落とす
    for (let col = 0; col < SIZE; col++) {
      const remaining: Cell[] = [];

      for (let row = SIZE - 1; row >= 0; row--) {
        if (current[row][col] !== "") {
          remaining.push(current[row][col]);
        }
      }

      for (let row = SIZE - 1; row >= 0; row--) {
        const index = SIZE - 1 - row;
        current[row][col] = remaining[index] ?? randomCandy();
      }
    }
  }

  return { board: current, points, chains };
}

function isAdjacent(a: Position, b: Position): boolean {
  return (
    Math.abs(a.row - b.row) +
      Math.abs(a.col - b.col) ===
    1
  );
}

function App() {
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [selected, setSelected] = useState<Position | null>(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(MOVES);
  const [bestScore, setBestScore] = useState(() =>
    Number(localStorage.getItem("candy-best") || 0)
  );
  const [message, setMessage] = useState("キャンディを3つそろえよう！");
  const [chains, setChains] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  function playSound(frequency: number) {
    if (!soundOn) return;

    try {
      const AudioClass = window.AudioContext;
      const audio = new AudioClass();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.12, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.currentTime + 0.16
      );

      oscillator.connect(gain);
      gain.connect(audio.destination);

      oscillator.start();
      oscillator.stop(audio.currentTime + 0.16);
      oscillator.onended = () => void audio.close();
    } catch {
      // 音声が使えなくてもゲームは続行
    }
  }

  function finishTurn(
    nextBoard: Board,
    nextScore: number,
    nextMoves: number,
    nextChains: number
  ) {
    setBoard(nextBoard);
    setScore(nextScore);
    setMoves(nextMoves);
    setChains(nextChains);
    setSelected(null);

    if (nextScore > bestScore) {
      setBestScore(nextScore);
      localStorage.setItem("candy-best", String(nextScore));
    }

    if (nextMoves <= 0) {
      setGameOver(true);
      setMessage("ゲーム終了！おつかれさま！");
    }
  }

  function handleCandyClick(row: number, col: number) {
    if (gameOver) return;

    const current: Position = { row, col };

    if (!selected) {
      setSelected(current);
      return;
    }

    if (selected.row === row && selected.col === col) {
      setSelected(null);
      return;
    }

    if (!isAdjacent(selected, current)) {
      setSelected(current);
      return;
    }

    const swapped = swapCells(board, selected, current);
    const matches = findMatches(swapped);

    if (matches.size === 0) {
      setSelected(null);
      setMessage("3つそろう場所に入れ替えてね！");
      playSound(180);
      return;
    }

    const result = resolveBoard(swapped);
    const nextScore = score + result.points;
    const nextMoves = moves - 1;

    finishTurn(
      result.board,
      nextScore,
      nextMoves,
      result.chains
    );

    if (result.chains >= 2) {
      setMessage(`🎉 ${result.chains}連鎖！ボーナス！`);
      playSound(1000);
    } else {
      setMessage("🍬 キャンディが消えた！");
      playSound(650);
    }
  }

  function restartGame() {
    setBoard(createBoard());
    setSelected(null);
    setScore(0);
    setMoves(MOVES);
    setChains(0);
    setGameOver(false);
    setMessage("新しいゲーム！スタート！");
    playSound(500);
  }

  return (
    <main className="candy-page">
      <div className="candy-card">
        <header className="candy-header">
          <div className="candy-logo">SWEET PUZZLE</div>
          <h1>🍬 キャンディ・マッチ3 🍭</h1>
          <p>同じ色を3つそろえて消しちゃおう！</p>
        </header>

        <section className="candy-status">
          <div className="status-item">
            <span>⭐ スコア</span>
            <strong>{score}</strong>
          </div>

          <div className="status-item moves-item">
            <span>👣 のこり手数</span>
            <strong>{moves}</strong>
          </div>

          <div className="status-item">
            <span>🏆 ベスト</span>
            <strong>{bestScore}</strong>
          </div>
        </section>

        <div className="candy-message">
          {message}
        </div>

        <div className="chain-display">
          {chains >= 2 && !gameOver
            ? `🔥 ${chains} CHAIN!`
            : "✨ SWEET TIME ✨"}
        </div>

        <section
          className="candy-board"
          aria-label="キャンディゲーム盤"
        >
          {board.map((row, rowIndex) =>
            row.map((candy, colIndex) => {
              const isSelected =
                selected?.row === rowIndex &&
                selected?.col === colIndex;

              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  className={`candy-cell ${
                    isSelected ? "selected" : ""
                  }`}
                  onClick={() =>
                    handleCandyClick(rowIndex, colIndex)
                  }
                  disabled={gameOver}
                  aria-label={`${rowIndex + 1}行目 ${colIndex + 1}列目 ${candy}`}
                >
                  <span>{candy}</span>
                </button>
              );
            })
          )}
        </section>

        <div className="candy-help">
          <span>🍓 いちご</span>
          <span>🍋 レモン</span>
          <span>🍇 ぶどう</span>
          <span>🍊 オレンジ</span>
          <span>🍏 りんご</span>
          <span>🫐 ブルーベリー</span>
        </div>

        <div className="candy-controls">
          <button
            className="restart-button"
            onClick={restartGame}
          >
            🔄 リスタート
          </button>

          <button
            className="sound-button"
            onClick={() => setSoundOn((value) => !value)}
          >
            {soundOn ? "🔊 音あり" : "🔇 音なし"}
          </button>
        </div>

        {gameOver && (
          <div className="game-result">
            <div className="result-star">🌟</div>
            <h2>GAME OVER!</h2>
            <p>今回のスコア</p>
            <strong>{score} 点</strong>
            {score >= bestScore && score > 0 && (
              <p className="record-text">🏆 ハイスコア更新！</p>
            )}
            <button onClick={restartGame}>
              もう一度あそぶ！
            </button>
          </div>
        )}

        <footer className="candy-footer">
          となり合うキャンディを選んで入れ替えよう！
          <br />
          3つ以上そろうと消えて得点になるよ。
        </footer>
      </div>
    </main>
  );
}

export default App;
