
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
var vidas = 3;
var vidasText;
var money = 2000;
var moneyText;
const UPGRADE_COST = 80; // custo fixo para upar (pode ser por tipo/nível se quiser)
const ENEMY_REWARD = 25;
var rangeCircle = null;
var graphics;
var path;
var enemies;
var turrets;
var bullets;
var mainScene = null;
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
    basic: { range: 100, damage: 50, fireRate: 600, preco: 100, sprite: 'basic' },
    sniper: { range: 200, damage: 150, fireRate: 1000, preco: 100, sprite: 'sniper' },
    rapid: { range: 80, damage: 20, fireRate: 300, preco: 100, sprite: 'rapid' }
};
const ENEMY_TYPES = {
    normal: { hp: 100, speed: 0.6, sprite: 'sprite1' },
    fast: { hp: 50, speed: 1, sprite: 'sprite5' },
    tank: { hp: 300, speed: 0.3, sprite: 'sprite10' }
};

var selectedTurretType = null;

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
    this.load.audio('gameover', 'assets/usteve.ogg');
    this.load.audio('levelup', 'assets/levelup.mp3');
    this.load.audio('spawn_sniper', 'assets/spawn_sniper.mp3');
    this.load.audio('spawn_fast', 'assets/spawn_fast.mp3');
    this.load.audio('spawn_soldier', 'assets/spawn_soldier.mp3');
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
            // Perde uma vida
            vidas--;
            this.scene.sound.play('gameover');
            updateVidasText();
            if (vidas <= 0) {
                // Fim de jogo

                alert('Game Over!');
                location.reload(); // reinicia o jogo (ou faça algo melhor se quiser)
            }
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
        
        if (this.level > 4) {
            alert('Torre já está no nível máximo!');
            return;
        }
        this.level++;
        this.scene.sound.play('levelup');
        if (this.type === 'sniper') {
            this.damage = Math.round(this.damage * 1.5);
            this.range = Math.round(this.range * 1.5);
            this.fireRate = Math.round(this.fireRate * 1.2);
        }else if (this.type === 'rapid') {
            this.damage = Math.round(this.damage * 1.2);
            this.range = Math.round(this.range * 1.1);
            this.fireRate = Math.round(this.fireRate * 0.8);
        }
        else {
            this.damage = Math.round(this.damage * 1.5);
            this.range = Math.round(this.range * 1.4);
            this.fireRate = Math.round(this.fireRate * 0.8);
        }

        console.log('Torre upada para o nível', this.level);
    },
    place: function (i, j, type = 'basic') {
        this.y = i * 64 + 32;
        this.x = j * 64 + 32;
        map[i][j] = 1;
        this.setType(type);
        this.setInteractive();
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
            this.speed = Phaser.Math.GetSpeed(1500, 1); // -- velocidade do tiro

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
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0,],
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
    mainScene = this; // -- salvar referencia da cena principal
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
            { key: 'mobs', frame: 'sprite4' },
            // { key: 'mobs', frame: 'sprite2' },
            // { key: 'mobs', frame: 'sprite3' },
            // { key: 'mobs', frame: 'sprite4' },
        ],
        frameRate: 8,
        repeat: -1
    });
    this.anims.create({
        key: 'mob_fast_walk',
        frames: [
            { key: 'mobs', frame: 'sprite12' },
            // { key: 'mobs', frame: 'sprite5' }
        ],
        frameRate: 12,
        repeat: -1
    });
    this.anims.create({
        key: 'mob_tank_walk',
        frames: [
            { key: 'mobs', frame: 'sprite1' },
            // { key: 'mobs', frame: 'sprite10' }
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
    // this.input.on('pointerdown', upgradeTurret);

    //hud da vida e dinheiro
    vidasText = this.add.text(16, 56, 'Vidas: ' + vidas, {
        fontSize: '32px',
        fill: '#fff',
        backgroundColor: 'red',
        padding: { x: 10, y: 5 }
    });
    vidasText.setScrollFactor(0);
    moneyText = this.add.text(16, 16, 'Dinheiro: $' + money, {
        fontSize: '32px',
        fill: '#fff',
        backgroundColor: 'green',
        padding: { x: 10, y: 5 }
    });
    moneyText.setScrollFactor(0);

    // -- adicionar torres
    this.input.on('gameobjectdown', function (pointer, gameObject) {
        if (gameObject instanceof Turret) {
            AbrirHudTorre(gameObject);
            showRangeCircle(this, gameObject);
        }
    }, this);
    turrets.children.iterate(function (turret) {
        turret.setInteractive();
    });

}
function damageEnemy(enemy, bullet) {
    if (enemy.active && bullet.active) {
        bullet.setActive(false); // -- desativar bala
        bullet.setVisible(false); // -- esconder bala
        enemy.receiveDamage(bullet.damage); // -- inimigo recebe dano
        if (enemy.hp <= 0) {
            money += ENEMY_REWARD;
            updateMoneyText();
        }
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
            enemy.setScale(3); 
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
    if (!selectedTurretType) {
        // alert('Selecione o tipo de torre antes de colocar!');
        return;
    }
    if (money < TURRET_TYPES[selectedTurretType].preco) {
        alert('Dinheiro insuficiente!');
        return;
    }
    var i = Math.floor(pointer.y / 64);
    var j = Math.floor(pointer.x / 64);
    if (canPlaceTurret(i, j)) {
        var turret = turrets.get();
        if (turret) {
            console.log(selectedTurretType)

            if(selectedTurretType == "sniper"){
                this.scene.sound.play('spawn_sniper');
            }else if(selectedTurretType == "rapid"){
                this.scene.sound.play('spawn_fast');
            }else{
                 this.scene.sound.play('spawn_soldier');
            }
            turret.setActive(true);
            turret.setVisible(true);
            turret.place(i, j, selectedTurretType); // Passe o tipo selecionado
            money -= TURRET_TYPES[selectedTurretType].preco;
            updateMoneyText();
            selectedTurretType = null;
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

var selectedTurret = null;

function AbrirHudTorre(turret) {
    selectedTurret = turret;
    document.getElementById('turret-info').style.display = 'block';
    document.getElementById('turret-type').innerText = turret.type.toUpperCase();
    document.getElementById('turret-level').innerText = 'Nível: ' + turret.level;
    document.getElementById('turret-range').innerText = turret.range;
    document.getElementById('turret-damage').innerText = turret.damage;
    document.getElementById('turret-speed').innerText = (1000 / turret.fireRate).toFixed(2) + '/s';
    document.getElementById('upgrade-cost').innerText = 'Custo do Upgrade: $' + UPGRADE_COST;
}

function FecharHudTorre() {
    document.getElementById('turret-info').style.display = 'none';
    selectedTurret = null;
}

document.getElementById('close-turret-info').onclick = function () {
    FecharHudTorre();
    hideRangeCircle();
};

document.getElementById('upgrade-btn').onclick = function () {
    if (selectedTurret) {
        if (money < UPGRADE_COST) {
            alert('Dinheiro insuficiente para upgrade!');
            return;
        }
        money -= UPGRADE_COST;
        selectedTurret.upgrade();
        updateMoneyText();
        AbrirHudTorre(selectedTurret); // Atualiza painel
        showRangeCircle(mainScene, selectedTurret);
    }
};
function showRangeCircle(scene, turret) {
    if (rangeCircle) rangeCircle.destroy();
    rangeCircle = scene.add.graphics({ x: turret.x, y: turret.y });
    rangeCircle.fillStyle(0x5fccff, 0.2);
    rangeCircle.lineStyle(3, 0x5fccff, 0.8);
    rangeCircle.fillCircle(0, 0, turret.range);
    rangeCircle.strokeCircle(0, 0, turret.range);
    rangeCircle.setDepth(1000); // garantir que fique acima dos sprites
}
function hideRangeCircle() {
    if (rangeCircle) {
        rangeCircle.destroy();
        rangeCircle = null;
    }
}
function updateMoneyText() {
    if (moneyText) moneyText.setText('Dinheiro: $' + money);
}
function updateVidasText() {
    if (vidasText) vidasText.setText('Vidas: ' + vidas);
}

window.preload = preload;
window.create = create;
window.update = update;