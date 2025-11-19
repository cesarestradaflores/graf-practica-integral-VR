// -----------------------------------------------------------------
// --- Player.js (VERSIÓN MEJORADA CON SOPORTE VR COMPLETO)
// -----------------------------------------------------------------

import * as THREE from 'three';
import { Config } from './Config.js';

export class Player {
    constructor(scene, assets) {
        this.scene = scene;
        this.assets = assets;
        this.height = 2.5; 
        this.width = 1;

        this.group = new THREE.Group();
        this.group.scale.set(0.015, 0.015, 0.015);
        this.scene.add(this.group);
        
        this.mesh = null; 
        this.mixer = null; 
        this.actions = {}; 
        this.activeActionName = ''; 

        this.boundingBox = new THREE.Box3();

        // NUEVO: Estado para controlar transiciones
        this.animationTransitionInProgress = false;
        this.pendingAnimation = '';

        if (assets.playerModel) {
            this.mesh = assets.playerModel;
            this.mesh.position.y = 0; 
            
            this.group.add(this.mesh); 
            this.mesh.rotation.y = Math.PI;
            
            this.mixer = new THREE.AnimationMixer(this.mesh);

            // Configurar todas las animaciones disponibles
            this.setupAnimations();
            
            this.activeActionName = 'run';
            this.actions.run.play();
            
            this._updateBoundingBox();
            
            // Listener mejorado para animaciones
            this.setupAnimationListeners();
            
        } else {
            console.error("No se pasó ningún modelo de jugador. Creando placeholder.");
            this._createPlaceholder();
        }
        
        this.state = Config.PLAYER_STATE.RUNNING;
        this.currentLane = 1; 
        this.yVelocity = 0;
        this.rollTimer = 0;

        // NUEVO: Configuración para VR
        this.vrMode = false;
        this.vrHeadPosition = new THREE.Vector3();
    }

    // NUEVO: Configuración centralizada de animaciones
    setupAnimations() {
        const animationClips = {
            'run': this.assets.animRun,
            'jump': this.assets.animJump,
            'die': this.assets.animDie,
            'roll': this.assets.animRoll,
            'left': this.assets.animLeft,
            'right': this.assets.animRight
        };

        for (const [name, animAsset] of Object.entries(animationClips)) {
            if (animAsset && animAsset.animations && animAsset.animations.length > 0) {
                this.actions[name] = this.mixer.clipAction(animAsset.animations[0]);
                console.log(`✅ Animación cargada: ${name}`);
            } else {
                console.warn(`⚠️ Animación no disponible: ${name}`);
            }
        }

        // Configurar loops y propiedades
        if (this.actions.run) {
            this.actions.run.setLoop(THREE.LoopRepeat);
            this.actions.run.setEffectiveTimeScale(1.0);
        }
        
        if (this.actions.jump) {
            this.actions.jump.setLoop(THREE.LoopOnce);
            this.actions.jump.clampWhenFinished = false;
        }
        
        if (this.actions.die) {
            this.actions.die.setLoop(THREE.LoopOnce);
            this.actions.die.clampWhenFinished = true;
        }
        
        if (this.actions.roll) {
            this.actions.roll.setLoop(THREE.LoopOnce);
            this.actions.roll.clampWhenFinished = false;
        }
        
        if (this.actions.left) {
            this.actions.left.setLoop(THREE.LoopOnce);
            this.actions.left.clampWhenFinished = false;
        }
        
        if (this.actions.right) {
            this.actions.right.setLoop(THREE.LoopOnce);
            this.actions.right.clampWhenFinished = false;
        }
    }

