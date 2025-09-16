# Flappy Bird React

A retro-style Flappy Bird clone built with **React**, **Vite**, **Tailwind CSS**, and the **Web Audio API**. Features multiple difficulty modes, retro font styling, parallax clouds, and sound effects.

---

## 🚀 Features
- **Three modes**: Easy (larger gaps, yellow sky), Normal (balanced, blue sky), Hard (smaller gaps, grey sky)
- **Auto-restart** when changing difficulty
- **Retro font (Press Start 2P)** for nostalgic vibes
- **Layered parallax clouds** in the background
- **Sound effects** for flap, score, and game over
- Responsive **2:1 aspect ratio canvas**

---

## 📦 Project Structure
```
flappy-bird-react/
├── package.json
├── vite.config.js
├── postcss.config.js
├── tailwind.config.js
├── index.html
├── public/
│   └── favicon.ico   (optional)
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── FlappyBird.jsx
    └── index.css
```

---

## 🛠️ Setup
Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/flappy-bird-react.git
cd flappy-bird-react
```

Install dependencies:
```bash
npm install
```

Start the dev server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Preview production build locally:
```bash
npm run preview
```

---

## 🎮 Controls
- **Space / Up Arrow / Click / Tap** → Flap
- **P** → Pause / Resume
- **Mode Selector** (top HUD) → Easy / Normal / Hard (auto-restarts game)

---

## 🌐 Deployment
You can host this game easily:

### GitHub Pages
1. Add this to `package.json`:
   ```json
   "homepage": "https://YOUR_USERNAME.github.io/flappy-bird-react"
   ```
2. Build the project:
   ```bash
   npm run build
   ```
3. Push the `dist/` folder to a `gh-pages` branch or use GitHub Actions.

### Vercel or Netlify
- Connect your GitHub repo and deploy directly. They auto-detect Vite projects.

---

## 📜 License
MIT License. Free to use, modify, and share.

---

## 🙌 Acknowledgments
- Inspired by the original Flappy Bird game by Dong Nguyen
- Built with [React](https://react.dev/), [Vite](https://vitejs.dev/), and [Tailwind CSS](https://tailwindcss.com/)
