import { useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';

const LOADING_JSON = {
  v: '5.5.7',
  fr: 30,
  ip: 0,
  op: 60,
  w: 120,
  h: 120,
  nm: 'Leaf Loading',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 0,
      ty: 4,
      nm: 'Leaf',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 1, k: [{ t: 0, s: [0] }, { t: 30, s: [15] }, { t: 60, s: [0] }] },
        p: { a: 0, k: [60, 60, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [80, 80] }, { t: 30, s: [100, 100] }, { t: 60, s: [80, 80] }] },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'el',
              p: { a: 0, k: [0, 8] },
              s: { a: 0, k: [24, 24] },
              sw: { a: 0, k: 3 },
              sc: { a: 0, k: '#22c55e' },
              fill: { a: 0, k: '#22c55e' },
            },
            {
              ty: 'el',
              p: { a: 0, k: [8, -4] },
              s: { a: 0, k: [18, 18] },
              sw: { a: 0, k: 2.5 },
              sc: { a: 0, k: '#34d399' },
              fill: { a: 0, k: '#34d399' },
            },
            {
              ty: 'el',
              p: { a: 0, k: [-8, -4] },
              s: { a: 0, k: [18, 18] },
              sw: { a: 0, k: 2.5 },
              sc: { a: 0, k: '#10b981' },
              fill: { a: 0, k: '#10b981' },
            },
          ],
        },
      ],
    },
  ],
};

const SUCCESS_JSON = {
  v: '5.5.7',
  fr: 30,
  ip: 0,
  op: 40,
  w: 120,
  h: 120,
  nm: 'Checkmark',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 0,
      ty: 4,
      nm: 'Check',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [60, 60, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 20, s: [110, 110] }, { t: 40, s: [100, 100] }] },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'el',
              p: { a: 0, k: [0, 0] },
              s: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 20, s: [60, 60] }, { t: 40, s: [50, 50] }] },
              sw: { a: 0, k: 4 },
              sc: { a: 0, k: '#22c55e' },
              fill: { a: 0, k: '#22c55e00' },
            },
          ],
        },
      ],
    },
  ],
};

export function LottieLoading({ size = 80 }) {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <Lottie animationData={LOADING_JSON} loop autoplay style={{ width: size, height: size }} />
    </div>
  );
}

export function LottieSuccess({ size = 80, onComplete }) {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <Lottie
        animationData={SUCCESS_JSON}
        loop={false}
        autoplay
        style={{ width: size, height: size }}
        onComplete={onComplete}
      />
    </div>
  );
}
