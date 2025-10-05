// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let gameMode = 'text'; // 'text', 'game', or 'breakout'
let foodDots = [];
let breakoutBricks = [];
let snake = [];
let snakeDirection = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let gridSize = 10;
let score = 0;
let gameLoopInterval;

// Animation variables
let textOpacity = 1;
let animationTime = 0;
let isAnimating = false;
// Ensure the Nothing font is available before rendering pixel text
function ensureFontLoaded(retries = 6) {
    return new Promise((resolve) => {
        if (!window.document || !document.fonts) {
            // Can't check fonts API, assume true
            return resolve(true);
        }

        // Try to actively load the font and then verify
        const fontSpec = '12px "Nothing"';
        document.fonts.load(fontSpec).then(() => {
            try {
                if (document.fonts.check(fontSpec)) return resolve(true);
            } catch (e) {
                // fallthrough to retry
            }
            // fallback to polling
            const check = () => {
                try {
                    if (document.fonts.check(fontSpec)) {
                        return resolve(true);
                    }
                } catch (e) {}
                if (retries-- <= 0) return resolve(false);
                setTimeout(check, 100);
            };
            check();
        }).catch(() => {
            // If fonts.load fails, fall back to polling check
            const check = () => {
                try {
                    if (document.fonts.check('12px "Nothing"')) return resolve(true);
                } catch (e) {}
                if (retries-- <= 0) return resolve(false);
                setTimeout(check, 100);
            };
            check();
        });
    });
}

// --- 5x7 bitmap font generator (from user snippet) ---
const FONT5x7 = {
    'A':["01110","10001","10001","11111","10001","10001","10001"],
    'B':["11110","10001","11110","10001","10001","10001","11110"],
    'C':["01110","10001","10000","10000","10000","10001","01110"],
    'D':["11100","10010","10001","10001","10001","10010","11100"],
    'E':["11111","10000","11110","10000","10000","10000","11111"],
    'F':["11111","10000","11110","10000","10000","10000","10000"],
    'G':["01110","10001","10000","10111","10001","10001","01111"],
    'H':["10001","10001","11111","10001","10001","10001","10001"],
    'I':["11111","00100","00100","00100","00100","00100","11111"],
    'J':["00001","00001","00001","00001","10001","10001","01110"],
    'K':["10001","10010","10100","11000","10100","10010","10001"],
    'L':["10000","10000","10000","10000","10000","10000","11111"],
    'M':["10001","11011","10101","10101","10001","10001","10001"],
    'N':["10001","11001","10101","10011","10001","10001","10001"],
    'O':["01110","10001","10001","10001","10001","10001","01110"],
    'P':["11110","10001","10001","11110","10000","10000","10000"],
    'Q':["01110","10001","10001","10001","10101","10010","01101"],
    'R':["11110","10001","10001","11110","10100","10010","10001"],
    'S':["01111","10000","10000","01110","00001","00001","11110"],
    'T':["11111","00100","00100","00100","00100","00100","00100"],
    'U':["10001","10001","10001","10001","10001","10001","01110"],
    'V':["10001","10001","10001","10001","10001","01010","00100"],
    'W':["10001","10001","10001","10101","10101","11011","10001"],
    'X':["10001","01010","00100","00100","00100","01010","10001"],
    'Y':["10001","01010","00100","00100","00100","00100","00100"],
    'Z':["11111","00010","00100","01000","10000","10000","11111"],
    '0':["01110","10001","10011","10101","11001","10001","01110"],
    '1':["00100","01100","00100","00100","00100","00100","01110"],
    '2':["01110","10001","00001","00010","00100","01000","11111"],
    '3':["11110","00001","00001","01110","00001","00001","11110"],
    '4':["00010","00110","01010","10010","11111","00010","00010"],
    '5':["11111","10000","11110","00001","00001","10001","01110"],
    '6':["00110","01000","10000","11110","10001","10001","01110"],
    '7':["11111","00001","00010","00100","01000","01000","01000"],
    '8':["01110","10001","10001","01110","10001","10001","01110"],
    '9':["01110","10001","10001","01111","00001","00010","11100"],
    ' ': ["00000","00000","00000","00000","00000","00000","00000"],
    ':': ["00000","00100","00100","00000","00100","00100","00000"],
};

function textToGrid(text = 'KONAMI CODE', tile = 10, letterSpacing = 1) {
    text = String(text).toUpperCase();
    const cells = [];
    let xOffset = 0;
    for (const ch of text) {
        const g = FONT5x7[ch] || FONT5x7[' '];
        for (let y = 0; y < 7; y++) {
            for (let x = 0; x < 5; x++) {
                if (g && g[y][x] === '1') {
                    cells.push({ col: xOffset + x, row: y });
                }
            }
        }
        xOffset += 5 + letterSpacing;
    }
    // Deduplicate
    const uniqKeys = Array.from(new Set(cells.map(c => `${c.col}:${c.row}`)));
    const uniq = uniqKeys.map(k => { const [col, row] = k.split(':').map(Number); return { col, row }; });
    const points = uniq.map(c => ({ x: c.col * tile + tile / 2, y: c.row * tile + tile / 2, r: Math.floor(tile * 0.42) }));
    return { cells: uniq, points, tile, widthCols: xOffset, heightRows: 7 };
}


const KONAMI_TEXT = 'KONAMI CODE';
const KONAMI_SPACING = 1;
const BASELINE_KONAMI = textToGrid(KONAMI_TEXT, 10, KONAMI_SPACING);

