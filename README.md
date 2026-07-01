# ✋ Gesture Ball Sort Puzzle

A real-time, gesture-controlled web application that allows users to play the classic "Ball Sort Puzzle" using physical hand movements. Built natively for the browser with zero latency, this project maps 3D hand tracking directly to a custom React state machine.

![Project Status](https://img.shields.io/badge/Status-Completed-success)
![Tech Stack](https://img.shields.io/badge/React-19-blue)
![Computer Vision](https://img.shields.io/badge/MediaPipe-Tasks_Vision-orange)

## 🚀 The Project

Most computer vision applications require heavy desktop environments. This project proves that high-fidelity, real-time spatial tracking can be orchestrated entirely on the client side. By leveraging dynamic WebAssembly resolution and strict React architecture, users can physically pinch, drag, and drop elements across a glassmorphic UI using only their webcam.

### ✨ Key Features
* **Webcam Gesture Control:** Tracks 21 hand landmarks in real-time.
* **Physical Drag-and-Drop:** Intuitive pinch-to-grab and open-to-release mechanics.
* **Smooth Physics:** Custom Exponential Moving Average (EMA) filters eliminate camera jitter.
* **Responsive Collision:** Layout-agnostic DOM tracking ensures drag-and-drop works on any screen size or zoom level.
* **Privacy-First:** The camera only activates upon explicit user consent and processes everything locally.

## 🛠️ Technology Stack

* **Core:** React 19, TypeScript, Vite 8
* **Styling:** Tailwind CSS v4 (Native CSS variables and glassmorphism)
* **Computer Vision:** Google MediaPipe Tasks Vision Web SDK
* **Icons:** Lucide React

## 🧠 Engineering & Architecture Solved

Building a bridge between a high-frequency camera loop (`requestAnimationFrame`) and a React state machine presents unique challenges. Here is how they were resolved:

1.  **Normalized 3D Pinch Hysteresis:** Relying on raw coordinates for pinch detection is unreliable when the user moves closer or further from the camera. The pinch logic utilizes a 3D Euclidean distance calculation between the thumb and index finger, normalized by the user's hand scale (wrist-to-middle-finger distance). It also features stateful hysteresis (different thresholds for grabbing vs. releasing) to prevent "sticky" drops.
2.  **Stale State Closure Prevention:** Binding fast-updating camera coordinates directly to React state causes the browser to freeze. The tracking loop was decoupled using mutable `useRef` hooks, ensuring buttery-smooth 60fps cursor rendering without triggering unnecessary React re-renders.
3.  **Layout-Agnostic Hit Testing:** Instead of hardcoding drop zones, the application uses dynamic `getBoundingClientRect()` lookups. This ensures the physics engine instantly adapts to window resizing or CSS flex-wrapping.

## 💻 Local Installation & Setup

To run this project locally, ensure you have Node.js installed.

1. Clone the repository:
   ```bash
   git clone [https://github.com/tayyab-dng/gesture-ball-sort-puzzle.git](https://github.com/tayyab-dng/gesture-ball-sort-puzzle.git)
Navigate into the directory:

```bash
cd gesture-ball-sort-puzzle
Install dependencies:
```
```bash
npm install
Start the Vite development server:
```
```bash
npm run dev
Open your browser and navigate to http://localhost:5173/. Click "Enable Webcam" to start!
```
```bash
👨‍💻 Author
Tayyab Safdar AI-Augmented Full-Stack & Mobile Developer
LinkedIn (https://www.linkedin.com/in/tayyabdng/)

📄 License
This project is open-source and available under the MIT License.
