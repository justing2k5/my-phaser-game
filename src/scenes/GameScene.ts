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

  private rotationSpeed: number = 200; // degrees per second

  private isJumping: boolean = false;
  private jumpHeight: number = 0; // Height added due to jumping
  private jumpStartHeight: number = 0; // Player's height at the time of jump
  private jumpPeakHeight: number = 0; // The peak height the player reaches during jump
  private jumpDuration: number = 500; // Duration of the jump in milliseconds
  private jumpElapsed: number = 0; // Time elapsed since the jump started

  private obstacles!: Phaser.Physics.Arcade.StaticGroup;

  // Player's height variables
  private currentBaseHeight: number = 0; // Adjusts over time
  private targetBaseHeight: number = 0; // Desired base height based on obstacle
  private heightAdjustmentRate: number = 8; // Height units per second

  // Scaling factor: how much the player scales per height unit
  private scaleFactor: number = 0.5;

  // Base scale for the player (now twice as big)
  private baseScale: number = 2;

  // Collision body scaling factor
  private collisionScale: number = 0.5; // Adjustable scalar for collision body size

  // Graphics object for drawing collision bounds
  private debugGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super('GameScene');
  }

  preload() {
    // Load the sprite sheet for the player
    // Frame size is 32x32
    this.load.spritesheet('playerSprite', '/skating_sassy.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create() {
    // Set camera background color to white
    this.cameras.main.setBackgroundColor(0xffffff);

    // Create a simple grid background
    this.createBackground();

    // Create obstacles group
    this.obstacles = this.physics.add.staticGroup();

    // Create a row of 10 obstacles, each 50x200 pixels, with increasing height values
    const obstacleWidth = 50;
    const obstacleHeightPixels = 200;
    const startX = 100; // Starting X position for the first obstacle
    const yPosition = 400; // Y position for all obstacles (you can adjust as needed)
    let obstacleHeightValue = 0.25; // Starting height value

    for (let i = 0; i < 10; i++) {
      const xPosition = startX + i * obstacleWidth; // Position obstacles next to each other
      this.createObstacle(
        xPosition,
        yPosition,
        obstacleWidth,
        obstacleHeightPixels,
        obstacleHeightValue
      );
      obstacleHeightValue += 0.25; // Increase the height value by 0.25 for each obstacle
    }

    // Create player sprite using the sprite sheet
    this.player = this.physics.add.sprite(500, 500, 'playerSprite', 0);
    this.player.setCollideWorldBounds(true);
    this.player.setScale(this.baseScale); // Set player to twice its original size

    // Rotate the sprite image by 90 degrees
    this.player.setAngle(90);

    // Update the physics body size to match the new scale and apply collisionScale
    this.player.body.setSize(
      this.player.displayWidth * this.collisionScale,
      this.player.displayHeight * this.collisionScale,
      true
    );

    // Define animations
    this.anims.create({
      key: 'skate',
      frames: this.anims.generateFrameNumbers('playerSprite', { start: 0, end: 14 }),
      frameRate: 15,
      repeat: -1,
    });

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
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W), // movementKeys[0]
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A), // movementKeys[1]
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S), // movementKeys[2]
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D), // movementKeys[3]
    ];
    this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Set up camera to follow the player
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBounds(0, 0, 1600, 1200);
    this.physics.world.setBounds(0, 0, 1600, 1200);

    // Create graphics object for debugging
    this.debugGraphics = this.add.graphics();
  }

  update(time: number, delta: number) {
    const dt = delta / 1000;

    // Handle rotation input
    if (this.cursors.left.isDown || this.movementKeys[1].isDown) {
      this.player.angle -= this.rotationSpeed * dt;
    }
    if (this.cursors.right.isDown || this.movementKeys[3].isDown) {
      this.player.angle += this.rotationSpeed * dt;
    }

    // Handle forward/backward movement
    let moveForward = 0;

    if (this.cursors.up.isDown || this.movementKeys[0].isDown) {
      moveForward += 1;
    }
    if (this.cursors.down.isDown || this.movementKeys[2].isDown) {
      moveForward -= 1;
    }

    if (moveForward !== 0) {
      const angleRad = Phaser.Math.DegToRad(this.player.angle);
      const force = new Phaser.Math.Vector2(Math.cos(angleRad), Math.sin(angleRad))
        .scale(moveForward * this.acceleration * dt);
      this.velocity.add(force);
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
    if (this.velocity.length() > this.maxSpeed) {
      this.velocity.setLength(this.maxSpeed);
    }

    // Update player velocity
    this.player.setVelocity(this.velocity.x, this.velocity.y);

    // Update target base height based on the obstacle closest to its center overlapping its bounds
    this.targetBaseHeight = this.getPlayerTargetBaseHeight();

    // Update base height towards target
    this.updateBaseHeight(delta);

    // Handle jumping mechanics
    this.handleJumping(delta);

    // Calculate player's current height (currentBaseHeight + jumpHeight)
    const playerHeight = this.currentBaseHeight + this.jumpHeight;

    // Update player scale based on current height
    this.updatePlayerScale(playerHeight);

    // Play animation when moving
    if (this.velocity.length() > 0) {
      this.player.anims.play('skate', true);
    } else {
      this.player.anims.stop();
      this.player.setFrame(0); // Set to the first frame when idle
    }

    // Draw collision bounds
    this.drawCollisionBounds();
  }

  private updateBaseHeight(delta: number) {
    // Adjust currentBaseHeight towards targetBaseHeight
    const dt = delta / 1000;
    const heightDifference = this.targetBaseHeight - this.currentBaseHeight;

    if (heightDifference !== 0) {
      // Determine adjustment direction
      const adjustment = Phaser.Math.Clamp(
        heightDifference,
        -this.heightAdjustmentRate * dt,
        this.heightAdjustmentRate * dt
      );

      this.currentBaseHeight += adjustment;

      // Check if adjustment is complete
      if (Math.abs(this.targetBaseHeight - this.currentBaseHeight) < 0.01) {
        this.currentBaseHeight = this.targetBaseHeight;
      }

      // Set isJumping to true during adjustment
      this.isJumping = true;
    } else {
      // Not adjusting height
      if (!this.isJumping) {
        this.isJumping = false;
      }
    }
  }

  private handleJumping(delta: number) {
    // Check if jump key was just pressed and player is not already jumping
    if (Phaser.Input.Keyboard.JustDown(this.jumpKey) && !this.isJumping) {
      this.isJumping = true;
      this.jumpElapsed = 0;
      this.jumpStartHeight = this.currentBaseHeight;
      this.jumpPeakHeight = this.jumpStartHeight + 2; // Jump up to 2 more than current height
    }

    if (this.isJumping && this.jumpElapsed < this.jumpDuration) {
      this.jumpElapsed += delta;
      const halfDuration = this.jumpDuration / 2;

      if (this.jumpElapsed <= halfDuration) {
        // Ascending
        const t = this.jumpElapsed / halfDuration;
        this.jumpHeight = Phaser.Math.Linear(0, this.jumpPeakHeight - this.jumpStartHeight, t);
      } else if (this.jumpElapsed <= this.jumpDuration) {
        // Descending
        const t = (this.jumpElapsed - halfDuration) / halfDuration;
        this.jumpHeight = Phaser.Math.Linear(
          this.jumpPeakHeight - this.jumpStartHeight,
          0,
          t
        );
      } else {
        // Jump complete
        this.jumpHeight = 0;
      }
    } else {
      // Not in a manual jump
      this.jumpHeight = 0;
      if (this.currentBaseHeight === this.targetBaseHeight) {
        this.isJumping = false;
      }
    }
  }

  private getPlayerTargetBaseHeight(): number {
    // Determine obstacles overlapping the player's bounds
    const overlappingObstacles: Phaser.GameObjects.GameObject[] = [];
    this.physics.overlap(
      this.player,
      this.obstacles,
      (_, obstacle) => {
        overlappingObstacles.push(obstacle);
      },
      undefined,
      this
    );

    if (overlappingObstacles.length === 0) {
      return 0; // No overlapping obstacles, height is 0
    }

    // Find the obstacle closest to the player's center
    let closestObstacle: Phaser.GameObjects.GameObject = overlappingObstacles[0];
    let minDistance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      overlappingObstacles[0].x,
      overlappingObstacles[0].y
    );

    for (let i = 1; i < overlappingObstacles.length; i++) {
      const obstacle = overlappingObstacles[i];
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        obstacle.x,
        obstacle.y
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestObstacle = obstacle;
      }
    }

    const obstacleHeight = (closestObstacle as any).heightValue;
    return obstacleHeight;
  }

  private updatePlayerScale(playerHeight: number) {
    // Update the player's scale based on current height
    const newScale = this.baseScale + playerHeight * this.scaleFactor;
    this.player.setScale(newScale);

    // Update the physics body size to match the new scale and apply collisionScale
    this.player.body.setSize(
      this.player.displayWidth * this.collisionScale,
      this.player.displayHeight * this.collisionScale,
      true
    );
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

    // Effective player height during collision checks
    const effectivePlayerHeight = this.currentBaseHeight + this.jumpHeight;

    // Collision occurs if obstacleHeight > playerHeight + 1
    if (obstacleHeight > effectivePlayerHeight + 1) {
      // Collision occurs
      return true; // Process collision
    }

    // Player can pass through
    return false;
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

  private drawCollisionBounds() {
    // Clear previous drawings
    this.debugGraphics.clear();

    // Draw player collision bounds
    this.debugGraphics.lineStyle(1, 0x00ff00); // Green color for player
    this.debugGraphics.strokeRect(
      this.player.body.x,
      this.player.body.y,
      this.player.body.width,
      this.player.body.height
    );

    // Draw obstacles collision bounds
    this.debugGraphics.lineStyle(1, 0xff0000); // Red color for obstacles
    this.obstacles.children.iterate((obstacle: Phaser.GameObjects.GameObject) => {
      const body = obstacle.body as Phaser.Physics.Arcade.Body;
      if (body) {
        this.debugGraphics.strokeRect(body.x, body.y, body.width, body.height);
      }
    });
  }
}