    // NUEVO: Listener mejorado para animaciones
    setupAnimationListeners() {
        this.mixer.addEventListener('finished', (e) => {
            // Solo procesar si no hay transición en progreso
            if (this.animationTransitionInProgress) return;

            const finishedAction = e.action;
            
            // Si la animación que terminó es de morir, no hacer nada
            if (finishedAction === this.actions.die) {
                return;
            }
            
            // Si terminó una animación de salto o rodar y estamos en ese estado, volver a correr
            if ((finishedAction === this.actions.jump && this.state === Config.PLAYER_STATE.JUMPING) ||
                (finishedAction === this.actions.roll && this.state === Config.PLAYER_STATE.ROLLING)) {
                
                // Pequeño delay para evitar transiciones bruscas
                setTimeout(() => {
                    if (this.state !== Config.PLAYER_STATE.DEAD) {
                        this.switchAnimation('run');
                    }
                }, 50);
            }
            
            // Animaciones de strafe (left/right) vuelven automáticamente a run
            if (finishedAction === this.actions.left || finishedAction === this.actions.right) {
                if (this.state === Config.PLAYER_STATE.RUNNING) {
                    this.switchAnimation('run');
                }
            }
        });
    }

    // Sistema de transiciones de animación MEJORADO
    switchAnimation(newActionName) {
        if (this.activeActionName === newActionName || !this.actions[newActionName]) {
            return;
        }

        // Si hay una transición en progreso, guardar como pendiente
        if (this.animationTransitionInProgress) {
            this.pendingAnimation = newActionName;
            return;
        }

        this.animationTransitionInProgress = true;

        const oldAction = this.actions[this.activeActionName];
        const newAction = this.actions[newActionName];

        // Configurar la nueva animación
        newAction.reset();
        
        // Configurar loop según el tipo de animación
        if (newActionName === 'run') {
            newAction.setLoop(THREE.LoopRepeat);
        } else {
            newAction.setLoop(THREE.LoopOnce);
        }
        
        newAction.clampWhenFinished = (newActionName === 'die');
        
        // Transición suave
        if (oldAction && oldAction !== newAction) {
            oldAction.fadeOut(0.1);
        }
        
        newAction.fadeIn(0.1);
        newAction.play();

        this.activeActionName = newActionName;

        // Liberar transición después de un tiempo
        setTimeout(() => {
            this.animationTransitionInProgress = false;
            
            // Procesar animación pendiente si existe
            if (this.pendingAnimation) {
                const pending = this.pendingAnimation;
                this.pendingAnimation = '';
                this.switchAnimation(pending);
            }
        }, 100);
    }

    _createPlaceholder() {
        const geometry = new THREE.CapsuleGeometry(this.width / 2, this.height - this.width, 16);
        const material = new THREE.MeshPhongMaterial({ color: 0xeeeeee });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.group.add(this.mesh);
        this.group.position.y = this.height / 2;
        this._updateBoundingBox();
    }
    
    die() {
        this.state = Config.PLAYER_STATE.DEAD;
        this.switchAnimation('die');
        
        // NUEVO: En VR, desactivar controles
        if (this.vrMode) {
            this.disableVRControls();
        }
    }

    // NUEVO: Métodos para control VR
    enableVRMode() {
        this.vrMode = true;
        console.log("🎮 Modo VR activado para el jugador");
    }

    disableVRMode() {
        this.vrMode = false;
        console.log("🖥️ Modo VR desactivado para el jugador");
    }

    disableVRControls() {
        // Método para desactivar controles VR cuando el jugador muere
        if (this.vrMode) {
            console.log("🚫 Controles VR desactivados (jugador muerto)");
        }
    }

    // NUEVO: Actualizar posición de cabeza en VR
    updateVRHeadPosition(headPosition) {
        if (this.vrMode && headPosition) {
            this.vrHeadPosition.copy(headPosition);
        }
    }

