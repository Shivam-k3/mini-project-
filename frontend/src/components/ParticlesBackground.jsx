import { useEffect, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

export default function ParticlesBackground({ id = 'env-particles' }) {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setInit(true));
  }, []);

  if (!init) return null;

  return (
    <Particles
      id={id}
      className="absolute inset-0 pointer-events-none"
      options={{
        fullScreen: false,
        fpsLimit: 30,
        particles: {
          number: { value: 40, density: { enable: true } },
          color: { value: ['#22c55e', '#34d399', '#10b981'] },
          shape: { type: 'circle' },
          opacity: { value: 0.15, random: true },
          size: { value: { min: 1, max: 3 }, random: true },
          move: {
            enable: true,
            speed: 0.3,
            direction: 'none',
            random: true,
            straight: false,
            outModes: { default: 'bounce' },
            attract: { enable: true, rotateX: 600, rotateY: 600 },
          },
          links: {
            enable: true,
            distance: 150,
            color: '#22c55e',
            opacity: 0.06,
            width: 0.5,
          },
        },
        interactivity: {
          events: {
            onHover: { enable: true, mode: 'repulse' },
            resize: true,
          },
          modes: {
            repulse: { distance: 80, duration: 0.4 },
          },
        },
        detectRetina: false,
      }}
    />
  );
}