function getKonamiLayoutForMode(mode = 'text') {
    const widthCols = BASELINE_KONAMI.widthCols;
    const heightRows = BASELINE_KONAMI.heightRows;
    const isMobile = window.innerWidth <= 768 || window.innerHeight <= 820;

    if (mode === 'snake') {
        const tile = gridSize;
        const totalWidth = widthCols * tile;
        const totalHeight = heightRows * tile;
        
        let startX = Math.floor((canvas.width - totalWidth) / 2);
        let startY = Math.floor((canvas.height - totalHeight) / 2);
        
        startX = Math.max(gridSize, Math.floor(startX / gridSize) * gridSize);
        startY = Math.max(gridSize, Math.floor(startY / gridSize) * gridSize);
        
        if (startX + totalWidth > canvas.width - gridSize) {
            startX = Math.max(gridSize, canvas.width - gridSize - totalWidth);
            startX = Math.floor(startX / gridSize) * gridSize;
        }
        if (startY + totalHeight > canvas.height - gridSize) {
            startY = Math.max(gridSize, canvas.height - gridSize - totalHeight);
            startY = Math.floor(startY / gridSize) * gridSize;
        }
        
        const gen = textToGrid(KONAMI_TEXT, tile, KONAMI_SPACING);
        return { gen, tile, startX, startY };
    }

    if (mode === 'breakout') {
        const controlsHeight = isMobile ? 180 : 0;
        const topPadding = isMobile ? 40 : 80;
        const availableHeight = canvas.height - controlsHeight - topPadding;
        
        let maxWidth = isMobile ? canvas.width - 32 : canvas.width - 80;
        let tile = Math.floor(maxWidth / widthCols);
        
        let maxHeightTile = Math.floor(availableHeight * 0.4 / heightRows);
        if (maxHeightTile > 0) tile = Math.min(tile, maxHeightTile);
        tile = Math.max(isMobile ? 10 : 12, Math.min(tile, isMobile ? 24 : 32));
        
        const totalWidth = widthCols * tile;
        const totalHeight = heightRows * tile;
        
        let startX = Math.floor((canvas.width - totalWidth) / 2);
        startX = Math.max(16, Math.min(startX, canvas.width - totalWidth - 16));
        
        let startY = topPadding + 20;
        
        const gen = textToGrid(KONAMI_TEXT, tile, KONAMI_SPACING);
        return { gen, tile, startX, startY };
    }

    // Homepage text mode - ONLY mobile gets pixel rendering
    if (isMobile) {
        const topPadding = 80;
        const bottomPadding = 200;
        const sidePadding = 20;
        
        const availableWidth = canvas.width - (sidePadding * 2);
        const availableHeight = canvas.height - topPadding - bottomPadding;
        
        let tile = Math.floor(availableWidth / widthCols);
        const maxHeightTile = Math.floor(availableHeight / heightRows);
        if (maxHeightTile > 0) tile = Math.min(tile, maxHeightTile);
        tile = Math.max(16, Math.min(tile, 36));
        
        const totalWidth = widthCols * tile;
        const totalHeight = heightRows * tile;
        
        let startX = Math.floor((canvas.width - totalWidth) / 2);
        let startY = Math.floor((canvas.height - totalHeight) / 2);
        
        startY = Math.max(topPadding, Math.min(startY, canvas.height - bottomPadding - totalHeight));
        
        const gen = textToGrid(KONAMI_TEXT, tile, KONAMI_SPACING);
        return { gen, tile, startX, startY };
    }

    // Desktop homepage uses native font rendering
    return null;
}


// Utility: put canvas visually above mobile controls but allow clicks to pass through
function setCanvasAboveControls(enable) {
    const mobileControls = document.getElementById('mobileControls');
    if (enable) {
        // Canvas above controls (for snake game)
        canvas.style.zIndex = 2100;
        canvas.style.pointerEvents = 'auto';
        if (mobileControls) mobileControls.style.zIndex = 2000;
    } else {
        // Controls above canvas (for breakout game)
        canvas.style.zIndex = 1;
        canvas.style.pointerEvents = 'auto';
        if (mobileControls) {
            mobileControls.style.zIndex = 2000;
            mobileControls.style.pointerEvents = 'auto';
        }
    }
}

// Breakout game variables
let paddle = { x: 0, y: 0, width: 100, height: 15, speed: 4 };
let ball = { x: 0, y: 0, dx: 0, dy: 0, radius: 8, speed: 3 };
let bricks = [];
let brickRowCount = 5;
let brickColumnCount = 10;
let brickWidth = 75;
let brickHeight = 20;
let brickPadding = 10;
let brickOffsetTop = 60;
let brickOffsetLeft = 30;
let paddleMovement = { left: false, right: false };

// Set canvas size to fill screen properly
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Redraw if in text mode
    if (gameMode === 'text' && !isAnimating) {
        initTextMode();
    }
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Konami Code detector
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const winCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'a', 'b'];
const tilesCode = ['ArrowUp', 'ArrowDown', 't', 'l'];
// Additional cheat sequence: Down, Up, L, T (works from keyboard or mobile buttons)
const cheatCode = ['ArrowDown', 'ArrowUp', 'l', 't'];
let konamiIndex = 0;
let winCodeIndex = 0;
let tilesCodeIndex = 0;
let cheatIndex = 0;
// Deduplicate rapid/duplicate inputs (helps mobile where touchstart+click pair may fire)
let _lastKonamiKey = null;
let _lastKonamiTime = 0;

// Function to check Konami code directly
function checkKonamiCode(key) {
    const keyLower = String(key).toLowerCase();
    const expectedKey = konamiCode[konamiIndex].toLowerCase();
    const now = Date.now();

    // Ignore immediate duplicate events for the same key within a very small window
    // (helps against touchstart+click duplicates) but keeps room for fast intentional taps.
    const DEDUPE_MS = 60; // 60ms allows very fast intended taps while blocking duplicates
    if (_lastKonamiKey === keyLower && now - _lastKonamiTime < DEDUPE_MS) {
        // Ignore duplicate
        // console.log(`Ignored duplicate key: ${keyLower}`);
        return;
    }
    _lastKonamiKey = keyLower;
    _lastKonamiTime = now;

    if (keyLower === expectedKey) {
        konamiIndex++;
        console.log(`Konami progress: ${konamiIndex}/${konamiCode.length}`);
        if (konamiIndex === konamiCode.length) {
            konamiIndex = 0;
            console.log('KONAMI CODE COMPLETED!');
            // If in text mode, start game; otherwise restart to snake game
            if (gameMode === 'text') {
                activateGame();
            } else {
                resetGame();
                setTimeout(() => activateGame(), 100);
            }
        }
    } else {
        konamiIndex = 0;
        // console.log('Konami code reset');
    }

    // Also check the separate cheat sequence (Down, Up, L, T)
    const expectedCheatKey = cheatCode[cheatIndex] ? String(cheatCode[cheatIndex]).toLowerCase() : null;
    if (keyLower === expectedCheatKey) {
        cheatIndex++;
        console.log(`Cheat progress: ${cheatIndex}/${cheatCode.length}`);
        if (cheatIndex === cheatCode.length) {
            cheatIndex = 0;
            console.log('Cheat code completed! Triggering win.');
            // Trigger win for current context. If breakout, use breakoutWin, else normal winGame
            if (gameMode === 'breakout') {
                breakoutWin();
            } else {
                winGame();
            }
        }
    } else {
        cheatIndex = 0;
    }
}

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const expectedKey = konamiCode[konamiIndex].toLowerCase();
    const expectedWinKey = winCode[winCodeIndex].toLowerCase();
    const expectedTilesKey = tilesCode[tilesCodeIndex].toLowerCase();

    // Check for game start/restart code (works in any mode)
    checkKonamiCode(e.key);

    // Check for tiles game code (only in text mode)
    if (gameMode === 'text') {
        if (key === expectedTilesKey) {
            tilesCodeIndex++;
            if (tilesCodeIndex === tilesCode.length) {
                tilesCodeIndex = 0;
                activateTilesGame();
            }
        } else {
            tilesCodeIndex = 0;
        }
    }

    // Check for instant win code (only during snake gameplay)
    if (gameMode === 'game') {
        if (key === expectedWinKey) {
            winCodeIndex++;
            if (winCodeIndex === winCode.length) {
                winCodeIndex = 0;
                winGame();
            }
        } else {
            winCodeIndex = 0;
        }
    }

    // Reset all code indices when in breakout mode to prevent accidental triggers
    // But allow Konami code to restart to snake game
    if (gameMode === 'breakout') {
        // Only reset if not entering Konami code
        if (konamiIndex === 0) {
            winCodeIndex = 0;
            tilesCodeIndex = 0;
        }
    }
});

