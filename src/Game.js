// -----------------------------------------------------------------
// --- Game.js (VERSIÓN CORREGIDA - OBSTÁCULOS A RAS DE SUELO)
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
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        this.clock = new THREE.Clock();
        
        this.player = null;
        this.world = null;
        this.obstacleManager = null;
        this.assets = {};

        // CONFIGURACIÓN VR MEJORADA
        this.isVRMode = false;
        this.vrControls = null;
        this.cameraContainer = new THREE.Group();

        // SISTEMA DE AUDIO
        this.audioListener = null;
        this.backgroundMusic = null;
        this.coinSound = null;
        this.powerUpSound = null;
        this.isMusicPlaying = false;

        // ESTADO DEL JUEGO
        this.isGameStarted = false;
        this.isGameOver = false;
        this.isPaused = false;
        this.gameSpeed = Config.GAME_START_SPEED;
        this.score = 0;
        this.distance = 0;
        this.difficultyLevel = 1;
        this.coinsCollected = 0;

        // SISTEMA DE POWER-UPS
        this.activePowerUps = {
            magnet: { active: false, timer: 0 },
            double: { active: false, timer: 0 }
        };

        // REFERENCIAS UI HTML
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
            rulesModal: document.getElementById('rules-modal'),
            pauseButton: document.getElementById('pause-button'),
            pauseMenu: document.getElementById('pause-menu'),
            finalScore: document.getElementById('final-score'),
            finalDistance: document.getElementById('final-distance'),
            finalCoins: document.getElementById('final-coins'),
            finalTime: document.getElementById('final-time')
        };

        // INDICADORES DE POWER-UPS
        this.powerUpIndicators = {
            magnet: document.createElement('div'),
            double: document.createElement('div')
        };

        this.setupPowerUpUI();
        
        // DEBUG
        this.frameCount = 0;
        this.collisionDebugEnabled = false;
        this.lastDistanceUpdate = 0;

        console.log("🎮 Game inicializado - Listo para VR");
    }

    async init() {
        console.log("🚀 Iniciando juego con obstáculos corregidos...");

        // CONFIGURAR RENDERER
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        document.body.appendChild(this.renderer.domElement);

        // CONFIGURAR WEBXR
        this.setupWebXR();

        // CONFIGURAR CÁMARA
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        // CONFIGURAR CONTENEDOR DE CÁMARA
        this.setupCameraContainer();

        // CONFIGURAR AUDIO
        this.setupAudio();

        // CONFIGURAR ESCENA
        this.scene.fog = new THREE.Fog(Config.FOG_COLOR, Config.FOG_NEAR, Config.FOG_FAR);
        this.cameraContainer.position.set(0, Config.VR_SETTINGS.PLAYER_HEIGHT, 0);
        this.camera.position.set(0, 0, 0);

        try {
            // PRECARGAR ASSETS
            this.assets = await this.preloadAssets();
            this.ui.loadingScreen.style.display = 'none';
            console.log("✅ Todos los assets cargados correctamente");
            
        } catch (error) {
            console.error("❌ Error al cargar assets:", error);
            this.ui.loadingScreen.style.display = 'none';
            this.ui.errorScreen.style.display = 'flex';
            return Promise.reject(error);
        }
        
        // INICIALIZAR COMPONENTES DEL JUEGO
        this.world = new GameWorld(this.scene, this.assets);
        this.player = new Player(this.scene, this.assets);
        
        // NUEVO: Pasar referencia del juego al ObstacleManager para correcciones
        this.obstacleManager = new ObstacleManager(this.scene, this.assets, this);

        // CONFIGURAR CONTROLES VR
        this.setupVRControls();

        // CONFIGURAR ILUMINACIÓN
        this.setupLights();

        // CARGAR ENTORNO
        this.loadEnvironment('Recursos/sunset_jhbcentral_4k.hdr'); 

        // CONFIGURAR EVENTOS
        this.setupEventListeners();

        // CONFIGURAR CONTROLES DE PAUSA
        this.setupPauseControls();

        console.log("🎯 Juego completamente inicializado - Obstáculos corregidos");
        
        return Promise.resolve();
    }

    setupWebXR() {
        this.renderer.xr.enabled = true;
        
        const vrButton = VRButton.createButton(this.renderer);
        vrButton.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 20px;
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            z-index: 1000;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;
        document.body.appendChild(vrButton);
        
        this.renderer.xr.addEventListener('sessionstart', () => {
            console.log('🚀 Sesión VR iniciada - UI VR activada');
            this.onVRStart();
        });
        
        this.renderer.xr.addEventListener('sessionend', () => {
            console.log('📴 Sesión VR finalizada');
            this.onVREnd();
        });
        
        console.log("✅ WebXR configurado - Botón VR añadido");
    }

    setupCameraContainer() {
        this.scene.add(this.cameraContainer);
        this.cameraContainer.add(this.camera);
        console.log("✅ Contenedor de cámara VR configurado");
    }

    setupVRControls() {
        if (this.renderer.xr.enabled && this.player) {
            this.vrControls = new VRControls(
                this.camera, 
                this.renderer, 
                this.player, 
                this.scene, 
                this.cameraContainer,
                this
            );
            
            // CONFIGURAR UMBRALES MEJORADOS
            this.vrControls.setHeadRotationThreshold(30); // 30 grados
            this.vrControls.setGazeDuration(0.8); // 0.8 segundos
            
            console.log("✅ Controles VR configurados - Umbral: 30°, Duración: 0.8s");
        }
    }

    setupAudio() {
        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);
        
        // MÚSICA DE FONDO
        this.backgroundMusic = new THREE.Audio(this.audioListener);
        const audioLoader = new THREE.AudioLoader();
        
        audioLoader.load('Recursos/Subway Surfers.mp3', (buffer) => {
            this.backgroundMusic.setBuffer(buffer);
            this.backgroundMusic.setLoop(true);
            this.backgroundMusic.setVolume(0.3);
            console.log("🎵 Música de fondo cargada");
        }, undefined, (error) => {
            console.warn("⚠️ No se pudo cargar la música:", error);
        });

        // SONIDO DE MONEDAS
        this.coinSound = new THREE.Audio(this.audioListener);
        audioLoader.load('Recursos/SonidoMoneda.mp3', (buffer) => {
            this.coinSound.setBuffer(buffer);
            this.coinSound.setVolume(0.5);
            console.log("💰 Sonido de monedas cargado");
        }, undefined, (error) => {
            console.warn("⚠️ No se pudo cargar sonido de monedas:", error);
        });

        // SONIDO DE POWER-UPS
        this.powerUpSound = new THREE.Audio(this.audioListener);
        audioLoader.load('Recursos/SonidoMoneda.mp3', (buffer) => {
            this.powerUpSound.setBuffer(buffer);
            this.powerUpSound.setVolume(0.8);
            console.log("⚡ Sonido de power-ups cargado");
        }, undefined, (error) => {
            console.warn("⚠️ No se pudo cargar sonido de power-ups:", error);
        });
    }

    setupEventListeners() {
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        document.addEventListener('keydown', this.player.onKeyDown.bind(this.player), false);
        
        // EVENTOS PERSONALIZADOS
        window.addEventListener('game-vr-start', () => {
            console.log("🎮 Evento VR Start recibido");
        });
        
        window.addEventListener('game-vr-end', () => {
            console.log("🎮 Evento VR End recibido");
        });
    }

    setupPauseControls() {
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Escape' && this.isGameStarted && !this.isGameOver) {
                this.togglePause();
            }
        });

        if (this.ui.pauseButton) {
            this.ui.pauseButton.addEventListener('click', () => {
                this.togglePause();
            });
        }

        // BOTONES DE PAUSA HTML
        const resumeButton = document.getElementById('resume-button');
        const restartFromPause = document.getElementById('restart-from-pause');
        const mainMenuFromPause = document.getElementById('main-menu-from-pause');

        if (resumeButton) {
            resumeButton.addEventListener('click', () => {
                this.resumeGame();
            });
        }

        if (restartFromPause) {
            restartFromPause.addEventListener('click', () => {
                this.restartGame();
                this.ui.pauseMenu.style.display = 'none';
            });
        }

        if (mainMenuFromPause) {
            mainMenuFromPause.addEventListener('click', () => {
                this.resetToMainMenu();
            });
        }

        // BOTONES DE GAME OVER HTML
        const restartButton = document.getElementById('restart-button');
        const mainMenuFromGameover = document.getElementById('main-menu-from-gameover');

        if (restartButton) {
            restartButton.addEventListener('click', () => {
                this.restartGame();
            });
        }

        if (mainMenuFromGameover) {
            mainMenuFromGameover.addEventListener('click', () => {
                this.resetToMainMenu();
            });
        }
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
            font-family: Arial, sans-serif;
        `;

        // INDICADOR DE IMÁN
        this.powerUpIndicators.magnet.id = 'magnet-indicator';
        this.powerUpIndicators.magnet.style.cssText = `
            background: rgba(255, 0, 0, 0.3);
            border: 2px solid #FF0000;
            border-radius: 10px;
            padding: 12px 16px;
            color: white;
            font-weight: bold;
            min-width: 160px;
            text-align: center;
            display: none;
            transition: all 0.3s ease;
            font-size: 14px;
            backdrop-filter: blur(10px);
        `;
        this.powerUpIndicators.magnet.innerHTML = '🎯 IMÁN ACTIVO: <span class="timer">0.0s</span>';

        // INDICADOR DE DOBLE PUNTUACIÓN
        this.powerUpIndicators.double.id = 'double-indicator';
        this.powerUpIndicators.double.style.cssText = `
            background: rgba(255, 215, 0, 0.3);
            border: 2px solid #FFD700;
            border-radius: 10px;
            padding: 12px 16px;
            color: white;
            font-weight: bold;
            min-width: 160px;
            text-align: center;
            display: none;
            transition: all 0.3s ease;
            font-size: 14px;
            backdrop-filter: blur(10px);
        `;
        this.powerUpIndicators.double.innerHTML = '🔧 DOBLE PUNTOS: <span class="timer">0.0s</span>';

        powerUpContainer.appendChild(this.powerUpIndicators.magnet);
        powerUpContainer.appendChild(this.powerUpIndicators.double);
        document.body.appendChild(powerUpContainer);
    }

    onVRStart() {
        this.isVRMode = true;
        this.player.enableVRMode();
        
        // OCULTAR MODELO DEL JUGADOR EN VR
        if (this.player.group) {
            this.player.group.visible = false;
        }
        
        // POSICIONAR CÁMARA EN EL JUGADOR
        this.cameraContainer.position.set(
            this.player.group.position.x,
            Config.VR_SETTINGS.PLAYER_HEIGHT,
            this.player.group.position.z
        );
        
        // MOSTRAR MENÚ DE INICIO EN VR
        if (this.vrControls && !this.isGameStarted) {
            this.vrControls.showStartMenu();
        }
        
        // OCULTAR UI HTML EN VR
        this.hideHTMLUI();
        
        window.dispatchEvent(new CustomEvent('game-vr-start'));
        
        console.log("🎮 Modo VR primera persona activado - UI VR visible");
    }

    onVREnd() {
        this.isVRMode = false;
        this.player.disableVRMode();
        
        // MOSTRAR MODELO DEL JUGADOR
        if (this.player.group) {
            this.player.group.visible = true;
        }
        
        // OCULTAR UI VR Y MOSTRAR UI HTML
        if (this.vrControls) {
            this.vrControls.hideAllMenus();
        }
        this.showHTMLUI();
        
        // RESTAURAR CÁMARA NORMAL
        this.cameraContainer.position.set(0, Config.CAMERA_START_Y, Config.CAMERA_START_Z);
        this.cameraContainer.lookAt(0, 0, 0);
        
        window.dispatchEvent(new CustomEvent('game-vr-end'));
        
        console.log("🖥️ Modo VR desactivado - Volviendo a modo normal");
    }

    hideHTMLUI() {
        if (this.ui.uiContainer) this.ui.uiContainer.style.display = 'none';
        if (this.ui.pauseButton) this.ui.pauseButton.style.display = 'none';
        if (this.ui.modalOverlay) this.ui.modalOverlay.style.display = 'none';
        if (this.ui.gameOver) this.ui.gameOver.style.display = 'none';
        if (this.ui.pauseMenu) this.ui.pauseMenu.style.display = 'none';
    }

    showHTMLUI() {
        if (!this.isGameStarted && this.ui.modalOverlay) {
            this.ui.modalOverlay.style.display = 'flex';
        } else if (this.isGameStarted && !this.isGameOver) {
            if (this.ui.uiContainer) this.ui.uiContainer.style.display = 'block';
            if (this.ui.pauseButton) this.ui.pauseButton.style.display = 'block';
        } else if (this.isGameOver && this.ui.gameOver) {
            this.ui.gameOver.style.display = 'block';
        }
    }

    startGame() {
        this.clock.start();
        console.log("🚀 INICIANDO JUEGO - Modo VR: " + this.isVRMode);
        
        this.checkInitialCollisions();
        
        // OCULTAR INTERFACES
        this.ui.modalOverlay.style.display = 'none';
        this.ui.rulesModal.style.display = 'none';
        
        if (this.isVRMode && this.vrControls) {
            this.vrControls.hideAllMenus();
        } else {
            this.ui.uiContainer.style.display = 'block';
            this.ui.pauseButton.style.display = 'block';
        }

        this.isGameStarted = true;
        this.isGameOver = false;
        this.isPaused = false;
        
        this.playBackgroundMusic();
        this.resetGameLogic();
        this.animate();
    }

    togglePause() {
        if (!this.isGameStarted || this.isGameOver) return;
        
        if (this.isPaused) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }

    pauseGame() {
        if (this.isGameStarted && !this.isGameOver && !this.isPaused) {
            this.isPaused = true;
            this.clock.stop();
            this.pauseBackgroundMusic();
            
            // MOSTRAR MENÚ DE PAUSA SEGÚN MODO
            if (this.isVRMode && this.vrControls) {
                this.vrControls.showPauseMenu();
            } else {
                this.ui.pauseMenu.style.display = 'block';
            }
            
            console.log("⏸️ Juego pausado");
        }
    }

    resumeGame() {
        if (this.isPaused) {
            this.isPaused = false;
            this.clock.start();
            
            // OCULTAR MENÚS DE PAUSA
            if (this.isVRMode && this.vrControls) {
                this.vrControls.hideAllMenus();
            } else {
                this.ui.pauseMenu.style.display = 'none';
            }
            
            this.playBackgroundMusic();
            console.log("▶️ Juego reanudado");
        }
    }

    restartGame() {
        this.clock.start();
        console.log("🔄 Reiniciando juego...");
        
        this.ui.gameOver.style.display = 'none';
        this.ui.pauseMenu.style.display = 'none';
        this.isGameOver = false;
        this.isPaused = false;
        
        this.playBackgroundMusic();
        this.resetGameLogic();
        this.animate();
    }

    resetGameLogic() {
        console.log("🔄 Reseteando lógica del juego...");
        
        this.score = 0;
        this.distance = 0;
        this.coinsCollected = 0;
        this.gameSpeed = Config.GAME_START_SPEED;
        this.difficultyLevel = 1;

        // RESETEAR POWER-UPS
        for (const type in this.activePowerUps) {
            this.activePowerUps[type].active = false;
            this.activePowerUps[type].timer = 0;
            this.powerUpIndicators[type].style.display = 'none';
        }

        // ACTUALIZAR UI
        this.ui.score.textContent = `Puntos: 0`;
        this.ui.distance.textContent = `Distancia: 0m`;

        // LIMPIAR OBSTÁCULOS EXISTENTES
        if (this.obstacleManager) {
            this.obstacleManager.reset();
        }
        
        // RESETEAR JUGADOR Y MUNDO
        if (this.player) this.player.reset();
        if (this.world) this.world.reset();

        console.log("✅ Juego reiniciado - Listo para empezar");
    }

    resetToMainMenu() {
        console.log("🔄 Reiniciando a menú principal...");
        
        // DETENER MÚSICA
        this.stopBackgroundMusic();
        
        // RESETEAR ESTADO
        this.isGameStarted = false;
        this.isGameOver = false;
        this.isPaused = false;
        this.score = 0;
        this.distance = 0;
        this.coinsCollected = 0;
        this.gameSpeed = Config.GAME_START_SPEED;
        this.difficultyLevel = 1;
        
        // RESETEAR POWER-UPS
        for (const type in this.activePowerUps) {
            this.activePowerUps[type].active = false;
            this.activePowerUps[type].timer = 0;
            if (this.powerUpIndicators[type]) {
                this.powerUpIndicators[type].style.display = 'none';
                this.powerUpIndicators[type].style.opacity = '1';
            }
        }
        
        // LIMPIAR OBSTÁCULOS
        if (this.obstacleManager) {
            this.obstacleManager.reset();
        }
        
        // RESETEAR JUGADOR Y MUNDO
        if (this.player) this.player.reset();
        if (this.world) this.world.reset();
        
        // OCULTAR UI DE JUEGO
        this.ui.uiContainer.style.display = 'none';
        this.ui.gameOver.style.display = 'none';
        this.ui.pauseButton.style.display = 'none';
        this.ui.pauseMenu.style.display = 'none';
        
        // MOSTRAR MENÚ PRINCIPAL SEGÚN MODO
        if (this.isVRMode && this.vrControls) {
            this.vrControls.showStartMenu();
        } else {
            this.ui.modalOverlay.style.display = 'flex';
            this.ui.rulesModal.style.display = 'block';
        }

        // REINICIAR MÚSICA DE INTRODUCCIÓN
        const introMusic = document.getElementById('intro-music');
        if (introMusic) {
            introMusic.currentTime = 0;
            if (!introMusic.muted) {
                introMusic.play().catch(e => console.log('Error al reanudar música:', e));
            }
        }
        
        console.log("✅ Menú principal cargado correctamente");
    }

    setupLights() {
        // LUZ AMBIENTAL
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // LUZ DIRECCIONAL PRINCIPAL
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(5, 10, 7);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 50;
        dirLight.shadow.camera.left = -20;
        dirLight.shadow.camera.right = 20;
        dirLight.shadow.camera.top = 20;
        dirLight.shadow.camera.bottom = -20;
        this.scene.add(dirLight);

        // LUZ DE RELLENO
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 5, -5);
        this.scene.add(fillLight);

        console.log("💡 Sistema de iluminación configurado");
    }

    loadEnvironment(hdrPath) {
        const rgbeLoader = new RGBELoader();
        rgbeLoader.load(hdrPath, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.background = texture;
            this.scene.environment = texture;
            console.log("🌅 Fondo HDR cargado correctamente");
        }, undefined, (err) => {
            console.warn("⚠️ No se pudo cargar el fondo HDR. Usando fondo por defecto.", err);
            this.scene.background = new THREE.Color(0x87CEEB);
        });
    }

    checkInitialCollisions() {
        if (!this.collisionDebugEnabled) return;
        
        console.log("🔍 Verificando colisiones iniciales...");
        
        const playerBox = this.player.getBoundingBox();
        console.log("📍 Posición inicial del jugador:", {
            x: this.player.group.position.x.toFixed(2),
            y: this.player.group.position.y.toFixed(2), 
            z: this.player.group.position.z.toFixed(2)
        });

        console.log(`🎯 Obstáculos al inicio: ${this.obstacleManager.obstacles.length}`);
        console.log(`💰 Monedas al inicio: ${this.obstacleManager.coins.length}`);
        console.log(`⚡ Power-ups al inicio: ${this.obstacleManager.powerUps.length}`);
    }

    preloadAssets() {
        console.log("📦 Precargando assets...");
        const fbxLoader = new FBXLoader();
        const textureLoader = new THREE.TextureLoader();
        const totalAssets = 15; 
        let loadedCount = 0;

        const updateProgress = () => {
            loadedCount++;
            const progress = (loadedCount / totalAssets) * 100;
            this.ui.loadingBar.style.width = `${progress}%`;
            this.ui.loadingText.textContent = `${Math.round(progress)}%`;
        };

        const loadPromise = (path) => {
            return new Promise((resolve, reject) => {
                fbxLoader.load(path, (obj) => {
                    updateProgress();
                    resolve(obj);
                }, undefined, (err) => {
                    console.error(`❌ Error cargando ${path}`, err);
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
                    console.error(`❌ Error cargando textura ${path}`, err);
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

                console.log("🎨 Cargando texturas...");
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

                console.log("🔄 Cargando modelos 3D...");
                const [
                    coin, barrier, car, rock, barrel, dartboard,
                    pipeWrench, playerModel, animRun, animJump,
                    animDie, animRoll, animLeft, animRight, zombieModel
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

                // APLICAR TEXTURAS
                this.applyTextures(car, carTexture);
                this.applyTextures(barrier, barrierDiffTexture, barrierDispTexture);
                this.applyTextures(rock, rockDiffTexture, rockDispTexture);
                this.applyTextures(barrel, barrelTexture);
                this.applyTextures(dartboard, dartboardTexture);
                this.applyTextures(pipeWrench, pipeWrenchTexture);

                // CONFIGURAR ESCALAS CORREGIDAS
                this.setupModelScales(coin, barrier, car, rock, barrel, dartboard, pipeWrench, zombieModel);

                // CONFIGURAR SOMBRAS
                this.setupModelShadows(coin, barrier, car, rock, barrel, dartboard, pipeWrench, playerModel);

                console.log("✅ Todos los assets configurados - Posiciones corregidas");

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

    applyTextures(model, diffuseMap, displacementMap = null) {
        model.traverse(child => {
            if (child.isMesh && child.material) {
                child.material.map = diffuseMap;
                if (displacementMap) {
                    child.material.displacementMap = displacementMap;
                    child.material.displacementScale = 0.1;
                }
                child.material.needsUpdate = true;
            }
        });
    }

    setupModelScales(coin, barrier, car, rock, barrel, dartboard, pipeWrench, zombieModel) {
        // NUEVO: ESCALAS CORREGIDAS PARA QUE QUEDEN A RAS DE SUELO
        coin.scale.set(0.005, 0.005, 0.005);           
        barrier.scale.set(0.008, 0.008, 0.008);  // REDUCIDO para mejor ajuste al suelo        
        car.scale.set(0.012, 0.012, 0.012);      // REDUCIDO para mejor ajuste al suelo           
        rock.scale.set(0.015, 0.015, 0.015);     // REDUCIDO
        barrel.scale.set(0.015, 0.015, 0.015);   // REDUCIDO          
        dartboard.scale.set(0.025, 0.025, 0.025); // REDUCIDO   
        pipeWrench.scale.set(0.025, 0.025, 0.025); // REDUCIDO
        zombieModel.scale.set(0.011, 0.011, 0.011);

        console.log("📏 Escalas de modelos corregidas para ajuste al suelo");
    }

    setupModelShadows(...models) {
        models.forEach(model => {
            model.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
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
            
            console.log(`📈 ¡Dificultad Nivel ${this.difficultyLevel}! Velocidad: ${this.gameSpeed.toFixed(1)}`);
        }
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
                
                // EFECTO DE PARPADEO CUANDO QUEDA POCO TIEMPO
                if (powerUp.timer < 3.0) {
                    const blink = (Math.sin(Date.now() * 0.02) + 1) * 0.3 + 0.4;
                    indicator.style.opacity = blink;
                }
                
                // DESACTIVAR CUANDO TIMER LLEGA A 0
                if (powerUp.timer <= 0) {
                    this.deactivatePowerUp(type);
                }
            }
        }
    }

    activatePowerUp(type) {
        console.log(`🎯 ACTIVANDO POWER-UP: ${type}`);
        
        const duration = Config.POWERUP_DURATION[type];
        
        this.activePowerUps[type].active = true;
        this.activePowerUps[type].timer = duration;
        
        this.powerUpIndicators[type].style.display = 'block';
        this.powerUpIndicators[type].style.background = type === 'magnet' 
            ? 'rgba(255, 0, 0, 0.7)' 
            : 'rgba(255, 215, 0, 0.7)';
        
        this.playPowerUpSound();
        this.showPowerUpNotification(type);
        
        console.log(`✅ Power-up ACTIVADO: ${type} por ${duration}s`);
    }

    deactivatePowerUp(type) {
        console.log(`🔚 DESACTIVANDO POWER-UP: ${type}`);
        
        this.activePowerUps[type].active = false;
        this.activePowerUps[type].timer = 0;
        
        this.powerUpIndicators[type].style.display = 'none';
        this.powerUpIndicators[type].style.opacity = '1';
        
        console.log(`❌ Power-up DESACTIVADO: ${type}`);
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
            backdrop-filter: blur(10px);
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

    checkCollisions() {
        if (this.isGameOver) return;

        const playerBox = this.player.getBoundingBox();
        const playerPosition = this.player.group.position;

        this.frameCount++;

        // DEBUG CADA 120 FRAMES
        if (this.collisionDebugEnabled && this.frameCount % 120 === 0) {
            console.log(`🔄 Frame ${this.frameCount} - Distancia: ${this.distance.toFixed(0)}m`);
            console.log(`📍 Jugador: X=${playerPosition.x.toFixed(2)}, Z=${playerPosition.z.toFixed(2)}`);
            console.log(`🎯 Obstáculos: ${this.obstacleManager.obstacles.length}`);
            console.log(`⚡ Power-ups: ${this.obstacleManager.powerUps.length}`);
        }

        // VERIFICAR COLISIONES CON OBSTÁCULOS
        for (let i = 0; i < this.obstacleManager.obstacles.length; i++) {
            const obstacle = this.obstacleManager.obstacles[i];
            const obstacleBox = obstacle.getBoundingBox();
            
            if (playerBox.intersectsBox(obstacleBox)) {
                console.log("🚨 ¡COLISIÓN CON OBSTÁCULO! Game Over");
                this.gameOver("COLISIÓN CON OBSTÁCULO");
                return;
            }
        }

        // VERIFICAR COLISIONES CON MONEDAS
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
                this.coinsCollected++;
                this.ui.score.textContent = `Puntos: ${this.score}`;
                this.playCoinSound();
            }
        }

        // VERIFICAR COLISIONES CON POWER-UPS
        for (let i = this.obstacleManager.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.obstacleManager.powerUps[i];
            const powerUpBox = powerUp.getBoundingBox();
            
            if (playerBox.intersectsBox(powerUpBox)) {
                console.log(`⚡ ¡COLISIÓN CON POWER-UP! Tipo: ${powerUp.powerUpType}`);
                
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
        console.log("🛑 GAME OVER");
        console.log(`🛑 Razón: ${reason}`);
        console.log(`🛑 Distancia: ${this.distance.toFixed(0)}m`);
        console.log(`🛑 Puntuación: ${this.score}`);
        console.log(`🛑 Monedas: ${this.coinsCollected}`);
        console.log("🛑 ================================");

        this.isGameOver = true;
        this.pauseBackgroundMusic();

        if (this.player) {
            this.player.die();
        }

        // ACTUALIZAR ESTADÍSTICAS FINALES
        this.updateFinalStats();

        // MOSTRAR MENÚ DE GAME OVER SEGÚN MODO
        setTimeout(() => {
            if (this.isVRMode && this.vrControls) {
                this.vrControls.showGameOverMenu();
            } else {
                this.ui.gameOver.style.display = 'block';
            }
        }, 2000);

        // LISTENER PARA ANIMACIÓN DE MUERTE
        if (this.player && this.player.mixer) {
            const dieAction = this.player.actions.die;

            const onDieAnimationFinished = (e) => {
                if (e.action === dieAction) {
                    console.log("💀 Animación de muerte terminada");
                    this.player.mixer.removeEventListener('finished', onDieAnimationFinished);
                }
            };

            this.player.mixer.addEventListener('finished', onDieAnimationFinished);
        }
    }

    updateFinalStats() {
        if (this.ui.finalScore) this.ui.finalScore.textContent = this.score;
        if (this.ui.finalDistance) this.ui.finalDistance.textContent = Math.floor(this.distance) + 'm';
        if (this.ui.finalCoins) this.ui.finalCoins.textContent = this.coinsCollected;
        if (this.ui.finalTime) {
            const timeInSeconds = Math.floor(this.distance / this.gameSpeed);
            this.ui.finalTime.textContent = timeInSeconds + 's';
        }
    }

    playBackgroundMusic() {
        if (this.backgroundMusic && !this.isMusicPlaying) {
            this.backgroundMusic.play();
            this.isMusicPlaying = true;
            console.log("🎵 Música de fondo iniciada");
        }
    }

    playCoinSound() {
        if (this.coinSound) {
            this.coinSound.stop();
            this.coinSound.play();
        }
    }

    playPowerUpSound() {
        if (this.powerUpSound) {
            this.powerUpSound.stop();
            this.powerUpSound.play();
        }
    }

    pauseBackgroundMusic() {
        if (this.backgroundMusic && this.isMusicPlaying) {
            this.backgroundMusic.pause();
            this.isMusicPlaying = false;
            console.log("⏸️ Música de fondo pausada");
        }
    }

    stopBackgroundMusic() {
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
            this.isMusicPlaying = false;
            console.log("🛑 Música de fondo detenida");
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

    render() {
        if (this.isPaused) {
            return; 
        }

        const delta = this.clock.getDelta();

        // ACTUALIZAR CONTROLES VR
        if (this.vrControls && this.isVRMode) {
            this.vrControls.update(delta);
        }

        // ACTUALIZAR JUGADOR
        if (this.player) {
            this.player.update(delta);
            
            // EN VR PRIMERA PERSONA, LA CÁMARA SIGUE AL JUGADOR
            if (this.isVRMode) {
                this.cameraContainer.position.x = this.player.group.position.x;
                this.cameraContainer.position.z = this.player.group.position.z;
                
                // AJUSTAR ALTURA DURANTE SALTOS
                if (this.player.state === Config.PLAYER_STATE.JUMPING) {
                    this.cameraContainer.position.y = Config.VR_SETTINGS.PLAYER_HEIGHT + this.player.group.position.y;
                } else {
                    this.cameraContainer.position.y = Config.VR_SETTINGS.PLAYER_HEIGHT;
                }
            }
        }

        // SI ES GAME OVER, SOLO RENDERIZAR
        if (this.isGameOver) {
            if (this.world) {
                this.world.zombieCatch(delta);
            }
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const playerPosition = this.player.group.position;

        // ACTUALIZAR MUNDO
        this.world.update(delta, this.gameSpeed, playerPosition);
        
        // ACTUALIZAR OBSTÁCULOS (CON POSICIONES CORREGIDAS)
        this.obstacleManager.update(
            delta, 
            this.gameSpeed, 
            this.distance, 
            playerPosition,
            this.activePowerUps
        );

        // EN MODO NORMAL, CÁMARA SIGUE AL JUGADOR EN 3RA PERSONA
        if (!this.isVRMode) {
            this.cameraContainer.position.z = playerPosition.z + Config.CAMERA_START_Z;
            this.cameraContainer.position.x = playerPosition.x;
        }

        // ACTUALIZAR DISTANCIA Y PUNTUACIÓN
        this.distance += this.gameSpeed * delta;
        
        // ACTUALIZAR UI CADA 0.1 SEGUNDOS (PARA MEJOR RENDIMIENTO)
        this.lastDistanceUpdate += delta;
        if (this.lastDistanceUpdate >= 0.1) {
            this.ui.distance.textContent = `Distancia: ${this.distance.toFixed(0)}m`;
            this.lastDistanceUpdate = 0;
        }
        
        // ACTUALIZAR SISTEMAS
        this.updatePowerUps(delta);
        this.updateDifficulty();
        
        // VERIFICAR COLISIONES
        this.checkCollisions();

        // RENDERIZAR ESCENA
        this.renderer.render(this.scene, this.camera);
    }

    // MÉTODO PARA DEBUG
    debugInfo() {
        return {
            gameState: {
                started: this.isGameStarted,
                paused: this.isPaused,
                gameOver: this.isGameOver,
                vrMode: this.isVRMode
            },
            stats: {
                score: this.score,
                distance: this.distance.toFixed(0),
                coins: this.coinsCollected,
                speed: this.gameSpeed.toFixed(1),
                difficulty: this.difficultyLevel
            },
            player: this.player ? this.player.debugInfo() : 'No inicializado',
            powerUps: this.activePowerUps
        };
    }
}

// HACER GLOBAL PARA DEBUG
window.gameDebug = function() {
    if (window.game) {
        console.log("🎮 DEBUG INFO:", window.game.debugInfo());
    } else {
        console.log("❌ Game no está inicializado");
    }
};