    onKeyDown(event) {
        if (this.state === Config.PLAYER_STATE.DEAD) return; 

        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
            case 'Space':
                this.jump();
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.strafe(-1);
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.strafe(1);
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.roll();
                break;
        }
    }

    reset() {
        console.log("Reseteando al jugador...");
        this.state = Config.PLAYER_STATE.RUNNING;
        this.yVelocity = 0;
        this.rollTimer = 0;
        this.currentLane = 1; 
        this.animationTransitionInProgress = false;
        this.pendingAnimation = '';

        if (this.group) {
            this.group.scale.set(0.015, 0.015, 0.015);
            this.group.position.x = 0;
            this.group.position.y = 0;
            this.group.position.z = 0;
            
            this._updateBoundingBox();
            
            if (this.mixer) {
                this.mixer.stopAllAction();
                this.activeActionName = 'run';
                if (this.actions.run) {
                    this.actions.run.reset();
                    this.actions.run.play();
                }
            }
        }
    }

    strafe(direction) {
        if (this.state === Config.PLAYER_STATE.DEAD) return; 

        const targetLane = this.currentLane + direction;
        this.currentLane = THREE.MathUtils.clamp(targetLane, 0, 2);

        // Solo animar strafe si estamos corriendo
        if (this.state === Config.PLAYER_STATE.RUNNING) {
            if (direction === -1 && this.actions.left) {
                this.switchAnimation('left');
            } else if (direction === 1 && this.actions.right) {
                this.switchAnimation('right');
            }
        }
    }

    jump() {
        if (this.state === Config.PLAYER_STATE.RUNNING) {
            this.state = Config.PLAYER_STATE.JUMPING;
            this.yVelocity = Config.JUMP_STRENGTH;
            if (this.actions.jump) {
                this.switchAnimation('jump');
            }
        }
    }

    roll() {
        if (this.state === Config.PLAYER_STATE.RUNNING) {
            this.state = Config.PLAYER_STATE.ROLLING;
            this.rollTimer = Config.ROLL_DURATION;
            if (this.actions.roll) {
                this.switchAnimation('roll');
            }
        }
    }

    update(deltaTime) {
        if (!this.group) return; 
        
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        if (this.state === Config.PLAYER_STATE.DEAD) return; 

        // Movimiento entre carriles (suave)
        const targetX = (this.currentLane - 1) * Config.LANE_WIDTH;
        this.group.position.x = THREE.MathUtils.lerp(this.group.position.x, targetX, 10 * deltaTime);
        
        const groundY = 0;

        // Físicas de salto
        if (this.state === Config.PLAYER_STATE.JUMPING) {
            this.group.position.y += this.yVelocity * deltaTime;
            this.yVelocity += Config.GRAVITY * deltaTime;

            if (this.group.position.y <= groundY) {
                this.group.position.y = groundY;
                this.yVelocity = 0;
                this.state = Config.PLAYER_STATE.RUNNING;
                // La transición a 'run' se maneja en el listener de animaciones
            }
        }

        // Temporizador de rodar
        if (this.state === Config.PLAYER_STATE.ROLLING) {
            this.rollTimer -= deltaTime;
            if (this.rollTimer <= 0) {
                this.state = Config.PLAYER_STATE.RUNNING;
                // La transición a 'run' se maneja en el listener de animaciones
            }
        }
        
        this._updateBoundingBox();
    }

    _updateBoundingBox() {
        if (!this.group) return; 
        
        // Ajustar bounding box según el estado
        this.boundingBox.setFromObject(this.group, true);
        
        // Reducir bounding box durante el roll
        if (this.state === Config.PLAYER_STATE.ROLLING) {
            this.boundingBox.min.y += 0.5;
        }
        
        // Ajustar para saltos
        if (this.state === Config.PLAYER_STATE.JUMPING) {
            this.boundingBox.expandByScalar(0.2);
        }
        
        this.boundingBox.expandByScalar(0.1);
    }

    getBoundingBox() {
        return this.boundingBox;
    }

    // NUEVO: Método para debug
    debugInfo() {
        return {
            state: this.state,
            currentLane: this.currentLane,
            animation: this.activeActionName,
            position: {
                x: this.group.position.x.toFixed(2),
                y: this.group.position.y.toFixed(2),
                z: this.group.position.z.toFixed(2)
            },
            vrMode: this.vrMode
        };
    }
}