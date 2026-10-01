/* ============================================
   Jogo da Trufa - Labirinto 2D
   Lógica do jogo, geração de labirintos e
   renderização no Canvas
   ============================================ */

// ===== Configuração =====
const CONFIG = {
    mazeRows: 20,         // Células do labirinto (linhas)
    mazeCols: 20,         // Células do labirinto (colunas)
    cellSize: 14,         // Tamanho de cada célula em pixels
    gameDuration: 45,     // Tempo limite em segundos
    warningTime: 10,      // Segundos para ativar alerta visual
};

// Dimensões derivadas da grade (cada célula vira 2 posições + 1 borda)
const GRID_H = CONFIG.mazeRows * 2 + 1;   // 41
const GRID_W = CONFIG.mazeCols * 2 + 1;    // 41
const CANVAS_W = GRID_W * CONFIG.cellSize; // 574
const CANVAS_H = GRID_H * CONFIG.cellSize; // 574

// ===== Paleta de Cores =====
const CORES = {
    parede:        '#4a3728',
    caminho:       '#f5e6d3',
    jogador:       '#e67e22',
    jogadorBorda:  '#d35400',
    jogadorFrente: '#ffffff',
    trufa:         '#6B4E3D',
    trufaBrilho:   '#D4A373',
    trufaGloss:    'rgba(255, 255, 255, 0.4)',
    saidaGlow:     'rgba(212, 163, 115, 0.35)',
};

// ===== Estado do Jogo =====
let labirinto = [];
let jogadorX = 1;
let jogadorY = 1;
let direcao = 'baixo';
let saidaX, saidaY;
let tempoRestante = CONFIG.gameDuration;
let intervaloTimer = null;
let jogoTerminou = false;

// ===== Referências DOM =====
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const barraTimer = document.getElementById('timer-bar');
const textoTimer = document.getElementById('timer-text');
const statusEl = document.getElementById('game-status');

// Configurar dimensões do canvas
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;


/* ================================================
   GERAÇÃO DO LABIRINTO
   Algoritmo: DFS Recursive Backtracker
   Gera labirintos perfeitos (1 caminho único
   entre quaisquer 2 pontos) aleatoriamente.
   ================================================ */

/**
 * Embaralha um array in-place (Fisher-Yates)
 */
