const API_URL = 'https://script.google.com/macros/s/AKfycbyqO36T5Jy_tgDychKYEzYXwl65maWWscYYsqndP-PfkQvr2qqocQC7di8PnImoJEyh/exec';

let dadosGlobais = [];
let saboresGlobais = {};
let listaClientesGlobal = [];
let rankingLabirintoGlobal = [];

// ===== Jogador autenticado =====
let jogadorAutenticado = null; // { id, nome }
let partidaAtualId = null;     // ID da partida registrada no backend ao validar acesso

// Cache local: mostra os últimos dados na hora enquanto a API responde
const CHAVE_CACHE_LOCAL = 'clubeTrufa_dados_v1';
const VALIDADE_CACHE_LOCAL_MS = 7 * 24 * 60 * 60 * 1000;

function lerCacheLocal() {
    try {
        const texto = localStorage.getItem(CHAVE_CACHE_LOCAL);
        if (!texto) return null;
        const registro = JSON.parse(texto);
        if (!registro || !registro.dados || (Date.now() - registro.salvoEm) > VALIDADE_CACHE_LOCAL_MS) {
            return null;
        }
        return registro.dados;
    } catch (e) {
        return null;
    }
}

function salvarCacheLocal(dados) {
    try {
        localStorage.setItem(CHAVE_CACHE_LOCAL, JSON.stringify({ salvoEm: Date.now(), dados: dados }));
    } catch (e) { }
}

