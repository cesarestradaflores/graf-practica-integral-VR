// -----------------------------------------------------------------
// --- VRControls.js (UMBRAL DE GIRO MEJORADO + UI VR)
// -----------------------------------------------------------------

import * as THREE from 'three';
import { Config } from './Config.js';

export class VRControls {
    constructor(camera, renderer, player, scene, cameraContainer, gameInstance) {
        this.camera = camera;
        this.renderer = renderer;
        this.player = player;
        this.scene = scene;
        this.cameraContainer = cameraContainer;
        this.game = gameInstance; // NUEVO: Referencia al Game para controlar UI
        
        this.controllers = [];
        this.raycaster = new THREE.Raycaster();
        this.gazeTimer = 0;
        this.lastGazeLane = 1;
        
        // NUEVO: Configuración de umbral de giro mejorado
        this.headRotationThreshold = 30; // Grados - AUMENTADO de 17° a 30°
        this.minGazeDuration = 0.8; // Segundos - AUMENTADO para mayor precisión
        
        // NUEVO: Sistema de UI VR
        this.vrUI = null;
        this.currentUIPanel = null;
        this.uiDistance = 1.5; // metros
        this.uiVisible = false;
        
        this.setupControllers();
        this.setupVRUI(); // NUEVO: Configurar UI en VR
        
        console.log("✅ VRControls mejorado - Umbral: " + this.headRotationThreshold + "°");
    }
    
    setupControllers() {
        for (let i = 0; i < 2; i++) {
            const controller = this.renderer.xr.getController(i);
            this.scene.add(controller);
            this.controllers.push(controller);
            
            controller.addEventListener('selectstart', () => this.onSelectStart(i));
            controller.addEventListener('selectend', () => this.onSelectEnd(i));
            
            this.addControllerRay(controller, i);
        }
    }
    
