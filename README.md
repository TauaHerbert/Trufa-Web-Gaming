# 🍫 Sistema de Gestão e Gamificação de Vendas

Um ecossistema completo de gestão financeira e fidelização de clientes, construído com arquitetura *Serverless*. O projeto integra um banco de dados em nuvem, um aplicativo de uso operacional (para registo de vendas) e uma API REST customizada que alimenta uma interface web gamificada para os clientes finais.

---

## Arquitetura do Sistema

O projeto foi desenhado em três camadas distintas para garantir segurança dos dados, facilidade de uso operacional e escalabilidade web.

### 1. Banco de Dados (Google Sheets)
Atuando como o banco de dados relacional (Headless DB), a estrutura foi modelada para suportar a escalabilidade do negócio de varejo e atacado.
* **Tabelas Relacionais:** Estrutura dividida em `Clientes`, `Locais`, `Sabores`, `Vendas` e `Itens_vendas`.
* **Integridade de Dados:** Utilização de identificadores alfanuméricos únicos (`UNIQUEID()`) gerados no momento da transação para evitar colisão de chaves (Key Collision) durante acessos simultâneos.

### 2. Interface Operacional (AppSheet)
Aplicativo de uso interno para gestão do fluxo de caixa e registo rápido de pedidos.
* **Segregação de Dados (Slices):** Criação de partições de dados virtuais para isolar análises financeiras de diferentes polos de venda (ex: Varejo Coren vs. Atacado Mercadinho).
* **Navegação Dinâmica (Actions):** Implementação de botões de roteamento com `LINKTOFILTEREDVIEW`, permitindo auditoria rápida ao clicar em um estabelecimento e visualizar apenas as transações exclusivas daquele local, em uma *view* limpa de edição.
* **UI/UX Condicional:** Uso de *Format Rules* para organização cronológica baseada em cores e layout em *Cards* para melhor usabilidade mobile.

### 3. API Intermediária (Google Apps Script)
O coração da integração. Um script rodando no ecossistema do Google Planilhas que atua como uma API blindada (Endpoint público read-only) para conectar o banco de dados ao aplicativo Web.
* **Segurança e Sanitização:** Em vez de expor a planilha publicamente (o que comprometeria dados financeiros sensíveis), a API lê a base de dados no back-end e devolve apenas as informações estritamente necessárias.
* **Regras de Negócio no Back-end:** O script cruza os IDs de vendas e itens, filtra exclusivamente as compras do polo varejista e calcula automaticamente o módulo promocional (Compre 10, Ganhe 1).
* **Payload JSON:** O método `doGet(e)` serializa e devolve a resposta estruturada em JSON contendo apenas: `{ Nome, Total_Mensal, Total_Geral }`.

### 4. Interface Web Gamificada (Front-end)
Front-end hospedado no **GitHub Pages** (HTML, CSS, JS), consumindo a API gerada pelo Apps Script via requisições assíncronas (`fetch`). Atua como um painel de competição e entretenimento sem acesso direto ou edição à base de dados operacional.

---

## 🎮 O Que Foi Construído (Front-end)

A interface web do **Clube da Trufa** foi desenvolvida como uma *Single Page Application* (SPA) leve e responsiva, focada em três pilares: **competição**, **progresso** e **entretenimento**.

### Estrutura de Ficheiros

```
turfas-web/
├── index.html              # Página principal (ranking + jogo integrado)
├── style.css               # Design system unificado (ranking + jogo)
├── script.js               # Lógica do ranking e consumo da API
├── README.md               # Documentação do projeto
└── jogo-trufa/             # Mini jogo do labirinto
    ├── index.html          # Versão standalone do jogo (para testes)
    ├── style.css           # Estilos standalone do jogo
    ├── script.js           # Lógica do jogo (geração, renderização, controlos)
    └── README.md           # Documentação técnica do jogo
```

### Funcionalidades Implementadas

#### 🏆 Sistema de Ranking com Abas
A interface apresenta dois modos de visualização, alternáveis por abas (tabs):
* **Ranking do Mês** — Classificação baseada nas compras do mês corrente (`totalMes`), incentivando a competição mensal entre clientes.
* **Histórico Geral** — Classificação acumulada de todas as compras (`totalGeral`), premiando a fidelidade a longo prazo.

