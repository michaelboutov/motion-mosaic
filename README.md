# MotionMosaic

MotionMosaic is an immersive, AI-powered creative studio that transforms text descriptions into stunning visual mosaics. Built with modern web technologies, it offers a seamless interface for generating images, creating variations, and animating static visuals into motion.

## ✨ Features

- **AI Image Generation**: Generate high-quality image variations in batches using advanced AI models (Midjourney integration).
- **Motion Studio**: A dedicated workspace to view, edit, and animate your generated images.
- **Video Generation**: Transform your static images into captivating videos.
- **Nano Banana Editing**: Advanced image editing capabilities for fine-tuning your creations.
- **Interactive UI**: Fluid animations and transitions powered by Framer Motion.
- **Responsive Design**: A beautiful, dark-themed interface that works seamlessly across devices.

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Icons**: [Lucide React](https://lucide.dev/)
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

## 📁 Project Structure

```
motion-mosaic/
├── src/
│   ├── app/          # Next.js App Router pages and API routes
│   ├── components/   # Reusable UI components
│   └── lib/          # Utilities and global state (Zustand store)
├── public/           # Static assets
└── package.json      # Project dependencies and scripts
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
