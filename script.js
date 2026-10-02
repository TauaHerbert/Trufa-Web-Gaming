const API_URL = 'https://script.google.com/macros/s/AKfycbyqO36T5Jy_tgDychKYEzYXwl65maWWscYYsqndP-PfkQvr2qqocQC7di8PnImoJEyh/exec';

let dadosGlobais = [];
let saboresGlobais = {};
let listaClientesGlobal = [];
let rankingLabirintoGlobal = [];

// ===== Jogador autenticado =====
let jogadorAutenticado = null; // { id, nome }
let partidaAtualId = null;     // ID da partida registrada no backend ao validar acesso

async function carregarRanking() {
    try {
        const resposta = await fetch(API_URL);
        const dados = await resposta.json();

        // A API retorna { ranking: [...], sabores: {...}, listaClientes: [...], rankingLabirinto: [...] }
        dadosGlobais = dados.ranking || [];
        saboresGlobais = dados.sabores || {};
        listaClientesGlobal = dados.listaClientes || dados.clientes || [];
        rankingLabirintoGlobal = dados.rankingLabirinto || [];

        document.getElementById('status').style.display = 'none';

        renderizarLista('totalMes', 'lista-mes');
        renderizarLista('totalGeral', 'lista-geral');
        renderizarTopSabores();

        // Popular o combobox de clientes no login do labirinto
        popularComboboxClientes();

        // Renderizar ranking do labirinto
        renderizarRankingLabirinto();

    } catch (erro) {
        document.getElementById('status').innerText = "Erro ao carregar o ranking. Tente novamente mais tarde.";
    }
}

/**
 * Popula o select de clientes na tela de login do labirinto.
 */
function popularComboboxClientes() {
    const select = document.getElementById('maze-cliente-select');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione seu nome...</option>';

    // Ordenar clientes por nome
    const clientesOrdenados = [...listaClientesGlobal].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR')
    );

    clientesOrdenados.forEach(function (cliente) {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nome;
        select.appendChild(option);
    });
}

/**
 * Renderiza o ranking do labirinto (Top 10 melhores tempos).
 */