function embaralhar(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Gera um novo labirinto aleatório e define
 * as posições de início e saída.
 */
function gerarLabirinto() {
    // Inicializar toda a grade com paredes (1)
    labirinto = [];
    for (let r = 0; r < GRID_H; r++) {
        labirinto[r] = [];
        for (let c = 0; c < GRID_W; c++) {
            labirinto[r][c] = 1;
        }
    }

    // Controlo de células visitadas pelo algoritmo
    const visitado = [];
    for (let r = 0; r < CONFIG.mazeRows; r++) {
        visitado[r] = [];
        for (let c = 0; c < CONFIG.mazeCols; c++) {
            visitado[r][c] = false;
        }
    }

    /**
     * Escava recursivamente a partir da célula (r, c).
     * Cada célula do labirinto ocupa a posição (r*2+1, c*2+1) na grade.
     * As paredes entre células estão nas posições pares.
     */
    function escavar(r, c) {
        visitado[r][c] = true;
        labirinto[r * 2 + 1][c * 2 + 1] = 0; // Abrir a célula

        // Tentar as 4 direções em ordem aleatória
        const direcoes = embaralhar([
            [0, 1],   // direita
            [1, 0],   // baixo
            [0, -1],  // esquerda
            [-1, 0]   // cima
        ]);

        for (const [dr, dc] of direcoes) {
            const nr = r + dr;
            const nc = c + dc;

            if (nr >= 0 && nr < CONFIG.mazeRows &&
                nc >= 0 && nc < CONFIG.mazeCols &&
                !visitado[nr][nc]) {
                // Remover a parede entre a célula atual e a vizinha
                labirinto[r * 2 + 1 + dr][c * 2 + 1 + dc] = 0;
                escavar(nr, nc);
            }
        }
    }

    // Começar a escavar a partir do canto superior esquerdo
    escavar(0, 0);

    // Criar caminhos alternativos removendo paredes extras (loops e bifurcações)
    criarCaminhosAlternativos();

    // Posição inicial do jogador (canto superior esquerdo da grade)
    jogadorX = 1;
    jogadorY = 1;

    // Posição da saída/trufa (canto inferior direito da grade)
    saidaX = GRID_W - 2;
    saidaY = GRID_H - 2;
}

/**
 * Remove paredes internas para criar loops e múltiplos caminhos.
 * O labirinto DFS puro tem apenas 1 caminho entre quaisquer 2 pontos.
 * Ao remover paredes extras, criamos bifurcações onde o jogador
 * precisa pensar e escolher qual direção seguir.
 */
function criarCaminhosAlternativos() {
    var paredesRemoviveis = [];

    // Identificar todas as paredes internas que podem ser removidas
    for (var r = 1; r < GRID_H - 1; r++) {
        for (var c = 1; c < GRID_W - 1; c++) {
            if (labirinto[r][c] === 1) {
                // Parede vertical (entre duas células lado a lado horizontalmente)
                // Posição: linha ímpar, coluna par
                if (r % 2 === 1 && c % 2 === 0) {
                    if (labirinto[r][c - 1] === 0 && labirinto[r][c + 1] === 0) {
                        paredesRemoviveis.push([r, c]);
                    }
                }
                // Parede horizontal (entre duas células uma acima da outra)
                // Posição: linha par, coluna ímpar
                if (r % 2 === 0 && c % 2 === 1) {
                    if (labirinto[r - 1][c] === 0 && labirinto[r + 1][c] === 0) {
                        paredesRemoviveis.push([r, c]);
                    }
                }
            }
        }
    }

    // Embaralhar e remover ~30% das paredes removíveis
    embaralhar(paredesRemoviveis);
    var numRemover = Math.floor(paredesRemoviveis.length * 0.12);

    for (var i = 0; i < numRemover; i++) {
        labirinto[paredesRemoviveis[i][0]][paredesRemoviveis[i][1]] = 0;
    }
}


/* ================================================
   RENDERIZAÇÃO (Canvas 2D)
   ================================================ */

// Variável para animação de brilho pulsante
let brilhoFase = 0;
let animacaoId = null;

/**
 * Loop de animação contínuo para efeitos de brilho pulsante.
 */
function loopAnimacao() {
    brilhoFase += 0.04;
    if (brilhoFase > Math.PI * 2) brilhoFase -= Math.PI * 2;
    desenhar();
    if (!jogoTerminou) {
        animacaoId = requestAnimationFrame(loopAnimacao);
    }
}

/**
 * Inicia o loop de animação de brilho.
 */
function iniciarAnimacao() {
    if (animacaoId) cancelAnimationFrame(animacaoId);
    brilhoFase = 0;
    animacaoId = requestAnimationFrame(loopAnimacao);
}

/**
 * Para o loop de animação.
 */
function pararAnimacao() {
    if (animacaoId) {
        cancelAnimationFrame(animacaoId);
        animacaoId = null;
    }
}

/**
 * Desenha todo o estado atual do jogo no canvas.
 */
function desenhar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    desenharLabirinto();
    desenharBrilhoSaida();
    desenharTrufa(saidaX, saidaY);
    desenharCarro(jogadorX, jogadorY);
}

/**
 * Desenha as paredes e caminhos do labirinto.
 */
function desenharLabirinto() {
    for (let r = 0; r < GRID_H; r++) {
        for (let c = 0; c < GRID_W; c++) {
            ctx.fillStyle = labirinto[r][c] === 1 ? CORES.parede : CORES.caminho;
            ctx.fillRect(c * CONFIG.cellSize, r * CONFIG.cellSize, CONFIG.cellSize, CONFIG.cellSize);
        }
    }
}

/**
 * Desenha um brilho suave e pulsante ao redor da saída para guiar o jogador.
 */
