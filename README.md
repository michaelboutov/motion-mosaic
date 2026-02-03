# MotionMosaic

MotionMosaic is an immersive, AI-powered creative studio that transforms text descriptions into stunning visual mosaics. Built with modern web technologies, it offers a seamless interface for generating images, creating variations, and animating static visuals into motion.

## ✨ Features

- **AI Image Generation**: Generate high-quality images using Midjourney integration via Kie.ai API.
- **Batch Generation**: Create multiple image variations simultaneously with customizable aspect ratios and parameters.
- **Motion Studio**: A dedicated workspace to view, edit, and animate your generated images.
- **Video Generation**: Transform static images into captivating videos with AI-powered motion.
- **Video Upscaling**: Enhance video quality with AI upscaling capabilities.
- **Nano Banana Pro Editing**: Advanced image editing and redrawing capabilities for fine-tuning creations.
- **Viral Architect**: Create variations of images optimized for viral content.
- **Real-time Processing**: Webhook callbacks and polling for async task status updates.
- **Interactive UI**: Fluid animations and transitions powered by Framer Motion.
- **Responsive Design**: A beautiful, dark-themed interface that works seamlessly across devices.

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **UI Components**: [Radix UI](https://www.radix-ui.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **AI Backend**: [Kie.ai API](https://kie.ai/)
- **Language**: TypeScript

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed on your machine.
- An API Key for the backend service (Kie.ai).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/michaelboutov/motion-mosaic.git
   cd motion-mosaic
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Optional: Set the base URL for webhooks (defaults to http://localhost:3000)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

**Note**: The Kie.ai API key is provided by the user at runtime through the UI and stored in the application state (Zustand store). No API keys need to be hardcoded in environment files.

## 📁 Project Structure

```
motion-mosaic/
├── src/
│   ├── app/              # Next.js App Router pages and API routes
│   │   ├── api/          # API endpoints for AI generation
│   │   │   ├── generate-batch/      # Batch image generation
│   │   │   ├── generate-images/     # Single image generation
│   │   │   ├── generate-nano/       # Nano Banana Pro editing
│   │   │   ├── generate-video/      # Video generation
│   │   │   ├── upscale-video/       # Video upscaling
│   │   │   ├── architect/           # Viral Architect variations
│   │   │   └── */callback/          # Webhook handlers
│   │   ├── page.tsx      # Main application page
│   │   ├── layout.tsx    # Root layout
│   │   └── globals.css   # Global styles
│   ├── components/       # Reusable UI components
│   │   ├── MotionStudio.tsx
│   │   ├── ViralArchitect.tsx
│   │   └── ...
│   └── lib/              # Utilities and global state (Zustand store)
├── public/               # Static assets
├── netlify.toml          # Netlify deployment configuration
└── package.json          # Project dependencies and scripts
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
