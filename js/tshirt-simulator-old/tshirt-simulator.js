class TShirtSimulator {
    constructor() {
        this.canvas = document.getElementById('renderCanvas');
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = null;
        this.camera = null;
        this.tshirtMesh = null;
        this.tshirtMaterial = null;
        this.currentColor = '#ffffff';
        
        this.decals = {
            front: null,
            back: null,
            leftSleeve: null,
            rightSleeve: null
        };
        
        this.textureUrls = {
            front: null,
            back: null,
            sleeve: null
        };
        
        this.wireframeMode = false;
        
        // 画像キャッシュをlocalStorageから読み込み
        this.loadImageCache();
        
        this.init();
        this.setupEventListeners();
    }

    init() {
        this.createScene();
        this.createTShirt();
        
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }

    createScene() {
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(0.9, 0.9, 0.92, 1);

        this.camera = new BABYLON.ArcRotateCamera(
            'camera',
            0,  // X軸正方向（正面）から
            Math.PI / 2,  // Y軸正方向（上）から
            5,
            new BABYLON.Vector3(0, 0, 0),  // 原点を中心
            this.scene
        );
        this.camera.attachControl(this.canvas, true);
        this.camera.lowerRadiusLimit = 3;
        this.camera.upperRadiusLimit = 10;
        // beta制限: 完全に自由
        this.camera.lowerBetaLimit = 0;
        this.camera.upperBetaLimit = Math.PI/2;
        // alpha制限: X軸正方向から左90度まで
        // this.camera.lowerAlphaLimit = -Math.PI / 2;
        // this.camera.upperAlphaLimit = 0;
        // スワイプ感度を調整
        this.camera.angularSensibilityX = 1000;
        this.camera.angularSensibilityY = 1000;
        this.camera.wheelPrecision = 50;
        this.camera.pinchPrecision = 50;

        const ambientLight = new BABYLON.HemisphericLight(
            'ambientLight',
            new BABYLON.Vector3(0, 1, 0),
            this.scene
        );
        ambientLight.intensity = 0.6;
        ambientLight.diffuse = new BABYLON.Color3(0.9, 0.9, 0.95);
        ambientLight.groundColor = new BABYLON.Color3(0.4, 0.4, 0.45);

        const mainLight = new BABYLON.DirectionalLight(
            'mainLight',
            new BABYLON.Vector3(-0.5, -1, -0.5),
            this.scene
        );
        mainLight.position = new BABYLON.Vector3(3, 5, 3);
        mainLight.intensity = 0.5;

        const fillLight = new BABYLON.DirectionalLight(
            'fillLight',
            new BABYLON.Vector3(0.5, -1, 0.5),
            this.scene
        );
        fillLight.position = new BABYLON.Vector3(-3, 4, -2);
        fillLight.intensity = 0.2;

        const backLight = new BABYLON.PointLight(
            'backLight',
            new BABYLON.Vector3(0, 2, -3),
            this.scene
        );
        backLight.intensity = 0.3;
        backLight.diffuse = new BABYLON.Color3(0.8, 0.8, 0.85);
    }

    createTShirt() {
        console.log("モデル読み込み開始...");
        
        BABYLON.SceneLoader.ImportMesh(
            "",
            "model/",
            "T-Shirt.glb",
            this.scene,
            (meshes, particleSystems, skeletons, animationGroups) => {
                console.log("読み込み完了 - メッシュ数:", meshes.length);
                console.log("読み込まれたオブジェクト:", meshes.map(m => ({
                    name: m.name,
                    type: m.constructor.name,
                    isMesh: m instanceof BABYLON.Mesh,
                    vertices: m.getTotalVertices ? m.getTotalVertices() : 'N/A'
                })));
                
                if (!meshes || meshes.length === 0) {
                    console.error("メッシュが見つかりませんでした");
                    document.getElementById('loading').textContent = 'モデルにメッシュが含まれていません';
                    return;
                }
                
                const validMeshes = meshes.filter(m => m instanceof BABYLON.Mesh && m.getTotalVertices() > 0);
                console.log("有効なメッシュ数:", validMeshes.length);
                
                if (validMeshes.length === 0) {
                    console.error("有効なメッシュが見つかりませんでした");
                    document.getElementById('loading').textContent = '有効なメッシュが見つかりません';
                    return;
                }
                
                if (validMeshes.length === 1) {
                    this.tshirtMesh = validMeshes[0];
                    console.log("単一メッシュを設定:", this.tshirtMesh.name);
                } else {
                    const parent = new BABYLON.TransformNode("tshirtParent", this.scene);
                    validMeshes.forEach((mesh, index) => {
                        mesh.parent = parent;
                        console.log(`メッシュ${index}を親に設定:`, mesh.name);
                    });
                    this.tshirtMesh = parent;
                    this.tshirtMesh._meshes = validMeshes;
                    console.log("親ノードを作成し、複数メッシュを管理");
                }
                
                this.applyMaterialToMeshes(validMeshes);
                this.setupTShirtTransform();
                
                document.getElementById('loading').style.display = 'none';
                console.log("モデル読み込みと設定完了");
            },
            null,
            (scene, message, exception) => {
                console.error("モデルの読み込みに失敗しました:", message, exception);
                document.getElementById('loading').textContent = 'モデルの読み込みに失敗: ' + message;
            }
        );
    }

    setupTShirtTransform() {
        // Tシャツのスケーリングと位置を調整
        this.tshirtMesh.scaling = new BABYLON.Vector3(0.05, 0.05, 0.05);
        this.tshirtMesh.rotation = new BABYLON.Vector3(Math.PI / 2, Math.PI / 2, 0); // Y軸180度回転で完全に正面を向く
        this.tshirtMesh.position = new BABYLON.Vector3(0, 0, 0); // 原点に配置
        
        // カメラは原点を中心に動く（設定済み）
        this.camera.setTarget(new BABYLON.Vector3(0, 0, 0));
        this.camera.radius = 5;
        
        // 各メッシュの可視性を確認
        const meshes = this.tshirtMesh._meshes || [this.tshirtMesh];
        meshes.forEach((mesh, index) => {
            mesh.isVisible = true;
            mesh.material = this.tshirtMaterial;
            console.log(`メッシュ${index} 設定:`, {
                name: mesh.name,
                isVisible: mesh.isVisible,
                hasMaterial: !!mesh.material,
                vertices: mesh.getTotalVertices()
            });
        });
        
        console.log("Tシャツ位置調整完了:", {
            scaling: this.tshirtMesh.scaling,
            position: this.tshirtMesh.position,
            cameraTarget: this.camera.target,
            cameraRadius: this.camera.radius,
            cameraAlpha: this.camera.alpha,
            cameraBeta: this.camera.beta,
            meshCount: meshes.length
        });
    }

    
    applyMaterialToMeshes(meshes) {
        this.tshirtMaterial = new BABYLON.StandardMaterial('tshirtMat', this.scene);
        this.tshirtMaterial.diffuseColor = BABYLON.Color3.FromHexString(this.currentColor);
        this.tshirtMaterial.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
        this.tshirtMaterial.specularPower = 32;
        this.tshirtMaterial.ambientColor = new BABYLON.Color3(0.3, 0.3, 0.35);
        this.tshirtMaterial.backFaceCulling = true;
        this.tshirtMaterial.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.02);
        this.tshirtMaterial.wireframe = this.wireframeMode;
        
        const allMeshes = this.tshirtMesh._meshes || [this.tshirtMesh];
        allMeshes.forEach((mesh, index) => {
            mesh.material = this.tshirtMaterial;
            mesh.isVisible = true;
            console.log(`メッシュ${index} (${mesh.name}) にマテリアル適用済み。isVisible: ${mesh.isVisible}`);
        });
        
        console.log("マテリアル設定完了 - 色:", this.currentColor, "ワイヤーフレーム:", this.wireframeMode);
    }

    createDecal(imageUrl, position, size) {
        if (!imageUrl || !this.tshirtMesh) return null;

        const decalMaterial = new BABYLON.StandardMaterial('decalMat_' + position, this.scene);
        const texture = new BABYLON.Texture(imageUrl, this.scene, false, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
        texture.hasAlpha = true;
        decalMaterial.diffuseTexture = texture;
        decalMaterial.diffuseTexture.uScale = 1.0;
        decalMaterial.diffuseTexture.vScale = 1.0;
        decalMaterial.backFaceCulling = false;
        decalMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        decalMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0);
        decalMaterial.wireframe = false;
        
        const meshes = this.tshirtMesh._meshes || [this.tshirtMesh];
        let minBounds = new BABYLON.Vector3(Infinity, Infinity, Infinity);
        let maxBounds = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
        
        meshes.forEach(mesh => {
            if (mesh.getBoundingInfo) {
                const bounds = mesh.getBoundingInfo().boundingBox;
                minBounds = BABYLON.Vector3.Minimize(minBounds, bounds.minimumWorld);
                maxBounds = BABYLON.Vector3.Maximize(maxBounds, bounds.maximumWorld);
            }
        });
        
        const meshHeight = maxBounds.y - minBounds.y;
        const meshWidth = maxBounds.x - minBounds.x;
        const meshDepth = maxBounds.z - minBounds.z;
        const centerY = (maxBounds.y + minBounds.y) / 2;
        
        let decalPosition, decalNormal;
        
        if (position === 'front') {
            // 正面：Tシャツ表面に密着
            decalPosition = new BABYLON.Vector3(0, centerY, maxBounds.z + 0.01);
            decalNormal = new BABYLON.Vector3(0, 0, 1);
        } else if (position === 'back') {
            // 背面：Tシャツ表面に密着
            decalPosition = new BABYLON.Vector3(0, centerY, minBounds.z - 0.01);
            decalNormal = new BABYLON.Vector3(0, 0, -1);
        } else if (position === 'leftSleeve') {
            // 左袖：Tシャツ表面に密着
            decalPosition = new BABYLON.Vector3(minBounds.x - 0.01, centerY, (maxBounds.z + minBounds.z) / 2);
            decalNormal = new BABYLON.Vector3(-1, 0, 0);
        } else if (position === 'rightSleeve') {
            // 右袖：Tシャツ表面に密着
            decalPosition = new BABYLON.Vector3(maxBounds.x + 0.01, centerY, (maxBounds.z + minBounds.z) / 2);
            decalNormal = new BABYLON.Vector3(1, 0, 0);
        }

        const decalSize = new BABYLON.Vector3(size.x, size.y, size.z);
        
        const targetMesh = meshes.find(m => m instanceof BABYLON.Mesh && m.getTotalVertices() > 0) || meshes[0];
        
        const decal = BABYLON.MeshBuilder.CreateDecal('decal_' + position, targetMesh, {
            position: decalPosition,
            normal: decalNormal,
            size: decalSize,
            angle: 0,
            localMode: true
        });

        decal.material = decalMaterial;
        
        return decal;
    }

    updateDecals() {
        if (!this.tshirtMesh) return;
        
        console.log("デカール更新開始:", this.textureUrls);
        
        // 画像キャッシュを保存
        this.saveImageCache();
        
        Object.keys(this.decals).forEach(key => {
            if (this.decals[key]) {
                this.decals[key].dispose();
                this.decals[key] = null;
            }
        });

        const meshes = this.tshirtMesh._meshes || [this.tshirtMesh];
        let minBounds = new BABYLON.Vector3(Infinity, Infinity, Infinity);
        let maxBounds = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
        
        meshes.forEach(mesh => {
            if (mesh.getBoundingInfo) {
                const bounds = mesh.getBoundingInfo().boundingBox;
                minBounds = BABYLON.Vector3.Minimize(minBounds, bounds.minimumWorld);
                maxBounds = BABYLON.Vector3.Maximize(maxBounds, bounds.maximumWorld);
            }
        });
        
        const meshHeight = maxBounds.y - minBounds.y;
        const meshWidth = maxBounds.x - minBounds.x;
        
        const frontBackSize = Math.min(meshHeight, meshWidth) * 0.35;  // 正面・背面を少し大きく
        const sleeveSize = frontBackSize * 0.6;                      // 袖を大きく

        console.log("デカールサイズ計算:", {meshHeight, meshWidth, frontBackSize, sleeveSize});

        if (this.textureUrls.front) {
            this.decals.front = this.createDecal(this.textureUrls.front, 'front', 
                new BABYLON.Vector3(frontBackSize, frontBackSize, 0.1));  // Zを小さく
            console.log("前面デカール作成完了");
        }

        if (this.textureUrls.back) {
            const backSize = frontBackSize * 0.7;  // 背面は小さく
            this.decals.back = this.createDecal(this.textureUrls.back, 'back', 
                new BABYLON.Vector3(backSize, backSize, 0.1));  // Zを小さく
            console.log("背面デカール作成完了");
        }

        if (this.textureUrls.sleeve) {
            this.decals.leftSleeve = this.createDecal(this.textureUrls.sleeve, 'leftSleeve', 
                new BABYLON.Vector3(sleeveSize, sleeveSize, 0.05));  // Zをさらに小さく
            this.decals.rightSleeve = this.createDecal(this.textureUrls.sleeve, 'rightSleeve', 
                new BABYLON.Vector3(sleeveSize, sleeveSize, 0.05));  // Zをさらに小さく
            console.log("袖デカール作成完了");
        }
        
        console.log("デカール更新完了");
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }

    loadImageCache() {
        try {
            const cached = localStorage.getItem('tshirtImageCache');
            if (cached) {
                const cacheData = JSON.parse(cached);
                this.textureUrls = cacheData.textureUrls || this.textureUrls;
                console.log("画像キャッシュを読み込み:", this.textureUrls);
            }
        } catch (error) {
            console.log("画像キャッシュ読み込みエラー:", error);
        }
    }

    saveImageCache() {
        try {
            const cacheData = {
                textureUrls: this.textureUrls,
                timestamp: Date.now()
            };
            localStorage.setItem('tshirtImageCache', JSON.stringify(cacheData));
            console.log("画像キャッシュを保存:", this.textureUrls);
        } catch (error) {
            console.log("画像キャッシュ保存エラー:", error);
        }
    }

    changeColor(color) {
        this.currentColor = color;
        if (this.tshirtMaterial) {
            this.tshirtMaterial.diffuseColor = BABYLON.Color3.FromHexString(color);
        } else if (this.tshirtMesh) {
            const meshes = this.tshirtMesh._meshes || [this.tshirtMesh];
            this.applyMaterialToMeshes(meshes);
        }
    }

    loadImage(file, position) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.textureUrls[position] = e.target.result;
                this.updateDecals();
                resolve(e.target.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    reset() {
        this.textureUrls = {
            front: null,
            back: null,
            sleeve: null
        };
        
        Object.keys(this.decals).forEach(key => {
            if (this.decals[key]) {
                this.decals[key].dispose();
                this.decals[key] = null;
            }
        });
        
        this.currentColor = '#ffffff';
        this.changeColor('#ffffff');
        
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector('.color-option[data-color="#ffffff"]').classList.add('active');
        
        document.getElementById('frontImage').value = '';
        document.getElementById('backImage').value = '';
        document.getElementById('sleeveImage').value = '';
        
        document.querySelectorAll('.preview-image').forEach(preview => {
            preview.classList.remove('show');
            preview.src = '';
        });
        
        document.getElementById('useSameImage').checked = true;
        this.toggleImageSections(true);
    }

    toggleImageSections(useSame) {
        const backSection = document.getElementById('backSection');
        const sleeveSection = document.getElementById('sleeveSection');
        
        if (useSame) {
            backSection.style.opacity = '0.5';
            backSection.style.pointerEvents = 'none';
            sleeveSection.style.opacity = '0.5';
            sleeveSection.style.pointerEvents = 'none';
        } else {
            backSection.style.opacity = '1';
            backSection.style.pointerEvents = 'auto';
            sleeveSection.style.opacity = '1';
            sleeveSection.style.pointerEvents = 'auto';
        }
    }

    toggleWireframe(enabled) {
        this.wireframeMode = enabled;
        if (this.tshirtMaterial) {
            this.tshirtMaterial.wireframe = enabled;
        }
        
        // デカールはワイヤーフレーム表示しない（テクスチャ表示を優先）
        Object.values(this.decals).forEach(decal => {
            if (decal && decal.material) {
                decal.material.wireframe = false;
                decal.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
            }
        });
        
        console.log("ワイヤーフレームモード:", enabled ? "ON" : "OFF");
    }

    setupEventListeners() {
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                e.target.classList.add('active');
                this.changeColor(e.target.dataset.color);
            });
        });

        const useSameCheckbox = document.getElementById('useSameImage');
        useSameCheckbox.addEventListener('change', (e) => {
            this.toggleImageSections(e.target.checked);
            
            if (e.target.checked && this.textureUrls.front) {
                this.textureUrls.back = this.textureUrls.front;
                this.textureUrls.sleeve = this.textureUrls.front;
                this.updateDecals();
            }
        });

        document.getElementById('frontImage').addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const preview = document.getElementById('frontPreview');
                const dataUrl = await this.loadImage(e.target.files[0], 'front');
                preview.src = dataUrl;
                preview.classList.add('show');
                
                if (useSameCheckbox.checked) {
                    this.textureUrls.back = this.textureUrls.front;
                    this.textureUrls.sleeve = this.textureUrls.front;
                    this.updateDecals();
                }
            }
        });

        document.getElementById('backImage').addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const preview = document.getElementById('backPreview');
                const dataUrl = await this.loadImage(e.target.files[0], 'back');
                preview.src = dataUrl;
                preview.classList.add('show');
            }
        });

        document.getElementById('sleeveImage').addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const preview = document.getElementById('sleevePreview');
                const dataUrl = await this.loadImage(e.target.files[0], 'sleeve');
                preview.src = dataUrl;
                preview.classList.add('show');
            }
        });

        document.getElementById('resetButton').addEventListener('click', () => {
            this.reset();
        });

        document.getElementById('wireframeMode').addEventListener('change', (e) => {
            this.toggleWireframe(e.target.checked);
        });

        this.toggleImageSections(true);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TShirtSimulator();
});
