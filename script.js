// --- COLE A SUA URL NA LINHA ABAIXO ---
const API_URL = 'https://script.google.com/macros/s/AKfycbyqO36T5Jy_tgDychKYEzYXwl65maWWscYYsqndP-PfkQvr2qqocQC7di8PnImoJEyh/exec';

let dadosGlobais = [];

async function carregarRanking() {
    try {
        const resposta = await fetch(API_URL);
        dadosGlobais = await resposta.json();

        document.getElementById('status').style.display = 'none';

        renderizarLista('totalMes', 'lista-mes');
        renderizarLista('totalGeral', 'lista-geral');

    } catch (erro) {
        document.getElementById('status').innerText = "Erro ao carregar o ranking. Tente novamente mais tarde.";
    }
}

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

        // Cria o HTML do cartão do cliente
        const card = `
            <div class="cliente-card">
                <div class="posicao ${classePosicao}">${posicao}º</div>
                <div class="info">
                    <div class="nome">${cliente.nome}</div>
                    <div class="promo-container">
                        <div class="promo-text">${textoPromo}</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progresso}%"></div>
                        </div>
                    </div>
                </div>
                <div class="pontos">${trufas}</div>
            </div>
        `;

        container.innerHTML += card;
    });
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

// Inicia a aplicação
carregarRanking();
