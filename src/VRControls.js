// -----------------------------------------------------------------
// --- VRControls.js (Controles para Realidad Virtual)
// -----------------------------------------------------------------

import * as THREE from 'three';
import { Config } from './Config.js';

export class VRControls {
    constructor(camera, renderer, player, scene) {
        this.camera = camera;
        this.renderer = renderer;
        this.player = player;
        this.scene = scene;
        
        this.controllers = [];
        this.raycaster = new THREE.Raycaster();
        this.gazeTimer = 0;
        this.lastGazeLane = 1; // Carril central por defecto
        
        this.setupControllers();
        console.log("✅ VRControls inicializado");
    }
    
    setupControllers() {
        // Configurar controllers VR
        for (let i = 0; i < 2; i++) {
            const controller = this.renderer.xr.getController(i);
            this.scene.add(controller);
            this.controllers.push(controller);
            
            // Configurar eventos de controller
            controller.addEventListener('selectstart', () => this.onSelectStart(i));
            controller.addEventListener('selectend', () => this.onSelectEnd(i));
            
            // Añadir un rayo visual para debug
            this.addControllerRay(controller, i);
        }
        
        console.log("🎮 Controllers VR configurados");
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
        
        // Mapear controles VR a acciones del juego
        if (controllerIndex === 0) { // Controller izquierdo - Saltar
            this.player.jump();
        } else if (controllerIndex === 1) { // Controller derecho - Rodar
            this.player.roll();
        }
    }
    
    onSelectEnd(controllerIndex) {
        console.log(`Controller ${controllerIndex} - Select End`);
    }
    
    update(deltaTime) {
        // Actualizar lógica de controles VR
        if (this.controllers.length > 0) {
            this.handleGazeControls(deltaTime);
        }
    }
    
    handleGazeControls(deltaTime) {
        // Sistema de selección por mirada para cambiar carriles
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        
        // Dirección de la mirada
        const gazeDirection = new THREE.Vector3();
        this.camera.getWorldDirection(gazeDirection);
        
        // Calcular ángulo de la mirada en el plano XZ
        const gazeAngle = Math.atan2(gazeDirection.x, gazeDirection.z);
        const gazeThreshold = 0.3; // Umbral para detectar mirada a los lados
        
        let targetLane = this.lastGazeLane;
        
        // Detectar mirada a la izquierda
        if (gazeAngle < -gazeThreshold) {
            targetLane = 0; // Carril izquierdo
        } 
        // Detectar mirada a la derecha
        else if (gazeAngle > gazeThreshold) {
            targetLane = 2; // Carril derecho
        }
        // Mirada al centro
        else {
            targetLane = 1; // Carril central
        }
        
        // Solo cambiar carril si es diferente al anterior
        if (targetLane !== this.lastGazeLane) {
            this.gazeTimer += deltaTime;
            
            // Requerir mirada sostenida por 0.5 segundos para cambiar carril
            if (this.gazeTimer >= 0.5) {
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
    
    // Método para debug visual de la dirección de mirada
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