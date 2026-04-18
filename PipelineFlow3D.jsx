import React, { useEffect, useMemo, useRef } from "https://esm.sh/react@18.2.0";
import * as THREE from "https://esm.sh/three@0.161.0";

const PIPE_COLOR = new THREE.Color("#7c3aed");
const PIPE_PULSE_COLOR = new THREE.Color("#ffffff");

const CIPHER_COLORS = {
  caesar: 0xf59e0b,
  xor: 0x3b82f6,
  vigenere: 0x10b981,
  railfence: 0xef4444,
  base64: 0x8b5cf6,
  reverse: 0xec4899
};

function createTextPlane(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const geometry = new THREE.PlaneGeometry(1.6, 0.4);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;

  return { mesh, texture, geometry, material };
}

function disposeObject(object) {
  if (!object) return;

  if (object.geometry) object.geometry.dispose();

  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => {
        if (material.map) material.map.dispose();
        material.dispose();
      });
    } else {
      if (object.material.map) object.material.map.dispose();
      object.material.dispose();
    }
  }
}

export default function PipelineFlow3D({ pipeline = [], isRunning = false, runResults = null }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const frameRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationStateRef = useRef({
    nodes: [],
    labels: [],
    tubes: [],
    packetGroups: [],
    curves: [],
    emptyOrb: null,
    group: null
  });
  const runningBoostUntilRef = useRef(0);

  const pipelineKey = useMemo(
    () => `${pipeline.length}:${pipeline.map((node) => node.cipherKey).join("|")}`,
    [pipeline]
  );

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(5, 5, 5);
    scene.add(directional);

    const centerLight = new THREE.PointLight(0x7c3aed, 1, 10);
    centerLight.position.set(0, 0, 1);
    scene.add(centerLight);

    const group = new THREE.Group();
    scene.add(group);
    animationStateRef.current.group = group;

    const resizeObserver = new ResizeObserver(() => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = Math.max(mountRef.current.clientWidth, 1);
      const h = Math.max(mountRef.current.clientHeight, 1);
      rendererRef.current.setSize(w, h);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    const onMouseMove = (event) => {
      const rect = container.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = (event.clientY - rect.top) / rect.height;
      mouseRef.current.x = (nx - 0.5) * 2;
      mouseRef.current.y = (ny - 0.5) * 2;
    };

    container.addEventListener("mousemove", onMouseMove);

    const animate = () => {
      const state = animationStateRef.current;
      const now = Date.now();
      const speed = now < runningBoostUntilRef.current ? 0.002 : 0.0003;
      const pulse = (Math.sin(now * 0.006) + 1) / 2;

      if (cameraRef.current) {
        const targetX = mouseRef.current.x * 0.3;
        const targetY = mouseRef.current.y * 0.1 + 0.5;
        cameraRef.current.position.x += (targetX - cameraRef.current.position.x) * 0.06;
        cameraRef.current.position.y += (targetY - cameraRef.current.position.y) * 0.06;
        cameraRef.current.lookAt(0, 0, 0);
      }

      if (state.emptyOrb) {
        const s = 1 + Math.sin(now * 0.003) * 0.08;
        state.emptyOrb.scale.set(s, s, s);
        state.emptyOrb.rotation.y += 0.008;
      }

      state.nodes.forEach((nodeMesh, index) => {
        nodeMesh.rotation.y += 0.01;
        nodeMesh.position.y = Math.sin(now * 0.001 + index * 0.5) * 0.1;

        const label = state.labels[index];
        if (label) {
          label.position.x = nodeMesh.position.x;
          label.position.y = nodeMesh.position.y + 0.9;
        }
      });

      state.curves.forEach((curve, lineIndex) => {
        const packetGroup = state.packetGroups[lineIndex];
        const tube = state.tubes[lineIndex];
        if (!packetGroup) return;

        packetGroup.forEach((packet, packetIndex) => {
          const t = (now * speed + lineIndex * 0.33 + packetIndex * 0.33) % 1;
          const point = curve.getPoint(t);
          packet.position.copy(point);
        });

        if (tube && tube.material && now < runningBoostUntilRef.current) {
          tube.material.color.copy(PIPE_COLOR).lerp(PIPE_PULSE_COLOR, pulse * 0.75);
        } else if (tube && tube.material) {
          tube.material.color.copy(PIPE_COLOR);
        }
      });

      if (rendererRef.current && cameraRef.current && sceneRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      container.removeEventListener("mousemove", onMouseMove);

      const state = animationStateRef.current;
      state.nodes.forEach(disposeObject);
      state.labels.forEach(disposeObject);
      state.tubes.forEach(disposeObject);
      state.packetGroups.forEach((groupItems) => groupItems.forEach(disposeObject));
      disposeObject(state.emptyOrb);

      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (isRunning || (runResults && runResults.length > 0)) {
      runningBoostUntilRef.current = Date.now() + 2000;
    }
  }, [isRunning, runResults]);

  useEffect(() => {
    const state = animationStateRef.current;
    const group = state.group;
    if (!group) return;

    state.nodes.forEach((mesh) => {
      group.remove(mesh);
      disposeObject(mesh);
    });
    state.labels.forEach((mesh) => {
      group.remove(mesh);
      disposeObject(mesh);
    });
    state.tubes.forEach((mesh) => {
      group.remove(mesh);
      disposeObject(mesh);
    });
    state.packetGroups.forEach((packetSet) => {
      packetSet.forEach((packet) => {
        group.remove(packet);
        disposeObject(packet);
      });
    });
    if (state.emptyOrb) {
      group.remove(state.emptyOrb);
      disposeObject(state.emptyOrb);
    }

    state.nodes = [];
    state.labels = [];
    state.tubes = [];
    state.packetGroups = [];
    state.curves = [];
    state.emptyOrb = null;

    if (pipeline.length < 3) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 24, 24),
        new THREE.MeshStandardMaterial({
          color: 0x7c3aed,
          emissive: 0xa855f7,
          emissiveIntensity: 0.8
        })
      );
      orb.position.set(0, 0, 0);
      group.add(orb);
      state.emptyOrb = orb;
      return;
    }

    const nodePositions = [];
    const startX = -((pipeline.length - 1) * 1.5);

    for (let i = 0; i < pipeline.length; i += 1) {
      const node = pipeline[i];
      const color = CIPHER_COLORS[node.cipherKey] || 0x7c3aed;
      const x = startX + i * 3;
      nodePositions.push(new THREE.Vector3(x, 0, 0));

      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, 0.8),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.3,
          metalness: 0.2,
          roughness: 0.4
        })
      );
      box.position.set(x, 0, 0);
      group.add(box);
      state.nodes.push(box);

      const labelData = createTextPlane(node.cipherKey.toUpperCase());
      if (labelData) {
        labelData.mesh.position.set(x, 0.9, 0);
        group.add(labelData.mesh);
        state.labels.push(labelData.mesh);
      }
    }

    for (let i = 0; i < nodePositions.length - 1; i += 1) {
      const a = nodePositions[i];
      const b = nodePositions[i + 1];
      const mid = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.2, 0);
      const curve = new THREE.CatmullRomCurve3([a.clone(), mid, b.clone()]);

      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 24, 0.03, 12, false),
        new THREE.MeshStandardMaterial({
          color: PIPE_COLOR.clone(),
          transparent: true,
          opacity: 0.95,
          emissive: 0x3b1e80,
          emissiveIntensity: 0.35
        })
      );

      group.add(tube);
      state.tubes.push(tube);
      state.curves.push(curve);

      const packets = [];
      for (let p = 0; p < 3; p += 1) {
        const packet = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 16, 16),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xa855f7,
            emissiveIntensity: 1
          })
        );

        const glowLight = new THREE.PointLight(0xa855f7, 0.5, 1);
        packet.add(glowLight);
        group.add(packet);
        packets.push(packet);
      }

      state.packetGroups.push(packets);
    }
  }, [pipelineKey, pipeline]);

  const isEmpty = pipeline.length < 3;

  return React.createElement(
    "div",
    {
      style: {
        position: "relative",
        width: "100%",
        height: "200px",
        border: "1px solid #2f2f42",
        borderRadius: "14px",
        overflow: "hidden",
        background: "radial-gradient(circle at center, rgba(124,58,237,0.1), rgba(15,15,19,0.1))"
      }
    },
    React.createElement("div", { ref: mountRef, style: { width: "100%", height: "100%" } }),
    isEmpty
      ? React.createElement(
          "div",
          {
            style: {
              position: "absolute",
              left: "50%",
              bottom: "10px",
              transform: "translateX(-50%)",
              color: "#8b92a5",
              fontSize: "12px"
            }
          },
          "Add 3+ nodes to see your pipeline"
        )
      : null
  );
}