function desenharBrilhoSaida() {
    const cx = saidaX * CONFIG.cellSize + CONFIG.cellSize / 2;
    const cy = saidaY * CONFIG.cellSize + CONFIG.cellSize / 2;
    const pulso = 0.5 + Math.sin(brilhoFase) * 0.3;
    const raio = CONFIG.cellSize * 3.0;

    // Camada de brilho externo (dourado pulsante)
    const gradiente = ctx.createRadialGradient(cx, cy, 2, cx, cy, raio);
    gradiente.addColorStop(0, 'rgba(212, 163, 115, ' + (0.5 * pulso) + ')');
    gradiente.addColorStop(0.5, 'rgba(212, 163, 115, ' + (0.2 * pulso) + ')');
    gradiente.addColorStop(1, 'transparent');

    ctx.fillStyle = gradiente;
    ctx.fillRect(
        (saidaX - 3) * CONFIG.cellSize,
        (saidaY - 3) * CONFIG.cellSize,
        CONFIG.cellSize * 7,
        CONFIG.cellSize * 7
    );

    // Camada interna (brilho branco intenso)
    const brilhoInterno = ctx.createRadialGradient(cx, cy, 1, cx, cy, CONFIG.cellSize * 1.2);
    brilhoInterno.addColorStop(0, 'rgba(255, 255, 220, ' + (0.4 * pulso) + ')');
    brilhoInterno.addColorStop(1, 'transparent');

    ctx.fillStyle = brilhoInterno;
    ctx.fillRect(
        (saidaX - 1) * CONFIG.cellSize,
        (saidaY - 1) * CONFIG.cellSize,
        CONFIG.cellSize * 3,
        CONFIG.cellSize * 3
    );
}

/**
 * Desenha a trufa (chocolate) na posição de saída — maior e com brilho.
 */
