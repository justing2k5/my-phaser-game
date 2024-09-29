// src/scenes/GameScene.ts

import Phaser from 'phaser';
import Player from '../objects/Player';
import Obstacle from '../objects/Obstacle';

export default class GameScene extends Phaser.Scene {
  private player!: Player;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;

  constructor() {
    super('GameScene');
  }

  preload() {
    // No external assets to load since we're using simple shapes
  }

  create() {
    // Set camera background color to white
    this.cameras.main.setBackgroundColor(0xffffff);

    // Create obstacles group
    this.obstacles = this.physics.add.staticGroup();

    // Example obstacles with height values
    // heightValue: 0 = floor, 1 = low obstacle, can be jumped over
    // heightValue: 2 = high obstacle, cannot be jumped over
    this.createObstacle(800, 1175, 1600, 50, 0); // Floor obstacle
    this.createObstacle(200, 150, 50, 50, 1);
    this.createObstacle(600, 450, 100, 100, 2);
    this.createObstacle(400, 300, 75, 75, 1);
    this.createObstacle(800, 600, 100, 100, 2); // Added another high obstacle for testing

    // Create player as a circle using a graphics texture
    const graphics = this.add.graphics();
    graphics.fillStyle(0x00ff00, 1);
    graphics.fillCircle(0, 0, 20);
    graphics.generateTexture('player', 40, 40);
    graphics.destroy();

    this.player = new Player(this, 500, 500, 'player');
    this.player.setScale(1); // Initial scale corresponding to height 0

    // Enable collision between player and obstacles with a process callback
    this.physics.add.collider(
      this.player,
      this.obstacles,
      this.handleCollision,
      this.processCollision,
      this
    );

    // Set up camera to follow the player
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBounds(0, 0, 1600, 1200); // Adjust the bounds as needed
    this.physics.world.setBounds(0, 0, 1600, 1200); // Match physics bounds to camera bounds
  }

  update(time: number, delta: number) {
    const dt = delta / 1000; // Delta time in seconds

    // Update player movement and scaling
    this.player.update(dt);
  }

  private createObstacle(
    x: number,
    y: number,
    width: number,
    height: number,
    obstacleHeight: number
  ) {
    const obstacle = new Obstacle(this, x, y, width, height, obstacleHeight);
    this.obstacles.add(obstacle);
  }

  private handleCollision(
    obj1: Phaser.GameObjects.GameObject,
    obj2: Phaser.GameObjects.GameObject
  ) {
    // Customize collision response if needed
    // For example, stop the player's movement vertically when landing on an obstacle
  }

  private processCollision(
    obj1: Phaser.GameObjects.GameObject,
    obj2: Phaser.GameObjects.GameObject
  ): boolean {
    // Ensure obj1 is the player and obj2 is an obstacle
    if (obj1 === this.player && obj2 instanceof Obstacle) {
      const obstacleHeight = obj2.heightValue;

      // Allow collision only if player's height is less than or equal to obstacle's height
      // Player can pass over low obstacles when jumping (height >=1)
      if (this.player.getPlayerHeight() > obstacleHeight) {
        // Player's height is greater; allow passing over
        return false; // Ignore collision
      }

      // Handle collision normally
      return true;
    }

    // Default to handling collision
    return true;
  }

  
}