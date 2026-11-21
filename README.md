# ⚔️ Grimoire: Awakening RPG

Um RPG 2D de exploração em mundo aberto ambientado no universo de fantasia e magia inspirado em Black Clover. O jogo conta com um vasto mundo procedural de **5.000 × 5.000 tiles**, múltiplos biomas únicos, transições de terreno com autotiling inteligente, sistema de oclusão de copas de árvores e renderização otimizada em tempo real.

---

## 🎮 Controles do Jogo

| Tecla / Ação | Função |
| :--- | :--- |
| **W, A, S, D** ou **Setas** | Movimentar o personagem |
| **Shift** | Correr |
| **Scroll do Mouse** | Controlar o zoom da câmera (1× a 4×) |
| **M** | Abrir / fechar o Minimapa do mundo |
| **R** ou **Espaço** | Gerar um novo mundo procedural (nova seed) |
| **F2** | Exibir / ocultar HUD de informações do bioma |

---

## 🗺️ Características do Mundo

- **Mundo Vasto e Procedural:** Mais de 5.000 × 5.000 tiles (80.000 × 80.000 pixels) gerados através de ruído Perlin multicamadas (continentes, relevo, umidade, temperatura e corpos d'água).
- **Diversidade de Biomas:**
  - 🌲 **Planícies e Bosques Temperados:** Vegetação viva com árvores frondosas e folhagens interativas.
  - 🍂 **Bosque Outonal:** Árvores douradas e âmbar com rica variedade florestal.
  - 🌲 **Taiga e Floresta Ancestral:** Bosques densos e caminhos sombreados.
  - 🏔️ **Montanhas Rochosas:** Terrenos escarpados com transições rochosas e minérios.
  - 🏜️ **Terras Secas e Praias:** Dunas de areia fina, orlas litorâneas e vegetação árida.
  - ❄️ **Tundra e Geleiras:** Águas congeladas e pinheiros cobertos de neve.
  - 🌿 **Pântano:** Terrenos úmidos e vegetação densa.
- **Transições Suaves (Autotiling):** Conexões orgânicas e naturais entre diferentes tipos de solo (grama, pedra, areia, água e gelo) utilizando algoritmos de autotile de 47 variações.
- **Oclusão Dinâmica de Árvores:** O personagem fica visível através de transparência suave e gradual ao passar por trás de copas e troncos altos.
- **Alto Desempenho:** Carregamento inteligente por chunks sob demanda, com pré-renderização de 10 tiles além da visão da câmera e descarte imediato de áreas distantes da memória para máxima fluidez a 60 FPS.

---

## 🚀 Como Executar o Jogo

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 20 ou superior)
- Gerenciador de pacotes npm (já incluso no Node.js)

### Instalação e Execução

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/NycolasQG-DEV/Grimoire-awakening-rpg.git
   cd Grimoire-awakening-rpg
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

4. **Abra no seu navegador:**
   Acesse a URL exibida no terminal (normalmente `http://localhost:5173`).

---

## 🛠️ Tecnologias Utilizadas

- **[Phaser 4](https://phaser.io/):** Motor de física, câmeras, tilemaps e renderização 2D.
- **[React 19](https://react.dev/):** Interface de usuário e overlays.
- **[TypeScript](https://www.typescriptlang.org/):** Tipagem estática robusta em todo o código-fonte.
- **[Vite](https://vite.dev/):** Bundler ultrarrápido para desenvolvimento e build.