A troca entre abas é gerida pela função `mudarAba()`, que manipula classes CSS (`active`) para alternar visibilidade sem recarregar a página.

#### Sistema de Medalhas (Pódio Visual)
Cada posição no ranking recebe um tratamento visual distinto:
| Posição | Estilo | Cor |
|---------|--------|-----|
| 1º Lugar | Ouro com brilho (*box-shadow*) | `#FFD700` |
| 2º Lugar | Prata | `#C0C0C0` |
| 3º Lugar | Bronze | `#CD7F32` |
| 4º+ | Cinza neutro | `#E0E0E0` |

Os badges circulares são renderizados dinamicamente com classes CSS condicionais (`pos-1`, `pos-2`, `pos-3`, `pos-geral`).

#### Barra de Progresso Promocional (Compre 10, Ganhe 1)
Cada cartão de cliente inclui um indicador visual de progresso em direção à trufa grátis:
* **Cálculo modular:** `trufas % 10` — determina quantas trufas faltam no ciclo atual de 10.
* **Barra de preenchimento:** Animada com `transition: width 0.5s ease`, preenchendo proporcionalmente (0% a 100%).
* **Feedback textual:** Mensagem dinâmica que informa quantas trufas faltam, ou exibe `🎉 Parabéns! Ganhou uma trufa grátis!` quando o ciclo se completa.
* **Tratamento de edge case:** Quando o total é múltiplo exato de 10 (e maior que zero), a barra mostra 10/10 (cheia) em vez de 0/10.