// Snake game controls
document.addEventListener('keydown', (e) => {
    if (gameMode !== 'game') return;

    switch(e.key) {
        case 'ArrowUp':
            if (snakeDirection.y === 0) nextDirection = { x: 0, y: -1 };
            break;
        case 'ArrowDown':
            if (snakeDirection.y === 0) nextDirection = { x: 0, y: 1 };
            break;
        case 'ArrowLeft':
            if (snakeDirection.x === 0) nextDirection = { x: -1, y: 0 };
            break;
        case 'ArrowRight':
            if (snakeDirection.x === 0) nextDirection = { x: 1, y: 0 };
            break;
    }
});

// Breakout paddle controls
document.addEventListener('keydown', (e) => {
    if (gameMode !== 'breakout') return;

    if (e.key === 'ArrowLeft') {
        paddleMovement.left = true;
        e.preventDefault(); // Prevent default arrow key behavior
    } else if (e.key === 'ArrowRight') {
        paddleMovement.right = true;
        e.preventDefault(); // Prevent default arrow key behavior
    }
});

document.addEventListener('keyup', (e) => {
    if (gameMode !== 'breakout') return;

    if (e.key === 'ArrowLeft') {
        paddleMovement.left = false;
    } else if (e.key === 'ArrowRight') {
        paddleMovement.right = false;
    }
});

// Mouse controls for Breakout
document.addEventListener('mousemove', (e) => {
    if (gameMode !== 'breakout') return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    paddle.x = mouseX - paddle.width / 2;

    // Keep paddle within bounds
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.width > canvas.width) paddle.x = canvas.width - paddle.width;
});

// Initialize text rendering
function initTextMode() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Wait for font to load so pixel extraction and rendering match the Nothing font
    ensureFontLoaded().then((ok) => {
        if (!ok) console.warn('Nothing font not detected before text animation - using fallback rendering');
        // Start animation loop for text
        animateText();
    });
}

// Animate the "KONAMI CODE" text
function animateText() {
    if (gameMode !== 'text') {
        isAnimating = false;
        return;
    }

    isAnimating = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Disable image smoothing for pixelated text
    ctx.imageSmoothingEnabled = false;

    // Calculate simple pulse animation (slower speed)
    animationTime += 0.005; // Even slower animation for better readability
    textOpacity = 0.8 + Math.sin(animationTime) * 0.2; // Subtle pulse effect (0.8 to 1.0)

    ctx.save();

    const isMobile = window.innerWidth <= 768 || window.innerHeight <= 820;

    // Clear background for better contrast
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = textOpacity;

    // ALWAYS use the Nothing font rendering for homepage (both mobile and desktop)
    const fontSize = isMobile ? Math.min(60, canvas.width / 6) : Math.min(120, canvas.width / 8);
    ctx.font = `bold ${fontSize}px Nothing, monospace`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const textY = isMobile ? canvas.height / 2 - 50 : canvas.height / 2;
    ctx.fillText('KONAMI CODE', canvas.width / 2, textY);

    ctx.restore();

    // Continue animation only in text mode
    if (gameMode === 'text') {
        requestAnimationFrame(animateText);
    }
}

// Extract pixels from rendered text (updated to work with animation)
// Extract text pixels for Snake game
function extractTextPixels(retryCount = 0) {
    const { gen, tile, startX, startY } = getKonamiLayoutForMode('snake');

    foodDots = [];
    const seen = new Set();
    for (const c of gen.cells) {
        const px = startX + c.col * tile;
        const py = startY + c.row * tile;
        const x = Math.max(0, Math.min(canvas.width - gridSize, Math.round(px / gridSize) * gridSize));
        const y = Math.max(0, Math.min(canvas.height - gridSize, Math.round(py / gridSize) * gridSize));
        const key = `${x},${y}`;
        if (!seen.has(key)) {
            seen.add(key);
            foodDots.push({ x, y, eaten: false });
        }
    }

    console.log(`Generated ${foodDots.length} food dots from 5x7 generator (tile=${tile})`);
    if (foodDots.length < 50) {
        console.warn('Too few generated dots, falling back to manual pattern');
        createManualKonamiCodeDots();
    }
}

// Fallback function to create text dots manually if font fails to load
function createFallbackTextDots() {
    foodDots = [];
    const centerX = Math.floor(canvas.width / 2 / gridSize) * gridSize;
    const centerY = Math.floor(canvas.height / 2 / gridSize) * gridSize;

    // Create a simple pattern that forms visible dots - aligned to gridSize
    for (let y = -100; y <= 100; y += gridSize) {
        for (let x = -200; x <= 200; x += gridSize) {
            const dotX = centerX + x;
            const dotY = centerY + y;
            // Keep dots within canvas bounds
            if (dotX >= 0 && dotX < canvas.width && dotY >= 0 && dotY < canvas.height) {
                foodDots.push({
                    x: dotX,
                    y: dotY,
                    eaten: false
                });
            }
        }
    }
    console.log(`Created ${foodDots.length} fallback dots aligned to gridSize ${gridSize}`);
}

