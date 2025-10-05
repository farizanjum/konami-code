# KONAMI CODE Game

A retro-styled game collection activated by the classic Konami Code cheat sequence. Built with vanilla JavaScript, HTML5 Canvas, and the Nothing 5×7 pixel font.

## Features

- **Classic Konami Code Detection**: Enter `↑ ↑ ↓ ↓ ← → ← → B A` to start the Snake game
- **Snake Game**: Eat the "KONAMI CODE" text rendered in pixels
- **Breakout Game**: Break bricks shaped like "KONAMI CODE"
- **Mobile Support**: Touch controls for mobile devices
- **Nothing Font**: Authentic 5×7 pixel font throughout
- **Secret Cheat Codes**: Additional sequences to discover

## Live Demo

Visit: www.trykonamicode.vercel.app

## Local Development

1. Clone the repository:
```bash
git clone https://github.com/farizanjum/konami-code.git
cd konami-code
```

2. Serve locally (Python example):
```bash
python -m http.server 8000
```

3. Open in browser:
```
http://localhost:8000
```

## Mobile Controls

- Tap "SHOW CONTROLS" to reveal on-screen buttons
- Full directional pad + action buttons for Snake
- Left/Right arrows + action buttons for Breakout

## Cheat Codes

- **Start Snake Game**: `↑ ↑ ↓ ↓ ← → ← → B A`
- **Start Breakout**: `↑ ↓ T L`
- **Instant Win (Snake)**: `↑ ↑ ↓ ↓ ← → ← → A B`
- **Instant Win (Any Mode)**: `↓ ↑ L T`

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### GitHub Pages

Push to `gh-pages` branch or configure in repository settings.

## Font Credits

Nothing Font (5×7) - Pixel perfect retro font

## 📄 License

MIT License - Feel free to use and modify!

## Contributing

Contributions welcome! Open an issue or submit a pull request.

---

Made with ❤️ and the Konami Code