#### 🕹️ Integração com Mini Fliperama
Um banner compacto posicionado no topo da página (entre o cabeçalho e as abas de ranking) convida o cliente a jogar um mini fliperama externo enquanto saboreia a sua trufa:
* **Conceito:** Agregar valor à experiência do cliente — ele come a trufa, confere a sua posição no ranking, vê quantas faltam para o prémio e, ao mesmo tempo, se diverte jogando.
* **Layout:** Banner horizontal com ícone animado (bounce), mensagem convidativa e botão de acesso rápido.
* **Botão "Jogar":** Abre o fliperama em nova aba (`target="_blank"`), com gradiente dourado e animação de pulse para chamar a atenção.
* **Link:** [React Fliperama](https://barroca07.github.io/React_Fliperama/)

#### 🍫 Jogo da Trufa — Labirinto Integrado
Um mini jogo de labirinto 2D embutido diretamente na página principal como **sidebar lateral**, oferecendo entretenimento imediato sem sair da página de ranking.

* **Mecânica:** O jogador navega por um labirinto gerado aleatoriamente (algoritmo DFS Recursive Backtracker) para encontrar a trufa escondida no canto inferior direito antes que o tempo se esgote.
* **Dificuldade:** Grade 20×20 células, 45 segundos de tempo limite e apenas ~12% de paredes removidas (poucas bifurcações, exigindo raciocínio).
* **Controlos:** Setas do teclado, teclas WASD ou botões D-Pad na tela (otimizado para touch/mobile).
* **Efeitos visuais:** Trufa e jogador com brilho pulsante animado via `requestAnimationFrame`, halo dourado na saída e indicador direcional no jogador.
* **Renderização:** HTML5 Canvas com paleta temática de chocolates (paredes castanho escuro, caminhos creme, jogador laranja, trufa castanho chocolate).
* **Integração:** O HTML do jogo é embutido como `<aside class="game-sidebar">` e o script `jogo-trufa/script.js` é carregado na página principal.

#### 📐 Layout de Duas Colunas
A página principal foi reestruturada com um layout flex de duas colunas para acomodar o jogo e o ranking lado a lado:

| Ecrã | Disposição |
|------|------------|
| **Desktop** (≥ 900px) | 🎮 Jogo na sidebar esquerda (sticky) + 🏆 Ranking à direita |
| **Mobile** (< 900px) | 🎮 Jogo no topo + 🏆 Ranking abaixo (empilhado) |

* **Sidebar sticky:** O jogo permanece visível ao rolar a lista de ranking (`position: sticky; top: 20px`).
* **Largura da sidebar:** 380px no desktop, 100% no mobile.
* **Container máximo:** `max-width: 1100px` para o layout completo.

#### Consumo da API (Fetch Assíncrono)
O `script.js` faz uma requisição `GET` assíncrona ao endpoint do Google Apps Script no carregamento da página:
* **Loading state:** Exibe a mensagem "A atualizar pontuações..." enquanto aguarda a resposta da API.
* **Tratamento de erro:** Em caso de falha na requisição, substitui o indicador de loading por uma mensagem de erro amigável.
* **Dados em memória:** Os dados recebidos são armazenados na variável `dadosGlobais`, permitindo a re-renderização entre abas sem chamadas adicionais à API.

### Design System

O projeto segue um design system coeso baseado numa paleta temática de chocolates:

| Token | Valor | Uso |
|-------|-------|-----|
| `--primary` | `#6B4E3D` | Castanho Trufa — títulos, destaques, medalhas |
| `--secondary` | `#D4A373` | Dourado Suave — barras de progresso, acentos |
| `--bg` | `#FAEDDF` | Fundo Creme — background da página |
| `--text` | `#333` | Texto principal |

**Detalhes visuais:**
* **Tipografia:** `Segoe UI` com fallback para `system-ui`, garantindo renderização nativa e rápida.
* **Cards de cliente:** Fundo `#fdfdfd` com borda `#eee`, `border-radius: 10px` e efeito hover com elevação (`translateY(-2px)` + sombra).
* **Banner do Fliperama:** Gradiente de três pontos (`#6B4E3D → #8B6F5E → #D4A373`) com efeito shimmer decorativo e ícone com animação bounce.
* **Botão do Fliperama:** Gradiente dourado (`#FFD700 → #FFA500`) com animação `pulse-glow` contínua e hover com escala + elevação.
* **Jogo da Trufa:** Brilho pulsante animado no jogador (halo laranja) e na trufa (halo dourado + luz especular), canvas com borda `#6B4E3D` e botões D-Pad com gradiente castanho.
* **Responsividade:** Layout de 2 colunas no desktop (≥ 900px) empilha verticalmente no mobile. Media queries adicionais para ecrãs ≤ 500px.

---

## 💻 Tecnologias Utilizadas

| Camada | Tecnologia | Finalidade |
|--------|------------|------------|
| **Database** | Google Sheets | Banco de dados relacional (Headless DB) |
| **Low-Code** | AppSheet | Interface operacional de vendas |
| **Back-end/API** | Google Apps Script (JavaScript) | API REST read-only, regras de negócio |
| **Front-end** | HTML5, CSS3, JavaScript (Vanilla) | Interface gamificada para clientes |
| **Canvas 2D** | HTML5 Canvas + requestAnimationFrame | Renderização do jogo do labirinto |
| **Deploy** | GitHub Pages | Hospedagem estática do front-end |

---

## Como Executar Localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/<usuario>/turfas-web.git
   ```
2. Abra o ficheiro `index.html` diretamente no navegador, ou utilize uma extensão de servidor local como o **Live Server** (VS Code).

> **Nota:** A aplicação depende da API do Google Apps Script para carregar os dados do ranking. Sem acesso à internet, a página exibirá a mensagem de erro de carregamento.

---

## 📁 Diagrama de Fluxo

```
┌─────────────┐     ┌─────────────────┐     ┌───────────────────────────────┐     ┌──────────────┐
│ Google       │────▶│ Google Apps      │────▶│ GitHub Pages (Front-end)      │────▶│ Cliente      │
│ Sheets (DB)  │     │ Script (API)    │     │                               │     │ (Navegador)  │
└─────────────┘     └─────────────────┘     │  ┌────────────┬────────────┐  │     └──────────────┘
       ▲                                    │  │ Sidebar    │ Ranking    │  │
       │                                    │  │ Jogo Trufa │ + Fliper.  │  │
┌─────────────┐                             │  │ (Canvas)   │ (API Data) │  │
│ AppSheet     │                             │  └────────────┴────────────┘  │
│ (Operação)   │                             └───────────────────────────────┘
└─────────────┘                                        │
                                                       ▼
                                                ┌──────────────────┐
                                                │ React Fliperama  │
                                                │ (Link Externo)   │
                                                └──────────────────┘
```

---

*Desenvolvido como projeto de automação, gestão analítica e fidelização de clientes.*
