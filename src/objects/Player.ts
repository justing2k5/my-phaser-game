// src/objects/Player.ts

import Phaser from 'phaser';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  // Player properties
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private movementKeys: Phaser.Input.Keyboard.Key[];
  private jumpKey: Phaser.Input.Keyboard.Key;

  private speed: number = 200;
  private velocity: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);
  private maxSpeed: number = 300;
  private acceleration: number = 600;
  private drag: number = 600;

  // Jump properties
  private playerHeight: number = 0; // 0 = on floor, 1.5 = jumped
  private scaleFactor: number = 0.5; // Scale increases by 50% per height unit
  private maxPlayerHeight: number = 20;

  private obstacles: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);

    // Add the player to the scene
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCircle(20);
    this.setCollideWorldBounds(true);
    this.setScale(1); // Initial scale corresponding to height 0

    // Initialize input keys
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.movementKeys = [
      scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    ];
    this.jumpKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    scene.physics.add.overlap(this, (<any>scene).obstacles, (player, obstacle) => {
        this.obstacles.push(obstacle as Phaser.GameObjects.Rectangle);
    });
  }

  update(dt: number) {
    // Handle movement input
    let input = new Phaser.Math.Vector2(0, 0);

    if (this.cursors.left.isDown || this.movementKeys[1].isDown) {
      input.x -= 1;
    }
    if (this.cursors.right.isDown || this.movementKeys[3].isDown) {
      input.x += 1;
    }
    if (this.cursors.up.isDown || this.movementKeys[0].isDown) {
      input.y -= 1;
    }
    if (this.cursors.down.isDown || this.movementKeys[2].isDown) {
      input.y += 1;
    }

    if (input.length() > 0) {
      input.normalize();
      this.velocity.x += input.x * this.acceleration * dt;
      this.velocity.y += input.y * this.acceleration * dt;
    } else {
      // Apply drag when no input
      const dragForce = this.velocity.clone().scale(this.drag * dt);
      if (dragForce.length() > this.velocity.length()) {
        this.velocity.set(0, 0);
      } else {
        this.velocity.subtract(dragForce);
      }
    }

    // Clamp velocity to max speed
    this.velocity.setLength(Math.min(this.velocity.length(), this.maxSpeed));

    // Update player velocity
    this.setVelocity(this.velocity.x, this.velocity.y);

    // Handle jump input
    if (Phaser.Input.Keyboard.JustDown(this.jumpKey) && this.playerHeight === 0) {
      this.playerHeight = 1.5;
    }

    // Loop through obstacles, find the greatest height that is less than or equal to the player's height
    let greatestHeight = 0;
    for (const obstacle of this.obstacles) {
      if (obstacle.heightValue > greatestHeight && obstacle.heightValue <= this.playerHeight) {
        greatestHeight = obstacle.heightValue;
      }
    }
    this.playerHeight -= 2.0 * dt;
    if (this.playerHeight < greatestHeight) {
      this.playerHeight = greatestHeight;
    }

    console.log(this.playerHeight + " " + greatestHeight);
    this.obstacles = [];
    // Update player scale based on current height
    const scale = 1 + this.playerHeight * this.scaleFactor;
    this.setScale(scale);
  }

  // Method to manage player height externally (e.g., in GameScene)
  setPlayerHeight(newHeight: number) {
    this.playerHeight = Phaser.Math.Clamp(newHeight, 0, this.maxPlayerHeight);
    const scale = 1 + this.playerHeight * this.scaleFactor;
    this.setScale(scale);
  }

  getPlayerHeight(): number {
    return this.playerHeight;
  }

  resetPlayerHeight(): void {
    this.playerHeight = 0;
    this.setScale(1);
  }
}