// src/objects/Obstacle.ts

import Phaser from 'phaser';

export default class Obstacle extends Phaser.GameObjects.Rectangle {
  heightValue: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    obstacleHeight: number
  ) {
    super(scene, x, y, width, height, 0x808080); // Gray color

    this.heightValue = obstacleHeight;

    // Add the obstacle to the scene and enable physics
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // true for static body
  }
}