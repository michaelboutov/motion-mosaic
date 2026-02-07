<div align="center">

# MotionMosaic

**AI-powered creative studio for generating images, videos, and viral content — all from text.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Deploy](https://img.shields.io/badge/Deploy-Netlify-00C7B7?logo=netlify)](https://www.netlify.com/)

</div>

---

MotionMosaic is a full-stack creative studio that turns text prompts into production-ready visual content. Generate Midjourney images, animate them into video, upscale quality, and orchestrate multi-scene viral narratives — all through a sleek, dark-themed interface.

## ✨ Features

### Image Generation
- **Midjourney Integration** — Generate high-quality images via the Kie.ai API with full control over aspect ratio, stylization, variety, and weirdness parameters.
- **Batch Generation** — Create multiple image variations simultaneously from a single prompt.
- **Nano Banana Pro Editing** — Advanced AI-powered image redrawing and fine-tuning.

### Motion Studio
- **Image-to-Video** — Transform any generated image into a captivating video with AI motion.
- **Video Upscaling** — Enhance video resolution and quality with one click.
- **Voiceover Generation** — Generate AI voiceovers for your video content.
- **Inline Preview** — View, compare, and download results without leaving the studio.

### Viral Architect
- **AI Script Writer** — Describe a topic and get a full viral video strategy with script, scenes, and visual direction powered by Google Gemini.
- **Scene-by-Scene Generation** — Each scene gets its own Midjourney image, generated and tracked independently.
- **Drag-and-Drop Reordering** — Rearrange scenes with intuitive drag-and-drop (dnd-kit).
- **Timeline View** — Visualize your entire project as a horizontal timeline of scenes.
- **One-Click Video Pipeline** — Generate video from any scene image, then upscale — all inline.
- **Genre Templates** — Quick-start with Horror, Sci-Fi, Documentary, Thriller, Fantasy, Drama, Comedy, and Cyberpunk presets.

### Project Management
- **Project Library** — Save, load, and manage multiple projects with persistent local storage.
- **Auto-Save** — Projects are preserved across sessions via Zustand persistence.

### Developer Experience
- **Async Polling** — Robust polling system for long-running AI tasks with configurable intervals and max attempts.
- **Webhook Callbacks** — API routes for receiving task completion notifications.
- **Modular Architecture** — Clean separation of concerns with custom hooks, sub-components, and a centralized store.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **UI** | [React 19](https://react.dev/) + [Framer Motion](https://www.framer.com/motion/) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **State** | [Zustand](https://github.com/pmndrs/zustand) (persisted) |
| **Components** | [Radix UI](https://www.radix-ui.com/) + [Lucide Icons](https://lucide.dev/) |
| **Drag & Drop** | [dnd-kit](https://dndkit.com/) |
| **AI APIs** | [Kie.ai](https://kie.ai/) (Midjourney, Video, Nano) + [Google Gemini](https://ai.google.dev/) |
| **Deployment** | [Netlify](https://www.netlify.com/) |
| **Language** | TypeScript |

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+**
- **Kie.ai API Key** — for image/video generation ([get one here](https://kie.ai/))
- **Google Gemini API Key** *(optional)* — for Viral Architect script generation

### Installation

```bash
git clone https://github.com/michaelboutov/motion-mosaic.git
cd motion-mosaic
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start creating.

### Environment Variables

Create a `.env.local` file in the project root:

```bash
# Optional: base URL for webhook callbacks (defaults to http://localhost:3000)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

> **Note**: API keys are entered at runtime through the UI and stored in the browser via Zustand. No secrets need to be committed to environment files.

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── architect/              # Viral Architect AI strategy endpoint
│   │   ├── generate-batch/         # Batch image generation + callback
│   │   ├── generate-images/        # Single image generation
│   │   ├── generate-nano/          # Nano Banana Pro editing
│   │   ├── generate-video/         # Image-to-video generation
│   │   ├── generate-voiceover/     # AI voiceover generation
│   │   ├── upscale-video/          # Video upscaling
│   │   ├── midjourney-callback/    # Midjourney polling endpoint
│   │   ├── nano-callback/          # Nano task polling endpoint
│   │   └── video-callback/         # Video task polling endpoint
│   ├── page.tsx                    # Main app (Mosaic + Architect tabs)
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Global styles
├── components/
│   ├── ViralArchitect.tsx          # Full Viral Architect workspace
│   ├── MotionStudio.tsx            # Image/video studio modal
│   ├── ProjectLibrary.tsx          # Save/load project manager
│   ├── ImageGrid.tsx               # Mosaic image grid
│   ├── PromptInput.tsx             # Prompt + generation controls
│   ├── ApiKeyInput.tsx             # Runtime API key input
│   ├── ConfirmDialog.tsx           # Reusable confirmation modal
│   ├── Toast.tsx                   # Toast notification system
│   ├── ParticleBubble.tsx          # Animated particle effects
│   └── architect/
│       ├── StrategyCard.tsx        # AI strategy display
│       ├── ScriptCard.tsx          # Generated script viewer
│       ├── SceneRow.tsx            # Individual scene controls
│       ├── DesignProgress.tsx      # Generation progress indicator
│       └── TimelineView.tsx        # Horizontal scene timeline
└── lib/
    ├── store.ts                    # Zustand store (state + persistence)
    ├── useArchitectActions.ts      # Architect business logic hook
    ├── useStudioHandlers.ts        # Studio interaction hook
    ├── usePoll.ts                  # Generic async polling utility
    └── utils.ts                    # Shared helpers (download, etc.)
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
