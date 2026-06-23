# Fala, Papagaio! — build local

App infantil para praticar **pronúncia em inglês** (estilo Duolingo), com mascote,
reconhecimento de voz (Web Speech API), sons (Web Audio API) e gerador de frases.

O build compila o código React/JSX e gera um **`index.html` único e autossuficiente**:
todo o JavaScript fica embutido no arquivo, **sem CDN e sem Babel no navegador**.
É esse `index.html` que você publica (tiiny.host, Netlify, GitHub Pages etc.).

---

## 1. Pré-requisito

Instale o **Node.js** (versão LTS, 18 ou superior). Para conferir:

```bash
node -v
npm -v
```

## 2. Instalar as dependências

Na pasta do projeto:

```bash
npm install
```

## 3. Gerar o `index.html`

```bash
npm run build
```

Isso cria/atualiza o `index.html` na raiz do projeto. Pronto para publicar.

## 4. Testar localmente COM microfone

O microfone só funciona em **HTTPS** ou em **localhost**. Abrir o arquivo com duplo
clique (`file://`) **bloqueia** o reconhecimento de voz. Use um servidor local:

```bash
npm run serve
```

Abra o endereço que aparecer (ex.: `http://localhost:3000`) no **Chrome**.
No Android o reconhecimento de fala é mais confiável; no iPhone/Safari o "Ouvir"
funciona, mas o "Falar" pode não.

## 5. Editar e recompilar automaticamente

Mexa em `src/app.jsx` e rode:

```bash
npm run watch
```

A cada alteração salva, o `index.html` é regenerado. (Deixe `npm run serve` rodando
em outro terminal e recarregue a página.)

---

## Onde mexer no código (`src/app.jsx`)

- **`PHRASES`** — frases curadas que abrem o app (en, pt, emoji).
- **`NOUNS` / `ADJS` / `TEMPLATES`** — bancos do gerador dinâmico (botão 🎲).
  Adicione substantivos/adjetivos (com gênero `g: "m"`/`"f"`) ou novos templates;
  cada item novo multiplica as combinações.
- **`play(name)`** — sons sintetizados (`win`, `good`, `try`, `pop`). Ajuste notas/volume.
- **`scoreAttempt` / `starsFor`** — regra de avaliação da pronúncia e limiares das estrelas.
- **`CSS`** (no fim do arquivo) — cores, fontes e animações.

---

## Estrutura

```
fala-papagaio/
├─ src/
│  └─ app.jsx        # todo o app (componente React + ponto de entrada)
├─ build.mjs         # script de build (esbuild -> index.html embutido)
├─ package.json
├─ index.html        # GERADO pelo build (publique este)
└─ README.md
```

## Publicar

Faça upload **apenas do `index.html`** no host estático de sua preferência
(tiiny.host, Netlify Drop, GitHub Pages, Cloudflare Pages). Todos servem HTTPS,
necessário para o microfone.
"# papagaio" 