    addControllerRay(controller, index) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1)
        ]);
        
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ 
            color: index === 0 ? 0xff0000 : 0x0000ff 
        }));
        line.scale.z = 5;
        controller.add(line);
    }
    
    // NUEVO: Configurar UI en mundo VR
    setupVRUI() {
        // Crear contenedor para UI VR
        this.vrUI = new THREE.Group();
        this.vrUI.name = "VR_UI_Container";
        this.scene.add(this.vrUI);
        
        // Crear panel de UI (simulado - en implementación real sería un Canvas)
        this.createUIPanel('start');
        this.createUIPanel('pause');
        this.createUIPanel('gameover');
        
        // Ocultar todos los paneles inicialmente
        this.hideAllUIPanels();
        
        console.log("✅ UI VR configurada - Paneles: start, pause, gameover");
    }
    
    // NUEVO: Crear panel de UI simulado
    createUIPanel(type) {
        const panelGroup = new THREE.Group();
        panelGroup.name = `ui_panel_${type}`;
        panelGroup.visible = false;
        
        // Panel base (plano)
        const panelGeometry = new THREE.PlaneGeometry(2, 1.2);
        const panelMaterial = new THREE.MeshBasicMaterial({ 
            color: this.getPanelColor(type),
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide
        });
        const panelMesh = new THREE.Mesh(panelGeometry, panelMaterial);
        panelGroup.add(panelMesh);
        
        // Texto simulado
        const textGeometry = new THREE.PlaneGeometry(1.5, 0.3);
        const textMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFFFFFF,
            transparent: true,
            opacity: 1
        });
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.y = 0.3;
        panelGroup.add(textMesh);
        
        // Botones simulados
        this.createUIButton(panelGroup, "Btn1", -0.6, -0.3, type);
        this.createUIButton(panelGroup, "Btn2", 0, -0.3, type);
        this.createUIButton(panelGroup, "Btn3", 0.6, -0.3, type);
        
        this.vrUI.add(panelGroup);
        return panelGroup;
    }
    
    // NUEVO: Crear botón de UI simulado
    createUIButton(parent, label, x, y, panelType) {
        const buttonGroup = new THREE.Group();
        buttonGroup.position.set(x, y, 0.01);
        
        const buttonGeometry = new THREE.PlaneGeometry(0.4, 0.15);
        const buttonMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x4444FF,
            transparent: true,
            opacity: 0.9
        });
        const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial);
        buttonMesh.userData = { 
            isButton: true, 
            label: label,
            panelType: panelType 
        };
        buttonGroup.add(buttonMesh);
        
        parent.add(buttonGroup);
        return buttonGroup;
    }
    
    // NUEVO: Obtener color del panel según tipo
    getPanelColor(type) {
        switch(type) {
            case 'start': return 0x00AA00; // Verde
            case 'pause': return 0x4444FF; // Azul
            case 'gameover': return 0xFF4444; // Rojo
            default: return 0x888888;
        }
    }
    
    // NUEVO: Mostrar panel de UI en VR
    showUIPanel(panelType) {
        this.hideAllUIPanels();
        
        const panel = this.vrUI.getObjectByName(`ui_panel_${panelType}`);
        if (panel) {
            this.positionUIPanel(panel);
            panel.visible = true;
            this.currentUIPanel = panel;
            this.uiVisible = true;
            
            console.log(`📱 UI VR mostrada: ${panelType}`);
        }
    }
    
    // NUEVO: Ocultar todos los paneles de UI
    hideAllUIPanels() {
        this.vrUI.children.forEach(panel => {
            panel.visible = false;
        });
        this.currentUIPanel = null;
        this.uiVisible = false;
    }
    
    // NUEVO: Posicionar panel frente al jugador
    positionUIPanel(panel) {
        if (!this.cameraContainer) return;
        
        // Obtener dirección de la cámara
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        
        // Posicionar panel frente al jugador
        const uiPosition = new THREE.Vector3()
            .copy(this.cameraContainer.position)
            .add(cameraDirection.multiplyScalar(this.uiDistance));
        
        panel.position.copy(uiPosition);
        
        // Hacer que el panel mire hacia la cámara
        panel.lookAt(this.cameraContainer.position);
        
        // Ajustar rotación para que esté recto
        panel.rotation.x = 0;
        panel.rotation.z = 0;
    }
    
    // NUEVO: Actualizar posición de UI (para que siga al jugador)
    updateUIPosition() {
        if (this.currentUIPanel && this.uiVisible) {
            this.positionUIPanel(this.currentUIPanel);
        }
    }
    
    // NUEVO: Manejar interacción con UI
    handleUIIntersection(controller) {
        if (!this.currentUIPanel || !this.uiVisible) return;
        
        this.raycaster.setFromCamera({ x: 0, y: 0 }, controller);
        
        // Verificar intersección con botones
        const intersectObjects = [];
        this.currentUIPanel.traverse(child => {
            if (child.userData.isButton) {
                intersectObjects.push(child);
            }
        });
        
        const intersects = this.raycaster.intersectObjects(intersectObjects);
        
        if (intersects.length > 0) {
            const button = intersects[0].object;
            this.onUIButtonPressed(button.userData);
        }
    }
    
    // NUEVO: Manejar botón presionado
    onUIButtonPressed(buttonData) {
        console.log(`🖱️ Botón VR presionado: ${buttonData.label} en ${buttonData.panelType}`);
        
        // Ejecutar acción según el botón y panel
        switch(buttonData.panelType) {
            case 'start':
                if (buttonData.label === 'Btn1') {
                    this.game.startGame();
                    this.hideAllUIPanels();
                }
                break;
                
            case 'pause':
                if (buttonData.label === 'Btn1') {
                    this.game.resumeGame();
                    this.hideAllUIPanels();
                } else if (buttonData.label === 'Btn2') {
                    this.game.restartGame();
                    this.hideAllUIPanels();
                } else if (buttonData.label === 'Btn3') {
                    this.game.resetToMainMenu();
                    this.showUIPanel('start');
                }
                break;
                
            case 'gameover':
                if (buttonData.label === 'Btn1') {
                    this.game.restartGame();
                    this.hideAllUIPanels();
                } else if (buttonData.label === 'Btn3') {
                    this.game.resetToMainMenu();
                    this.showUIPanel('start');
                }
                break;
        }
    }
    
    onSelectStart(controllerIndex) {
        // Si hay UI visible, manejar interacción con UI
        if (this.uiVisible) {
            this.handleUIIntersection(this.controllers[controllerIndex]);
            return;
        }
        
        // Si no hay UI, manejar controles normales del juego
        if (controllerIndex === 0) {
            this.player.jump();
        } else if (controllerIndex === 1) {
            this.player.roll();
        }
    }
    
    onSelectEnd(controllerIndex) {
        // Manejar release de botones si es necesario
    }
    
    update(deltaTime) {
        if (this.controllers.length > 0) {
            this.handleGazeControls(deltaTime);
            this.updateCameraPosition();
            this.updateUIPosition(); // NUEVO: Actualizar posición de UI
        }
    }
    
    updateCameraPosition() {
        // La cámara ya está posicionada en Game.js
    }
    
    // NUEVO: Sistema de detección de giro MEJORADO
    handleGazeControls(deltaTime) {
        if (this.uiVisible) return; // No detectar giros cuando hay UI visible
        
        const gazeDirection = new THREE.Vector3();
        this.camera.getWorldDirection(gazeDirection);
        
        // Calcular ángulo de rotación en el plano horizontal (XZ)
        const gazeAngle = Math.atan2(gazeDirection.x, gazeDirection.z);
        const gazeAngleDegrees = THREE.MathUtils.radToDeg(gazeAngle);
        
        // NUEVO: Umbral mejorado - más restrictivo
        const gazeThreshold = THREE.MathUtils.degToRad(this.headRotationThreshold);
        
        let targetLane = this.lastGazeLane;
        
        // Detectar giro a la izquierda (ángulo negativo más grande)
        if (gazeAngle < -gazeThreshold) {
            targetLane = 0;
        } 
        // Detectar giro a la derecha (ángulo positivo más grande)
        else if (gazeAngle > gazeThreshold) {
            targetLane = 2;
        }
        // Mirada al centro
        else {
            targetLane = 1;
        }
        
        // Debug opcional del ángulo
        if (Math.random() < 0.02) { // ~2% de los frames
            console.log(`👁️ Ángulo cabeza: ${gazeAngleDegrees.toFixed(1)}° | Umbral: ±${this.headRotationThreshold}° | Carril: ${targetLane}`);
        }
        
        if (targetLane !== this.lastGazeLane) {
            this.gazeTimer += deltaTime;
            
            // NUEVO: Tiempo requerido AUMENTADO para mayor precisión
            if (this.gazeTimer >= this.minGazeDuration) {
                this.changeLane(targetLane);
                this.lastGazeLane = targetLane;
                this.gazeTimer = 0;
                
                console.log(`🎯 Cambio de carril confirmado: ${this.lastGazeLane} -> ${targetLane} (${gazeAngleDegrees.toFixed(1)}°)`);
            }
        } else {
            this.gazeTimer = 0;
        }
    }
    
    changeLane(targetLane) {
        const currentLane = this.player.currentLane;
        
        if (targetLane !== currentLane) {
            const direction = targetLane > currentLane ? 1 : -1;
            this.player.strafe(direction);
        }
    }
    
    // NUEVO: Métodos públicos para controlar UI desde Game.js
    showStartMenu() {
        this.showUIPanel('start');
    }
    
    showPauseMenu() {
        this.showUIPanel('pause');
    }
    
    showGameOverMenu() {
        this.showUIPanel('gameover');
    }
    
    hideAllMenus() {
        this.hideAllUIPanels();
    }
    
    // NUEVO: Configurar umbral desde inspector (simulado)
    setHeadRotationThreshold(degrees) {
        this.headRotationThreshold = THREE.MathUtils.clamp(degrees, 15, 60);
        console.log(`🎯 Nuevo umbral de giro: ${this.headRotationThreshold}°`);
    }
    
    setGazeDuration(seconds) {
        this.minGazeDuration = THREE.MathUtils.clamp(seconds, 0.3, 2.0);
        console.log(`⏱️ Nueva duración de mirada: ${this.minGazeDuration}s`);
    }
    
    debugGazeDirection() {
        const gazeDirection = new THREE.Vector3();
        this.camera.getWorldDirection(gazeDirection);
        const gazeAngle = Math.atan2(gazeDirection.x, gazeDirection.z);
        const gazeAngleDegrees = THREE.MathUtils.radToDeg(gazeAngle);
        
        console.log(`👁️ DEBUG Mirada:`, {
            angulo: `${gazeAngleDegrees.toFixed(1)}°`,
            umbral: `±${this.headRotationThreshold}°`,
            carrilActual: this.player.currentLane,
            carrilObjetivo: this.lastGazeLane,
            timer: `${this.gazeTimer.toFixed(1)}/${this.minGazeDuration}s`
        });
    }
}