function renderizarRankingLabirinto() {
    const container = document.getElementById('maze-ranking-list');
    if (!container) return;

    if (!rankingLabirintoGlobal || rankingLabirintoGlobal.length === 0) {
        container.innerHTML = '<div class="maze-ranking-empty">Nenhuma jogada registrada ainda. Seja o primeiro! 🎮</div>';
        return;
    }

    // Criar mapa de nomes dos clientes
    const mapaClientes = {};
    listaClientesGlobal.forEach(function (c) {
        mapaClientes[String(c.id)] = c.nome;
    });

    // Agrupar por cliente e manter apenas o MELHOR TEMPO de cada um
    const melhorPorCliente = {};

    rankingLabirintoGlobal.forEach(function (item) {
        const idCliente = String(item.ID_Cliente);
        const tempo = parseFloat(item.Tempo) || 9999;

        // Ignorar registros com tempo 9999 (partidas não concluídas)
        // para o cálculo do melhor tempo
        if (tempo >= 9999) return;

        if (!melhorPorCliente[idCliente] || tempo < melhorPorCliente[idCliente].tempo) {
            melhorPorCliente[idCliente] = {
                idCliente: idCliente,
                tempo: tempo,
                data: item.Data
            };
        }
    });

    // Converter para array e ordenar por menor tempo (mais rápido primeiro)
    const ranking = Object.values(melhorPorCliente).sort((a, b) => a.tempo - b.tempo);

    // Top 10
    const top10 = ranking.slice(0, 10);

    let html = '';

    top10.forEach(function (item, index) {
        const posicao = index + 1;
        const nomeCliente = mapaClientes[item.idCliente] || 'Desconhecido';
        const tempo = item.tempo;

        // Data formatada (data do melhor resultado)
        let dataFormatada = '';
        if (item.data) {
            try {
                const dataObj = new Date(item.data);
                dataFormatada = dataObj.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            } catch (e) {
                dataFormatada = '';
            }
        }

        // Classes especiais para top 3
        let cardClass = 'maze-rank-card';
        let posClass = 'maze-rank-pos pos-other';

        if (posicao === 1) {
            cardClass += ' rank-1';
            posClass = 'maze-rank-pos pos-1';
        } else if (posicao === 2) {
            cardClass += ' rank-2';
            posClass = 'maze-rank-pos pos-2';
        } else if (posicao === 3) {
            cardClass += ' rank-3';
            posClass = 'maze-rank-pos pos-3';
        }

        html += `
            <div class="${cardClass}" id="maze-rank-${posicao}">
                <div class="${posClass}">${posicao}º</div>
                <div class="maze-rank-info">
                    <div class="maze-rank-name">${nomeCliente}</div>
                    <div class="maze-rank-date">${dataFormatada}</div>
                </div>
                <div class="maze-rank-time">
                    ${tempo}<small>s</small>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}


/* ================================================
   LÓGICA DE LOGIN DO LABIRINTO (PIN)
   ================================================ */

/**
 * Valida o PIN do cliente via POST e libera o jogo.
 */
async function validarPinEJogar() {
    const select = document.getElementById('maze-cliente-select');
    const pinInput = document.getElementById('maze-pin-input');
    const errorEl = document.getElementById('maze-login-error');
    const loginBtn = document.getElementById('maze-login-btn');

    const idCliente = select.value;
    const pin = pinInput.value.trim();

    // Validações locais
    if (!idCliente) {
        errorEl.textContent = '⚠️ Selecione o seu nome.';
        errorEl.className = 'maze-login-error';
        return;
    }

    if (!pin) {
        errorEl.textContent = '⚠️ Digite o seu PIN.';
        errorEl.className = 'maze-login-error';
        return;
    }

    // Desabilitar botão
    loginBtn.disabled = true;
    loginBtn.textContent = '⏳ Validando...';
    errorEl.textContent = '';

    try {
        const resposta = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                acao: 'validar_acesso',
                idCliente: idCliente,
                pin: pin
            }),
            redirect: 'follow'
        });

        const textoResposta = await resposta.text();
        let resultado;

        try {
            resultado = JSON.parse(textoResposta);
        } catch (parseErr) {
            errorEl.textContent = '❌ Erro na resposta do servidor.';
            errorEl.className = 'maze-login-error';
            loginBtn.disabled = false;
            loginBtn.textContent = '🎮 Validar e Jogar';
            return;
        }

        // Verificar se a resposta é do doPost (tem 'sucesso') ou do doGet (redirecionou)
        if (typeof resultado.sucesso === 'undefined') {
            // O servidor retornou a resposta do doGet em vez do doPost
            errorEl.textContent = '❌ Erro de comunicação com o servidor. Tente novamente.';
            errorEl.className = 'maze-login-error';
            loginBtn.disabled = false;
            loginBtn.textContent = '🎮 Validar e Jogar';
            return;
        }

        if (resultado.sucesso) {
            // Login bem sucedido
            const nomeCliente = select.options[select.selectedIndex].text;
            jogadorAutenticado = { id: idCliente, nome: nomeCliente };

            // Guardar o ID da partida registrada pelo backend
            // O backend já gravou a linha com tempo 9999 (pendente)
            partidaAtualId = resultado.idPartida || null;

            errorEl.textContent = '✅ ' + resultado.mensagem;
            errorEl.className = 'maze-login-error success';

            // Aguardar meio segundo para mostrar mensagem de sucesso
            setTimeout(function () {
                mostrarJogo();
            }, 600);
        } else {
            errorEl.textContent = '❌ ' + (resultado.erro || resultado.mensagem || 'Erro desconhecido.');
            errorEl.className = 'maze-login-error';
            loginBtn.disabled = false;
            loginBtn.textContent = '🎮 Validar e Jogar';
        }
    } catch (erro) {
        errorEl.textContent = '❌ Erro de conexão. Tente novamente.';
        errorEl.className = 'maze-login-error';
        loginBtn.disabled = false;
        loginBtn.textContent = '🎮 Validar e Jogar';
    }
}

/**
 * Mostra a área do jogo e esconde o login.
 * Exibe uma contagem regressiva antes de iniciar o jogo.
 */
function mostrarJogo() {
    const loginEl = document.getElementById('maze-login');
    const gameArea = document.getElementById('maze-game-area');
    const badge = document.getElementById('maze-player-badge');

    loginEl.style.display = 'none';
    gameArea.style.display = 'flex';

    // Mostrar badge com nome do jogador
    if (jogadorAutenticado) {
        badge.textContent = '👤 ' + jogadorAutenticado.nome;
    }

    // Exibir contagem regressiva antes de iniciar o jogo
    iniciarContagemRegressiva();
}

/**
 * Exibe um overlay de contagem regressiva (Prepare-se → 3 → 2 → 1 → VAI!)
 * sobre a área do jogo e só inicia o jogo quando terminar.
 */
function iniciarContagemRegressiva() {
    const gameArea = document.getElementById('maze-game-area');

    // Criar o overlay da contagem regressiva
    const overlay = document.createElement('div');
    overlay.id = 'countdown-overlay';
    overlay.className = 'countdown-overlay';

    const texto = document.createElement('div');
    texto.id = 'countdown-text';
    texto.className = 'countdown-text';
    texto.textContent = 'Prepare-se!';

    const subtexto = document.createElement('div');
    subtexto.className = 'countdown-subtitle';
    subtexto.textContent = 'O labirinto vai começar...';

    overlay.appendChild(texto);
    overlay.appendChild(subtexto);
    gameArea.appendChild(overlay);

    // Forçar reflow para a animação inicial
    overlay.offsetHeight;
    overlay.classList.add('visible');

    // Sequência: Prepare-se! (1.5s) → 3 (1s) → 2 (1s) → 1 (1s) → VAI! (0.5s)
    const etapas = [
        { texto: '3', subtexto: 'Concentre-se...', delay: 1500 },
        { texto: '2', subtexto: '', delay: 2500 },
        { texto: '1', subtexto: '', delay: 3500 },
        { texto: 'VAI! 🚀', subtexto: '', delay: 4500 },
    ];

    etapas.forEach(function (etapa) {
        setTimeout(function () {
            texto.textContent = etapa.texto;
            subtexto.textContent = etapa.subtexto;

            // Adicionar efeito de pulso a cada número
            texto.classList.remove('pulse');
            texto.offsetHeight; // reflow
            texto.classList.add('pulse');
        }, etapa.delay);
    });

    // Após a contagem, remover overlay e iniciar o jogo
    setTimeout(function () {
        overlay.classList.remove('visible');
        overlay.classList.add('fade-out');

        setTimeout(function () {
            overlay.remove();

            // Agora sim, iniciar o jogo!
            if (typeof novoJogo === 'function') {
                novoJogo();
            }
        }, 400);
    }, 5200);
}

/**
 * Salva o resultado do labirinto via POST.
 */
async function salvarResultadoLabirinto(tempoGasto) {
    if (!jogadorAutenticado) return;

    try {
        const resposta = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                acao: 'salvar_tempo',
                idCliente: jogadorAutenticado.id,
                idPartida: partidaAtualId,
                tempo: tempoGasto
            }),
            redirect: 'follow'
        });

        const resultado = await resposta.json();

        if (resultado.sucesso) {
            // Atualizar ranking local com o novo resultado
            rankingLabirintoGlobal.push({
                ID_Cliente: jogadorAutenticado.id,
                Data: new Date().toISOString(),
                Tempo: tempoGasto
            });
            renderizarRankingLabirinto();
        }
    } catch (erro) {
        // Silenciosamente falhar, o resultado já foi exibido no jogo
        console.error('Erro ao salvar resultado:', erro);
    }
}


/* ================================================
   RANKING DE TRUFAS (código existente)
   ================================================ */

function renderizarLista(criterio, elementId) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';

    // Cria uma cópia da lista e ordena do maior para o menor pontuador
    let listaOrdenada = [...dadosGlobais].sort((a, b) => b[criterio] - a[criterio]);

    // Remove quem tiver 0 no critério atual
    listaOrdenada = listaOrdenada.filter(cliente => cliente[criterio] > 0);

    if (listaOrdenada.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#999;'>Nenhum registo encontrado ainda.</p>";
        return;
    }

    listaOrdenada.forEach((cliente, index) => {
        const trufas = cliente[criterio];
        const posicao = index + 1;

        // Define a cor da medalha
        let classePosicao = 'pos-geral';
        if (posicao === 1) classePosicao = 'pos-1';
        else if (posicao === 2) classePosicao = 'pos-2';
        else if (posicao === 3) classePosicao = 'pos-3';

        // Lógica da barra de progresso (Módulo 10)
        let trufasProximoBrinde = trufas % 10;
        // Se for múltiplo exato de 10 e não for 0, considera que a barra acabou de encher (10/10)
        if (trufas > 0 && trufasProximoBrinde === 0) {
            trufasProximoBrinde = 10;
        }
        const progresso = (trufasProximoBrinde / 10) * 100;

        // Texto promocional
        let textoPromo = `Faltam ${10 - trufasProximoBrinde} para a trufa grátis!`;
        if (trufasProximoBrinde === 10) {
            textoPromo = "🎉 Parabéns! Ganhou uma trufa grátis!";
        }

        // Bloco promocional só aparece no ranking mensal
        const promoHtml = criterio === 'totalMes' ? `
                    <div class="promo-container">
                        <div class="promo-text">${textoPromo}</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progresso}%"></div>
                        </div>
                    </div>` : '';

        // Cria o HTML do cartão do cliente
        const card = `
            <div class="cliente-card">
                <div class="posicao ${classePosicao}">${posicao}º</div>
                <div class="info">
                    <div class="nome">${cliente.nome}</div>
                    ${promoHtml}
                </div>
                <div class="pontos">${trufas}</div>
            </div>
        `;

        container.innerHTML += card;
    });
}

/**
 * Renderiza o Top 5 sabores mais vendidos.
 */
function renderizarTopSabores() {
    const container = document.getElementById('top-sabores');
    if (!container) return;

    // Converter o objeto de sabores num array e ordenar do maior para o menor
    const listaSabores = Object.entries(saboresGlobais)
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total);

    // Pegar apenas o Top 5
    const top5 = listaSabores.slice(0, 5);

    if (top5.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#999;'>Sem dados de sabores.</p>";
        return;
    }

    // O maior valor serve de referência (100%) para as barras proporcionais
    const maxTotal = top5[0].total;

    // Emojis temáticos para cada posição do pódio
    const medalhas = ['🥇', '🥈', '🥉', '4º', '5º'];

    // Cores do gradiente para cada posição
    const cores = [
        'linear-gradient(90deg, #FFD700, #FFA500)',  // Ouro
        'linear-gradient(90deg, #C0C0C0, #A8A8A8)',  // Prata
        'linear-gradient(90deg, #CD7F32, #B8652A)',   // Bronze
        'linear-gradient(90deg, #D4A373, #C4935F)',   // 4º
        'linear-gradient(90deg, #D4A373, #C4935F)',   // 5º
    ];

    let html = '';

    top5.forEach((sabor, index) => {
        const percentual = (sabor.total / maxTotal) * 100;
        const medalha = medalhas[index];
        const cor = cores[index];

        html += `
            <div class="sabor-item" id="sabor-${index + 1}">
                <div class="sabor-header">
                    <span class="sabor-medalha">${medalha}</span>
                    <span class="sabor-nome">${sabor.nome}</span>
                    <span class="sabor-total">${sabor.total}</span>
                </div>
                <div class="sabor-bar-container">
                    <div class="sabor-bar-fill" style="width: ${percentual}%; background: ${cor};"></div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Função para alternar entre as abas visuais
function mudarAba(abaId) {
    // Remove 'active' de todos os botões e listas
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.ranking-list').forEach(list => list.classList.remove('active'));

    // Adiciona 'active' ao botão clicado e à lista correspondente
    if (abaId === 'mes') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('lista-mes').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('lista-geral').classList.add('active');
    }
}


/* ================================================
   EVENT LISTENERS DO LOGIN
   ================================================ */

// Botão de login
document.getElementById('maze-login-btn').addEventListener('click', validarPinEJogar);

// Enter no campo de PIN
document.getElementById('maze-pin-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        validarPinEJogar();
    }
});


// Inicia a aplicação
carregarRanking();