// Manual KONAMI CODE pattern - creates dots in the shape of letters
function createManualKonamiCodeDots() {
    foodDots = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = Math.min(canvas.width / 600, canvas.height / 400); // Scale based on canvas size

    // Letter patterns for "KONAMI CODE" - denser dot matrix for more gameplay
    const letters = [
        // K - more dots
        [[0,0],[0,1],[0,2],[0,3],[0,4],[1,1],[1,2],[2,0],[2,2],[2,3],[3,0],[3,4],[4,0],[4,1],[4,2],[4,3],[4,4]],
        // O - more dots
        [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,1],[4,2],[4,3]],
        // N - more dots
        [[0,0],[0,1],[0,2],[0,3],[0,4],[1,1],[1,2],[2,2],[2,3],[3,3],[3,4],[4,0],[4,1],[4,2],[4,3],[4,4]],
        // A - more dots
        [[0,4],[1,3],[1,1],[2,0],[2,1],[2,2],[2,3],[2,4],[3,0],[3,4],[4,0],[4,1],[4,2],[4,3],[4,4],[1,2],[3,2]],
        // M - more dots
        [[0,0],[0,1],[0,2],[0,3],[0,4],[1,1],[1,2],[2,0],[2,1],[2,2],[3,0],[3,1],[3,2],[4,0],[4,1],[4,2],[4,3],[4,4]],
        // I - more dots
        [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,0],[4,1],[4,2],[4,3],[4,4],[1,2],[2,2],[3,2]],
        // C - more dots
        [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,1],[4,2],[4,3],[1,2],[2,2],[3,2]],
        // O - more dots
        [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,1],[4,2],[4,3]],
        // D - more dots
        [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,1],[4,2],[4,3],[1,2],[2,2],[3,2]],
        // E - more dots
        [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[1,2],[1,4],[2,0],[2,2],[2,4],[3,0],[3,2],[3,4],[4,0],[4,1],[4,2],[4,3],[4,4]]
    ];

    let currentX = centerX - (letters.length * 50 * scale) / 2; // Center the text

    letters.forEach((letter, letterIndex) => {
        letter.forEach(([x, y]) => {
            const dotX = Math.floor((currentX + x * 6 * scale) / gridSize) * gridSize;
            const dotY = Math.floor((centerY - 15 * scale + y * 6 * scale) / gridSize) * gridSize;

            // Keep within bounds
            if (dotX >= 0 && dotX < canvas.width && dotY >= 0 && dotY < canvas.height) {
                // Avoid duplicates
                const exists = foodDots.some(dot => dot.x === dotX && dot.y === dotY);
                if (!exists) {
                    foodDots.push({
                        x: dotX,
                        y: dotY,
                        eaten: false
                    });
                }
            }
        });
        currentX += 45 * scale; // Space between letters
    });

    console.log(`Created ${foodDots.length} manual KONAMI CODE dots`);
}

// Activate game mode
function activateGame() {
    gameMode = 'game';
    isAnimating = false; // Stop text animation

    // Show Snake game controls (full controls)
    const virtualButtons = document.getElementById('virtualButtons');
    const breakoutButtons = document.getElementById('breakoutButtons');
    const leftButtons = document.querySelector('.left-buttons');
    const rightButtons = document.querySelector('.right-buttons');

    if (virtualButtons) virtualButtons.style.display = 'block';
    if (breakoutButtons) breakoutButtons.style.display = 'none';
    if (leftButtons) leftButtons.style.display = 'flex';
    if (rightButtons) rightButtons.style.display = 'flex';

    // Update control visibility
    updateControlVisibility();

    // Extract pixels before starting game
    extractTextPixels();

    // Clear canvas completely
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Initialize snake in the center
    const centerX = Math.floor(canvas.width / 2 / gridSize) * gridSize;
    const centerY = Math.floor(canvas.height / 2 / gridSize) * gridSize;

    snake = [
        { x: centerX, y: centerY },
        { x: centerX - gridSize, y: centerY },
        { x: centerX - gridSize * 2, y: centerY }
    ];

    snakeDirection = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;

    // Start game loop
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(gameLoop, 100);
}

// Game loop
function gameLoop() {
    // Update direction
    snakeDirection = { ...nextDirection };

    // Move snake
    const head = { ...snake[0] };
    head.x += snakeDirection.x * gridSize;
    head.y += snakeDirection.y * gridSize;

    // Wrap around screen
    if (head.x < 0) head.x = canvas.width - gridSize;
    if (head.x >= canvas.width) head.x = 0;
    if (head.y < 0) head.y = canvas.height - gridSize;
    if (head.y >= canvas.height) head.y = 0;

    // Check collision with self
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOver();
        return;
    }

    // Add new head
    snake.unshift(head);

    // Check if food eaten
    let foodEaten = false;

    for (let dot of foodDots) {
        if (!dot.eaten) {
            // Exact match since both snake and food are on the same grid
            if (dot.x === head.x && dot.y === head.y) {
                dot.eaten = true;
                foodEaten = true;
                score++;
                console.log(`Ate dot at (${dot.x}, ${dot.y})! Score: ${score}, Snake length: ${snake.length + 1}`);
                break;
            }
        }
    }

    // Remove tail if no food eaten
    if (!foodEaten) {
        snake.pop();
    }

    // Check win condition - but only if we have enough dots to make it challenging
    if (foodDots.length >= 50 && foodDots.every(dot => dot.eaten)) {
        winGame();
        return;
    }

    // Render
    render();
}

// Render function
function render() {
    // Disable image smoothing for pixelated rendering
    ctx.imageSmoothingEnabled = false;
    
    // Full clear for better visibility of eaten dots
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Use gridSize for consistent rendering (matches snake and food positioning)
    const dotSize = gridSize - 2; // Slightly smaller for visual gap

    // Draw food dots (only uneaten ones) - should be clearly visible
    ctx.fillStyle = '#fff';
    let visibleDots = 0;
    for (let dot of foodDots) {
        if (!dot.eaten) {
            ctx.fillRect(dot.x, dot.y, dotSize, dotSize);
            visibleDots++;
        }
    }

    // Debug: Log every 10 frames to avoid console spam
    if (Math.random() < 0.1) {
        console.log(`Rendering ${visibleDots} food dots, Snake at (${snake[0].x}, ${snake[0].y}), length: ${snake.length}`);
    }

    // Draw snake with clear visibility
    for (let i = 0; i < snake.length; i++) {
        const segment = snake[i];
        // Head is brighter, tail fades
        if (i === 0) {
            // Snake head - bright green with border for visibility
            ctx.fillStyle = '#0f0';
            ctx.fillRect(segment.x, segment.y, dotSize, dotSize);
            // Add border to head
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(segment.x, segment.y, dotSize, dotSize);
        } else {
            // Body - fades towards tail
            const alpha = 1 - (i / snake.length) * 0.6;
            ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
            ctx.fillRect(segment.x, segment.y, dotSize, dotSize);
        }
    }

    // Draw score
    ctx.fillStyle = '#fff';
    ctx.font = '20px Nothing, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}/${foodDots.length}`, 20, 30);
}