// Evita XSS ao inserir textos da planilha via innerHTML
function escaparHTML(valor) {
    return String(valor === undefined || valor === null ? '' : valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Renderiza a página com os dados recebidos (API ou cache local)
function aplicarDados(dados) {
    // A API retorna { ranking: [...], sabores: {...}, clientes: [...], rankingLabirinto: [...] }
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
}

async function carregarRanking() {
    // Mostra o cache local primeiro e depois atualiza com a API
    const dadosLocais = lerCacheLocal();
    if (dadosLocais) {
        aplicarDados(dadosLocais);
    }

    try {
        const resposta = await fetch(API_URL);
        if (!resposta.ok) throw new Error('HTTP ' + resposta.status);

        const dados = await resposta.json();
        if (!dados || !Array.isArray(dados.ranking)) throw new Error('Resposta inválida');

        aplicarDados(dados);
        salvarCacheLocal(dados);

    } catch (erro) {
        if (!dadosLocais) {
            document.getElementById('status').innerText = "Erro ao carregar o ranking. Tente novamente mais tarde.";
        } else {
            console.warn('Não foi possível atualizar os dados; exibindo a última versão salva.', erro);
        }
    }
}

/**
 * Popula o select de clientes na tela de login do labirinto.
 */
function popularComboboxClientes() {
    const select = document.getElementById('maze-cliente-select');
    if (!select) return;

    // Mantém a seleção atual após atualizar a lista
    const selecionadoAntes = select.value;

    select.innerHTML = '<option value="">Selecione seu nome...</option>';

    // Ordenar clientes por nome
    const clientesOrdenados = [...listaClientesGlobal].sort((a, b) =>
        String(a.nome).localeCompare(String(b.nome), 'pt-BR')
    );

    const fragmento = document.createDocumentFragment();
    clientesOrdenados.forEach(function (cliente) {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nome;
        fragmento.appendChild(option);
    });
    select.appendChild(fragmento);

    if (selecionadoAntes) {
        select.value = selecionadoAntes;
        if (select.value !== selecionadoAntes) select.value = '';
    }
}

/**
 * Calcula o Top 10 do labirinto (melhor tempo de cada cliente).
 */
function calcularTop10Labirinto() {
    // Agrupar por cliente e manter apenas o MELHOR TEMPO de cada um
    const melhorPorCliente = {};

    (rankingLabirintoGlobal || []).forEach(function (item) {
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
    return ranking.slice(0, 10);
}

/**
 * Renderiza o ranking do labirinto (Top 10 melhores tempos).
 * idDestaque (opcional): cliente que acabou de jogar, destacado na lista.
 */
function renderizarRankingLabirinto(idDestaque) {
    const container = document.getElementById('maze-ranking-list');
    if (!container) return;

    const top10 = calcularTop10Labirinto();

    if (top10.length === 0) {
        container.innerHTML = '<div class="maze-ranking-empty">Nenhuma jogada registrada ainda. Seja o primeiro! 🎮</div>';
        return;
    }

    // Criar mapa de nomes dos clientes
    const mapaClientes = {};
    listaClientesGlobal.forEach(function (c) {
        mapaClientes[String(c.id)] = c.nome;
    });

    const destaque = idDestaque !== undefined && idDestaque !== null ? String(idDestaque) : null;

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

        if (destaque && item.idCliente === destaque) {
            cardClass += ' is-highlight';
        }

        html += `
            <div class="${cardClass}" id="maze-rank-${posicao}">
                <div class="${posClass}">${posicao}º</div>
                <div class="maze-rank-info">
                    <div class="maze-rank-name">${escaparHTML(nomeCliente)}</div>
                    <div class="maze-rank-date">${dataFormatada}</div>
                </div>
                <div class="maze-rank-time">
                    ${escaparHTML(tempo)}<small>s</small>
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

    // Evita requisições duplicadas (duplo clique / Enter repetido)
    if (loginBtn.disabled) return;

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

/* ================================================
   FIM DE PARTIDA
   Salva o resultado (com retentativas), exibe o painel
   de resultado e volta ao login SEM recarregar a página.
   ================================================ */

const SALVAR_TIMEOUT_MS = 15000;     // tempo máximo de cada tentativa
const SALVAR_MAX_TENTATIVAS = 3;     // tentativas em falha de rede / servidor ocupado
const VOLTAR_LOGIN_VITORIA_S = 6;    // segundos até voltar ao login após salvar
const VOLTAR_LOGIN_DERROTA_S = 5;    // segundos até voltar ao login após perder
const VOLTAR_LOGIN_ERRO_S = 8;       // segundos até voltar após erro definitivo
const ATRASO_PAINEL_MS = 700;        // deixa o jogador ver a trufa antes do painel

let salvamentoPendente = false;
let intervaloVoltarLogin = null;
let timeoutPainel = null;
let timeoutsMensagemSalvar = [];

// Avisa antes de fechar a aba enquanto o resultado ainda está sendo enviado
window.addEventListener('beforeunload', function (e) {
    if (salvamentoPendente) {
        e.preventDefault();
        e.returnValue = '';
    }
});

function esperar(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/**
 * Envia o tempo ao backend.
 * Repete em falhas de rede, timeout ou "servidor ocupado" (o backend aceita
 * reenvio do mesmo idPartida + tempo sem duplicar).
 * Nunca rejeita: devolve { sucesso, rankingLabirinto?, erro?, definitivo? }.
 */
async function enviarTempoLabirinto(idCliente, idPartida, tempo) {
    let ultimoErro = 'Erro de conexão.';

    for (let tentativa = 1; tentativa <= SALVAR_MAX_TENTATIVAS; tentativa++) {
        const controlador = new AbortController();
        const timer = setTimeout(function () { controlador.abort(); }, SALVAR_TIMEOUT_MS);

        try {
            const resposta = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    acao: 'salvar_tempo',
                    idCliente: idCliente,
                    idPartida: idPartida,
                    tempo: tempo
                }),
                redirect: 'follow',
                keepalive: true, // continua o envio mesmo se a aba for fechada
                signal: controlador.signal
            });

            const resultado = JSON.parse(await resposta.text());
            if (typeof resultado.sucesso === 'undefined') {
                throw new Error('Resposta inesperada do servidor');
            }
            if (resultado.sucesso) return resultado;

            const erro = String(resultado.erro || resultado.mensagem || 'Erro desconhecido.');

            // Backend antigo: um reenvio que chega depois de já ter salvo responde isto
            if (tentativa > 1 && /já foi registrado/i.test(erro)) {
                return { sucesso: true };
            }

            if (/ocupado/i.test(erro)) {
                ultimoErro = erro; // vale tentar de novo
            } else {
                return { sucesso: false, erro: erro, definitivo: true };
            }
        } catch (e) {
            ultimoErro = (e && e.name === 'AbortError')
                ? 'O servidor demorou para responder.'
                : 'Erro de conexão.';
        } finally {
            clearTimeout(timer);
        }

        if (tentativa < SALVAR_MAX_TENTATIVAS) {
            await esperar(1000 * tentativa);
        }
    }

    return { sucesso: false, erro: ultimoErro, definitivo: false };
}

/**
 * Chamado pelo jogo (jogo-trufa/script.js) ao vencer ou perder.
 */
function finalizarPartidaLabirinto(venceu, tempoGasto) {
    const jogador = jogadorAutenticado;
    const idPartida = partidaAtualId;

    // O envio começa imediatamente; o painel aparece logo depois
    let envio = null;
    if (venceu && jogador && idPartida) {
        envio = iniciarEnvio(jogador.id, idPartida, tempoGasto);
    }

    clearTimeout(timeoutPainel);
    timeoutPainel = setTimeout(function () {
        const painel = criarPainelResultado(venceu, tempoGasto);

        if (!venceu) {
            iniciarVoltaAoLogin(painel, VOLTAR_LOGIN_DERROTA_S);
            return;
        }

        if (!envio) {
            atualizarEstadoSalvar(painel, 'error', '⚠️ Resultado não enviado: sessão inválida.');
            iniciarVoltaAoLogin(painel, VOLTAR_LOGIN_ERRO_S);
            return;
        }

        acompanharEnvio(painel, envio, jogador.id, idPartida, tempoGasto);
    }, ATRASO_PAINEL_MS);
}

function iniciarEnvio(idCliente, idPartida, tempo) {
    salvamentoPendente = true;
    return enviarTempoLabirinto(idCliente, idPartida, tempo).then(function (resultado) {
        salvamentoPendente = false;
        return resultado;
    });
}

/**
 * Mostra o progresso do envio no painel e trata o resultado.
 */
function acompanharEnvio(painel, envio, idCliente, idPartida, tempo) {
    atualizarEstadoSalvar(painel, 'saving', 'Salvando seu resultado...');
    painel.querySelector('.result-actions').innerHTML = '';
    painel.querySelector('.result-rank').textContent = '';

    // Mensagens progressivas para mascarar a espera
    limparMensagensSalvar();
    timeoutsMensagemSalvar.push(setTimeout(function () {
        atualizarEstadoSalvar(painel, 'saving', 'Registrando no ranking...');
    }, 2500));
    timeoutsMensagemSalvar.push(setTimeout(function () {
        atualizarEstadoSalvar(painel, 'saving', 'A conexão está lenta, quase lá...');
    }, 7000));

    envio.then(function (resultado) {
        limparMensagensSalvar();
        if (!painel.isConnected) return;

        if (resultado.sucesso) {
            atualizarEstadoSalvar(painel, 'saved', 'Resultado salvo!');
            const info = aplicarRankingAposSalvar(resultado, idCliente, tempo);
            painel.querySelector('.result-rank').innerHTML = montarMensagemPosicao(info, tempo);
            adicionarBotaoVoltar(painel, 'Voltar agora');
            iniciarVoltaAoLogin(painel, VOLTAR_LOGIN_VITORIA_S);
            return;
        }

        if (resultado.definitivo) {
            atualizarEstadoSalvar(painel, 'error', '⚠️ ' + resultado.erro);
            adicionarBotaoVoltar(painel, 'Voltar ao início');
            iniciarVoltaAoLogin(painel, VOLTAR_LOGIN_ERRO_S);
            return;
        }

        // Falha temporária: deixa o jogador tentar de novo (sem voltar sozinho)
        atualizarEstadoSalvar(painel, 'error', '⚠️ Não foi possível salvar. ' + resultado.erro);
        const acoes = painel.querySelector('.result-actions');
        const btnTentar = document.createElement('button');
        btnTentar.type = 'button';
        btnTentar.id = 'maze-result-retry';
        btnTentar.className = 'result-btn result-btn-primary';
        btnTentar.textContent = '🔄 Tentar novamente';
        btnTentar.addEventListener('click', function () {
            acompanharEnvio(painel, iniciarEnvio(idCliente, idPartida, tempo), idCliente, idPartida, tempo);
        });
        acoes.appendChild(btnTentar);
        adicionarBotaoVoltar(painel, 'Voltar ao início');
    });
}

function limparMensagensSalvar() {
    timeoutsMensagemSalvar.forEach(clearTimeout);
    timeoutsMensagemSalvar = [];
}

/**
 * Atualiza o ranking com a resposta do servidor (ou localmente, se o
 * backend não devolver o ranking) e retorna a posição do jogador.
 */
function aplicarRankingAposSalvar(resultado, idCliente, tempo) {
    if (Array.isArray(resultado.rankingLabirinto)) {
        rankingLabirintoGlobal = resultado.rankingLabirinto;
    } else {
        rankingLabirintoGlobal.push({
            ID_Cliente: idCliente,
            Data: new Date().toISOString(),
            Tempo: tempo
        });
    }

    renderizarRankingLabirinto(idCliente);

    // Mantém o ranking atualizado no cache local
    const dadosLocais = lerCacheLocal();
    if (dadosLocais) {
        dadosLocais.rankingLabirinto = rankingLabirintoGlobal;
        salvarCacheLocal(dadosLocais);
    }

    const top10 = calcularTop10Labirinto();
    const indice = top10.findIndex(function (item) { return item.idCliente === String(idCliente); });
    return {
        posicao: indice + 1,
        melhorTempo: indice >= 0 ? top10[indice].tempo : null
    };
}

function montarMensagemPosicao(info, tempo) {
    if (info.posicao <= 0) {
        return 'Continue tentando para entrar no <strong>Top 10</strong>! 💪';
    }
    if (info.melhorTempo !== null && info.melhorTempo < tempo) {
        return 'Seu recorde continua sendo <strong>' + escaparHTML(info.melhorTempo) +
            's</strong> (' + info.posicao + 'º lugar)';
    }
    if (info.posicao === 1) {
        return '🥇 Você é o <strong>novo líder</strong> do ranking!';
    }
    return '🏆 Você está em <strong>' + info.posicao + 'º lugar</strong> no ranking!';
}

/**
 * Cria o painel de resultado sobre a área do jogo.
 */
function criarPainelResultado(venceu, tempoGasto) {
    const gameArea = document.getElementById('maze-game-area');
    const antigo = document.getElementById('maze-result-overlay');
    if (antigo) antigo.remove();

    const painel = document.createElement('div');
    painel.id = 'maze-result-overlay';
    painel.className = 'result-overlay ' + (venceu ? 'is-win' : 'is-lose');
    painel.setAttribute('role', 'status');
    painel.setAttribute('aria-live', 'polite');

    let confete = '';
    if (venceu) {
        const cores = ['#FFD700', '#D4A373', '#ffffff', '#e67e22', '#f5e6d3'];
        for (let i = 0; i < 14; i++) {
            const angulo = (360 / 14) * i;
            confete += '<span class="result-confetti" style="--ang:' + angulo + 'deg;--cor:' +
                cores[i % cores.length] + ';--atraso:' + (i % 3) * 0.05 + 's"></span>';
        }
    }

    const conteudoVitoria =
        '<div class="result-icon-wrap">' + confete + '<div class="result-icon">🎉</div></div>' +
        '<h3 class="result-title">Você encontrou a trufa!</h3>' +
        '<div class="result-time"><span>' + escaparHTML(tempoGasto) + '</span><small>s</small></div>' +
        '<div class="result-save" id="maze-result-save" data-state="saving">' +
            '<span class="result-save-icon" aria-hidden="true"></span>' +
            '<span class="result-save-text">Salvando seu resultado...</span>' +
        '</div>' +
        '<div class="result-rank" id="maze-result-rank"></div>';

    const conteudoDerrota =
        '<div class="result-icon-wrap"><div class="result-icon">⏰</div></div>' +
        '<h3 class="result-title">Tempo esgotado!</h3>' +
        '<p class="result-desc">Sua tentativa de hoje foi usada.<br>Volte amanhã para tentar de novo! 🍫</p>' +
        '<div class="result-rank" id="maze-result-rank"></div>';

    painel.innerHTML =
        '<div class="result-card">' +
            (venceu ? conteudoVitoria : conteudoDerrota) +
            '<div class="result-actions" id="maze-result-actions"></div>' +
            '<div class="result-return" id="maze-result-return" hidden>' +
                '<div class="result-return-text"></div>' +
                '<div class="result-return-bar"><div class="result-return-fill"></div></div>' +
            '</div>' +
        '</div>';

    gameArea.appendChild(painel);
    painel.offsetHeight; // reflow para a transição de entrada
    painel.classList.add('visible');

    if (!venceu) adicionarBotaoVoltar(painel, 'Voltar agora');
    return painel;
}

function atualizarEstadoSalvar(painel, estado, texto) {
    const caixa = painel.querySelector('.result-save');
    if (!caixa) return;
    caixa.dataset.state = estado;
    caixa.querySelector('.result-save-text').textContent = texto;
}

function adicionarBotaoVoltar(painel, rotulo) {
    const acoes = painel.querySelector('.result-actions');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'maze-result-back';
    btn.className = 'result-btn';
    btn.textContent = rotulo;
    btn.addEventListener('click', voltarParaLogin);
    acoes.appendChild(btn);
}

/**
 * Contagem regressiva (com barra) até voltar para o login.
 */
function iniciarVoltaAoLogin(painel, segundos) {
    pararVoltaAoLogin();

    const caixa = painel.querySelector('.result-return');
    const texto = caixa.querySelector('.result-return-text');
    const barra = caixa.querySelector('.result-return-fill');
    let restante = segundos;

    caixa.hidden = false;
    texto.textContent = 'Voltando ao início em ' + restante + 's';

    barra.style.transition = 'none';
    barra.style.width = '100%';
    barra.offsetWidth; // reflow
    barra.style.transition = 'width ' + segundos + 's linear';
    barra.style.width = '0%';

    intervaloVoltarLogin = setInterval(function () {
        restante--;
        if (restante <= 0) {
            voltarParaLogin();
            return;
        }
        texto.textContent = 'Voltando ao início em ' + restante + 's';
    }, 1000);
}

function pararVoltaAoLogin() {
    if (intervaloVoltarLogin) {
        clearInterval(intervaloVoltarLogin);
        intervaloVoltarLogin = null;
    }
}

/**
 * Volta para a tela de login sem recarregar a página,
 * limpando todo o estado da partida anterior.
 */
let voltandoParaLogin = false;
function voltarParaLogin() {
    if (voltandoParaLogin) return;
    voltandoParaLogin = true;

    pararVoltaAoLogin();
    limparMensagensSalvar();
    clearTimeout(timeoutPainel);

    const gameArea = document.getElementById('maze-game-area');
    gameArea.classList.add('is-leaving');

    setTimeout(function () {
        const painel = document.getElementById('maze-result-overlay');
        if (painel) painel.remove();

        jogadorAutenticado = null;
        partidaAtualId = null;

        if (typeof resetarJogoLabirinto === 'function') {
            resetarJogoLabirinto();
        }

        gameArea.classList.remove('is-leaving');
        gameArea.style.display = 'none';
        document.getElementById('maze-player-badge').textContent = '';

        resetarFormularioLogin();

        const loginEl = document.getElementById('maze-login');
        loginEl.style.display = '';
        // Reinicia a animação de entrada do login
        loginEl.style.animation = 'none';
        loginEl.offsetHeight;
        loginEl.style.animation = '';

        voltandoParaLogin = false;
    }, 300);
}

function resetarFormularioLogin() {
    const select = document.getElementById('maze-cliente-select');
    const pinInput = document.getElementById('maze-pin-input');
    const errorEl = document.getElementById('maze-login-error');
    const loginBtn = document.getElementById('maze-login-btn');

    select.value = '';
    pinInput.value = '';
    errorEl.textContent = '';
    errorEl.className = 'maze-login-error';
    loginBtn.disabled = false;
    loginBtn.textContent = '🎮 Validar e Jogar';
}


/* ================================================
   RANKING DE TRUFAS (código existente)
   ================================================ */

function renderizarLista(criterio, elementId) {
    const container = document.getElementById(elementId);
    let html = '';

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
                    <div class="nome">${escaparHTML(cliente.nome)}</div>
                    ${promoHtml}
                </div>
                <div class="pontos">${escaparHTML(trufas)}</div>
            </div>
        `;

        html += card;
    });

    container.innerHTML = html;
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
                    <span class="sabor-nome">${escaparHTML(sabor.nome)}</span>
                    <span class="sabor-total">${escaparHTML(sabor.total)}</span>
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
