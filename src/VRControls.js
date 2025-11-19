// -----------------------------------------------------------------
// --- VRControls.js (PRIMERA PERSONA INMERSIVA)
// -----------------------------------------------------------------

import * as THREE from 'three';
import { Config } from './Config.js';

export class VRControls {
    constructor(camera, renderer, player, scene, cameraContainer) {
        this.camera = camera;
        this.renderer = renderer;
        this.player = player;
        this.scene = scene;
        this.cameraContainer = cameraContainer; // NUEVO: Contenedor de cámara
        
        this.controllers = [];
        this.raycaster = new THREE.Raycaster();
        this.gazeTimer = 0;
        this.lastGazeLane = 1;
        
        this.setupControllers();
        console.log("✅ VRControls primera persona inicializado");
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
        
        console.log("🎮 Controllers VR primera persona configurados");
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
    
    onSelectStart(controllerIndex) {
        console.log(`Controller ${controllerIndex} - Select Start`);
        
        if (controllerIndex === 0) {
            this.player.jump();
        } else if (controllerIndex === 1) {
            this.player.roll();
        }
    }
    
    onSelectEnd(controllerIndex) {
        console.log(`Controller ${controllerIndex} - Select End`);
    }
    
    update(deltaTime) {
        if (this.controllers.length > 0) {
            this.handleGazeControls(deltaTime);
            this.updateCameraPosition(); // NUEVO: Actualizar posición de cámara
        }
    }
    
    // NUEVO: Actualizar posición de cámara en primera persona
    updateCameraPosition() {
        if (this.cameraContainer && this.player) {
            // La cámara ya está posicionada en Game.js, aquí solo verificamos
            const playerPos = this.player.group.position;
            const cameraPos = this.cameraContainer.position;
            
            // Debug opcional
            if (Math.random() < 0.01) { // Solo cada 100 frames aprox
                console.log("👁️ Posición VR:", {
                    jugador: { x: playerPos.x.toFixed(2), z: playerPos.z.toFixed(2) },
                    camara: { x: cameraPos.x.toFixed(2), z: cameraPos.z.toFixed(2) }
                });
            }
        }
    }
    
    handleGazeControls(deltaTime) {
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        
        const gazeDirection = new THREE.Vector3();
        this.camera.getWorldDirection(gazeDirection);
        
        const gazeAngle = Math.atan2(gazeDirection.x, gazeDirection.z);
        const gazeThreshold = Config.VR_SETTINGS.GAZE_THRESHOLD;
        
        let targetLane = this.lastGazeLane;
        
        if (gazeAngle < -gazeThreshold) {
            targetLane = 0;
        } else if (gazeAngle > gazeThreshold) {
            targetLane = 2;
        } else {
            targetLane = 1;
        }
        
        if (targetLane !== this.lastGazeLane) {
            this.gazeTimer += deltaTime;
            
            if (this.gazeTimer >= Config.VR_SETTINGS.GAZE_DURATION) {
                this.changeLane(targetLane);
                this.lastGazeLane = targetLane;
                this.gazeTimer = 0;
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
            console.log(`👁️ Cambio de carril por mirada: ${currentLane} -> ${targetLane}`);
        }
    }
    
    debugGazeDirection() {
        const gazeDirection = new THREE.Vector3();
        this.camera.getWorldDirection(gazeDirection);
        
        console.log(`👁️ Dirección mirada:`, {
            x: gazeDirection.x.toFixed(2),
            y: gazeDirection.y.toFixed(2),
            z: gazeDirection.z.toFixed(2),
            angulo: Math.atan2(gazeDirection.x, gazeDirection.z).toFixed(2)
        });
    }
}