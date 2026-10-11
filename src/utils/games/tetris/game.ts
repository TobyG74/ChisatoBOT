// Keep this function self-contained: its compiled source also runs in the HTML renderer.
export function createTetrisGame() {
    const shapes = [
        [[1, 1, 1, 1]], [[2, 2], [2, 2]], [[0, 3, 0], [3, 3, 3]],
        [[0, 4, 4], [4, 4, 0]], [[5, 5, 0], [0, 5, 5]],
        [[6, 0, 0], [6, 6, 6]], [[0, 0, 7], [7, 7, 7]]
    ];
    let bag: number[] = [];
    function takePiece() {
        if (!bag.length) {
            bag = shapes.map((_, index) => index);
            for (let i = bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bag[i], bag[j]] = [bag[j], bag[i]];
            }
        }
        return shapes[bag.pop()].map(row => [...row]);
    }
    const game = {
        board: Array.from({ length: 20 }, () => Array(10).fill(0) as number[]),
        piece: { matrix: takePiece(), x: 3, y: 0 },
        next: takePiece(), score: 0, lines: 0, level: 1, over: false,
        move(dx: number) {
            if (game.over || collides(game.piece.matrix, game.piece.x + dx, game.piece.y)) return false;
            game.piece.x += dx;
            return true;
        },
        rotate() {
            if (game.over) return false;
            const matrix = game.piece.matrix[0].map((_, x) => game.piece.matrix.map(row => row[x]).reverse());
            for (const offset of [0, -1, 1, -2, 2]) {
                if (collides(matrix, game.piece.x + offset, game.piece.y)) continue;
                game.piece.matrix = matrix;
                game.piece.x += offset;
                return true;
            }
            return false;
        },
        down(soft = false) {
            if (game.over) return false;
            if (!collides(game.piece.matrix, game.piece.x, game.piece.y + 1)) {
                game.piece.y++;
                if (soft) game.score++;
                return true;
            }
            lock();
            return false;
        },
        drop() {
            if (game.over) return;
            while (!collides(game.piece.matrix, game.piece.x, game.piece.y + 1)) {
                game.piece.y++;
                game.score += 2;
            }
            lock();
        },
        landingY() {
            let y = game.piece.y;
            while (!collides(game.piece.matrix, game.piece.x, y + 1)) y++;
            return y;
        }
    };
    function collides(matrix: number[][], x: number, y: number) {
        return matrix.some((row, dy) => row.some((cell, dx) => cell &&
            (x + dx < 0 || x + dx >= 10 || y + dy >= 20 || y + dy < 0 || game.board[y + dy][x + dx])));
    }
    function lock() {
        game.piece.matrix.forEach((row, dy) => row.forEach((cell, dx) => {
            if (cell) game.board[game.piece.y + dy][game.piece.x + dx] = cell;
        }));
        const remaining = game.board.filter(row => row.some(cell => !cell));
        const cleared = 20 - remaining.length;
        game.score += [0, 100, 300, 500, 800][cleared] * game.level;
        game.lines += cleared;
        game.level = 1 + Math.floor(game.lines / 10);
        game.board = [...Array.from({ length: cleared }, () => Array(10).fill(0)), ...remaining];
        game.piece = { matrix: game.next, x: Math.floor((10 - game.next[0].length) / 2), y: 0 };
        game.next = takePiece();
        game.over = collides(game.piece.matrix, game.piece.x, game.piece.y);
    }
    game.piece.x = Math.floor((10 - game.piece.matrix[0].length) / 2);
    return game;
}