// Game over
function gameOver() {
    clearInterval(gameLoopInterval);

    // Apply blur to canvas only
    canvas.style.filter = 'blur(10px)';

    // Show overlay with sharp text
    const overlay = document.getElementById('overlay');
    const overlayText = document.getElementById('overlayText');
    const overlaySubtext = document.getElementById('overlaySubtext');
    const overlayFooter = document.getElementById('overlayFooter');

    const isMobile = window.innerWidth <= 768;

    overlay.style.display = 'flex';
    overlayText.textContent = 'WASTED';
    overlayText.style.color = '#ff0000';
    overlaySubtext.textContent = '';
    overlayFooter.textContent = isMobile ? 'Tap screen to restart' : 'Press any key to restart';

    setTimeout(() => {
        if (isMobile) {
            overlay.addEventListener('click', restartGame, { once: true });
        } else {
            document.addEventListener('keydown', restartGame, { once: true });
        }
    }, 500);
}

// Win game
function winGame() {
    clearInterval(gameLoopInterval);

    // Apply blur to canvas only
    canvas.style.filter = 'blur(10px)';

    // Show overlay with sharp text
    const overlay = document.getElementById('overlay');
    const overlayText = document.getElementById('overlayText');
    const overlaySubtext = document.getElementById('overlaySubtext');
    const overlayFooter = document.getElementById('overlayFooter');
    const giftLink = document.getElementById('giftLink');

    const isMobile = window.innerWidth <= 768;

    overlay.style.display = 'flex';
    overlayText.textContent = 'RESPECT++';
    overlayText.style.color = '#00ff00';
    overlaySubtext.textContent = `Score: ${score}`;
    overlaySubtext.style.color = '#fff';
    giftLink.style.display = 'block';
    overlayFooter.textContent = isMobile ? 'Tap screen to restart' : 'Press any key to restart';

    setTimeout(() => {
        if (isMobile) {
            overlay.addEventListener('click', restartGame, { once: true });
        } else {
            document.addEventListener('keydown', restartGame, { once: true });
        }
    }, 500);
}

// Reset game
function resetGame() {
    gameMode = 'text';
    konamiIndex = 0;
    winCodeIndex = 0;
    if (gameLoopInterval) clearInterval(gameLoopInterval);

    // Show Snake controls, hide Breakout controls
    const virtualButtons = document.getElementById('virtualButtons');
    const breakoutButtons = document.getElementById('breakoutButtons');
    const leftButtons = document.querySelector('.left-buttons');
    const rightButtons = document.querySelector('.right-buttons');

    if (virtualButtons) virtualButtons.style.display = 'none';
    if (breakoutButtons) breakoutButtons.style.display = 'none';
    if (leftButtons) leftButtons.style.display = 'flex';
    if (rightButtons) rightButtons.style.display = 'flex';

    // Remove blur
    canvas.style.filter = 'none';

    // Hide overlay and gift link
    const overlay = document.getElementById('overlay');
    const giftLink = document.getElementById('giftLink');
    overlay.style.display = 'none';
    giftLink.style.display = 'none';

    // Reset animation time
    animationTime = 0;

    // Restore canvas stacking
    setCanvasAboveControls(false);
    initTextMode();
}

// Restart game (from win/lose screen)
function restartGame() {
    konamiIndex = 0;
    winCodeIndex = 0;
    if (gameLoopInterval) clearInterval(gameLoopInterval);

    // Remove blur
    canvas.style.filter = 'none';

    // Hide overlay and gift link
    const overlay = document.getElementById('overlay');
    const giftLink = document.getElementById('giftLink');
    overlay.style.display = 'none';
    giftLink.style.display = 'none';

    // Directly activate game again (skip text mode)
    activateGame();
}

// Breakout win
function breakoutWin() {
    gameMode = 'breakout-win';

    // Apply blur to canvas
    canvas.style.filter = 'blur(10px)';

    // Show overlay
    const overlay = document.getElementById('overlay');
    const overlayText = document.getElementById('overlayText');
    const overlaySubtext = document.getElementById('overlaySubtext');
    const overlayFooter = document.getElementById('overlayFooter');
    const giftLink = document.getElementById('giftLink');

    const isMobile = window.innerWidth <= 768;

    overlay.style.display = 'flex';
    overlayText.textContent = 'RESPECT++';
    overlayText.style.color = '#00ff00';
    overlaySubtext.textContent = `Score: ${score}`;
    overlaySubtext.style.color = '#fff';
    giftLink.style.display = 'block';
    overlayFooter.textContent = isMobile ? 'Tap screen to restart' : 'Press any key to restart';

    setTimeout(() => {
        if (isMobile) {
            overlay.addEventListener('click', restartBreakout, { once: true });
        } else {
            document.addEventListener('keydown', restartBreakout, { once: true });
        }
    }, 500);
}

// Restart Breakout game (from win/lose screen)
function restartBreakout() {
    konamiIndex = 0;
    winCodeIndex = 0;
    if (gameLoopInterval) clearInterval(gameLoopInterval);

    // Remove blur
    canvas.style.filter = 'none';

    // Hide overlay and gift link
    const overlay = document.getElementById('overlay');
    const giftLink = document.getElementById('giftLink');
    overlay.style.display = 'none';
    giftLink.style.display = 'none';

    // Directly activate Breakout game again (skip text mode)
    activateTilesGame();
}

// Extract text pixels for Breakout bricks
function extractTextPixelsForBreakout() {
    console.log('Generating KONAMI CODE bricks from 5x7 generator');
    const { gen, tile, startX, startY } = getKonamiLayoutForMode('breakout');

    breakoutBricks = [];
    const seen = new Set();
    for (const c of gen.cells) {
        const x = Math.floor(startX + c.col * tile);
        const y = Math.floor(startY + c.row * tile);
        const key = `${x},${y}`;
        if (!seen.has(key)) {
            seen.add(key);
            breakoutBricks.push({ x, y, width: tile, height: tile, status: 1 });
        }
    }

    console.log(`Generated ${breakoutBricks.length} bricks for Breakout from generator (tile=${tile})`);
    if (breakoutBricks.length < 50) {
        console.warn('Too few generated bricks, using manual pattern');
        createManualKonamiCodeBricks();
    }
}

