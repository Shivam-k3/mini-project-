import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const NODE_COUNT = 24;
const CONNECTION_COUNT = 12;
const PARTICLE_COUNT = 800;
const EARTH_RADIUS = 2.2;

function randomSpherePoint(radius) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi)
  );
}

function Earth() {
  const meshRef = useRef();
  const materialRef = useRef();

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <group ref={meshRef}>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <shaderMaterial
          ref={materialRef}
          uniforms={{
            uTime: { value: 0 },
          }}
          vertexShader={`
            varying vec2 vUv;
            varying vec3 vNormal;
            void main() {
              vUv = uv;
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vUv;
            varying vec3 vNormal;
            uniform float uTime;

            void main() {
              float lat = vUv.y * 3.14159;
              float lon = vUv.x * 6.28318;
              float continent = sin(lat * 4.0 + cos(lon * 3.0)) * 0.5 + 0.5;
              continent = smoothstep(0.35, 0.65, continent);
              continent *= 1.0 - smoothstep(0.0, 0.3, abs(vUv.y - 0.5) * 2.0 - 0.3);

              vec3 oceanColor = vec3(0.04, 0.12, 0.22);
              vec3 landColor = vec3(0.05, 0.25, 0.08);

              vec3 color = mix(oceanColor, landColor, continent);

              vec3 lightDir = normalize(vec3(1.0, 0.5, 1.0));
              float diff = max(dot(vNormal, lightDir), 0.15);
              color *= diff;

              float glow = 0.03 + 0.02 * sin(uTime * 0.5);
              color += vec3(0.02, glow * 0.8, 0.01);

              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[EARTH_RADIUS * 1.005, 32, 32]} />
        <meshBasicMaterial wireframe color="#22c55e" transparent opacity={0.08} />
      </mesh>

      <mesh>
        <sphereGeometry args={[EARTH_RADIUS * 1.12, 32, 32]} />
        <meshBasicMaterial
          color="#22c55e"
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

function SensorNodes({ pulsePhase }) {
  const positions = useMemo(() => {
    const pts = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const p = randomSpherePoint(EARTH_RADIUS * 1.15);
      pts.push(p.x, p.y, p.z);
    }
    return new Float32Array(pts);
  }, []);

  const nodeRefs = useMemo(() => {
    const refs = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      refs.push(null);
    }
    return refs;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={NODE_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        color="#22c55e"
        sizeAttenuation
        transparent
        opacity={0.9}
      />
    </points>
  );
}

function PulseRings() {
  const ringRef = useRef();
  const ringRef2 = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      const s = 1 + ((t * 0.3) % 1) * 0.5;
      ringRef.current.scale.setScalar(s);
      ringRef.current.material.opacity = 0.4 * (1 - ((t * 0.3) % 1));
    }
    if (ringRef2.current) {
      const s = 1 + (((t * 0.3) + 0.5) % 1) * 0.5;
      ringRef2.current.scale.setScalar(s);
      ringRef2.current.material.opacity = 0.4 * (1 - (((t * 0.3) + 0.5) % 1));
    }
  });

  return (
    <>
      <mesh ref={ringRef} rotation-x={Math.PI / 2}>
        <ringGeometry args={[EARTH_RADIUS * 1.2, EARTH_RADIUS * 1.25, 64]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ringRef2} rotation-x={Math.PI / 2} rotation-z={0.5}>
        <ringGeometry args={[EARTH_RADIUS * 1.2, EARTH_RADIUS * 1.25, 64]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

function ConnectionLine({ points, color }) {
  const ref = useRef();
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(points.length * 3);
    points.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [points]);

  return (
    <line ref={ref}>
      <bufferGeometry attach="geometry" {...geom.attributes} />
      <lineBasicMaterial attach="material" color={color} transparent opacity={0.2} />
    </line>
  );
}

function Connections() {
  const pairs = useMemo(() => {
    const result = [];
    for (let i = 0; i < CONNECTION_COUNT; i++) {
      const a = randomSpherePoint(EARTH_RADIUS * 1.15);
      const b = randomSpherePoint(EARTH_RADIUS * 1.4);
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      mid.add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8,
      ));

      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      result.push(curve.getPoints(20));
    }
    return result;
  }, []);

  return (
    <group>
      {pairs.map((pts, i) => (
        <ConnectionLine key={i} points={pts} color="#22c55e" />
      ))}
    </group>
  );
}

function Particles() {
  const count = PARTICLE_COUNT;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.5 + Math.random() * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  const ref = useRef();

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#34d399"
        sizeAttenuation
        transparent
        opacity={0.5}
      />
    </points>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <pointLight position={[-3, 1, -3]} intensity={0.4} color="#22c55e" />
      <Earth />
      <SensorNodes />
      <PulseRings />
      <Connections />
      <Particles />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.8}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 4}
        target={[0, 0, 0]}
      />
    </>
  );
}

export default function EarthCanvas() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 1.5, 6], fov: 45, near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
