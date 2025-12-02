import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { GameApp } from './core/GameApp'

// Mount Vue UI
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

// Initialize Game Engine
const initGame = async () => {
    try {
        console.log('[Init] Starting game initialization...');

        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
        if (!canvas) {
            console.error("[Init] Canvas element 'game-canvas' not found!");
            return;
        }

        console.log('[Init] Canvas found, creating GameApp...');
        const game = new GameApp();

        console.log('[Init] Initializing GameApp...');
        await game.init(canvas);

        console.log('[Init] GameApp initialized successfully');

        // 簡易房間控制 (開發用)
        (window as any).game = game;
        (window as any).createRoom = () => {
            game.networkManager.createRoom();
            game.hostManager.setHost(true);
            console.log(`✅ Room created! Share this Peer ID: ${game.networkManager.peerId}`);
        };
        (window as any).joinRoom = (hostPeerId: string) => {
            game.networkManager.joinRoom(hostPeerId);
            console.log(`✅ Joining room with Host: ${hostPeerId}`);
        };

        console.log('\n=== 🎮 開發指令 ===');
        console.log('createRoom() - 建立房間');
        console.log('joinRoom(peerId) - 加入房間');
        console.log(`game.networkManager.peerId - 你的 Peer ID (目前: ${game.networkManager.peerId || '等待連線...'})`);
        console.log('==================\n');
    } catch (error) {
        console.error('[Init] Initialization failed:', error);
    }
}

initGame();
