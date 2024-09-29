import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private movementKeys!: Phaser.Input.Keyboard.Key[];
  private jumpKey!: Phaser.Input.Keyboard.Key;

  private speed: number = 200;
  private velocity: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);
  private maxSpeed: number = 300;
  private acceleration: number = 600;
  private drag: number = 600;

  private isJumping: boolean = false;
  private jumpDuration: number = 500; // Duration of jump in milliseconds
  private jumpTimer: number = 0;

  private isOnObstacle: boolean = false; // Flag to track if player is on any obstacle after jumping

  private obstacles!: Phaser.Physics.Arcade.StaticGroup;

  // New property: Player's current height
  private playerHeight: number = 0; // 0 = on floor, 1 = jumped

  // Scaling factor: how much the player scales per height unit
  private scaleFactor: number = 0.5; // Scale increases by 50% per height unit

  constructor() {
    super('GameScene');
  }

  preload() {
    // No external assets to load since we're using simple shapes
  }

  create() {
    // Set camera background color to white
    this.cameras.main.setBackgroundColor(0xffffff);

    // Create a simple grid background
    this.createBackground();

    // Create obstacles group
    this.obstacles = this.physics.add.staticGroup();

    // Example obstacles with height values
    // heightValue: 0 = floor, 1 = low obstacle, can be jumped over
    // heightValue: 2 = high obstacle, cannot be jumped over
    this.createObstacle(800, 1200 - 25, 1600, 50, 0); // Floor obstacle
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

    this.player = this.physics.add.sprite(500, 500, 'player');
    this.player.setCircle(20);
    this.player.setCollideWorldBounds(true);
    this.player.setScale(1); // Initial scale corresponding to height 0

    // Enable collision between player and obstacles with a process callback
    this.physics.add.collider(
      this.player,
      this.obstacles,
      this.handleCollision,
      this.processCollision,
      this
    );

    // Set up keyboard input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.movementKeys = [
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    ];
    this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Set up camera to follow the player
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBounds(0, 0, 1600, 1200); // Adjust the bounds as needed
    this.physics.world.setBounds(0, 0, 1600, 1200); // Match physics bounds to camera bounds
  }

  update(time: number, delta: number) {
    const dt = delta / 1000;

    // Reset the obstacle flag each frame
    this.isOnObstacle = false;

    // Check for overlaps with any obstacles
    this.physics.overlap(this.player, this.obstacles, this.handleOverlap, undefined, this);

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
    this.player.setVelocity(this.velocity.x, this.velocity.y);

    // Handle jumping and scaling
    this.handleJumping(delta);

    // Handle height adjustment over time (falling)
    this.handleHeightAdjustment(delta);
  }

  private handleJumping(delta: number) {
    // Check if jump key was just pressed and player is not already jumping
    if (Phaser.Input.Keyboard.JustDown(this.jumpKey) && !this.isJumping) {
      this.isJumping = true;
      //this.jumpTimer = this.jumpDuration;

      // Increase player's height to 1
      this.playerHeight += 1;
      
    }

    this.playerHeight -= 0.01 * delta;

    // If our height is equal to whatever obstacle we're on, we're not jumping anymore
    const overlappingObstacles = this.getOverlappingObstacles();
    if (overlappingObstacles.length > 0 && this.isJumping) {
      const obstacle = overlappingObstacles[0];
      const obstacleHeight = (obstacle as any).heightValue;
      
      if (this.playerHeight === obstacleHeight) {
        this.isJumping = false;
      }
    }

    this.updatePlayerScale();
  }

  private handleHeightAdjustment(delta: number) {
    // If player's height is greater than the obstacle's height, decrease it over time
    if (this.playerHeight > 0) {
      // Find the obstacle the player is currently on
      const overlappingObstacles = this.getOverlappingObstacles();
      if (overlappingObstacles.length > 0) {
        const obstacle = overlappingObstacles[0];
        const obstacleHeight = (obstacle as any).heightValue;

        if (this.playerHeight > obstacleHeight) {
          // Decrease height slightly
          this.playerHeight -= 0.01 * delta; // Adjust the rate as needed
          if (this.playerHeight < obstacleHeight) {
            this.playerHeight = obstacleHeight;
          }
          this.updatePlayerScale();
        }
      }
    }
  }

  private updatePlayerScale() {
    // Update the player's scale based on current height
    const newScale = 1 + this.playerHeight * this.scaleFactor;
    this.player.setScale(newScale);
  }

  private createObstacle(
    x: number,
    y: number,
    width: number,
    height: number,
    obstacleHeight: number
  ) {
    const obstacle = this.add.rectangle(x, y, width, height, 0x808080); // Gray color
    (obstacle as any).heightValue = obstacleHeight; // Custom property to store height
    this.physics.add.existing(obstacle, true); // true for static body
    this.obstacles.add(obstacle);
  }

  private handleCollision(
    player: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    obstacle: Phaser.Types.Physics.Arcade.GameObjectWithBody
  ) {
    // Simple collision response: stop the player's movement
    this.velocity.set(0, 0);
    this.player.setVelocity(0, 0);
  }

  private processCollision(
    player: Phaser.GameObjects.GameObject,
    obstacle: Phaser.GameObjects.GameObject
  ): boolean {
    const obstacleHeight = (obstacle as any).heightValue;

    // Allow collision only if player's height is less than or equal to obstacle's height
    // Player can pass over low obstacles when jumping (height >=1)
    if (this.playerHeight > obstacleHeight) {
      // Player's height is greater; allow passing over
      return false; // Ignore collision
    }

    // Handle collision normally
    return true;
  }

  private handleOverlap(
    player: Phaser.GameObjects.GameObject,
    obstacle: Phaser.GameObjects.GameObject
  ) {
    const obstacleHeight = (obstacle as any).heightValue;

    // Player is considered on an obstacle only if their height matches the obstacle's height
    if (this.playerHeight === obstacleHeight && obstacleHeight > 0) {
      this.isOnObstacle = true;
    }
  }

  private getOverlappingObstacles(): Phaser.GameObjects.GameObject[] {
    // Return all obstacles overlapping with the player
    const overlapping = this.physics.overlap(this.player, this.obstacles);
    if (overlapping) {
      return overlapping;
    }
    return [];
  }

  private createBackground() {
    const gridSize = 50;
    const gridColor = 0x808080; // Gray grid lines

    // Draw vertical grid lines
    for (let x = 0; x <= 1600; x += gridSize) {
      this.add.line(0, 0, x, 0, x, 1200, gridColor).setOrigin(0);
    }

    // Draw horizontal grid lines
    for (let y = 0; y <= 1200; y += gridSize) {
      this.add.line(0, 0, 0, y, 1600, y, gridColor).setOrigin(0);
    }
  }
}