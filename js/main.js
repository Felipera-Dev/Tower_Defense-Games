
var config = {
    type: Phaser.AUTO,
    parent: 'content',
    width: 1280,
    height: 1024,
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
// var game = new Phaser.Game(config);
var graphics;
var path;
var enemies;
var turrets;
var bullets;
var ENEMY_SPEED = 0.2 / 10000; // velocidade do inimigo
var BULLET_DAMAGE = 50
var tileSize = 64;
var mapRows = Math.floor(config.height / tileSize);
var mapCols = Math.floor(config.width / tileSize);

var map = [];
for (let i = 0; i < mapRows; i++) {
    let row = [];
    for (let j = 0; j < mapCols; j++) {
        row.push(0); // 0 = livre, -1 = caminho, 1 = torre
    }
    map.push(row);
}
const TURRET_TYPES = {
    basic: { range: 100, damage: 50, fireRate: 1000, sprite: 'basic' },
    sniper: { range: 200, damage: 150, fireRate: 2000, sprite: 'sniper' },
    rapid: { range: 80, damage: 20, fireRate: 300, sprite: 'rapid' }
};
const ENEMY_TYPES = {
    normal: { hp: 100, speed: 0.6, sprite: 'sprite1' },
    fast: { hp: 50, speed: 1, sprite: 'sprite5' },
    tank: { hp: 300, speed: 0.3, sprite: 'sprite10' }
};

var selectedTurretType = 'basic';

function selectTurret(type) {
    selectedTurretType = type;
    console.log('Tipo de torre selecionado:', type);
} window.selectTurret = selectTurret;

function preload() {
    //carregar assets
    // this.load.atlas('sprites', 'assets/spritesheet.png', 'assets/spritesheet.json');
    this.load.atlas('sprites', 'assets/soldiers.png', 'assets/soldiers.json');
    this.load.atlas('mobs', 'assets/mobs.png', 'assets/mobs.json');
    this.load.image('bullet', 'assets/bullet.png');
    this.load.image('grass', 'assets/grass.png');
    this.load.image('road', 'assets/pedra.png');
    this.load.image('end', 'assets/tnt.png');
    this.load.image('start', 'assets/start.png');
}

var Enemy = new Phaser.Class({
    Extends: Phaser.GameObjects.Sprite,
    initialize:
        function Enemy(scene) {
            Phaser.GameObjects.Sprite.call(this, scene, 0, 0, 'mobs', 'sprite1');
            this.follower = { t: 0, vec: new Phaser.Math.Vector2() };
            this.type = 'normal';
            this.baseSpeed = ENEMY_TYPES.normal.speed;
        },
    startOnPath: function (path, type = 'normal') {
    this.type = type;
    this.hp = ENEMY_TYPES[type].hp;
    this.baseSpeed = ENEMY_TYPES[type].speed;
    // Toca a animação correta
    if (type === 'normal') {
        this.play('mob_normal_walk');
    } else if (type === 'fast') {
        this.play('mob_fast_walk');
    } else if (type === 'tank') {
        this.play('mob_tank_walk');
    }
    this.follower.t = 0;
    path.getPoint(this.follower.t, this.follower.vec);
    this.setPosition(this.follower.vec.x, this.follower.vec.y);
},
    receiveDamage: function (damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.setActive(false);
            this.setVisible(false);
        }
    },
    update: function (time, delta) {
        this.follower.t += ENEMY_SPEED * this.baseSpeed * delta;
        path.getPoint(this.follower.t, this.follower.vec);
        this.setPosition(this.follower.vec.x, this.follower.vec.y);
        if (this.follower.t > 1) {
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
            Phaser.GameObjects.Image.call(this, scene, 0, 0, 'sprites', 'sprite4');
            this.nextTick = 0;
            this.type = 'basic'; // tipo padrão
            this.range = TURRET_TYPES.basic.range;
            this.damage = TURRET_TYPES.basic.damage;
            this.fireRate = TURRET_TYPES.basic.fireRate;
            this.level = 1; 
        },
    setType: function (type) {
        this.type = type;
        this.range = TURRET_TYPES[type].range;
        this.damage = TURRET_TYPES[type].damage;
        this.fireRate = TURRET_TYPES[type].fireRate;
        this.setTexture('sprites', TURRET_TYPES[type].sprite);
        this.level = 1; 
    },
    upgrade: function () {
        this.level++;
        this.damage = Math.round(this.damage * 1.5);
        this.range = Math.round(this.range * 1.2);
        this.fireRate = Math.round(this.fireRate * 1.2);
        console.log('Torre upada para o nível', this.level);
    },
    place: function (i, j, type = 'basic') {
        this.y = i * 64 + 32;
        this.x = j * 64 + 32;
        map[i][j] = 1;
        this.setType(type);
    },
    fire: function () {
        var enemy = getEnemy(this.x, this.y, this.range);
        if (enemy) {
            var angle = Phaser.Math.Angle.Between(this.x, this.y, enemy.x, enemy.y);
            addBullet(this.x, this.y, angle, this.damage);
            this.angle = (angle + Math.PI / 2) * Phaser.Math.RAD_TO_DEG;
        }
    },
    update: function (time, delta) {
        if (time > this.nextTick) {
            this.fire();
            this.nextTick = time + this.fireRate;
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
            this.speed = Phaser.Math.GetSpeed(1200, 1); // -- velocidade do tiro

        },
    fire: function (x, y, angle, damage) {
        this.setActive(true);
        this.setVisible(true);
        this.setPosition(x, y);
        this.damage = damage;
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

var caminhoMapa = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0,],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0,],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
];
function gerarMapa(scene, caminhoMapa) {
    // Encontrar o ponto inicial (primeiro 1 na primeira coluna)
    let start = null;
    for (let i = 0; i < caminhoMapa.length; i++) {
        for (let j = 0; j < caminhoMapa[i].length; j++) {
            if (caminhoMapa[i][j] === 1) {
                start = { i, j };
                break;
            }
        }
        if (start) break;
    }

    // Busca sequencial pelo caminho (DFS simples)
    let visited = Array.from({ length: caminhoMapa.length }, () => Array(caminhoMapa[0].length).fill(false));
    let pathPoints = [];
    function dfs(i, j) {
        if (
            i < 0 || i >= caminhoMapa.length ||
            j < 0 || j >= caminhoMapa[0].length ||
            caminhoMapa[i][j] !== 1 ||
            visited[i][j]
        ) return;
        visited[i][j] = true;
        pathPoints.push({ i, j });
        // Ordem: direita, baixo, esquerda, cima
        dfs(i, j + 1);
        dfs(i + 1, j);
        dfs(i, j - 1);
        dfs(i - 1, j);
    }
    dfs(start.i, start.j);
    // Marcar o caminho no mapa
    pathPoints.forEach(pt => {
        map[pt.i][pt.j] = -1; // -1 indica caminho
    });
    // Criar o path
    let p = null;
    pathPoints.forEach((pt, idx) => {
        let x = pt.j * tileSize + tileSize / 2;
        let y = pt.i * tileSize + tileSize / 2;
        if (idx === 0) {
            p = scene.add.path(x, y);
        } else {
            p.lineTo(x, y);
        }
    });
    return p;
}
function texturaMapa(scene, caminhoMapa) {
    for (let i = 0; i < caminhoMapa.length; i++) {
        for (let j = 0; j < caminhoMapa[i].length; j++) {
            let tipo = caminhoMapa[i][j];
            let x = j * tileSize + tileSize / 2;
            let y = i * tileSize + tileSize / 2;
            if (tipo === 1) {
                scene.add.image(x, y, 'road').setDisplaySize(tileSize, tileSize);
            } else if (tipo === 3) {
                scene.add.image(x, y, 'end').setDisplaySize(tileSize, tileSize);
            }
            else if (tipo === 2) {
                scene.add.image(x, y, 'start').setDisplaySize(tileSize, tileSize);
            } else {
                scene.add.image(x, y, 'grass').setDisplaySize(tileSize, tileSize);
            }
        }
    }
}
function create() {
    //colocando textura no mapa
    texturaMapa(this, caminhoMapa);
    //criando variacao grafica da linha
    var graphics = this.add.graphics();
    path = gerarMapa(this, caminhoMapa);

    drawGrid(graphics); // -- desenhar grade

    //estilo da linha

    // graphics.lineStyle(3, 0x00ff00, 1);
    // path.draw(graphics);

    //criar inimigo

    this.anims.create({
        key: 'mob_normal_walk',
        frames: [
            { key: 'mobs', frame: 'sprite1' },
            { key: 'mobs', frame: 'sprite2' },
            { key: 'mobs', frame: 'sprite3' },
            { key: 'mobs', frame: 'sprite4' }
        ],
        frameRate: 8,
        repeat: -1
    });
    this.anims.create({
        key: 'mob_fast_walk',
        frames: [
            { key: 'mobs', frame: 'sprite5' },
            { key: 'mobs', frame: 'sprite6' }
        ],
        frameRate: 12,
        repeat: -1
    });
    this.anims.create({
        key: 'mob_tank_walk',
        frames: [
            { key: 'mobs', frame: 'sprite10' },
            { key: 'mobs', frame: 'sprite11' }
        ],
        frameRate: 6,
        repeat: -1
    });
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
    this.input.on('pointerdown', upgradeTurret);
}
function damageEnemy(enemy, bullet) {
    if (enemy.active && bullet.active) {
        bullet.setActive(false); // -- desativar bala
        bullet.setVisible(false); // -- esconder bala
        enemy.receiveDamage(bullet.damage); // -- inimigo recebe dano
        console.log('Inimigo atingido! HP restante:', enemy.hp);
    }
}

function drawGrid(graphics) {
    graphics.lineStyle(1, 0x00ff00, 0.2);
    for (var i = 0; i <= mapRows; i++) {
        graphics.moveTo(0, i * tileSize);
        graphics.lineTo(mapCols * tileSize, i * tileSize);
    }
    for (var j = 0; j <= mapCols; j++) {
        graphics.moveTo(j * tileSize, 0);
        graphics.lineTo(j * tileSize, mapRows * tileSize);
    }
    graphics.strokePath();
}

function update(time, delta) {
    if (time > this.nextEnemy) {
        var enemy = enemies.get();
        if (enemy) {
            enemy.setActive(true);
            enemy.setVisible(true);
            // Sorteia tipo de inimigo
            let tipos = ['normal', 'fast', 'tank'];
            let tipo = Phaser.Utils.Array.GetRandom(tipos);
            enemy.startOnPath(path, tipo);
            this.nextEnemy = time + Phaser.Math.Between(1000, 2000);
        }
    }
}

function canPlaceTurret(i, j) {
    return caminhoMapa[i][j] === 0 && map[i][j] === 0; // -- verificar se a posicao esta livre
}
function placeTurret(pointer) {
    var i = Math.floor(pointer.y / 64);
    var j = Math.floor(pointer.x / 64);
    if (canPlaceTurret(i, j)) {
        var turret = turrets.get();
        if (turret) {
            turret.setActive(true);
            turret.setVisible(true);
            turret.place(i, j, selectedTurretType); // Passe o tipo selecionado
        }
    } else {
        console.log('Posicao ocupada');
    }
}
function addBullet(x, y, angle, damage) {
    var bullet = bullets.get();
    if (bullet) {
        bullet.fire(x, y, angle, damage); // -- disparar bala
    }
}
function upgradeTurret(pointer) {
    if (pointer.rightButtonDown()) {
        var i = Math.floor(pointer.y / 64);
        var j = Math.floor(pointer.x / 64);
        var turretsArr = turrets.getChildren();
        for (let t of turretsArr) {
            if (t.active && Math.floor(t.x / 64) === j && Math.floor(t.y / 64) === i) {
                t.upgrade();
                break;
            }
        }
    }
}

window.preload = preload;
window.create = create;
window.update = update;