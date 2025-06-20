
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
var game = new Phaser.Game(config);
var graphics;
var path;
var enemies;
var turrets;
var bullets;
var ENEMY_SPEED = 0.5 / 10000; // velocidade do inimigo
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
    basic: { range: 100, damage: 50, fireRate: 1000, sprite: 'turret' },
    sniper: { range: 200, damage: 150, fireRate: 2000, sprite: 'turret' },
    rapid: { range: 80, damage: 20, fireRate: 300, sprite: 'turret' }
};


var selectedTurretType = 'basic';

function selectTurret(type) {
    selectedTurretType = type;
    console.log('Tipo de torre selecionado:', type);
} window.selectTurret = selectTurret;

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
            this.nextTick = 0;
            this.type = 'basic'; // tipo padrão
            this.range = TURRET_TYPES.basic.range;
            this.damage = TURRET_TYPES.basic.damage;
            this.fireRate = TURRET_TYPES.basic.fireRate;
        },
    setType: function (type) {
        this.type = type;
        this.range = TURRET_TYPES[type].range;
        this.damage = TURRET_TYPES[type].damage;
        this.fireRate = TURRET_TYPES[type].fireRate;
        this.setTexture('sprites', TURRET_TYPES[type].sprite);
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
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,], 
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,], 
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
];
function gerarMapa(scene, caminhoMapa) {
    // Encontrar o ponto inicial (primeiro 1 na primeira coluna)
    let start = null;
    for (let i = 0; i < caminhoMapa.length; i++) {
        for (let j = 0; j < caminhoMapa[i].length; j++) {
            if (caminhoMapa[i][j] === 1) {
                start = {i, j};
                break;
            }
        }
        if (start) break;
    }

    // Busca sequencial pelo caminho (DFS simples)
    let visited = Array.from({length: caminhoMapa.length}, () => Array(caminhoMapa[0].length).fill(false));
    let pathPoints = [];
    function dfs(i, j) {
        if (
            i < 0 || i >= caminhoMapa.length ||
            j < 0 || j >= caminhoMapa[0].length ||
            caminhoMapa[i][j] !== 1 ||
            visited[i][j]
        ) return;
        visited[i][j] = true;
        pathPoints.push({i, j});
        // Ordem: direita, baixo, esquerda, cima
        dfs(i, j+1);
        dfs(i+1, j);
        dfs(i, j-1);
        dfs(i-1, j);
    }
    dfs(start.i, start.j);

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
function create() {
    //criando variacao grafica da linha
    var graphics = this.add.graphics();
    path = gerarMapa(this, caminhoMapa);

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
function addBullet(x, y, angle,damage) {
    var bullet = bullets.get();
    if (bullet) {
        bullet.fire(x, y, angle, damage); // -- disparar bala
    }
}