// Manual fallback for Breakout bricks when font fails to load
function createManualKonamiCodeBricks() {
    console.log('Creating manual KONAMI CODE brick pattern...');

    breakoutBricks = [];

    // Define the KONAMI CODE pattern manually
    const pattern = [
        // K
        [1,0,0,1],
        [1,0,1,0],
        [1,1,0,0],
        [1,0,1,0],
        [1,0,0,1],
        // O
        [0,1,1,0],
        [1,0,0,1],
        [1,0,0,1],
        [1,0,0,1],
        [0,1,1,0],
        // N
        [1,0,0,1],
        [1,1,0,1],
        [1,0,1,1],
        [1,0,0,1],
        [1,0,0,1],
        // A
        [0,1,0,0],
        [1,0,1,0],
        [1,1,1,0],
        [1,0,1,0],
        [1,0,1,0],
        // M
        [1,0,0,0,1],
        [1,1,0,1,1],
        [1,0,1,0,1],
        [1,0,0,0,1],
        [1,0,0,0,1],
        // I
        [1,1,1],
        [0,1,0],
        [0,1,0],
        [0,1,0],
        [1,1,1],
        //   (space)
        [0,0,0],
        [0,0,0],
        [0,0,0],
        [0,0,0],
        [0,0,0],
        // C
        [0,1,1,0],
        [1,0,0,1],
        [1,0,0,0],
        [1,0,0,1],
        [0,1,1,0],
        // O
        [0,1,1,0],
        [1,0,0,1],
        [1,0,0,1],
        [1,0,0,1],
        [0,1,1,0],
        // D
        [1,1,0,0],
        [1,0,1,0],
        [1,0,0,1],
        [1,0,1,0],
        [1,1,0,0],
        // E
        [1,1,1,1],
        [1,0,0,0],
        [1,1,1,0],
        [1,0,0,0],
        [1,1,1,1]
    ];

    const letterSpacing = 6; // pixels between letters
    const lineHeight = 6; // pixels between lines
    let currentX = 50;
    let currentY = 50;

    for (let letterIndex = 0; letterIndex < pattern.length; letterIndex++) {
        const letter = pattern[letterIndex];
        const letterWidth = letter[0].length || 1; // Handle variable width letters

        for (let row = 0; row < letter.length; row++) {
            for (let col = 0; col < letter[row].length; col++) {
                if (letter[row][col] === 1) {
                    breakoutBricks.push({
                        x: currentX + col * gridSize,
                        y: currentY + row * gridSize,
                        width: gridSize,
                        height: gridSize,
                        status: 1
                    });
                }
            }
        }

        currentX += letterWidth * gridSize + letterSpacing;

        // Wrap to next line if needed
        if (currentX > canvas.width - 100) {
            currentX = 50;
            currentY += 5 * gridSize + lineHeight;
        }
    }

    console.log(`Created ${breakoutBricks.length} manual KONAMI CODE bricks`);
}

// Initialize the game
initTextMode();

