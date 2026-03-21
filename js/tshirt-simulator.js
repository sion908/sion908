// 定数定義
const CONFIG = {
    DEBUG_MODE: false, // 本番環境ではfalseに設定
    CROP_CANVAS_MAX_SIZE: 400,
    CROP_SCALE_MIN: 50,
    CROP_SCALE_MAX: 200,
    CROP_SCALE_DEFAULT: 100,
    CAMERA_SENSITIVITY: 1000,
    CAMERA_WHEEL_PRECISION: 50,
    CAMERA_RADIUS_MIN: 3,
    CAMERA_RADIUS_MAX: 10,
    CAMERA_RADIUS_DEFAULT: 5,
    TSHIRT_SCALE: 0.05,
    TEXTURE_UV_SCALE: -1,
    MATERIAL_NAME_TSHIRT: 'Cotton_Heavy_Canvas_FRONT',
    VALID_TEXTURE_KEYS: ['front', 'back', 'left', 'right']
};

class TShirtSimulator {
    constructor() {
        this.canvas = document.getElementById('renderCanvas');
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = null;
        this.camera = null;
        this.tshirtMesh = null;
        this.currentColor = '#ffffff';
        
        // 個別マテリアル管理
        this.faceMaterials = {
            front: null,
            back: null,
            left: null,
            right: null
        };
        
        // Tシャツ本体の色変更用マテリアル
        this.tshirtColorMaterial = null;
        
        // メッシュとマテリアルのマッピング
        this.meshToMaterialMap = {};
        
        this.textureUrls = {
            front: null,
            back: null,
            left: null,
            right: null
        };
        
        this.wireframeMode = false;
        this.showMeshInfo = false;
        this.meshInfoElement = null;
        
        // 画像クロップ関連
        this.currentCropPosition = null;
        this.cropCanvas = null;
        this.cropContext = null;
        this.cropImage = null;
        this.cropScale = 1.0;
        
        // DOM要素キャッシュ
        this.domCache = {};
        
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
        this.camera.lowerRadiusLimit = CONFIG.CAMERA_RADIUS_MIN;
        this.camera.upperRadiusLimit = CONFIG.CAMERA_RADIUS_MAX;
        // beta制限: 完全に自由
        this.camera.lowerBetaLimit = 0;
        this.camera.upperBetaLimit = Math.PI/2;
        // alpha制限: X軸正方向から左90度まで
        // this.camera.lowerAlphaLimit = -Math.PI / 2;
        // this.camera.upperAlphaLimit = 0;
        // スワイプ感度を調整
        this.camera.angularSensibilityX = CONFIG.CAMERA_SENSITIVITY;
        this.camera.angularSensibilityY = CONFIG.CAMERA_SENSITIVITY;
        this.camera.wheelPrecision = CONFIG.CAMERA_WHEEL_PRECISION;
        this.camera.pinchPrecision = CONFIG.CAMERA_WHEEL_PRECISION;

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
        this.log("モデル読み込み開始...");
        
        BABYLON.SceneLoader.ImportMesh(
            "",
            "model/",
            "t-short.glb",
            this.scene,
            (meshes, particleSystems, skeletons, animationGroups) => {
                this.log("読み込み完了 - メッシュ数:", meshes.length);
                this.log("読み込まれたオブジェクト:", meshes.map(m => ({
                    name: m.name,
                    type: m.constructor.name,
                    isMesh: m instanceof BABYLON.Mesh,
                    vertices: m.getTotalVertices ? m.getTotalVertices() : 'N/A',
                    material: m.material ? m.material.name : 'none',
                    materialId: m.material ? m.material.id : 'none'
                })));
                
                // マテリアル情報を詳細に出力
                const materials = new Set();
                const allMaterialIds = [];
                
                meshes.forEach(mesh => {
                    if (mesh.material) {
                        materials.add(mesh.material);
                        const materialId = mesh.material.id;
                        allMaterialIds.push(materialId);
                        
                        this.log(`メッシュ ${mesh.name} のマテリアル:`, {
                            name: mesh.material.name,
                            id: materialId,
                            type: mesh.material.constructor.name,
                            diffuseTexture: mesh.material.diffuseTexture ? mesh.material.diffuseTexture.name : 'none'
                        });
                        
                        // マテリアルマッピングを設定
                        if (materialId === 'front' || materialId === 'back' || 
                            materialId === 'left' || materialId === 'right') {
                            this.meshToMaterialMap[mesh.name] = materialId;
                            this.faceMaterials[materialId] = mesh.material;
                            this.log(`マテリアルマッピング: ${mesh.name} -> ${materialId}`);
                        }
                        
                        // Tシャツ本体の色変更用マテリアルを特定
                        if (materialId.includes(CONFIG.MATERIAL_NAME_TSHIRT)) {
                            this.tshirtColorMaterial = mesh.material;
                            this.log(`✅ Tシャツ色変更用マテリアルを設定: ${materialId}`);
                        }
                    }
                });
                
                this.log("総マテリアル数:", materials.size);
                this.log("全マテリアルID一覧:", allMaterialIds);
                this.log("マテリアルマッピング:", this.meshToMaterialMap);
                
                if (!this.tshirtColorMaterial) {
                    console.warn("⚠️ Tシャツ色変更用マテリアルが見つかりませんでした");
                    console.warn("利用可能なマテリアル:", allMaterialIds);
                }
                
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
                    this.log("単一メッシュを設定:", this.tshirtMesh.name);
                } else {
                    const parent = new BABYLON.TransformNode("tshirtParent", this.scene);
                    validMeshes.forEach((mesh, index) => {
                        mesh.parent = parent;
                        this.log(`メッシュ${index}を親に設定:`, mesh.name);
                    });
                    this.tshirtMesh = parent;
                    this.tshirtMesh._meshes = validMeshes;
                    this.log("親ノードを作成し、複数メッシュを管理");
                }
                
                this.setupTShirtTransform();
                this.initializeTransparentMaterials();
                this.loadImageCache();
                
                document.getElementById('loading').style.display = 'none';
                this.log("モデル読み込みと設定完了");
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
        this.tshirtMesh.scaling = new BABYLON.Vector3(CONFIG.TSHIRT_SCALE, CONFIG.TSHIRT_SCALE, CONFIG.TSHIRT_SCALE);
        this.tshirtMesh.rotation = new BABYLON.Vector3(Math.PI / 2, Math.PI / 2, 0); // Y軸180度回転で完全に正面を向く
        this.tshirtMesh.position = new BABYLON.Vector3(0, 0, 0); // 原点に配置
        
        // カメラは原点を中心に動く（設定済み）
        this.camera.setTarget(new BABYLON.Vector3(0, 0, 0));
        this.camera.radius = CONFIG.CAMERA_RADIUS_DEFAULT;
        
        // 各メッシュの可視性を確認
        const meshes = this.tshirtMesh._meshes || [this.tshirtMesh];
        meshes.forEach((mesh, index) => {
            mesh.isVisible = true;
            this.log(`メッシュ${index} 設定:`, {
                name: mesh.name,
                isVisible: mesh.isVisible,
                hasMaterial: !!mesh.material,
                vertices: mesh.getTotalVertices()
            });
        });
        
        this.log("Tシャツ位置調整完了:", {
            scaling: this.tshirtMesh.scaling,
            position: this.tshirtMesh.position,
            cameraTarget: this.camera.target,
            cameraRadius: this.camera.radius,
            cameraAlpha: this.camera.alpha,
            cameraBeta: this.camera.beta,
            meshCount: meshes.length
        });
    }


    initializeTransparentMaterials() {
        // 各面のマテリアルを透過状態に初期化
        Object.keys(this.faceMaterials).forEach(face => {
            const material = this.faceMaterials[face];
            if (material) {
                this.log(`${face}マテリアル初期化:`, {
                    name: material.name,
                    type: material.constructor.name,
                    isPBR: material instanceof BABYLON.PBRMaterial
                });
                
                if (material instanceof BABYLON.PBRMaterial) {
                    // PBRMaterialの場合
                    material.albedoColor = new BABYLON.Color3(1, 1, 1);
                    material.alpha = 0.0;
                    material.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
                    material.backFaceCulling = false;
                } else {
                    // StandardMaterialの場合
                    material.diffuseColor = new BABYLON.Color3(1, 1, 1);
                    material.alpha = 0.0;
                    material.specularColor = new BABYLON.Color3(0, 0, 0);
                    material.emissiveColor = new BABYLON.Color3(0, 0, 0);
                    material.backFaceCulling = false;
                    material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
                }
                
                this.log(`${face}マテリアルを透過状態に初期化完了 (alpha: ${material.alpha})`);
            }
        });
    }

    setFaceTexture(face, imageUrl) {
        const material = this.faceMaterials[face];
        if (!material) {
            console.error(`${face}マテリアルが見つかりません`);
            return;
        }

        this.log(`${face}マテリアル情報:`, {
            name: material.name,
            type: material.constructor.name,
            isPBR: material instanceof BABYLON.PBRMaterial,
            isStandard: material instanceof BABYLON.StandardMaterial
        });

        if (imageUrl) {
            // 古いテクスチャを破棄（メモリリーク防止）
            this.disposeTexture(material);
            
            // 画像を設定
            const texture = new BABYLON.Texture(imageUrl, this.scene, false);
            texture.hasAlpha = true;
            
            // 180度回転を修正（垂直反転 + 水平反転）
            texture.vScale = CONFIG.TEXTURE_UV_SCALE;
            texture.uScale = CONFIG.TEXTURE_UV_SCALE;
            
            // PBRMaterialとStandardMaterialで異なるプロパティを使用
            if (material instanceof BABYLON.PBRMaterial) {
                // PBRMaterialの場合
                material.albedoTexture = texture;
                material.opacityTexture = texture;
                material.alpha = 1.0;
                material.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
                this.log(`${face}面にPBRテクスチャを設定`);
            } else {
                // StandardMaterialの場合
                material.diffuseTexture = texture;
                material.opacityTexture = texture;
                material.alpha = 1.0;
                this.log(`${face}面にStandardテクスチャを設定`);
            }
            
            this.log(`${face}面テクスチャ設定完了:`, {
                textureUrl: imageUrl.substring(0, 50) + '...',
                alpha: material.alpha,
                hasTexture: !!(material.albedoTexture || material.diffuseTexture)
            });
        } else {
            // 透過に戻す
            if (material instanceof BABYLON.PBRMaterial) {
                material.albedoTexture = null;
                material.opacityTexture = null;
                material.alpha = 0.0;
            } else {
                material.diffuseTexture = null;
                material.opacityTexture = null;
                material.alpha = 0.0;
            }
            this.log(`${face}面を透過状態に戻す`);
        }
    }

    updateTextures(skipCache = false) {
        if (!this.tshirtMesh) return;
        
        this.log("テクスチャ更新開始:", this.textureUrls);
        
        // 画像キャッシュを保存（スキップフラグがない場合のみ）
        if (!skipCache) {
            this.saveImageCache();
        }
        
        // 各面のテクスチャを更新
        CONFIG.VALID_TEXTURE_KEYS.forEach(face => {
            this.setFaceTexture(face, this.textureUrls[face]);
        });
        
        this.updateMeshInfo();
        this.log("テクスチャ更新完了");
    }

    loadImageCache() {
        try {
            const cached = localStorage.getItem('tshirtImageCache');
            if (cached) {
                const cacheData = JSON.parse(cached);
                const validKeys = CONFIG.VALID_TEXTURE_KEYS;
                
                // 有効なキーのみをフィルタリング
                if (cacheData.textureUrls) {
                    Object.keys(cacheData.textureUrls).forEach(key => {
                        if (validKeys.includes(key) && cacheData.textureUrls[key]) {
                            this.textureUrls[key] = cacheData.textureUrls[key];
                        }
                    });
                }
                
                this.log("画像キャッシュを読み込み:", this.textureUrls);
                // キャッシュされた画像を適用（キャッシュ保存はスキップ）
                this.updateTextures(true);
            }
        } catch (error) {
            console.error("画像キャッシュ読み込みエラー:", error);
        }
    }

    saveImageCache() {
        try {
            const cacheData = {
                textureUrls: this.textureUrls,
                timestamp: Date.now()
            };
            localStorage.setItem('tshirtImageCache', JSON.stringify(cacheData));
            this.log("画像キャッシュを保存:", this.textureUrls);
        } catch (error) {
            console.error("画像キャッシュ保存エラー:", error);
        }
    }

    changeColor(color) {
        this.currentColor = color;
        
        // Tシャツ本体の色を変更（Material109373.006）
        if (this.tshirtColorMaterial) {
            const color3 = BABYLON.Color3.FromHexString(color);
            
            if (this.tshirtColorMaterial instanceof BABYLON.PBRMaterial) {
                // PBRMaterialの場合
                this.tshirtColorMaterial.albedoColor = color3;
                this.log(`Tシャツ本体のPBR色を変更:`, color);
            } else {
                // StandardMaterialの場合
                this.tshirtColorMaterial.diffuseColor = color3;
                this.log(`Tシャツ本体のStandard色を変更:`, color);
            }
            
            this.log("Tシャツ色変更完了:", color);
        } else {
            console.warn("Tシャツ色変更用マテリアルが見つかりません");
        }
    }

    openCropModal(file, position) {
        this.currentCropPosition = position;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.cropImage = img;
                this.cropScale = 1.0;
                this.setupCropCanvas();
                document.getElementById('cropModal').style.display = 'flex';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    setupCropCanvas() {
        this.cropCanvas = document.getElementById('cropCanvas');
        this.cropContext = this.cropCanvas.getContext('2d');
        
        // 正方形のキャンバスサイズを設定
        const maxSize = CONFIG.CROP_CANVAS_MAX_SIZE;
        const size = Math.min(this.cropImage.width, this.cropImage.height, maxSize);
        this.cropCanvas.width = size;
        this.cropCanvas.height = size;
        
        this.drawCropPreview();
    }
    
    drawCropPreview() {
        const ctx = this.cropContext;
        const canvas = this.cropCanvas;
        
        // キャンバスをクリア
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 画像を中央に配置してスケール適用
        const scaledWidth = this.cropImage.width * this.cropScale;
        const scaledHeight = this.cropImage.height * this.cropScale;
        
        // 正方形にクロップ（中央部分を取得）
        const cropSize = Math.min(scaledWidth, scaledHeight);
        const sx = (scaledWidth - cropSize) / 2;
        const sy = (scaledHeight - cropSize) / 2;
        
        // 画像を描画
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(this.cropScale, this.cropScale);
        ctx.translate(-this.cropImage.width / 2, -this.cropImage.height / 2);
        ctx.drawImage(this.cropImage, 0, 0);
        ctx.restore();
        
        // クロップ範囲を示す枠を描画
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
    }
    
    confirmCrop() {
        // 正方形にクロップした画像をデータURLとして取得
        const croppedDataUrl = this.cropCanvas.toDataURL('image/png');
        
        this.textureUrls[this.currentCropPosition] = croppedDataUrl;
        this.updateTextures();
        
        this.closeCropModal();
        
        return croppedDataUrl;
    }
    
    closeCropModal() {
        this.getElement('cropModal').style.display = 'none';
        this.currentCropPosition = null;
        this.cropImage = null;
        this.cropCanvas = null;
        this.cropContext = null;
    }
    
    loadImage(file, position) {
        // クロップモーダルを開く
        this.openCropModal(file, position);
        return Promise.resolve();
    }

    reset() {
        this.textureUrls = {
            front: null,
            back: null,
            left: null,
            right: null
        };
        
        // 全ての面を透過状態に戻す
        Object.keys(this.faceMaterials).forEach(face => {
            this.setFaceTexture(face, null);
        });
        
        this.currentColor = '#ffffff';
        this.changeColor('#ffffff');
        
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector('.color-option[data-color="#ffffff"]').classList.add('active');
        
        document.getElementById('frontImage').value = '';
        document.getElementById('backImage').value = '';
        document.getElementById('leftImage').value = '';
        document.getElementById('rightImage').value = '';
        
        document.querySelectorAll('.preview-image').forEach(preview => {
            preview.classList.remove('show');
            preview.src = '';
        });
        
        document.getElementById('useSameImage').checked = true;
        this.toggleImageSections(true);
    }

    toggleImageSections(useSame) {
        const backSection = document.getElementById('backSection');
        const leftSection = document.getElementById('leftSection');
        const rightSection = document.getElementById('rightSection');
        
        if (useSame) {
            backSection.style.opacity = '0.5';
            backSection.style.pointerEvents = 'none';
            leftSection.style.opacity = '0.5';
            leftSection.style.pointerEvents = 'none';
            rightSection.style.opacity = '0.5';
            rightSection.style.pointerEvents = 'none';
        } else {
            backSection.style.opacity = '1';
            backSection.style.pointerEvents = 'auto';
            leftSection.style.opacity = '1';
            leftSection.style.pointerEvents = 'auto';
            rightSection.style.opacity = '1';
            rightSection.style.pointerEvents = 'auto';
        }
    }

    toggleWireframe(enabled) {
        this.wireframeMode = enabled;
        // 各面のマテリアルにワイヤーフレームを適用
        Object.values(this.faceMaterials).forEach(material => {
            if (material) {
                material.wireframe = enabled;
            }
        });
        
        this.log("ワイヤーフレームモード:", enabled ? "ON" : "OFF");
        this.updateMeshInfo();
    }

    toggleMeshInfo(enabled) {
        this.showMeshInfo = enabled;
        if (enabled) {
            this.createMeshInfoDisplay();
        } else {
            this.removeMeshInfoDisplay();
        }
        this.updateMeshInfo();
    }

    createMeshInfoDisplay() {
        if (this.meshInfoElement) return;
        
        this.meshInfoElement = document.createElement('div');
        this.meshInfoElement.id = 'meshInfo';
        this.meshInfoElement.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            max-width: 300px;
            z-index: 1000;
        `;
        
        document.querySelector('.canvas-container').appendChild(this.meshInfoElement);
    }

    removeMeshInfoDisplay() {
        if (this.meshInfoElement) {
            this.meshInfoElement.remove();
            this.meshInfoElement = null;
        }
    }

    updateMeshInfo() {
        if (!this.showMeshInfo || !this.meshInfoElement) return;
        
        let info = '<h4>メッシュ情報</h4>';
        
        // Tシャツメッシュ情報
        if (this.tshirtMesh) {
            const meshes = this.tshirtMesh._meshes || [this.tshirtMesh];
            info += '<h5>Tシャツ:</h5>';
            meshes.forEach((mesh, index) => {
                info += `メッシュ${index}: ${mesh.name}<br>`;
                info += `頂点数: ${mesh.getTotalVertices()}<br>`;
                info += `ワイヤーフレーム: ${this.wireframeMode ? 'ON' : 'OFF'}<br>`;
            });
        }
        
        // マテリアル情報
        info += '<h5>マテリアル:</h5>';
        Object.keys(this.faceMaterials).forEach(face => {
            const material = this.faceMaterials[face];
            if (material) {
                info += `${face}: 存在<br>`;
                info += `テクスチャ: ${material.diffuseTexture ? 'あり' : 'なし'}<br>`;
                info += `透明度: ${material.alpha}<br>`;
            } else {
                info += `${face}: なし<br>`;
            }
        });
        
        this.meshInfoElement.innerHTML = info;
    }

    // ヘルパーメソッド：開発モード時のみログ出力
    log(...args) {
        if (CONFIG.DEBUG_MODE) {
            console.log(...args);
        }
    }
    
    // ヘルパーメソッド：DOM要素取得（キャッシング）
    getElement(id) {
        if (!this.domCache[id]) {
            this.domCache[id] = document.getElementById(id);
        }
        return this.domCache[id];
    }
    
    // ヘルパーメソッド：古いテクスチャの破棄
    disposeTexture(material) {
        if (material instanceof BABYLON.PBRMaterial) {
            if (material.albedoTexture) {
                material.albedoTexture.dispose();
            }
            if (material.opacityTexture && material.opacityTexture !== material.albedoTexture) {
                material.opacityTexture.dispose();
            }
        } else {
            if (material.diffuseTexture) {
                material.diffuseTexture.dispose();
            }
            if (material.opacityTexture && material.opacityTexture !== material.diffuseTexture) {
                material.opacityTexture.dispose();
            }
        }
    }

    setupEventListeners() {
        // 色選択
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                e.target.classList.add('active');
                this.changeColor(e.target.dataset.color);
            });
        });

        // 画像アップロード
        const useSameCheckbox = document.getElementById('useSameImage');
        if (useSameCheckbox) {
            useSameCheckbox.addEventListener('change', (e) => {
                this.toggleImageSections(e.target.checked);
                
                if (e.target.checked && this.textureUrls.front) {
                    this.textureUrls.back = this.textureUrls.front;
                    this.textureUrls.left = this.textureUrls.front;
                    this.textureUrls.right = this.textureUrls.front;
                    this.updateTextures();
                }
            });
        }
        
        const useSameSideCheckbox = document.getElementById('useSameSideImage');
        if (useSameSideCheckbox) {
            useSameSideCheckbox.addEventListener('change', (e) => {
                const rightSection = document.getElementById('rightSection');
                if (e.target.checked) {
                    rightSection.style.opacity = '0.5';
                    rightSection.style.pointerEvents = 'none';
                    
                    // leftの画像をrightにコピー
                    if (this.textureUrls.left) {
                        this.textureUrls.right = this.textureUrls.left;
                        this.updateTextures();
                    }
                } else {
                    rightSection.style.opacity = '1';
                    rightSection.style.pointerEvents = 'auto';
                }
            });
        }

        const frontImageInput = document.getElementById('frontImage');
        if (frontImageInput) {
            frontImageInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    await this.loadImage(e.target.files[0], 'front');
                }
            });
        }

        const backImageInput = document.getElementById('backImage');
        if (backImageInput) {
            backImageInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    await this.loadImage(e.target.files[0], 'back');
                }
            });
        }

        const leftImageInput = document.getElementById('leftImage');
        if (leftImageInput) {
            leftImageInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    await this.loadImage(e.target.files[0], 'left');
                }
            });
        }

        const rightImageInput = document.getElementById('rightImage');
        if (rightImageInput) {
            rightImageInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    await this.loadImage(e.target.files[0], 'right');
                }
            });
        }
        
        // クロップモーダルのイベントリスナー
        const cropScale = document.getElementById('cropScale');
        if (cropScale) {
            cropScale.addEventListener('input', (e) => {
                this.cropScale = e.target.value / 100;
                document.getElementById('cropSize').textContent = e.target.value + '%';
                this.drawCropPreview();
            });
        }
        
        const cropConfirm = document.getElementById('cropConfirm');
        if (cropConfirm) {
            cropConfirm.addEventListener('click', () => {
                const dataUrl = this.confirmCrop();
                const position = this.currentCropPosition;
                
                // プレビューを更新
                const preview = document.getElementById(position + 'Preview');
                if (preview) {
                    preview.src = dataUrl;
                    preview.classList.add('show');
                }
                
                // useSameImageがチェックされている場合、全面に適用
                const useSameCheckbox = document.getElementById('useSameImage');
                if (useSameCheckbox && useSameCheckbox.checked && position === 'front') {
                    this.textureUrls.back = dataUrl;
                    this.textureUrls.left = dataUrl;
                    this.textureUrls.right = dataUrl;
                    this.updateTextures();
                }
                
                // useSameSideImageがチェックされている場合、左右に適用
                const useSameSideCheckbox = document.getElementById('useSameSideImage');
                if (useSameSideCheckbox && useSameSideCheckbox.checked && position === 'left') {
                    this.textureUrls.right = dataUrl;
                    this.updateTextures();
                }
            });
        }
        
        const cropCancel = document.getElementById('cropCancel');
        if (cropCancel) {
            cropCancel.addEventListener('click', () => {
                this.closeCropModal();
            });
        }

        // ボタン
        const resetButton = document.getElementById('resetButton');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.reset();
            });
        }

        // ワイヤーフレーム
        const wireframeMode = document.getElementById('wireframeMode');
        if (wireframeMode) {
            wireframeMode.addEventListener('change', (e) => {
                this.toggleWireframe(e.target.checked);
            });
        }

        const showMeshInfo = document.getElementById('showMeshInfo');
        if (showMeshInfo) {
            showMeshInfo.addEventListener('change', (e) => {
                this.toggleMeshInfo(e.target.checked);
            });
        }

        this.toggleImageSections(true);
        
        // 初期状態でrightセクションを無効化
        const rightSection = document.getElementById('rightSection');
        if (rightSection) {
            rightSection.style.opacity = '0.5';
            rightSection.style.pointerEvents = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TShirtSimulator();
});
