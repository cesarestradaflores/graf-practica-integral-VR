// -----------------------------------------------------------------
// --- Game.js (VR PRIMERA PERSONA - CÁMARA EN JUGADOR)
// -----------------------------------------------------------------

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { Config } from './Config.js';
import { Player } from './Player.js';
import { GameWorld } from './GameWorld.js';
import { ObstacleManager } from './ObstacleManager.js';
import { VRControls } from './VRControls.js';

export class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            Config.CAMERA_FOV,
            Config.CAMERA_ASPECT,
            Config.CAMERA_NEAR,
            Config.CAMERA_FAR
        );
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();
        
        this.player = null;
        this.world = null;
        this.obstacleManager = null;
        this.assets = {};

        // Configuración VR MEJORADA
        this.isVRMode = false;
        this.vrControls = null;
        this.cameraContainer = new THREE.Group(); // NUEVO: Contenedor para cámara en VR

        this.audioListener = null;
        this.backgroundMusic = null;
        this.coinSound = null;
        this.powerUpSound = null;
        this.isMusicPlaying = false;

        this.isGameStarted = false;
        this.isGameOver = false;
        this.isPaused = false;
        this.gameSpeed = Config.GAME_START_SPEED;
        this.score = 0;
        this.distance = 0;
        this.difficultyLevel = 1;

        // SISTEMA DE POWER-UPS
        this.activePowerUps = {
            magnet: { active: false, timer: 0 },
            double: { active: false, timer: 0 }
        };

        this.ui = {
            score: document.getElementById('score'),
            distance: document.getElementById('distance'),
            gameOver: document.getElementById('game-over'),
            loadingScreen: document.getElementById('loading-screen'),
            loadingBar: document.getElementById('loading-bar'),
            loadingText: document.getElementById('loading-text'),
            errorScreen: document.getElementById('error-screen'),
            uiContainer: document.getElementById('ui-container'),
            modalOverlay: document.getElementById('modal-overlay'),
            rulesModal: document.getElementById('rules-modal')
        };

        this.powerUpIndicators = {
            magnet: document.createElement('div'),
            double: document.createElement('div')
        };

        this.setupPowerUpUI();
        
        // DEBUG
        this.frameCount = 0;
        this.collisionDebugEnabled = true;
    }

    async init() {
        console.log("Iniciando el juego con VR primera persona...");

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // NUEVO: Configuración WebXR MEJORADA
        this.setupWebXR();

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.shadowMap.enabled = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        document.body.appendChild(this.renderer.domElement);

        // NUEVO: Configurar contenedor de cámara para VR
        this.setupCameraContainer();

        this.setupAudio();

        this.scene.fog = new THREE.Fog(Config.FOG_COLOR, Config.FOG_NEAR, Config.FOG_FAR);
        
        // POSICIÓN INICIAL MEJORADA - Permite ver zombie atrás
        this.cameraContainer.position.set(0, Config.VR_SETTINGS.PLAYER_HEIGHT, 0);
        this.camera.position.set(0, 0, 0); // Cámara dentro del contenedor

        try {
            this.assets = await this.preloadAssets();
            this.ui.loadingScreen.style.display = 'none';
            console.log("Assets cargados, mostrando modal de reglas.");
            
        } catch (error) {
            console.error("Error al cargar assets:", error);
            this.ui.loadingScreen.style.display = 'none';
            this.ui.errorScreen.style.display = 'flex';
            return Promise.reject(error);
        }
        
        this.world = new GameWorld(this.scene, this.assets);
        this.player = new Player(this.scene, this.assets);
        this.obstacleManager = new ObstacleManager(this.scene, this.assets);

        // NUEVO: Configurar controles VR después de crear el player
        this.setupVRControls();

        this.setupLights();
        this.loadEnvironment('Recursos/sunset_jhbcentral_4k.hdr'); 

        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        document.addEventListener('keydown', this.player.onKeyDown.bind(this.player), false);

        console.log("Iniciación completa. VR primera persona configurada.");
        
        return Promise.resolve();
    }

    // NUEVO: Configurar contenedor de cámara para VR
    setupCameraContainer() {
        this.scene.add(this.cameraContainer);
        this.cameraContainer.add(this.camera);
        console.log("✅ Contenedor de cámara VR configurado");
    }

    // NUEVO MÉTODO: Configuración WebXR MEJORADA
    setupWebXR() {
        this.renderer.xr.enabled = true;
        
        const vrButton = VRButton.createButton(this.renderer);
        document.body.appendChild(vrButton);
        
        this.renderer.xr.addEventListener('sessionstart', () => {
            console.log('🚀 Sesión VR iniciada - Primera persona activada');
            this.onVRStart();
        });
        
        this.renderer.xr.addEventListener('sessionend', () => {
            console.log('📴 Sesión VR finalizada');
            this.onVREnd();
        });
        
        console.log("✅ WebXR configurado - Primera persona inmersiva");
    }

    // NUEVO: Configurar controles VR MEJORADOS
    setupVRControls() {
        if (this.renderer.xr.enabled && this.player) {
            this.vrControls = new VRControls(this.camera, this.renderer, this.player, this.scene, this.cameraContainer);
            console.log("✅ Controles VR primera persona configurados");
        }
    }

    // NUEVO: Cuando inicia sesión VR - PRIMERA PERSONA
    onVRStart() {
        this.isVRMode = true;
        this.player.enableVRMode();
        
        // OCULTAR MODELO DEL JUGADOR EN VR (eres tú mismo)
        if (this.player.group) {
            this.player.group.visible = false;
        }
        
        // Posicionar contenedor de cámara en el jugador
        this.cameraContainer.position.set(
            this.player.group.position.x,
            Config.VR_SETTINGS.PLAYER_HEIGHT,
            this.player.group.position.z
        );
        
        // Disparar evento personalizado para la UI
        window.dispatchEvent(new CustomEvent('game-vr-start'));
        
        console.log("🎮 Modo VR primera persona activado - Eres el personaje");
    }

    // NUEVO: Cuando termina sesión VR
    onVREnd() {
        this.isVRMode = false;
        this.player.disableVRMode();
        
        // MOSTRAR MODELO DEL JUGADOR en modo normal
        if (this.player.group) {
            this.player.group.visible = true;
        }
        
        // Restaurar cámara normal
        this.cameraContainer.position.set(0, Config.CAMERA_START_Y, Config.CAMERA_START_Z);
        this.cameraContainer.lookAt(0, 0, 0);
        
        // Disparar evento personalizado para la UI
        window.dispatchEvent(new CustomEvent('game-vr-end'));
        
        console.log("🖥️ Modo VR desactivado - Volviendo a tercera persona");
    }

    setupAudio() {
        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);
        
        this.backgroundMusic = new THREE.Audio(this.audioListener);
        
        const audioLoader = new THREE.AudioLoader();
        
        audioLoader.load('Recursos/Subway Surfers.mp3', (buffer) => {
            this.backgroundMusic.setBuffer(buffer);
            this.backgroundMusic.setLoop(true);
            this.backgroundMusic.setVolume(0.3);
            console.log("Música cargada correctamente");
        }, undefined, (error) => {
            console.error("Error al cargar la música:", error);
        });

        this.coinSound = new THREE.Audio(this.audioListener);
        audioLoader.load('Recursos/SonidoMoneda.mp3', (buffer) => {
            this.coinSound.setBuffer(buffer);
            this.coinSound.setVolume(0.5);
            console.log("Sonido de monedas cargado correctamente");
        }, undefined, (error) => {
            console.error("Error al cargar el sonido de monedas:", error);
        });

        this.powerUpSound = new THREE.Audio(this.audioListener);
        audioLoader.load('Recursos/SonidoMoneda.mp3', (buffer) => {
            this.powerUpSound.setBuffer(buffer);
            this.powerUpSound.setVolume(0.8);
            console.log("Sonido de power-ups cargado correctamente");
        }, undefined, (error) => {
            console.error("Error al cargar el sonido de power-ups:", error);
        });
    }

    setupPowerUpUI() {
        const powerUpContainer = document.createElement('div');
        powerUpContainer.id = 'powerup-container';
        powerUpContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 100;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;

        this.powerUpIndicators.magnet.id = 'magnet-indicator';
        this.powerUpIndicators.magnet.style.cssText = `
            background: rgba(255, 0, 0, 0.3);
            border: 2px solid #FF0000;
            border-radius: 10px;
            padding: 10px;
            color: white;
            font-weight: bold;
            min-width: 140px;
            text-align: center;
            display: none;
            transition: all 0.3s ease;
            font-size: 14px;
        `;
        this.powerUpIndicators.magnet.innerHTML = '🎯 IMÁN: <span class="timer">0.0s</span>';

        this.powerUpIndicators.double.id = 'double-indicator';
        this.powerUpIndicators.double.style.cssText = `
            background: rgba(255, 255, 0, 0.3);
            border: 2px solid #FFFF00;
            border-radius: 10px;
            padding: 10px;
            color: white;
            font-weight: bold;
            min-width: 140px;
            text-align: center;
            display: none;
            transition: all 0.3s ease;
            font-size: 14px;
        `;
        this.powerUpIndicators.double.innerHTML = '🔧 DOBLE: <span class="timer">0.0s</span>';

        powerUpContainer.appendChild(this.powerUpIndicators.magnet);
        powerUpContainer.appendChild(this.powerUpIndicators.double);
        document.body.appendChild(powerUpContainer);
    }

    activatePowerUp(type) {
        console.log(`🎯 ACTIVANDO POWER-UP: ${type}`);
        
        const duration = Config.POWERUP_DURATION[type];
        
        this.activePowerUps[type].active = true;
        this.activePowerUps[type].timer = duration;
        
        this.powerUpIndicators[type].style.display = 'block';
        this.powerUpIndicators[type].style.background = type === 'magnet' 
            ? 'rgba(255, 0, 0, 0.7)' 
            : 'rgba(255, 255, 0, 0.7)';
        
        this.playPowerUpSound();
        this.showPowerUpNotification(type);
        
        console.log(`✅ Power-up ACTIVADO: ${type} por ${duration}s`);
    }

    updatePowerUps(deltaTime) {
        for (const [type, powerUp] of Object.entries(this.activePowerUps)) {
            if (powerUp.active) {
                powerUp.timer -= deltaTime;
                
                const indicator = this.powerUpIndicators[type];
                const timerElement = indicator.querySelector('.timer');
                if (timerElement) {
                    timerElement.textContent = `${Math.max(0, powerUp.timer).toFixed(1)}s`;
                }
                
                // Efecto de parpadeo cuando queda poco tiempo
                if (powerUp.timer < 3.0) {
                    const blink = (Math.sin(Date.now() * 0.02) + 1) * 0.3 + 0.4;
                    indicator.style.opacity = blink;
                }
                
                // Desactivar cuando timer llega a 0
                if (powerUp.timer <= 0) {
                    console.log(`⏰ Power-up ${type} terminó - Desactivando`);
                    this.deactivatePowerUp(type);
                }
            }
        }
    }

    deactivatePowerUp(type) {
        console.log(`🔚 DESACTIVANDO POWER-UP: ${type}`);
        
        this.activePowerUps[type].active = false;
        this.activePowerUps[type].timer = 0;
        
        this.powerUpIndicators[type].style.display = 'none';
        this.powerUpIndicators[type].style.opacity = '1';
        
        console.log(`❌ Power-up DESACTIVADO: ${type}`);
    }

    debugPowerUps() {
        console.log("🔍 DEBUG Power-ups:");
        for (const [type, powerUp] of Object.entries(this.activePowerUps)) {
            console.log(`   ${type}: active=${powerUp.active}, timer=${powerUp.timer.toFixed(1)}s`);
        }
    }

    showPowerUpNotification(type) {
        const notification = document.createElement('div');
        const powerUpInfo = {
            magnet: { text: '🎯 IMÁN ACTIVADO!', color: '#FF0000', subtext: 'Atrae monedas automáticamente' },
            double: { text: '🔧 DOBLE PUNTUACIÓN!', color: '#FFFF00', subtext: 'Monedas valen 20 puntos' }
        };
        
        const info = powerUpInfo[type];
        
        notification.style.cssText = `
            position: fixed;
            top: 30%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${info.color}DD;
            color: white;
            padding: 25px 50px;
            border-radius: 15px;
            font-size: 28px;
            font-weight: bold;
            z-index: 1000;
            animation: powerUpNotification 3s ease-in-out;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            text-align: center;
            border: 3px solid white;
            box-shadow: 0 0 30px ${info.color};
        `;
        
        notification.innerHTML = `
            <div style="margin-bottom: 10px;">${info.text}</div>
            <div style="font-size: 18px; opacity: 0.9;">${info.subtext}</div>
            <div style="font-size: 16px; opacity: 0.7; margin-top: 5px;">15 segundos</div>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes powerUpNotification {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
                15% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
                25% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                75% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                85% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
            if (document.head.contains(style)) {
                document.head.removeChild(style);
            }
        }, 3000);
    }

    playPowerUpSound() {
        if (this.powerUpSound) {
            this.powerUpSound.stop();
            this.powerUpSound.play();
        }
    }

    playBackgroundMusic() {
        if (this.backgroundMusic && !this.isMusicPlaying) {
            this.backgroundMusic.play();
            this.isMusicPlaying = true;
            console.log("Música de fondo iniciada");
        }
    }

    playCoinSound() {
        if (this.coinSound) {
            this.coinSound.stop();
            this.coinSound.play();
        }
    }

    pauseBackgroundMusic() {
        if (this.backgroundMusic && this.isMusicPlaying) {
            this.backgroundMusic.pause();
            this.isMusicPlaying = false;
            console.log("Música de fondo pausada");
        }
    }

    stopBackgroundMusic() {
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
            this.isMusicPlaying = false;
            console.log("Música de fondo detenida");
        }
    }

    resetToMainMenu() {
        console.log("🔄 Reiniciando a menú principal...");
        
        this.stopBackgroundMusic();
        
        this.isGameStarted = false;
        this.isGameOver = false;
        this.isPaused = false;
        this.score = 0;
        this.distance = 0;
        this.gameSpeed = Config.GAME_START_SPEED;
        this.difficultyLevel = 1;
        
        for (const type in this.activePowerUps) {
            this.activePowerUps[type].active = false;
            this.activePowerUps[type].timer = 0;
            if (this.powerUpIndicators[type]) {
                this.powerUpIndicators[type].style.display = 'none';
                this.powerUpIndicators[type].style.opacity = '1';
            }
        }
        
        if (this.obstacleManager) {
            this.obstacleManager.reset();
        }
        
        if (this.player) this.player.reset();
        if (this.world) this.world.reset();
        
        this.ui.uiContainer.style.display = 'none';
        this.ui.gameOver.style.display = 'none';
        document.getElementById('pause-button').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'none';
        
        this.ui.modalOverlay.style.display = 'flex';
        this.ui.rulesModal.style.display = 'block';

        const introMusic = document.getElementById('intro-music');
        if (introMusic) {
            introMusic.currentTime = 0;
            if (!introMusic.muted) {
                introMusic.play().catch(e => console.log('Error al reanudar música:', e));
            }
        }
        
        console.log("✅ Menú principal cargado correctamente");
    }

    startGame() {
        this.clock.start();
        console.log("🚀 INICIANDO JUEGO - VR Primera Persona");
        
        this.checkInitialCollisions();
        
        this.ui.modalOverlay.style.display = 'none';
        this.ui.rulesModal.style.display = 'none';
        this.ui.uiContainer.style.display = 'block';

        this.isGameStarted = true;
        this.isGameOver = false;
        
        this.playBackgroundMusic();
        this.resetGameLogic();
        this.animate();
    }

    checkInitialCollisions() {
        console.log("🔍 VERIFICANDO COLISIONES INICIALES...");
        
        const playerBox = this.player.getBoundingBox();
        console.log("📍 Posición inicial del jugador:", {
            x: this.player.group.position.x.toFixed(2),
            y: this.player.group.position.y.toFixed(2), 
            z: this.player.group.position.z.toFixed(2)
        });

        console.log(`🎯 Obstáculos al inicio: ${this.obstacleManager.obstacles.length}`);
        this.obstacleManager.obstacles.forEach((obstacle, i) => {
            const obstacleBox = obstacle.getBoundingBox();
            console.log(`   Obstáculo ${i}:`, {
                type: obstacle.type,
                position: {
                    x: obstacle.mesh.position.x.toFixed(2),
                    y: obstacle.mesh.position.y.toFixed(2),
                    z: obstacle.mesh.position.z.toFixed(2)
                },
                colisiona: playerBox.intersectsBox(obstacleBox)
            });
        });

        console.log(`⚡ Power-ups al inicio: ${this.obstacleManager.powerUps.length}`);
        this.obstacleManager.powerUps.forEach((powerUp, i) => {
            const powerUpBox = powerUp.getBoundingBox();
            console.log(`   Power-up ${i}:`, {
                type: powerUp.powerUpType,
                position: {
                    x: powerUp.mesh.position.x.toFixed(2),
                    y: powerUp.mesh.position.y.toFixed(2),
                    z: powerUp.mesh.position.z.toFixed(2)
                },
                colisiona: playerBox.intersectsBox(powerUpBox)
            });
        });
    }

    resetGameLogic() {
        console.log("🔄 Reseteando juego...");
        
        this.score = 0;
        this.distance = 0;
        this.gameSpeed = Config.GAME_START_SPEED;
        this.difficultyLevel = 1;

        for (const type in this.activePowerUps) {
            this.activePowerUps[type].active = false;
            this.activePowerUps[type].timer = 0;
            this.powerUpIndicators[type].style.display = 'none';
        }

        this.ui.score.textContent = `Puntos: 0`;
        this.ui.distance.textContent = `Distancia: 0m`;

        if (this.obstacleManager) {
            this.obstacleManager.reset();
        }
        
        if (this.player) this.player.reset();
        if (this.world) this.world.reset();

        console.log("✅ Juego reiniciado - Listo para empezar");
    }

    restartGame() {
        this.clock.start();
        console.log("Reiniciando el juego...");
        
        this.ui.gameOver.style.display = 'none';
        this.isGameOver = false;
        
        this.playBackgroundMusic();
        this.resetGameLogic();
        this.animate();
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(5, 10, 7);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 50;
        this.scene.add(dirLight);
    }

    loadEnvironment(hdrPath) {
        const rgbeLoader = new RGBELoader();
        rgbeLoader.load(hdrPath, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.background = texture;
            this.scene.environment = texture;
            console.log("Fondo HDR cargado.");
        }, undefined, (err) => {
            console.warn("No se pudo cargar el fondo HDR. Usando fondo azul por defecto.", err);
            this.scene.background = new THREE.Color(0x87CEEB);
        });
    }

    updateDifficulty() {
        const newDifficulty = Math.floor(this.distance / Config.DIFFICULTY_INTERVAL) + 1;
        
        if (newDifficulty > this.difficultyLevel) {
            this.difficultyLevel = newDifficulty;
            
            const speedIncrease = 2 * this.difficultyLevel;
            this.gameSpeed = Math.min(
                Config.GAME_START_SPEED + speedIncrease, 
                Config.GAME_MAX_SPEED
            );
            
            this.obstacleManager.baseSpawnRate = Math.max(
                0.5, 
                2 - (this.difficultyLevel * 0.3)
            );
            
            console.log(`¡Dificultad Nivel ${this.difficultyLevel}! Velocidad: ${this.gameSpeed.toFixed(1)}`);
        }
    }

    preloadAssets() {
        console.log("Precargando assets...");
        const fbxLoader = new FBXLoader();
        const textureLoader = new THREE.TextureLoader();
        const totalAssets = 15; 
        let loadedCount = 0;

        const updateProgress = () => {
            loadedCount++;
            const progress = (loadedCount / totalAssets) * 100;
            this.ui.loadingBar.style.width = `${progress}%`;
            this.ui.loadingText.textContent = `${Math.round(progress)}%`;
            console.log(`Progreso de carga: ${progress}%`);
        };

        const loadPromise = (path) => {
            return new Promise((resolve, reject) => {
                fbxLoader.load(path, (obj) => {
                    updateProgress();
                    resolve(obj);
                }, undefined, (err) => {
                    console.error(`Error cargando ${path}`, err);
                    reject(err);
                });
            });
        };

        const loadTexturePromise = (path) => {
            return new Promise((resolve, reject) => {
                textureLoader.load(path, (texture) => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    resolve(texture);
                }, undefined, (err) => {
                    console.error(`Error cargando textura ${path}`, err);
                    reject(err);
                });
            });
        };

        return new Promise(async (resolve, reject) => {
            try {
                const assetPaths = {
                    coin: 'Recursos/Low Poly Coin.fbx',
                    barrier: 'Recursos/concrete_road_barrier4k.fbx',
                    car: 'Recursos/covered_car4k.fbx',
                    rock: 'Recursos/moon_rock_4k.fbx',
                    barrel: 'Recursos/Barrel.fbx',
                    dartboard: 'Recursos/dartboard_4k.fbx', 
                    pipeWrench: 'Recursos/pipe_wrench_4k.fbx', 
                    playerModel: 'Recursos/character.fbx',
                    animRun: 'Recursos/Fast Run.fbx',
                    animJump: 'Recursos/Jump.fbx',
                    animDie: 'Recursos/Death.fbx',
                    animRoll: 'Recursos/Sprinting Forward Roll.fbx',
                    animLeft: 'Recursos/Left.fbx',   
                    animRight: 'Recursos/Right.fbx',
                    zombieModel: 'Recursos/Zombie Walk1.fbx'
                };

                console.log("Cargando texturas...");
                const [
                    carTexture,
                    barrierDiffTexture,
                    barrierDispTexture,
                    rockDiffTexture,
                    rockDispTexture,
                    barrelTexture, 
                    dartboardTexture, 
                    pipeWrenchTexture 
                ] = await Promise.all([
                    loadTexturePromise('Recursos/covered_car_diff_4k.jpg'),
                    loadTexturePromise('Recursos/concrete_road_barrier_diff_4k.jpg'),
                    loadTexturePromise('Recursos/concrete_road_barrier_disp_4k.png'),
                    loadTexturePromise('Recursos/moon_rock_03_diff_4k.jpg'),
                    loadTexturePromise('Recursos/moon_rock_03_disp_4k.png'),
                    loadTexturePromise('Recursos/Barrel_01.png'), 
                    loadTexturePromise('Recursos/dartboard_diff_4k.jpg'), 
                    loadTexturePromise('Recursos/pipe_wrench_diff_4k.jpg') 
                ]);

                const [
                    coin, 
                    barrier, 
                    car, 
                    rock,
                    barrel, 
                    dartboard,
                    pipeWrench, 
                    playerModel,
                    animRun,
                    animJump,
                    animDie,
                    animRoll,
                    animLeft,
                    animRight,
                    zombieModel
                    
                ] = await Promise.all([
                    loadPromise(assetPaths.coin),
                    loadPromise(assetPaths.barrier),
                    loadPromise(assetPaths.car),
                    loadPromise(assetPaths.rock),
                    loadPromise(assetPaths.barrel),
                    loadPromise(assetPaths.dartboard), 
                    loadPromise(assetPaths.pipeWrench), 
                    loadPromise(assetPaths.playerModel),
                    loadPromise(assetPaths.animRun),
                    loadPromise(assetPaths.animJump),
                    loadPromise(assetPaths.animDie),
                    loadPromise(assetPaths.animRoll),
                    loadPromise(assetPaths.animLeft),
                    loadPromise(assetPaths.animRight),
                    loadPromise(assetPaths.zombieModel)
                ]);

                car.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material.map = carTexture;
                        child.material.needsUpdate = true;
                    }
                });

                barrier.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material.map = barrierDiffTexture;
                        child.material.displacementMap = barrierDispTexture;
                        child.material.displacementScale = 0.1;
                        child.material.needsUpdate = true;
                    }
                });

                rock.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material.map = rockDiffTexture;
                        child.material.displacementMap = rockDispTexture;
                        child.material.displacementScale = 0.05;
                        child.material.needsUpdate = true;
                    }
                });

                barrel.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material.map = barrelTexture;
                        child.material.needsUpdate = true;
                    }
                });

                dartboard.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material.map = dartboardTexture;
                        child.material.needsUpdate = true;
                    }
                });

                pipeWrench.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material.map = pipeWrenchTexture;
                        child.material.needsUpdate = true;
                    }
                });

                coin.scale.set(0.005, 0.005, 0.005);           
                barrier.scale.set(0.01, 0.01, 0.01);           
                car.scale.set(0.015, 0.015, 0.015);            
                barrel.scale.set(0.02, 0.02, 0.02);            
                dartboard.scale.set(0.03,0.03,0.03);    
                pipeWrench.scale.set(0.03,0.03,0.03); 
                zombieModel.scale.set(0.011, 0.011, 0.011);

                [coin, barrier, car, rock, barrel, dartboard, pipeWrench, playerModel].forEach(model => {
                    model.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                });

                console.log("✅ Todos los assets cargados y configurados");

                resolve({
                    coin: coin,
                    playerModel: playerModel,
                    barrier: barrier,
                    car: car,
                    rock: rock,
                    barrel: barrel, 
                    dartboard: dartboard, 
                    pipeWrench: pipeWrench, 
                    obstacleBarriers: [barrier, car, rock, barrel], 
                    animRun: animRun,
                    animJump: animJump,
                    animDie: animDie,
                    animRoll: animRoll,
                    animLeft: animLeft,
                    animRight: animRight,
                    zombieModel: zombieModel
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    checkCollisions() {
        if (this.isGameOver) return;

        const playerBox = this.player.getBoundingBox();
        const playerPosition = this.player.group.position;

        this.frameCount++;

        if (this.collisionDebugEnabled && this.frameCount % 120 === 0) {
            console.log(`🔄 Frame ${this.frameCount} - Distancia: ${this.distance.toFixed(0)}m`);
            console.log(`📍 Jugador: X=${playerPosition.x.toFixed(2)}, Z=${playerPosition.z.toFixed(2)}`);
            console.log(`🎯 Obstáculos: ${this.obstacleManager.obstacles.length}`);
            console.log(`⚡ Power-ups: ${this.obstacleManager.powerUps.length}`);
            this.debugPowerUps(); 
        }

        for (let i = 0; i < this.obstacleManager.obstacles.length; i++) {
            const obstacle = this.obstacleManager.obstacles[i];
            const obstacleBox = obstacle.getBoundingBox();
            
            if (playerBox.intersectsBox(obstacleBox)) {
                console.log("🚨 ¡COLISIÓN CON OBSTÁCULO! Game Over");
                console.log(`📍 Obstáculo ${i}:`, {
                    type: obstacle.type,
                    position: {
                        x: obstacle.mesh.position.x.toFixed(2),
                        y: obstacle.mesh.position.y.toFixed(2),
                        z: obstacle.mesh.position.z.toFixed(2)
                    }
                });
                this.gameOver("COLISIÓN CON OBSTÁCULO");
                return;
            }
        }

        for (let i = this.obstacleManager.coins.length - 1; i >= 0; i--) {
            const coin = this.obstacleManager.coins[i];
            const coinBox = coin.getBoundingBox();
            if (playerBox.intersectsBox(coinBox)) {
                console.log("💰 Moneda recolectada!");
                this.obstacleManager.collectCoin(coin);
                
                let points = 10;
                if (this.activePowerUps.double.active) {
                    points = 20;
                    console.log("✅ Bonus doble aplicado: +20 puntos");
                }
                
                this.score += points;
                this.ui.score.textContent = `Puntos: ${this.score}`;
                this.playCoinSound();
            }
        }

        for (let i = this.obstacleManager.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.obstacleManager.powerUps[i];
            const powerUpBox = powerUp.getBoundingBox();
            
            if (playerBox.intersectsBox(powerUpBox)) {
                console.log(`⚡ ¡COLISIÓN CON POWER-UP! Tipo: ${powerUp.powerUpType}`);
                console.log(`📍 Posición power-up:`, {
                    x: powerUp.mesh.position.x.toFixed(2),
                    y: powerUp.mesh.position.y.toFixed(2), 
                    z: powerUp.mesh.position.z.toFixed(2)
                });
                
                const powerUpType = powerUp.powerUpType;
                
                this.obstacleManager.collectPowerUp(powerUp);
                
                if (powerUpType && (powerUpType === 'magnet' || powerUpType === 'double')) {
                    console.log(`🎯 Activando power-up: ${powerUpType}`);
                    this.activatePowerUp(powerUpType);
                } else {
                    console.error("❌ Tipo de power-up inválido:", powerUpType);
                }
                break;
            }
        }
    }
    
    gameOver(reason = "DESCONOCIDO") {
        if (this.isGameOver) return;

        console.log("🛑 ================================");
        console.log("🛑 GAME OVER - INICIANDO SECUENCIA");
        console.log(`🛑 Razón: ${reason}`);
        console.log(`🛑 Distancia: ${this.distance.toFixed(0)}m`);
        console.log(`🛑 Puntuación: ${this.score}`);
        console.log("🛑 ================================");

        this.isGameOver = true;
        this.pauseBackgroundMusic();

        if (this.player) {
            this.player.die();
        }

        if (this.player && this.player.mixer) {
            const dieAction = this.player.actions.die;

            const onDieAnimationFinished = (e) => {
                if (e.action === dieAction) {
                    console.log("Animación 'die' terminada. Mostrando menú de Game Over.");

                    document.getElementById('final-score').textContent = this.score;
                    document.getElementById('final-distance').textContent = Math.floor(this.distance) + 'm';
                    document.getElementById('final-coins').textContent = Math.floor(this.score / 10);
                    document.getElementById('final-time').textContent = Math.floor(this.distance / this.gameSpeed) + 's';

                    this.ui.gameOver.style.display = 'block';

                    this.player.mixer.removeEventListener('finished', onDieAnimationFinished);
                }
            };

            this.player.mixer.addEventListener('finished', onDieAnimationFinished);

        } else {
            this.ui.gameOver.style.display = 'block';
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        if (!this.isGameStarted) {
            return;
        }

        if (this.renderer.xr.isPresenting) {
            this.renderer.setAnimationLoop(this.render.bind(this));
        } else {
            requestAnimationFrame(this.animate.bind(this));
            this.render();
        }
    }

    // NUEVO: Render MEJORADO para VR primera persona
    render() {
        if (this.isPaused) {
            return; 
        }

        const delta = this.clock.getDelta();

        // NUEVO: Actualizar controles VR con contenedor de cámara
        if (this.vrControls && this.isVRMode) {
            this.vrControls.update(delta);
        }

        if (this.player) {
            this.player.update(delta);
            
            // NUEVO: En VR primera persona, la cámara SIGUE al jugador
            if (this.isVRMode) {
                this.cameraContainer.position.x = this.player.group.position.x;
                this.cameraContainer.position.z = this.player.group.position.z;
                
                // Ajustar altura durante saltos
                if (this.player.state === Config.PLAYER_STATE.JUMPING) {
                    this.cameraContainer.position.y = Config.VR_SETTINGS.PLAYER_HEIGHT + this.player.group.position.y;
                } else {
                    this.cameraContainer.position.y = Config.VR_SETTINGS.PLAYER_HEIGHT;
                }
            }
        }

        if (this.isGameOver) {
            if (this.world) {
                this.world.zombieCatch(delta);
            }
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const playerPosition = this.player.group.position;

        this.world.update(delta, this.gameSpeed, playerPosition);
        
        this.obstacleManager.update(
            delta, 
            this.gameSpeed, 
            this.distance, 
            playerPosition,
            this.activePowerUps
        );

        // NUEVO: En modo normal, cámara sigue al jugador en 3ra persona
        if (!this.isVRMode) {
            this.cameraContainer.position.z = playerPosition.z + Config.CAMERA_START_Z;
            this.cameraContainer.position.x = playerPosition.x;
        }

        this.distance += this.gameSpeed * delta;
        this.ui.distance.textContent = `Distancia: ${this.distance.toFixed(0)}m`;
        
        this.updatePowerUps(delta);
        this.updateDifficulty();
        
        this.checkCollisions();

        this.renderer.render(this.scene, this.camera);
    }
}