// Mobile controls
function setupMobileControls() {
    // Show controls button
    const showControlsBtn = document.getElementById('showControlsBtn');
    const hideControlsBtn = document.getElementById('hideControlsBtn');
    const mobileControls = document.getElementById('mobileControls');
    
    const applyResponsiveState = () => {
        const isMobile = window.innerWidth <= 768;
        if (showControlsBtn) {
            showControlsBtn.style.display = isMobile ? 'block' : 'none';
        }
    };

    if (showControlsBtn && mobileControls) {
        showControlsBtn.addEventListener('click', () => {
            mobileControls.style.display = 'flex';
            showControlsBtn.style.display = 'none';
            if (hideControlsBtn) hideControlsBtn.style.display = 'block';

            // Show appropriate controls based on current game mode
            updateControlVisibility();
            const breakoutButtons = document.getElementById('breakoutButtons');
            if (breakoutButtons && gameMode === 'breakout') {
                breakoutButtons.style.display = 'block';
            }
        });
    }
    
    if (hideControlsBtn && mobileControls) {
        hideControlsBtn.addEventListener('click', () => {
            mobileControls.style.display = 'none';
            hideControlsBtn.style.display = 'none';
            if (showControlsBtn && window.innerWidth <= 768) {
                showControlsBtn.style.display = 'block';
            }
        });
    }

    applyResponsiveState();
    window.addEventListener('resize', applyResponsiveState);
    
    // Snake game controls - using correct IDs from HTML
    const upBtn = document.querySelector('.btn-up');
    const downBtn = document.querySelector('.btn-down');
    const leftBtn = document.querySelector('.btn-left');
    const rightBtn = document.querySelector('.btn-right');
    
    // Function to handle direction change
    const changeDirection = (newDirection) => {
        if (gameMode === 'game') {
            nextDirection = newDirection;
        }
    };
    
    // Remove individual event listeners - use global handler instead
    
    // Breakout controls - using correct IDs from HTML
    const breakoutLeftBtn = document.querySelector('.btn-left-breakout');
    const breakoutRightBtn = document.querySelector('.btn-right-breakout');
    
    // Remove individual event listeners - use global handler instead
    // However, for Breakout we want precise hold and toggle behavior on mobile,
    // so add explicit listeners to the breakout buttons to ensure reliable movement.
    if (breakoutLeftBtn && breakoutRightBtn) {
        const bindBreakoutButton = (btn, dir) => {
            // touchstart / pointerdown -> start movement
            btn.addEventListener('touchstart', (ev) => {
                ev.preventDefault();
                paddleMovement[dir] = true;
                btn.classList.add('pressed');
            }, { passive: false });

            btn.addEventListener('pointerdown', (ev) => {
                if (ev.pointerType === 'mouse' && ev.button !== 0) return;
                paddleMovement[dir] = true;
                btn.classList.add('pressed');
            });

            // touchend / pointerup -> stop movement
            btn.addEventListener('touchend', (ev) => {
                ev.preventDefault();
                paddleMovement[dir] = false;
                btn.classList.remove('pressed');
            }, { passive: false });

            btn.addEventListener('pointerup', () => {
                paddleMovement[dir] = false;
                btn.classList.remove('pressed');
            });

            // click toggles movement for quick taps
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                paddleMovement[dir] = !paddleMovement[dir];
                if (!paddleMovement[dir]) btn.classList.remove('pressed');
                else btn.classList.add('pressed');
            });
        };

        bindBreakoutButton(breakoutLeftBtn, 'left');
        bindBreakoutButton(breakoutRightBtn, 'right');
    }
    
    // Global event handler for all mobile buttons (both touch and click)
    const handleButtonPress = (e) => {
        const button = e.target.closest('[data-key]');
        if (!button) return;

        // If this is one of the breakout-specific buttons, ignore here because
        // they have dedicated handlers to support hold/release behavior.
        if (button.classList.contains('btn-left-breakout') || button.classList.contains('btn-right-breakout')) return;

        const key = button.getAttribute('data-key');
        if (!key) return;

        e.preventDefault();
        e.stopPropagation();

        // Add visual feedback
        button.classList.add('pressed');
        setTimeout(() => {
            button.classList.remove('pressed');
        }, 150);

        console.log(`Button pressed: ${key}, gameMode: ${gameMode}`);

    // Normalize keys for letters (mobile buttons may use uppercase letters in data-key)
    const normalizedKeyForCheck = (key.length === 1) ? key.toLowerCase() : key;
    // Check Konami code directly for mobile buttons
    checkKonamiCode(normalizedKeyForCheck);

        // Also advance tiles and win codes the same way keyboard input does
    const keyLower = key.toLowerCase();
        const expectedTilesKey = tilesCode[tilesCodeIndex] ? tilesCode[tilesCodeIndex].toLowerCase() : null;
        const expectedWinKey = winCode[winCodeIndex] ? winCode[winCodeIndex].toLowerCase() : null;

        // Check for tiles game code (only in text mode)
        if (gameMode === 'text') {
            if (expectedTilesKey && keyLower === expectedTilesKey) {
                tilesCodeIndex++;
                if (tilesCodeIndex === tilesCode.length) {
                    tilesCodeIndex = 0;
                    activateTilesGame();
                }
            } else {
                tilesCodeIndex = 0;
            }
        }

        // Check for instant win code (only during snake gameplay)
        if (gameMode === 'game') {
            if (expectedWinKey && keyLower === expectedWinKey) {
                winCodeIndex++;
                if (winCodeIndex === winCode.length) {
                    winCodeIndex = 0;
                    winGame();
                }
            } else {
                winCodeIndex = 0;
            }
        }

        // Reset other code indices when in breakout mode (same logic as keyboard)
        if (gameMode === 'breakout') {
            if (konamiIndex === 0) {
                winCodeIndex = 0;
                tilesCodeIndex = 0;
            }
        }

        // Handle game-specific actions
        if (gameMode === 'game') {
            // Handle snake game direction changes
            switch(key) {
                case 'ArrowUp':
                    if (snakeDirection.y === 0) nextDirection = { x: 0, y: -1 };
                    break;
                case 'ArrowDown':
                    if (snakeDirection.y === 0) nextDirection = { x: 0, y: 1 };
                    break;
                case 'ArrowLeft':
                    if (snakeDirection.x === 0) nextDirection = { x: -1, y: 0 };
                    break;
                case 'ArrowRight':
                    if (snakeDirection.x === 0) nextDirection = { x: 1, y: 0 };
                    break;
                default:
                    // For A, B, T, L buttons - already handled by checkKonamiCode
                    break;
            }
        } else if (gameMode === 'breakout') {
            // Handle breakout paddle movement
            if (key === 'ArrowLeft') {
                paddleMovement.left = true;
                console.log('Breakout paddle moving LEFT');
            } else if (key === 'ArrowRight') {
                paddleMovement.right = true;
                console.log('Breakout paddle moving RIGHT');
            }
        }
    };
    
    // Handle touch end for breakout paddle
    const handleButtonRelease = (e) => {
        const button = e.target.closest('[data-key]');
        if (!button) return;
        
        const key = button.getAttribute('data-key');
        if (!key || gameMode !== 'breakout') return;
        
        e.preventDefault();
        e.stopPropagation();

        // If this is a breakout-specific button, ignore here because
        // breakout buttons have dedicated release handlers to avoid conflicts.
        if (button.classList.contains('btn-left-breakout') || button.classList.contains('btn-right-breakout')) return;
        
        if (key === 'ArrowLeft') {
            paddleMovement.left = false;
            console.log('Breakout paddle stopped LEFT');
        } else if (key === 'ArrowRight') {
            paddleMovement.right = false;
            console.log('Breakout paddle stopped RIGHT');
        }
    };;
    
    // Add global event listeners. Use touch events on touch-capable devices to avoid
    // duplicate touchstart+click sequences; fall back to click for pointer/mouse devices.
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.addEventListener('touchstart', handleButtonPress, { passive: false });
        document.addEventListener('touchend', handleButtonRelease, { passive: false });
    } else if (window.PointerEvent) {
        // Pointer events are a good unified option
        document.addEventListener('pointerdown', (e) => {
            // Only handle primary button
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            handleButtonPress(e);
        });
        document.addEventListener('pointerup', handleButtonRelease);
    } else {
        document.addEventListener('click', handleButtonPress);
        // click doesn't need a dedicated release handler
    }
}

// Update control visibility based on game mode
function updateControlVisibility() {
    const virtualButtons = document.getElementById('virtualButtons');
    const breakoutButtons = document.getElementById('breakoutButtons');
    const mobileControls = document.getElementById('mobileControls');
    
    if (gameMode === 'breakout') {
        // Show only breakout controls (left/right)
        if (virtualButtons) virtualButtons.classList.add('hidden');
        if (breakoutButtons) {
            breakoutButtons.classList.remove('hidden');
            breakoutButtons.style.display = 'block';
        }
        // Ensure mobile controls container is visible on mobile
        if (window.innerWidth <= 768 && mobileControls) {
            mobileControls.style.display = 'flex';
        }
    } else {
        // Show full controls for text mode and snake game
        if (virtualButtons) virtualButtons.classList.remove('hidden');
        if (breakoutButtons) {
            breakoutButtons.classList.add('hidden');
            breakoutButtons.style.display = 'none';
        }
    }
}

