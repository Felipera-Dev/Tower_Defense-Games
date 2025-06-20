
var config = {
    type: Phaser.AUTO,
    parent: 'content',
    width: 640,
    height: 512,
    physics: {
        default: 'arcade',
    },
    scene: {
        key: 'main',
        preload: preload,
        create: create,
        update: update
    },
}
var game = new Phaser.Game(config);
var graphics;
var path;
var enemies;
var turrets;
var bullets;
var ENEMY_SPEED = 2 / 10000; // velocidade do inimigo
var BULLET_DAMAGE = 50
var map = [[0, -1, 0, 0, 0, 0, 0, 0, 0, 0],
[0, -1, 0, 0, 0, 0, 0, 0, 0, 0],
[0, -1, -1, -1, -1, -1, -1, -1, 0, 0],
[0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
[0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
[0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
[0, 0, 0, 0, 0, 0, 0, -1, 0, 0],
[0, 0, 0, 0, 0, 0, 0, -1, 0, 0]];

function preload() {
    //carregar assets
    this.load.atlas('sprites', 'assets/spritesheet.png', 'assets/spritesheet.json');
    this.load.image('bullet', 'assets/bullet.png');
}

var Enemy = new Phaser.Class({
    Extends: Phaser.GameObjects.Image,
    initialize:
        function Enemy(scene) {
            Phaser.GameObjects.Image.call(this, scene, 0, 0, 'sprites', 'enemy');
            this.follower = { t: 0, vec: new Phaser.Math.Vector2() }; // -- progresso do inmigo na linha

        },
    startOnPath:
        function () {
            //paramentro do inicio do inimigo na linha
            this.follower.t = 0; // -- reiniciar progresso do inimigo na linha
            this.hp = 100;

            //pegar x e y do ponto T
            path.getPoint(this.follower.t, this.follower.vec);
            // -- posicionar inimigo na linha
            this.setPosition(this.follower.vec.x, this.follower.vec.y);
        },
    receiveDamage: function (damage) {
        this.hp -= damage; // -- diminuir vida do inimigo
        if (this.hp <= 0) {
            this.setActive(false);
            this.setVisible(false);
            // console.log('Inimigo morto');
        }
    },
    update: function (time, delta) {
        //atualizar posicao do inimigo
        this.follower.t += ENEMY_SPEED * delta;
        //novas cordenadas do inimigo
        path.getPoint(this.follower.t, this.follower.vec);
        //coloca o inimigo na nova posicao
        this.setPosition(this.follower.vec.x, this.follower.vec.y);
        //se inimigo sair do caminho, remover ele
        if (this.follower.t > 1) {
            // this.destroy();
            // console.log('Inimigo chegou ao final do caminho');
            this.setActive(false);
            this.setVisible(false);
        }
    }
});

function getEnemy(x, y, distance) {
    var enemyUnits = enemies.getChildren();
    for (var i = 0; i < enemyUnits.length; i++) {
        var enemy = enemyUnits[i];
        if (enemyUnits[i].active && Phaser.Math.Distance.Between(x, y, enemyUnits[i].x, enemyUnits[i].y) <= distance) {
            return enemyUnits[i];
        }
    }
    return false;
}


var Turret = new Phaser.Class({
    Extends: Phaser.GameObjects.Image,
    initialize:
        function Turret(scene) {
            Phaser.GameObjects.Image.call(this, scene, 0, 0, 'sprites', 'turret');
            this.nextTick = 0; // -- tempo para a torre atirar

        },
    place: function (i, j) {
        this.y = i * 64 + 32; // -- posicao y do canhao
        this.x = j * 64 + 32; // -- posicao x do canhao
        map[i][j] = 1; // -- marcar posicao do canhao no mapa
    },
    fire: function () {
        var enemy = getEnemy(this.x, this.y, 100); // -- pegar inimigo mais proximo  
        if (enemy) {
            // -- calcular angulo do tiro
            var angle = Phaser.Math.Angle.Between(this.x, this.y, enemy.x, enemy.y);
            addBullet(this.x, this.y, angle);
            this.angle = (angle + Math.PI / 2) * Phaser.Math.RAD_TO_DEG; // -- rotacionar canhao para o angulo do tiro
        }
    },
    update: function (time, delta) {
        //atualizar canhao
        //tempo para atirar
        if (time > this.nextTick) {
            this.fire(); // -- disparar canhao
            this.nextTick = time + 1000; // -- proximo tiro em 1 segundo
        }
    }
});

var Bullet = new Phaser.Class({
    Extends: Phaser.GameObjects.Image,
    initialize:
        function Bullet(scene) {
            Phaser.GameObjects.Image.call(this, scene, 0, 0, 'bullet');
            this.dx = 0; // -- deslocamento x do tiro
            this.dy = 0; // -- deslocamento y do tiro
            this.lifespan = 1000; // -- tempo de vida do tiro
            this.speed = Phaser.Math.GetSpeed(600, 1); // -- velocidade do tiro

        },
    fire: function (x, y, angle) {
        this.setActive(true);
        this.setVisible(true);
        this.setPosition(x, y);

        this.dx = Math.cos(angle)
        this.dy = Math.sin(angle)
        this.lifespan = 1000; // -- reiniciar tempo de vida do tiro
    },
    update: function (time, delta) {
        this.lifespan -= delta; // -- diminuir tempo de vida do tiro
        this.x += this.dx * (this.speed * delta);
        this.y += this.dy * (this.speed * delta);
        if (this.lifespan <= 0) {
            this.setActive(false);
            this.setVisible(false);
        }
    }
})

function create() {
    //criando variacao grafica da linha
    var graphics = this.add.graphics();
    path = this.add.path(96, -32);
    path.lineTo(96, 164);
    path.lineTo(480, 164);
    path.lineTo(480, 544);
    drawGrid(graphics); // -- desenhar grade
    //estilo da linha
    graphics.lineStyle(3, 0x00ff00, 1);
    path.draw(graphics);

    //criar inimigo
    enemies = this.physics.add.group({
        classType: Enemy,
        runChildUpdate: true
    });
    this.nextEnemy = 0; // -- tempo para o proximo inimigo

    //torres
    turrets = this.add.group({
        classType: Turret,
        runChildUpdate: true
    });

    //balas
    bullets = this.physics.add.group({
        classType: Bullet,
        runChildUpdate: true
    });

    this.physics.add.overlap(enemies, bullets, damageEnemy); // -- colisao entre inimigo e bala

    this.input.on('pointerdown', placeTurret); // -- colocar torre ao clicar
}
function damageEnemy(enemy, bullet) {
    if (enemy.active && bullet.active) {
        bullet.setActive(false); // -- desativar bala
        bullet.setVisible(false); // -- esconder bala
        enemy.receiveDamage(BULLET_DAMAGE); // -- inimigo recebe dano
    }
    if (!enemy.active) {
        console.log('Inimigo morto');
    }
}

function drawGrid(graphics) {
    graphics.lineStyle(1, 0x00ff00, 0.2);
    for (var i = 0; i < 8; i++) {
        graphics.moveTo(0, i * 64);
        graphics.lineTo(640, i * 64);
    }
    for (var j = 0; j < 512; j++) {
        graphics.moveTo(j * 64, 0);
        graphics.lineTo(j * 64, 512);
    }
    graphics.strokePath();
}

function update(time, delta) {
    //quando o proximo inimigo deve ser criado
    if (time > this.nextEnemy) {
        var enemy = enemies.get();
        if (enemy) {
            enemy.setActive(true);
            enemy.setVisible(true);
            enemy.startOnPath(path);
            this.nextEnemy = time + Phaser.Math.Between(1000, 2000); // -- proximo inimigo entre 1 e 2 segundos
        }
    }

}

function canPlaceTurret(i, j) {
    return map[i][j] === 0; // -- verificar se a posicao esta livre
}
function placeTurret(pointer) {
    // -- pegar posicao do clique
    var i = Math.floor(pointer.y / 64);
    var j = Math.floor(pointer.x / 64);
    // -- verificar se a posicao esta livre
    if (canPlaceTurret(i, j)) {
        var turret = turrets.get();
        if (turret) {
            turret.setActive(true);
            turret.setVisible(true);
            turret.place(i, j); // -- colocar torre na posicao
        }
    } else {
        console.log('Posicao ocupada');
    }
}
function addBullet(x, y, angle) {
    var bullet = bullets.get();
    if (bullet) {
        bullet.fire(x, y, angle); // -- disparar bala
    }
}