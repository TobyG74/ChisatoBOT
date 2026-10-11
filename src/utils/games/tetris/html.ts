import { createTetrisGame } from "./game";

export function createTetrisHtml(): string {
    return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tetris • ChisatoBOT</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#15191c;color:#f5f5f5;font:15px/1.5 system-ui,sans-serif}
main{width:100%;max-width:400px;margin:auto;padding:16px}header{display:flex;align-items:center;justify-content:space-between;gap:16px}
h1{margin:0;font-size:26px}header p{margin:0;color:#c6d0d5;font-size:12px}#next{display:block;width:80px;height:48px}
.stats{display:flex;justify-content:space-between;gap:12px;margin:12px 0}.stats span{display:block;color:#c6d0d5;font-size:12px}
.stats strong{font-size:20px;font-variant-numeric:tabular-nums}.board{position:relative;width:min(100%,240px);margin:auto;border:2px solid #64747c}
#board{display:block;width:100%;height:auto;touch-action:manipulation;outline-offset:4px}
#overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(21,25,28,.94);padding:20px;text-align:center}
#overlay[hidden]{display:none}#overlay strong{font-size:22px}#overlay p{margin:0;color:#c6d0d5;font-size:13px}
button{min-height:48px;border:1px solid #64747c;border-radius:4px;background:#273137;color:#f5f5f5;font:600 14px system-ui;cursor:pointer;touch-action:manipulation}
button:active{background:#46565f}button:disabled{opacity:.55;cursor:default}button:focus-visible,#board:focus-visible{outline:3px solid #fbbf24;outline-offset:3px}
#start{background:#fbbf24;border-color:#fbbf24;color:#15191c;padding:10px 20px}
.controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:16px}.wide{grid-column:span 2}
.footer{display:flex;gap:8px;margin-top:8px}.footer button{flex:1}#status{min-height:24px;margin:10px 0 0;text-align:center;color:#c6d0d5}
.help{margin:8px 0 0;font-size:12px;color:#c6d0d5;text-align:center}noscript p{padding:12px;border:1px solid #64747c}
</style>
</head>
<body>
<main aria-label="Permainan Tetris">
<header><div><h1>Tetris</h1><p>ChisatoBOT</p></div><div><p>Balok berikutnya</p><canvas id="next" width="80" height="48" aria-label="Pratinjau balok berikutnya"></canvas></div></header>
<div class="stats"><div><span>Skor</span><strong id="score">0</strong></div><div><span>Baris</span><strong id="lines">0</strong></div><div><span>Level</span><strong id="level">1</strong></div></div>
<div class="board">
<canvas id="board" width="240" height="480" tabindex="0" aria-label="Papan Tetris 10 kolom dan 20 baris. Gunakan tombol panah untuk bergerak dan memutar."></canvas>
<div id="overlay"><strong id="heading">Susun. Isi. Bersihkan.</strong><p id="detail">Isi satu baris penuh untuk menghapusnya. Jangan sampai balok menumpuk ke atas.</p><button id="start" type="button">Mulai bermain</button></div>
</div>
<div class="controls" aria-label="Kontrol balok">
<button type="button" data-action="left" aria-label="Geser balok ke kiri">◀ Kiri</button>
<button type="button" data-action="rotate" aria-label="Putar balok searah jarum jam">Putar</button>
<button type="button" data-action="right" aria-label="Geser balok ke kanan">Kanan ▶</button>
<button type="button" data-action="down">Turun</button><button type="button" class="wide" data-action="drop">Jatuhkan langsung</button>
</div>
<div class="footer"><button id="pause" type="button" disabled>Jeda</button><button id="restart" type="button">Main ulang</button></div>
<p id="status" role="status" aria-live="polite">Tekan Mulai bermain.</p>
<p class="help">Keyboard: ← → geser · ↑ putar · ↓ turun · Spasi jatuhkan · P jeda.</p>
<noscript><p>Game membutuhkan JavaScript. Buka kartu di WhatsApp yang mendukung HTML interaktif.</p></noscript>
</main>
<script>
(() => {
const createGame = ${createTetrisGame.toString()};
const el = id => document.getElementById(id);
const canvas = el('board'), context = canvas.getContext('2d'), preview = el('next').getContext('2d');
if (!context || !preview) {
    el('detail').textContent = 'Papan game tidak dapat dimuat. Coba buka kartu di perangkat lain.';
    document.querySelectorAll('button').forEach(button => button.disabled = true);
    return;
}
// Piece colours identify the seven tetrominoes; motion comes only from gameplay.
const colours = ['#15191c','#67e8f9','#fde047','#c4b5fd','#a3e635','#fb7185','#93c5fd','#fdba74'];
let game = createGame(), running = false, paused = false, lastFall = 0;
function cell(ctx, x, y, value, size, ghost = false) {
    ctx.fillStyle = colours[value];
    ctx.strokeStyle = ghost ? colours[value] : '#15191c';
    ctx.lineWidth = ghost ? 2 : 1;
    if (!ghost) ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    ctx.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
}
function drawPiece(matrix, x, y, ghost = false) {
    matrix.forEach((row, dy) => row.forEach((value, dx) => { if (value) cell(context, x + dx, y + dy, value, 24, ghost); }));
}
function draw() {
    context.fillStyle = colours[0]; context.fillRect(0, 0, 240, 480);
    context.strokeStyle = '#273137'; context.lineWidth = 1;
    for (let x = 0; x <= 10; x++) { context.beginPath(); context.moveTo(x*24,0); context.lineTo(x*24,480); context.stroke(); }
    for (let y = 0; y <= 20; y++) { context.beginPath(); context.moveTo(0,y*24); context.lineTo(240,y*24); context.stroke(); }
    game.board.forEach((row, y) => row.forEach((value, x) => { if (value) cell(context,x,y,value,24); }));
    if (!game.over) {
        drawPiece(game.piece.matrix, game.piece.x, game.landingY(), true);
        drawPiece(game.piece.matrix, game.piece.x, game.piece.y);
    }
    preview.clearRect(0,0,80,48);
    const offset = (5 - game.next[0].length) / 2;
    game.next.forEach((row,y) => row.forEach((value,x) => { if(value) cell(preview,x+offset,y+.5,value,16); }));
    el('score').textContent = game.score; el('lines').textContent = game.lines; el('level').textContent = game.level;
    document.querySelectorAll('[data-action]').forEach(button => button.disabled = !running || paused || game.over);
}
function showOverlay(heading, detail, action) {
    el('heading').textContent = heading; el('detail').textContent = detail;
    el('start').textContent = action; el('overlay').hidden = false;
}
function finish() {
    running = false; paused = false; el('pause').disabled = true; el('pause').textContent = 'Jeda';
    showOverlay('Permainan selesai', 'Skor akhir: ' + game.score + '. Baris dibersihkan: ' + game.lines + '.', 'Main lagi');
    el('status').textContent = 'Permainan selesai. Tekan Main lagi.';
}
function start() {
    game = createGame(); running = true; paused = false; lastFall = performance.now();
    el('overlay').hidden = true; el('pause').disabled = false; el('pause').textContent = 'Jeda';
    el('status').textContent = 'Isi baris penuh. Bayangan menunjukkan posisi jatuh.';
    draw(); canvas.focus();
}
function togglePause() {
    if (!running || game.over) return;
    paused = !paused; el('pause').textContent = paused ? 'Lanjutkan' : 'Jeda';
    if (paused) {
        showOverlay('Dijeda', 'Balok berhenti sampai kamu melanjutkan permainan.', 'Lanjutkan');
        el('status').textContent = 'Permainan dijeda.';
    } else {
        el('overlay').hidden = true; lastFall = performance.now();
        el('status').textContent = 'Permainan dilanjutkan.';
    }
    draw();
}
function act(action) {
    if (!running || paused || game.over) return;
    if (action === 'left') game.move(-1);
    if (action === 'right') game.move(1);
    if (action === 'rotate') game.rotate();
    if (action === 'down') { game.down(true); lastFall = performance.now(); }
    if (action === 'drop') { game.drop(); lastFall = performance.now(); }
    if (game.over) finish();
    draw();
}
el('start').onclick = () => paused ? togglePause() : start();
el('restart').onclick = start; el('pause').onclick = togglePause;
document.querySelectorAll('[data-action]').forEach(button => button.onclick = () => act(button.dataset.action));
document.addEventListener('keydown', event => {
    if ((event.code === 'Space' || event.code === 'Enter') && event.target.tagName === 'BUTTON') return;
    const actions = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down',Space:'drop'};
    if (actions[event.code]) { event.preventDefault(); act(actions[event.code]); }
    if (event.code === 'KeyP' || event.code === 'Escape') { event.preventDefault(); if (!event.repeat) togglePause(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) togglePause(); });
window.addEventListener('blur', () => { if (running && !paused) togglePause(); });
function tick(now) {
    if (running && !paused && !game.over && now - lastFall >= Math.max(100, 800 - (game.level - 1)*60)) {
        game.down(); lastFall = now; if (game.over) finish(); draw();
    }
    requestAnimationFrame(tick);
}
draw(); requestAnimationFrame(tick);
})();
</script>
</body>
</html>`;
}