function desenharTrufa(gx, gy) {
    const cx = gx * CONFIG.cellSize + CONFIG.cellSize / 2;
    const cy = gy * CONFIG.cellSize + CONFIG.cellSize / 2;
    const raio = CONFIG.cellSize * 0.48;
    const pulso = 0.7 + Math.sin(brilhoFase * 1.5) * 0.3;

    // Halo dourado pulsante ao redor da trufa
    ctx.save();
    ctx.shadowColor = 'rgba(212, 163, 115, ' + pulso + ')';
    ctx.shadowBlur = 10 + Math.sin(brilhoFase) * 5;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Sombra no chão
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.arc(cx + 1, cy + 2, raio * 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Corpo principal da trufa
    ctx.fillStyle = CORES.trufa;
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.fill();

    // Contorno
    ctx.strokeStyle = '#5a3d2e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    // Brilho interno (reflexo quente)
    ctx.fillStyle = CORES.trufaBrilho;
    ctx.beginPath();
    ctx.arc(cx - raio * 0.12, cy - raio * 0.12, raio * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Ponto de luz especular
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.35 + Math.sin(brilhoFase * 2) * 0.2) + ')';
    ctx.beginPath();
    ctx.arc(cx - raio * 0.25, cy - raio * 0.3, raio * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Segundo ponto de luz menor
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(cx + raio * 0.2, cy + raio * 0.15, raio * 0.12, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Desenha o carro (jogador) com indicador de direção — maior e com brilho.
 */
function desenharCarro(gx, gy) {
    const x = gx * CONFIG.cellSize;
    const y = gy * CONFIG.cellSize;
    const s = CONFIG.cellSize;
    const m = 1; // margem interna reduzida (era 3, agora 1)
    const pulso = 0.6 + Math.sin(brilhoFase * 1.2 + 1) * 0.4;

    // Halo luminoso pulsante ao redor do jogador
    ctx.save();
    ctx.shadowColor = 'rgba(230, 126, 34, ' + pulso + ')';
    ctx.shadowBlur = 8 + Math.sin(brilhoFase) * 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Corpo do carro (maior com margem reduzida)
    ctx.fillStyle = CORES.jogador;
    const raioRect = 3;
    roundRect(ctx, x + m, y + m, s - m * 2, s - m * 2, raioRect);
    ctx.fill();

    // Contorno
    ctx.strokeStyle = CORES.jogadorBorda;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    // Indicador de direção (triângulo branco apontando para onde o carro se move)
    ctx.fillStyle = CORES.jogadorFrente;
    const centro = s / 2;
    const t = 4; // tamanho do triângulo (era 3.5)

    ctx.beginPath();
    switch (direcao) {
        case 'cima':
            ctx.moveTo(x + centro, y + m + 1);
            ctx.lineTo(x + centro - t, y + m + 1 + t * 1.3);
            ctx.lineTo(x + centro + t, y + m + 1 + t * 1.3);
            break;
        case 'baixo':
            ctx.moveTo(x + centro, y + s - m - 1);
            ctx.lineTo(x + centro - t, y + s - m - 1 - t * 1.3);
            ctx.lineTo(x + centro + t, y + s - m - 1 - t * 1.3);
            break;
        case 'esquerda':
            ctx.moveTo(x + m + 1, y + centro);
            ctx.lineTo(x + m + 1 + t * 1.3, y + centro - t);
            ctx.lineTo(x + m + 1 + t * 1.3, y + centro + t);
            break;
        case 'direita':
            ctx.moveTo(x + s - m - 1, y + centro);
            ctx.lineTo(x + s - m - 1 - t * 1.3, y + centro - t);
            ctx.lineTo(x + s - m - 1 - t * 1.3, y + centro + t);
            break;
    }
    ctx.closePath();
    ctx.fill();
}

/**
 * Desenha um retângulo com cantos arredondados.
 */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}


/* ================================================
   MOVIMENTAÇÃO DO JOGADOR
   ================================================ */

/**
 * Move o jogador na direção indicada (dx, dy).
 * Verifica colisões com paredes antes de mover.
 */
function mover(dx, dy) {
    if (jogoTerminou) return;

    // Atualizar a direção visual do carro
    if (dy < 0) direcao = 'cima';
    else if (dy > 0) direcao = 'baixo';
    else if (dx < 0) direcao = 'esquerda';
    else if (dx > 0) direcao = 'direita';

    const novoX = jogadorX + dx;
    const novoY = jogadorY + dy;

    // Verificar limites da grade e se a posição destino é caminho (0)
    if (novoX >= 0 && novoX < GRID_W &&
        novoY >= 0 && novoY < GRID_H &&
        labirinto[novoY][novoX] === 0) {

        jogadorX = novoX;
        jogadorY = novoY;
        desenhar();

        // Verificar se chegou à saída (vitória)
        if (jogadorX === saidaX && jogadorY === saidaY) {
            vencer();
        }
    } else {
        // Mesmo sem mover, redesenhar para atualizar a direção visual
        desenhar();
    }
}


/* ================================================
   TEMPORIZADOR
   ================================================ */

/**
 * Inicia a contagem regressiva do temporizador.
 */
function iniciarTimer() {
    pararTimer();
    tempoRestante = CONFIG.gameDuration;
    atualizarBarraTimer();

    intervaloTimer = setInterval(function () {
        tempoRestante--;
        atualizarBarraTimer();

        if (tempoRestante <= 0) {
            perder();
        }
    }, 1000);
}

/**
 * Atualiza a barra visual e o texto do temporizador.
 */
function atualizarBarraTimer() {
    const percentual = (tempoRestante / CONFIG.gameDuration) * 100;
    barraTimer.style.width = percentual + '%';
    textoTimer.textContent = '⏱ ' + tempoRestante + 's';

    // Ativar alerta visual quando falta pouco tempo
    if (tempoRestante <= CONFIG.warningTime) {
        barraTimer.classList.add('warning');
    } else {
        barraTimer.classList.remove('warning');
    }
}

/**
 * Para o temporizador.
 */
function pararTimer() {
    if (intervaloTimer) {
        clearInterval(intervaloTimer);
        intervaloTimer = null;
    }
}


/* ================================================
   CONTROLO DO JOGO (Vitória, Derrota, Novo Jogo)
   ================================================ */

/**
 * Chamado quando o jogador encontra a trufa.
 */
function vencer() {
    jogoTerminou = true;
    pararTimer();
    pararAnimacao();

    const tempoGasto = CONFIG.gameDuration - tempoRestante;
    statusEl.textContent = '🎉 Encontrou a trufa em ' + tempoGasto + 's!';
    statusEl.className = 'game-status win';
    desenhar();

    // Salvar resultado no servidor (se jogador autenticado)
    if (typeof salvarResultadoLabirinto === 'function') {
        salvarResultadoLabirinto(tempoGasto);
    }

    // Esconder botão novo jogo e agendar reload
    agendarReloadPagina();
}

/**
 * Chamado quando o tempo se esgota.
 */
function perder() {
    jogoTerminou = true;
    pararTimer();
    pararAnimacao();

    statusEl.textContent = '⏰ Tempo esgotado! Tente novamente.';
    statusEl.className = 'game-status lose';

    // Redesenhar para mostrar o estado final
    desenhar();

    // Agendar reload da página
    agendarReloadPagina();
}

/**
 * Reinicia tudo: gera novo labirinto, reseta timer e estado.
 */
function novoJogo() {
    jogoTerminou = false;
    direcao = 'baixo';
    statusEl.textContent = '';
    statusEl.className = 'game-status';
    barraTimer.classList.remove('warning');

    gerarLabirinto();
    desenhar();
    iniciarTimer();
    iniciarAnimacao();
}


/* ================================================
   EVENT LISTENERS
   ================================================ */

// --- Teclado (Setas + WASD) ---
document.addEventListener('keydown', function (e) {
    const tecla = e.key;

    if (tecla === 'ArrowUp' || tecla === 'w' || tecla === 'W') {
        e.preventDefault();
        mover(0, -1);
    } else if (tecla === 'ArrowDown' || tecla === 's' || tecla === 'S') {
        e.preventDefault();
        mover(0, 1);
    } else if (tecla === 'ArrowLeft' || tecla === 'a' || tecla === 'A') {
        e.preventDefault();
        mover(-1, 0);
    } else if (tecla === 'ArrowRight' || tecla === 'd' || tecla === 'D') {
        e.preventDefault();
        mover(1, 0);
    }
});

// --- Botões de controlo (D-Pad para mobile/touch) ---
function adicionarControlo(idBotao, dx, dy) {
    var botao = document.getElementById(idBotao);

    // Click para mouse
    botao.addEventListener('click', function () {
        mover(dx, dy);
    });

    // Touchstart para resposta mais rápida no mobile
    botao.addEventListener('touchstart', function (e) {
        e.preventDefault();
        mover(dx, dy);
    });
}

adicionarControlo('btn-up', 0, -1);
adicionarControlo('btn-down', 0, 1);
adicionarControlo('btn-left', -1, 0);
adicionarControlo('btn-right', 1, 0);

// --- Botão Novo Jogo ---
document.getElementById('btn-new-game').addEventListener('click', novoJogo);


/* ================================================
   RELOAD AUTOMÁTICO APÓS FIM DE JOGO
   Exibe contagem regressiva de 5s e recarrega a página.
   ================================================ */

/**
 * Agenda o reload da página com contagem regressiva de 5 segundos.
 * Mostra um aviso abaixo do status do jogo.
 */
function agendarReloadPagina() {
    // Esconder botão novo jogo
    const btnNovoJogo = document.getElementById('btn-new-game');
    if (btnNovoJogo) btnNovoJogo.style.display = 'none';

    // Criar elemento de contagem regressiva para reload
    const reloadInfo = document.createElement('div');
    reloadInfo.id = 'reload-countdown';
    reloadInfo.className = 'reload-countdown';
    reloadInfo.textContent = '🔄 Voltando ao início em 5s...';

    // Inserir após o status do jogo
    statusEl.parentNode.insertBefore(reloadInfo, statusEl.nextSibling);

    let segundosRestantes = 4;

    const intervaloReload = setInterval(function () {
        reloadInfo.textContent = '🔄 Voltando ao início em ' + segundosRestantes + 's...';
        segundosRestantes--;

        if (segundosRestantes < 0) {
            clearInterval(intervaloReload);
            reloadInfo.textContent = '🔄 Recarregando...';
            window.location.reload();
        }
    }, 1000);
}


/* ================================================
   INICIALIZAÇÃO
   O jogo NÃO inicia automaticamente.
   Aguarda a validação do PIN em script.js
   para chamar novoJogo() via mostrarJogo().
   ================================================ */
// Preparar o labirinto inicial (sem timer) para exibir visualmente
gerarLabirinto();
desenhar();
