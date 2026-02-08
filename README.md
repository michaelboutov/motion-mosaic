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

### UX Enhancements
- **AI Director Chat** — Conversational AI assistant that understands your project context and can perform actions like setting topics, updating scene prompts, applying narration, and adding new scenes through natural language.
- **Prompt Character Counter** — Live character count (4000 limit) with amber/red color warnings on the Mosaic prompt input.
- **Backdrop Dismiss** — Click outside the generation settings panel to close it.
- **Smart Empty State** — Animated transition from landing screen to loading skeleton when generation starts, so you always know something is happening.
- **Video Settings Panel** — Choose between Seedance (standard) or Grok (high quality) video models with customizable duration and mode options.
- **Task Image Refresh** — Manually refresh image URLs for completed tasks to ensure they're still valid before download.
- **Production Board Onboarding** — Helpful hint when all Architect scenes are pending, guiding users to start generating.
- **Image Grid Filtering** — Sticky filter bar above the Mosaic grid: All | Completed | Failed | Has Video — each with a live count badge.
- **Bulk Select Mode** — Enter select mode to multi-pick images with checkboxes, then bulk download or bulk delete in one action.
- **Touch Swipe Navigation** — Swipe left/right on images in MotionStudio to navigate between images on mobile (powered by Framer Motion drag).
- **Topic History Search** — Filter input at the top of the Viral Architect topic history dropdown for quick lookup.
- **Retry Failed Images** — Failed image tiles show a "Tap to retry" button that re-polls the API instead of being dead-ends.

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
│   │   ├── director-chat/          # AI Director chat endpoint
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
│   ├── AnimatedSpinner.tsx         # Loading animation component
│   ├── ApiKeyInput.tsx             # Runtime API key input
│   ├── ComparisonSlider.tsx        # Before/after image comparison
│   ├── ConfirmDialog.tsx           # Reusable confirmation modal
│   ├── DirectorChat.tsx            # AI Director chat assistant
│   ├── ImageGrid.tsx               # Mosaic image grid
│   ├── MotionStudio.tsx            # Image/video studio modal
│   ├── ParticleBubble.tsx          # Animated particle effects
│   ├── ProjectLibrary.tsx          # Save/load project manager
│   ├── PromptInput.tsx             # Prompt + generation controls
│   ├── Toast.tsx                   # Toast notification system
│   ├── VideoSettings.tsx           # Video model & options panel
│   └── architect/
│       ├── SceneRow.tsx            # Individual scene controls
│       ├── ScriptCard.tsx          # Generated script viewer
│       ├── StrategyCard.tsx        # AI strategy display
│       ├── DesignProgress.tsx      # Generation progress indicator
│       └── TimelineView.tsx        # Horizontal scene timeline
└── lib/
    ├── refreshTaskImages.ts        # Task image URL refresh utility
    ├── store.ts                    # Zustand store (state + persistence)
    ├── useArchitectActions.ts      # Architect business logic hook
    ├── useDirectorContext.ts       # AI Director context builder
    ├── useMosaicPolling.ts         # Mosaic-level polling hook
    ├── usePoll.ts                  # Generic async polling utility
    ├── useStudioHandlers.ts        # Studio interaction hook
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