// Breakout game functions
function activateTilesGame() {
    gameMode = 'breakout';
    isAnimating = false;

    // Show Breakout controls, hide Snake controls
    const virtualButtons = document.getElementById('virtualButtons');
    const breakoutButtons = document.getElementById('breakoutButtons');
    const leftButtons = document.querySelector('.left-buttons');
    const rightButtons = document.querySelector('.right-buttons');
    const mobileControls = document.getElementById('mobileControls');
    const showControlsBtn = document.getElementById('showControlsBtn');

    // Hide snake controls
    if (virtualButtons) {
        virtualButtons.classList.add('hidden');
        virtualButtons.style.display = 'none';
    }
    
    // Show breakout controls
    if (breakoutButtons) {
        breakoutButtons.classList.remove('hidden');
        breakoutButtons.style.display = 'block';
        breakoutButtons.style.visibility = 'visible';
        breakoutButtons.style.opacity = '1';
        console.log('Breakout buttons shown:', {
            display: breakoutButtons.style.display,
            visibility: breakoutButtons.style.visibility,
            opacity: breakoutButtons.style.opacity,
            classList: breakoutButtons.classList.toString()
        });
    }
    
    if (leftButtons) leftButtons.style.display = 'none';
    if (rightButtons) rightButtons.style.display = 'none';

    // On mobile, auto-show controls for breakout
    const isMobile = window.innerWidth <= 768;
    if (isMobile && mobileControls && showControlsBtn) {
        mobileControls.style.display = 'flex';
        mobileControls.style.visibility = 'visible';
        showControlsBtn.style.display = 'none';
        const hideControlsBtn = document.getElementById('hideControlsBtn');
        if (hideControlsBtn) hideControlsBtn.style.display = 'block';
        console.log('Mobile controls shown:', {
            display: mobileControls.style.display,
            visibility: mobileControls.style.visibility,
            zIndex: mobileControls.style.zIndex
        });
    }

    // Update control visibility
    updateControlVisibility();

    // Initialize breakout game
    // Keep controls ABOVE canvas so buttons are visible
    setCanvasAboveControls(false);
    initBreakout();

    // Start breakout game loop
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(breakoutGameLoop, 16); // ~60 FPS
}

function initBreakout() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Initialize paddle - position above mobile controls
    const isMobile = window.innerWidth <= 768;
    const controlsHeight = isMobile ? 180 : 0;
    paddle.x = canvas.width / 2 - paddle.width / 2;
    paddle.y = canvas.height - controlsHeight - 50;

    // Initialize ball
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.dx = ball.speed * (Math.random() > 0.5 ? 1 : -1);
    ball.dy = -ball.speed;

    // Extract KONAMI CODE text pixels for bricks
    extractTextPixelsForBreakout();

    score = 0;
}

function breakoutGameLoop() {
    // Don't run game loop if in win/lose state
    if (gameMode === 'breakout-win' || gameMode === 'breakout-lose') {
        return;
    }

    // Update paddle
    if (paddleMovement.left && paddle.x > 0) {
        paddle.x -= paddle.speed;
    }
    if (paddleMovement.right && paddle.x < canvas.width - paddle.width) {
        paddle.x += paddle.speed;
    }

    // Keep paddle at fixed position above controls on mobile
    const isMobile = window.innerWidth <= 768;
    const controlsHeight = isMobile ? 180 : 0;
    paddle.y = canvas.height - controlsHeight - 50;

    // Update ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Ball collision with walls
    if (ball.x + ball.dx > canvas.width - ball.radius || ball.x + ball.dx < ball.radius) {
        ball.dx = -ball.dx;
    }
    if (ball.y + ball.dy < ball.radius) {
        ball.dy = -ball.dy;
    }

    // Ball collision with paddle - check first before game over
    if (ball.y + ball.radius >= paddle.y && 
        ball.y - ball.radius <= paddle.y + paddle.height &&
        ball.x >= paddle.x && 
        ball.x <= paddle.x + paddle.width) {
        // Only bounce if ball is moving downward
        if (ball.dy > 0) {
            ball.dy = -ball.dy;
            // Prevent ball from getting stuck in paddle
            ball.y = paddle.y - ball.radius;
        }
    } else if (ball.y + ball.dy > paddle.y + paddle.height + ball.radius) {
        // Ball went below paddle - game over
        breakoutGameOver();
        return;
    }

    // Ball collision with bricks
    for (let i = 0; i < breakoutBricks.length; i++) {
        const brick = breakoutBricks[i];
        if (brick.status === 1) {
            if (ball.x > brick.x && ball.x < brick.x + brick.width &&
                ball.y > brick.y && ball.y < brick.y + brick.height) {
                ball.dy = -ball.dy;
                brick.status = 0;
                score++;

                // Check win condition
                if (score === breakoutBricks.length) {
                    breakoutWin();
                    return;
                }
            }
        }
    }

    // Render
    renderBreakout();
}

function renderBreakout() {
    // Disable image smoothing for pixelated rendering
    ctx.imageSmoothingEnabled = false;
    
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw paddle
    ctx.fillStyle = '#fff';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);

    // Draw ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.closePath();

    // Draw bricks
    for (let i = 0; i < breakoutBricks.length; i++) {
        const brick = breakoutBricks[i];
        if (brick.status === 1) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
        }
    }

    // Draw score
    ctx.fillStyle = '#fff';
    ctx.font = '20px Nothing, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}/${breakoutBricks.length}`, 20, 30);
}

function breakoutGameOver() {
    gameMode = 'breakout-lose';
    clearInterval(gameLoopInterval);

    // Apply blur to canvas
    canvas.style.filter = 'blur(10px)';

    // Show overlay
    const overlay = document.getElementById('overlay');
    const overlayText = document.getElementById('overlayText');
    const overlaySubtext = document.getElementById('overlaySubtext');
    const overlayFooter = document.getElementById('overlayFooter');

    const isMobile = window.innerWidth <= 768;

    overlay.style.display = 'flex';
    overlayText.textContent = 'WASTED';
    overlayText.style.color = '#ff0000';
    overlaySubtext.textContent = '';
    overlayFooter.textContent = isMobile ? 'Tap screen to restart' : 'Press any key to restart';

    setTimeout(() => {
        if (isMobile) {
            overlay.addEventListener('click', restartBreakout, { once: true });
        } else {
            document.addEventListener('keydown', restartBreakout, { once: true });
        }
    }, 500);
}

// Setup mobile controls when DOM is loaded
document.addEventListener('DOMContentLoaded', setupMobileControls);
