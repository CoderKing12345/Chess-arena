(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const game = new Chess();
  let mode = "computer";
  let flipped = false;
  let selected = null;
  let legalTargets = [];
  let history = [];
  let whiteTime = 600;
  let blackTime = 600;
  let clockTimer = null;
  let clockRunning = false;
  let gameOver = false;
  let computerBusy = false;

  const pieces = {
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
  };

  const readStats = () => {
    try {
      return JSON.parse(localStorage.getItem("chessArenaStats") || '{"games":0,"wins":0,"draws":0,"streak":0,"losses":0}');
    } catch (_) {
      return { games: 0, wins: 0, draws: 0, streak: 0, losses: 0 };
    }
  };
  let stats = readStats();

  function saveStats() {
    localStorage.setItem("chessArenaStats", JSON.stringify(stats));
    updateStats();
  }

  function updateStats() {
    const values = {
      "stat-games": stats.games,
      "stat-wins": stats.wins,
      "stat-draws": stats.draws,
      "stat-streak": stats.streak,
      "profile-games": stats.games,
      "profile-wins": stats.wins,
      "profile-draws": stats.draws,
      "profile-losses": stats.losses
    };
    Object.entries(values).forEach(([id, value]) => { if ($(id)) $(id).textContent = value; });
  }

  function setStatus(message) {
    if ($("game-status")) $("game-status").textContent = message;
  }

  function formatTime(seconds) {
    const safe = Math.max(0, seconds);
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
  }

  function updateClocks() {
    if ($("white-clock")) $("white-clock").textContent = formatTime(whiteTime);
    if ($("black-clock")) $("black-clock").textContent = formatTime(blackTime);
    $("white-clock")?.classList.toggle("active-clock", clockRunning && game.turn() === "w");
    $("black-clock")?.classList.toggle("active-clock", clockRunning && game.turn() === "b");
  }

  function stopClock() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = null;
    clockRunning = false;
    updateClocks();
  }

  function startClock() {
    if (clockTimer || gameOver) return;
    clockRunning = true;
    clockTimer = setInterval(() => {
      if (gameOver) return stopClock();
      if (game.turn() === "w") whiteTime--;
      else blackTime--;
      updateClocks();
      if (whiteTime <= 0 || blackTime <= 0) {
        stopClock();
        finishGame(whiteTime <= 0 ? "Black wins on time." : "White wins on time.", whiteTime <= 0 ? "b" : "w");
      }
    }, 1000);
    updateClocks();
  }

  function squareName(row, col) {
    return "abcdefgh"[col] + (8 - row);
  }

  function renderBoard() {
    const board = $("chessboard");
    if (!board) return;
    board.innerHTML = "";
    const position = game.board();
    for (let displayRow = 0; displayRow < 8; displayRow++) {
      for (let displayCol = 0; displayCol < 8; displayCol++) {
        const row = flipped ? 7 - displayRow : displayRow;
        const col = flipped ? 7 - displayCol : displayCol;
        const square = document.createElement("button");
        const name = squareName(row, col);
        const piece = position[row][col];
        square.type = "button";
        square.className = `square ${(row + col) % 2 ? "dark" : "light"}`;
        square.dataset.square = name;
        square.setAttribute("role", "gridcell");
        square.setAttribute("aria-label", `${name}${piece ? " " + (piece.color === "w" ? "white " : "black ") + piece.type : ""}`);
        if (piece) {
          const span = document.createElement("span");
          span.className = `piece ${piece.color === "w" ? "white-piece" : "black-piece"}`;
          span.textContent = pieces[piece.color][piece.type];
          square.appendChild(span);
        }
        if (selected === name) square.classList.add("selected");
        if (legalTargets.includes(name)) square.classList.add("legal-target");
        if (game.isCheck() && piece?.type === "k" && piece.color === game.turn()) square.classList.add("in-check");
        square.addEventListener("click", () => onSquareClick(name));
        board.appendChild(square);
      }
    }
  }

  function renderMoves() {
    const list = $("move-list");
    if (!list) return;
    const moves = game.history();
    $("move-count").textContent = `${moves.length} ${moves.length === 1 ? "move" : "moves"}`;
    if (!moves.length) {
      list.innerHTML = '<div class="empty-moves">Your moves will appear here.</div>';
      return;
    }
    list.innerHTML = "";
    for (let i = 0; i < moves.length; i += 2) {
      const row = document.createElement("div");
      row.className = "move-row";
      const number = document.createElement("span");
      number.textContent = `${Math.floor(i / 2) + 1}.`;
      const white = document.createElement("span");
      white.textContent = moves[i];
      const black = document.createElement("span");
      black.textContent = moves[i + 1] || "";
      row.append(number, white, black);
      list.appendChild(row);
    }
    list.scrollTop = list.scrollHeight;
  }

  function onSquareClick(square) {
    if (gameOver || computerBusy || (mode === "computer" && game.turn() === "b")) return;
    const piece = game.get(square);
    if (selected && legalTargets.includes(square)) {
      makeMove(selected, square);
      return;
    }
    if (piece && piece.color === game.turn()) {
      selected = square;
      legalTargets = game.moves({ square, verbose: true }).map(move => move.to);
    } else {
      selected = null;
      legalTargets = [];
    }
    renderBoard();
  }

  function makeMove(from, to, promotion = "q") {
    let move;
    try { move = game.move({ from, to, promotion }); } catch (_) { move = null; }
    if (!move) return;
    history.push(move);
    selected = null;
    legalTargets = [];
    if (!clockRunning) startClock();
    renderBoard();
    renderMoves();
    updatePlayerLabels();
    if (game.game_over()) {
      const winner = game.in_checkmate() ? (game.turn() === "w" ? "b" : "w") : null;
      finishGame(game.in_checkmate() ? `${winner === "w" ? "White" : "Black"} wins by checkmate!` :
        game.in_stalemate() ? "Draw by stalemate." : "Game drawn.", winner);
      return;
    }
    setStatus(game.in_check() ? "Check! Protect your king." : `${game.turn() === "w" ? "White" : "Black"} to move.`);
    if (mode === "computer" && game.turn() === "b") {
      computerBusy = true;
      setStatus("Computer is thinking…");
      window.setTimeout(computerMove, 450);
    }
  }

  function computerMove() {
    if (gameOver || mode !== "computer") { computerBusy = false; return; }
    const moves = game.moves({ verbose: true });
    if (!moves.length) { computerBusy = false; return; }
    // A simple legal-move opponent. It prioritizes captures and checks.
    const ranked = moves.map(move => ({
      move,
      score: (move.captured ? ({ p: 1, n: 3, b: 3, r: 5, q: 9 }[move.captured] || 0) : 0)
        + (move.san.includes("+") ? 2 : 0)
        + (move.san.includes("#") ? 100 : 0)
        + Math.random() * 1.5
    })).sort((a, b) => b.score - a.score);
    const chosen = ranked[0].move;
    computerBusy = false;
    makeMove(chosen.from, chosen.to, chosen.promotion || "q");
  }

  function updatePlayerLabels() {
    if ($("player-name")) $("player-name").textContent = mode === "computer" ? "You" : "White";
    if ($("opponent-name")) $("opponent-name").textContent = mode === "computer" ? "Chess Arena AI" : "Black";
    if ($("player-sub")) $("player-sub").textContent = mode === "computer" ? "White pieces" : "White pieces";
    if ($("opponent-sub")) $("opponent-sub").textContent = mode === "computer" ? "Computer opponent" : "Black pieces";
  }

  function finishGame(message, winnerColor) {
    if (gameOver) return;
    gameOver = true;
    computerBusy = false;
    stopClock();
    stats.games++;
    if (!winnerColor) {
      stats.draws++;
      stats.streak = 0;
    } else if (winnerColor === "w") {
      stats.wins++;
      stats.streak++;
    } else {
      stats.losses++;
      stats.streak = 0;
    }
    saveStats();
    setStatus(message);
    if ($("result-title")) $("result-title").textContent = winnerColor ? `${winnerColor === "w" ? "White" : "Black"} wins!` : "It's a draw!";
    if ($("result-description")) $("result-description").textContent = message;
    $("result-modal")?.classList.remove("hidden");
  }

  function newGame() {
    game.reset();
    history = [];
    selected = null;
    legalTargets = [];
    gameOver = false;
    computerBusy = false;
    stopClock();
    const minutes = Number($("time-control")?.value || 10);
    whiteTime = minutes * 60;
    blackTime = minutes * 60;
    $("result-modal")?.classList.add("hidden");
    setStatus("Your turn. Make a move.");
    updateClocks();
    updatePlayerLabels();
    renderBoard();
    renderMoves();
  }

  function changeMode(nextMode) {
    mode = nextMode;
    document.querySelectorAll(".mode-card").forEach(card => card.classList.toggle("selected", card.dataset.mode === mode));
    $("online-controls")?.classList.toggle("hidden", mode !== "online");
    if (mode === "online") {
      setStatus("Online rooms need Supabase configuration. Local and computer games are ready.");
      $("room-status").textContent = "Online multiplayer is not configured yet. Use computer or local mode for now.";
    } else {
      setStatus(mode === "computer" ? "Play against the computer. White moves first." : "Two players share this device.");
    }
    newGame();
  }

  function switchView(view) {
    document.querySelectorAll(".view").forEach(el => el.classList.remove("active-view"));
    $(`${view}-view`)?.classList.add("active-view");
    document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  }

  document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
  document.querySelectorAll(".mode-card").forEach(button => button.addEventListener("click", () => changeMode(button.dataset.mode)));
  $("flip-board")?.addEventListener("click", () => { flipped = !flipped; renderBoard(); });
  $("new-game")?.addEventListener("click", newGame);
  $("start-game")?.addEventListener("click", newGame);
  $("result-new-game")?.addEventListener("click", newGame);
  $("time-control")?.addEventListener("change", newGame);
  $("undo-move")?.addEventListener("click", () => {
    if (gameOver) return;
    game.undo();
    if (mode === "computer" && game.turn() === "b") game.undo();
    history = [];
    selected = null;
    legalTargets = [];
    renderBoard();
    renderMoves();
    setStatus("Last move undone.");
  });
  $("resign")?.addEventListener("click", () => {
    if (gameOver) return;
    finishGame("You resigned. Black wins.", "b");
  });
  $("offer-draw")?.addEventListener("click", () => setStatus("Draw offer noted. In a local game, agree with the other player."));
  $("copy-pgn")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(game.pgn());
      setStatus("PGN copied to clipboard.");
    } catch (_) {
      setStatus("Clipboard access is unavailable in this browser.");
    }
  });
  $("create-room")?.addEventListener("click", () => setStatus("Online multiplayer is not configured yet."));
  $("join-room")?.addEventListener("click", () => setStatus("Online multiplayer is not configured yet."));

  $("auth-open")?.addEventListener("click", () => $("auth-modal")?.classList.remove("hidden"));
  $("auth-close")?.addEventListener("click", () => $("auth-modal")?.classList.add("hidden"));
  $("auth-switch")?.addEventListener("click", () => {
    const title = $("auth-title");
    const isSignIn = title.textContent === "Sign in";
    title.textContent = isSignIn ? "Create an account" : "Sign in";
    $("auth-submit").textContent = isSignIn ? "Create account" : "Sign in";
    $("auth-switch").textContent = isSignIn ? "Already have an account? Sign in" : "Create an account";
    $("username-label")?.classList.toggle("hidden", !isSignIn);
    $("auth-username")?.classList.toggle("hidden", !isSignIn);
  });
  $("auth-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    $("auth-message").textContent = "Account sign-in is not connected yet. Add your Supabase project settings to enable accounts.";
  });
  $("signout")?.addEventListener("click", () => setStatus("No account is currently connected."));
  $("reset-stats")?.addEventListener("click", () => {
    stats = { games: 0, wins: 0, draws: 0, streak: 0, losses: 0 };
    saveStats();
  });

  const lessons = {
    pieces: ["Know your pieces", "The king moves one square in any direction. The queen moves along ranks, files, and diagonals. Rooks move straight, bishops diagonally, and knights jump in an L-shape. Pawns move forward and capture diagonally."],
    fork: ["Spot the fork", "A fork is a double attack: one piece threatens two or more targets at once. Knights are especially good at forks. Look for checks that also attack a queen or rook."],
    center: ["Control the centre", "The four central squares help your pieces reach more of the board. Develop knights and bishops toward useful squares, and avoid moving the same piece repeatedly without a reason."]
  };
  document.querySelectorAll("[data-lesson]").forEach(button => button.addEventListener("click", () => {
    const lesson = lessons[button.dataset.lesson];
    if (!lesson) return;
    $("lesson-detail").innerHTML = `<p class="eyebrow">CHESS LESSON</p><h2></h2><p></p>`;
    $("lesson-detail").querySelector("h2").textContent = lesson[0];
    $("lesson-detail").querySelector("p:last-child").textContent = lesson[1];
  }));

  if (typeof Chess === "undefined") {
    setStatus("Chess library failed to load. Check your internet connection and refresh.");
  } else {
    updateStats();
    updateClocks();
    updatePlayerLabels();
    renderBoard();
    renderMoves();
  }
})();
