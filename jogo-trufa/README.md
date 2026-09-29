# 🍫 Jogo da Trufa — Labirinto 2D

Mini jogo do **Clube da Trufa** onde o jogador deve encontrar a trufa escondida no final de um labirinto gerado aleatoriamente antes que o tempo acabe.

---

## 📁 Estrutura da Pasta

```
jogo-trufa/
├── index.html    # Página standalone do jogo (pode ser aberta independentemente)
├── style.css     # Estilos visuais do jogo standalone
├── script.js     # Toda a lógica do jogo (geração, renderização, controlos)
└── README.md     # Este ficheiro
```

---

## 🎮 Como Funciona

O jogador começa no **canto superior esquerdo** do labirinto e precisa chegar à **trufa** (🍫) no **canto inferior direito** antes que o tempo se esgote.

### Controlos
| Método | Ações |
|---|---|
| **Teclado** | Setas direcionais (`↑ ↓ ← →`) ou teclas WASD |
| **Touch/Mobile** | Botões D-Pad na tela |

### Mecânicas
- **Labirinto aleatório**: cada partida gera um labirinto diferente usando o algoritmo **DFS Recursive Backtracker**
- **Caminhos alternativos**: ~12% das paredes internas são removidas para criar bifurcações e múltiplos caminhos
- **Temporizador**: contagem regressiva de **45 segundos**
- **Alerta visual**: a barra de tempo fica vermelha e pulsa nos últimos **10 segundos**
- **Efeitos visuais**: tanto a trufa como o jogador possuem brilho pulsante animado via `requestAnimationFrame`

---

## ⚙️ Configurações Técnicas

As configurações do jogo ficam no objeto `CONFIG` em `script.js`:

```javascript
const CONFIG = {
    mazeRows: 20,        // Células do labirinto (linhas)
    mazeCols: 20,        // Células do labirinto (colunas)
    cellSize: 14,        // Tamanho de cada célula em pixels
    gameDuration: 45,    // Tempo limite em segundos
    warningTime: 10,     // Segundos para ativar alerta visual
};
```

### Dimensões Derivadas

| Propriedade | Fórmula | Valor Atual |
|---|---|---|
| Grade (altura) | `mazeRows × 2 + 1` | 41 posições |
| Grade (largura) | `mazeCols × 2 + 1` | 41 posições |
| Canvas (largura) | `grade × cellSize` | 574px |
| Canvas (altura) | `grade × cellSize` | 574px |

### Ajustar Dificuldade

| Parâmetro | ↑ Mais Fácil | ↓ Mais Difícil |
|---|---|---|
| `mazeRows` / `mazeCols` | Diminuir (ex: 10) | Aumentar (ex: 25) |
| `gameDuration` | Aumentar (ex: 90) | Diminuir (ex: 30) |
| Paredes removidas (em `criarCaminhosAlternativos`) | Aumentar % (ex: 0.30) | Diminuir % (ex: 0.05) |

---

## 🎨 Paleta de Cores

| Elemento | Cor | Hex |
|---|---|---|
| Paredes | Castanho escuro | `#4a3728` |
| Caminho | Creme claro | `#f5e6d3` |
| Jogador | Laranja | `#e67e22` |
| Jogador (borda) | Laranja escuro | `#d35400` |
| Trufa | Castanho chocolate | `#6B4E3D` |
| Trufa (brilho) | Dourado suave | `#D4A373` |

---

## 🔗 Integração com a Página Principal

O jogo está integrado na página principal do ranking (`../index.html`) como uma **sidebar lateral**:

- O HTML do jogo é embutido diretamente no `index.html` principal dentro de `<aside class="game-sidebar">`
- O script `jogo-trufa/script.js` é carregado como segundo `<script>` na página principal
- Os estilos do jogo estão incluídos no `../style.css` principal
- Em ecrãs ≥ 900px: o jogo aparece como sidebar fixa à esquerda
- Em ecrãs < 900px: o jogo aparece no topo, acima do ranking

> **Nota:** O ficheiro `index.html` dentro desta pasta é a versão **standalone** do jogo, que pode ser aberta independentemente para testes.

---

## 🧩 Algoritmo de Geração

O labirinto é gerado com o algoritmo **DFS Recursive Backtracker**:

1. Toda a grade começa preenchida com paredes
2. A partir da célula (0,0), o algoritmo escolhe uma direção aleatória
3. Remove a parede entre a célula atual e a vizinha não visitada
4. Repete recursivamente até visitar todas as células
5. Resultado: labirinto perfeito (1 único caminho entre quaisquer 2 pontos)
6. Pós-processamento: ~12% das paredes internas são removidas para criar bifurcações

---

## 📋 Tecnologias

- **HTML5 Canvas** para renderização do labirinto
- **JavaScript puro** (sem dependências externas)
- **CSS3** com animações e responsividade
- **requestAnimationFrame** para efeitos de brilho pulsante
