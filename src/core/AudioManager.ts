export class AudioManager {
    private static instance: AudioManager
    private audioContext: AudioContext | null = null
    private masterGain: GainNode | null = null
    private bgmOscillator: OscillatorNode | null = null

    private isMuted: boolean = false
    private volume: number = 0.5

    private constructor() {
        // Lazy init via user interaction
    }

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager()
        }
        return AudioManager.instance
    }

    async init() {
        if (this.audioContext) return

        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            this.masterGain = this.audioContext.createGain()
            this.masterGain.connect(this.audioContext.destination)
            this.masterGain.gain.value = this.volume
            console.log('[AudioManager] AudioContext initialized')
        } catch (e) {
            console.error('[AudioManager] Failed to init AudioContext', e)
        }
    }

    // Set Master Volume (0.0 - 1.0)
    setVolume(val: number) {
        this.volume = Math.max(0, Math.min(1, val))
        if (this.masterGain) {
            this.masterGain.gain.value = this.isMuted ? 0 : this.volume
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted
        this.setVolume(this.volume)
    }

    // --- Sound Effects (Synthesized for now) ---

    playClick() {
        this.playTone(800, 'sine', 0.1)
    }

    playHover() {
        this.playTone(400, 'sine', 0.05, 0.1)
    }

    playSkillUse() {
        this.playTone(600, 'square', 0.15)
        setTimeout(() => this.playTone(300, 'square', 0.3), 100)
    }

    playSkillReady() {
        this.playTone(1200, 'sine', 0.5)
        setTimeout(() => this.playTone(1800, 'sine', 0.5), 100)
    }

    playCooldown() {
        this.playTone(200, 'sawtooth', 0.1)
    }

    startBGM() {
        // Simple drone for BGM
        if (!this.audioContext || this.bgmOscillator) return

        // Resume context if suspended (browser policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume()
        }

        const osc = this.audioContext.createOscillator()
        const gain = this.audioContext.createGain()

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(110, this.audioContext.currentTime) // A2

        // LFO for some movement
        const lfo = this.audioContext.createOscillator()
        lfo.type = 'sine'
        lfo.frequency.value = 0.2
        const lfoGain = this.audioContext.createGain()
        lfoGain.gain.value = 50
        lfo.connect(lfoGain)
        lfoGain.connect(osc.frequency)
        lfo.start()

        gain.gain.value = 0.1 * (this.isMuted ? 0 : this.volume)

        osc.connect(gain)
        gain.connect(this.masterGain!)
        osc.start()

        this.bgmOscillator = osc
        console.log('[AudioManager] BGM Started')
    }

    stopBGM() {
        if (this.bgmOscillator) {
            this.bgmOscillator.stop()
            this.bgmOscillator.disconnect()
            this.bgmOscillator = null
        }
    }

    // Helper to generate simple tones
    private playTone(freq: number, type: OscillatorType, duration: number, vol = 0.5) {
        if (!this.audioContext || this.isMuted) return

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume()
        }

        const osc = this.audioContext.createOscillator()
        const gain = this.audioContext.createGain()

        osc.type = type
        osc.frequency.setValueAtTime(freq, this.audioContext.currentTime)

        gain.gain.setValueAtTime(vol * this.volume, this.audioContext.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)

        osc.connect(gain)
        gain.connect(this.masterGain!)

        osc.start()
        osc.stop(this.audioContext.currentTime + duration)
    }
}

export const audioManager = AudioManager.getInstance()
